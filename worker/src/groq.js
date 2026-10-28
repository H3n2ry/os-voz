// ─────────────────────────────────────────────────────────────────────────────
// Camada anti-descontinuação da Groq.
//
// Modelos hospedados são desligados em data marcada (a Groq desligou o
// llama-3.3-70b-versatile em 16/08/2026 e o app parou de gerar OS). Aqui o
// modelo deixa de ser uma string fixa no meio do código e passa a ser resolvido
// em tempo de execução, com cinco camadas de defesa:
//
//   1. Override por variável de ambiente → conserto em minutos, sem tocar no código
//   2. Lista de preferência              → ordem explícita de quem assume
//   3. Descoberta dinâmica (GET /models) → só usa modelo que a Groq ainda lista
//   4. Retry automático                  → 'model_decommissioned' troca de modelo
//                                          na mesma requisição; o técnico não vê erro
//   5. Cron semanal + /health/models     → avisa antes de virar problema
//
// Resultado: mesmo que TODOS os modelos listados abaixo sejam desligados de uma
// vez, o app assume qualquer modelo compatível que a conta ainda tenha — sem
// deploy e sem intervenção.
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://api.groq.com/openai/v1'

// Ordem de preferência. O primeiro que estiver vivo é o escolhido.
// Modelos de produção no topo; preview só como última linha de defesa.
// Ao revisar, confira https://console.groq.com/docs/deprecations
export const PREFERIDOS = {
  chat: [
    'openai/gpt-oss-120b',  // produção — substituto oficial do llama-3.3-70b-versatile
    'openai/gpt-oss-20b',   // produção — menor, mesma família
    'qwen/qwen3.6-27b',     // preview  — rede de segurança
  ],
  transcribe: [
    'whisper-large-v3-turbo', // produção
    'whisper-large-v3',       // produção
  ],
}

// Se todos os preferidos morrerem, serve qualquer modelo vivo compatível.
const SERVE_PARA = {
  chat: (id) => !/whisper|tts|orpheus|guard|embed|rerank/i.test(id),
  transcribe: (id) => /whisper/i.test(id),
}

// Trava manual por env var — a saída de emergência mais rápida que existe.
const OVERRIDE = { chat: 'GROQ_CHAT_MODEL', transcribe: 'GROQ_TRANSCRIBE_MODEL' }

const TTL_MS = 10 * 60 * 1000
let vivos = { ids: null, at: 0 }
const mortos = new Set() // modelos que a API já rejeitou nesta isolate

export class GroqError extends Error {
  constructor({ status, corpo }) {
    super(`Groq (${status}): ${String(corpo).slice(0, 300)}`)
    this.status = status
  }
}

// ─── Descoberta ──────────────────────────────────────────────────────────────

async function listarVivos(env, force = false) {
  if (!force && vivos.ids && Date.now() - vivos.at < TTL_MS) return vivos.ids
  try {
    const res = await fetch(`${API}/models`, {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    })
    if (!res.ok) return vivos.ids
    const { data } = await res.json()
    const ids = new Set((data ?? []).map((m) => m.id).filter(Boolean))
    if (ids.size === 0) return vivos.ids
    vivos = { ids, at: Date.now() }
    return ids
  } catch {
    return vivos.ids // sem rede: segue com o que já sabia (ou null = tenta às cegas)
  }
}

// Candidatos em ordem de tentativa, já sem os que morreram.
async function candidatos(env, tipo, force = false) {
  const override = (env[OVERRIDE[tipo]] ?? '').trim()
  const preferidos = [override, ...PREFERIDOS[tipo]]
    .filter((id, i, arr) => id && arr.indexOf(id) === i && !mortos.has(id))

  const cacheFresco = vivos.ids && Date.now() - vivos.at < TTL_MS
  // Caminho feliz: não gasta uma chamada extra para confirmar o óbvio. Se o
  // modelo tiver morrido, o retry em comFallback() descobre e corrige sozinho.
  if (!force && !cacheFresco && preferidos.length) return preferidos

  const ids = await listarVivos(env, force)
  if (!ids) return preferidos

  const confirmados = preferidos.filter((id) => ids.has(id))
  const reservas = [...ids]
    .filter((id) => SERVE_PARA[tipo](id) && !mortos.has(id) && !confirmados.includes(id))
    .sort()

  return [...confirmados, ...reservas]
}

// ─── Detecção de falha ───────────────────────────────────────────────────────

// "Esse modelo não existe mais" → vale trocar de modelo e tentar de novo.
function modeloMorreu(status, corpo) {
  if (status !== 400 && status !== 404) return false
  return /model_decommissioned|model_not_found|decommission|no longer supported|does not exist/i.test(corpo)
}

// "Esse modelo não aceita esse parâmetro" → vale repetir sem os opcionais.
function parametroRejeitado(status, corpo) {
  if (status !== 400) return false
  return /reasoning_effort|response_format|unsupported_(parameter|value)|unrecognized|invalid.{0,20}(parameter|field|argument)/i.test(corpo)
}

// Parâmetros que só alguns modelos aceitam. Se derem 400, a chamada é repetida
// sem eles — melhor uma resposta sem JSON mode do que nenhuma resposta.
function opcionais(id, response_format) {
  return {
    ...(response_format ? { response_format } : {}),
    ...(/gpt-oss/i.test(id) ? { reasoning_effort: 'low' } : {}),
  }
}

// ─── Executor com troca automática de modelo ─────────────────────────────────

// `chamar(modelo, comOpcionais)` deve devolver a Response da Groq.
async function comFallback(env, tipo, chamar) {
  const tentados = new Set()
  let erro = { status: 502, corpo: 'Nenhum modelo Groq disponível no momento' }
  let trocou = false

  for (let i = 0; i < 4; i++) {
    const lista = await candidatos(env, tipo, i > 0)
    const modelo = lista.find((id) => !tentados.has(id))
    if (!modelo) break
    tentados.add(modelo)

    let res = await chamar(modelo, true)
    if (res.ok) return { res, modelo, trocou }
    let corpo = await res.text()

    if (parametroRejeitado(res.status, corpo)) {
      console.warn(`[groq] "${modelo}" recusou um parâmetro opcional — repetindo sem ele`)
      res = await chamar(modelo, false)
      if (res.ok) return { res, modelo, trocou }
      corpo = await res.text()
    }

    // Erro que não é de modelo (cota, chave, áudio inválido): propaga como está.
    if (!modeloMorreu(res.status, corpo)) return { res: null, erro: { status: res.status, corpo } }

    console.warn(`[groq] modelo "${modelo}" indisponível — trocando. ${corpo.slice(0, 160)}`)
    mortos.add(modelo)
    erro = { status: res.status, corpo }
    trocou = true
  }

  return { res: null, erro }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function groqChat(env, { messages, max_completion_tokens = 2048, response_format }) {
  const { res, modelo, erro } = await comFallback(env, 'chat', (id, comOpcionais) =>
    fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: id,
        messages,
        max_completion_tokens,
        ...(comOpcionais ? opcionais(id, response_format) : {}),
      }),
    })
  )
  if (!res) throw new GroqError(erro)
  return { data: await res.json(), modelo }
}

export async function groqTranscribe(env, arquivo, { language = 'pt' } = {}) {
  const { res, modelo, erro } = await comFallback(env, 'transcribe', (id) => {
    const form = new FormData()
    form.append('file', arquivo, 'audio.webm')
    form.append('model', id)
    form.append('language', language)
    form.append('response_format', 'json')
    return fetch(`${API}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    })
  })
  if (!res) throw new GroqError(erro)
  return { data: await res.json(), modelo }
}

// Extrai o objeto JSON da resposta mesmo se vier com cerca de markdown ou texto
// em volta — o que acontece quando o modelo da vez não suporta JSON mode.
export function extrairJSON(texto) {
  const limpo = String(texto ?? '').trim()
  if (!limpo) throw new Error('A IA devolveu uma resposta vazia')

  try {
    return JSON.parse(limpo)
  } catch { /* tenta recuperar abaixo */ }

  const semCerca = limpo.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(semCerca)
  } catch { /* tenta recuperar abaixo */ }

  const inicio = semCerca.indexOf('{')
  const fim = semCerca.lastIndexOf('}')
  if (inicio !== -1 && fim > inicio) return JSON.parse(semCerca.slice(inicio, fim + 1))

  throw new Error('A IA não devolveu um JSON válido')
}

// ─── Diagnóstico (rota /health/models e cron semanal) ────────────────────────

export async function diagnostico(env) {
  // Revalida de verdade, mas no máximo uma vez por minuto — a rota é pública e
  // não deve virar um martelo contra a API da Groq.
  const ids = await listarVivos(env, Date.now() - vivos.at > 60_000)
  const modelos = {}

  for (const tipo of Object.keys(PREFERIDOS)) {
    const lista = await candidatos(env, tipo, false)
    const emUso = lista[0] ?? null
    const ideal = (env[OVERRIDE[tipo]] ?? '').trim() || PREFERIDOS[tipo][0]
    modelos[tipo] = {
      em_uso: emUso,
      ideal,
      usando_reserva: !!emUso && emUso !== ideal,
      preferidos_mortos: ids ? PREFERIDOS[tipo].filter((id) => !ids.has(id)) : null,
      alternativas: lista.slice(1, 4),
    }
  }

  // Sem lista de modelos = não deu para falar com a Groq (chave inválida, cota,
  // rede). O app segue tentando às cegas, mas isso NÃO é um estado saudável.
  const semContato = !ids
  const alerta = semContato || Object.values(modelos).some(
    (m) => !m.em_uso || m.usando_reserva || (m.preferidos_mortos?.length ?? 0) > 0
  )

  return {
    ok: !alerta,
    ...(semContato
      ? { aviso: 'Não foi possível listar os modelos da Groq — verifique GROQ_API_KEY e a cota da conta.' }
      : {}),
    modelos,
    modelos_na_conta: ids ? ids.size : null,
    verificado_em: new Date().toISOString(),
  }
}
