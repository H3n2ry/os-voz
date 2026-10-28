// Testa a camada anti-descontinuação sem tocar na API real da Groq.
// Cada cenário importa o módulo de novo (?v=N) para zerar o cache interno.

const MOD = new URL('../src/groq.js', import.meta.url)
const env = { GROQ_API_KEY: 'fake', GROQ_CHAT_MODEL: '', GROQ_TRANSCRIBE_MODEL: '' }

let v = 0
const carregar = () => import(`${MOD.href}?v=${++v}`)

function resposta(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
    json: async () => (typeof corpo === 'string' ? JSON.parse(corpo) : corpo),
  }
}

const decomissionado = (m) => resposta(400, {
  error: {
    message: `The model \`${m}\` has been decommissioned and is no longer supported.`,
    type: 'invalid_request_error',
    code: 'model_decommissioned',
  },
})

const respostaOK = (m) => resposta(200, {
  choices: [{ message: { content: JSON.stringify({ valores: { cliente: 'Stamptech' } }) } }],
  model: m,
})

// Monta um fetch falso. `vivosNaConta` = o que GET /models devolve.
// `politica(modelo, body)` decide a resposta do chat.
function stubFetch({ vivosNaConta, politica }) {
  const chamadas = []
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).endsWith('/models')) {
      chamadas.push({ tipo: 'models' })
      return resposta(200, { data: vivosNaConta.map((id) => ({ id })) })
    }
    const body = JSON.parse(opts.body)
    chamadas.push({ tipo: 'chat', modelo: body.model, params: Object.keys(body) })
    return politica(body.model, body)
  }
  return chamadas
}

let falhas = 0
function checar(nome, condicao, detalhe = '') {
  console.log(`${condicao ? '  OK  ' : ' FALHA'} │ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!condicao) falhas++
}

// ── 1. Caminho feliz ─────────────────────────────────────────────────────────
{
  const { groqChat } = await carregar()
  const chamadas = stubFetch({
    vivosNaConta: ['openai/gpt-oss-120b'],
    politica: (m) => respostaOK(m),
  })
  const { modelo } = await groqChat(env, { messages: [], response_format: { type: 'json_object' } })
  checar('1. Caminho feliz usa o modelo preferido', modelo === 'openai/gpt-oss-120b', modelo)
  checar('1. Não gasta chamada extra em GET /models', !chamadas.some((c) => c.tipo === 'models'))
}

// ── 2. O cenário de hoje: o preferido foi desligado ──────────────────────────
{
  const { groqChat } = await carregar()
  const chamadas = stubFetch({
    vivosNaConta: ['openai/gpt-oss-20b', 'whisper-large-v3-turbo'],
    politica: (m) => (m === 'openai/gpt-oss-120b' ? decomissionado(m) : respostaOK(m)),
  })
  const { modelo } = await groqChat(env, { messages: [] })
  checar('2. Modelo desligado → assume o próximo sozinho', modelo === 'openai/gpt-oss-20b', modelo)
  checar('2. Revalidou a lista real após a falha', chamadas.some((c) => c.tipo === 'models'))
}

// ── 3. Todos os preferidos desligados de uma vez ─────────────────────────────
{
  const { groqChat } = await carregar()
  stubFetch({
    vivosNaConta: ['algum-modelo-novo-2027', 'whisper-large-v3'],
    politica: (m) => (m.startsWith('algum-modelo') ? respostaOK(m) : decomissionado(m)),
  })
  const { modelo } = await groqChat(env, { messages: [] })
  checar('3. Todos mortos → adota modelo desconhecido da conta', modelo === 'algum-modelo-novo-2027', modelo)
}

// ── 4. Erro que NÃO é de modelo não deve queimar a lista ─────────────────────
{
  const { groqChat, GroqError } = await carregar()
  const chamadas = stubFetch({
    vivosNaConta: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    politica: () => resposta(401, { error: { message: 'Invalid API Key', code: 'invalid_api_key' } }),
  })
  let capturado = null
  try { await groqChat(env, { messages: [] }) } catch (e) { capturado = e }
  const tentativas = chamadas.filter((c) => c.tipo === 'chat').length
  checar('4. Chave inválida propaga como GroqError', capturado instanceof GroqError, capturado?.message?.slice(0, 40))
  checar('4. Não sai testando todo modelo à toa', tentativas === 1, `${tentativas} tentativa(s)`)
}

// ── 5. Modelo que não aceita parâmetro opcional ──────────────────────────────
{
  const { groqChat } = await carregar()
  const chamadas = stubFetch({
    vivosNaConta: ['openai/gpt-oss-120b'],
    politica: (m, body) =>
      body.response_format
        ? resposta(400, { error: { message: 'response_format is not supported', code: 'unsupported_parameter' } })
        : respostaOK(m),
  })
  const { modelo } = await groqChat(env, { messages: [], response_format: { type: 'json_object' } })
  const segunda = chamadas.filter((c) => c.tipo === 'chat')[1]
  checar('5. Parâmetro recusado → repete sem ele, mesmo modelo', modelo === 'openai/gpt-oss-120b')
  checar('5. A repetição realmente removeu o opcional', !segunda?.params.includes('response_format'))
}

// ── 6. Override por env var manda em tudo ────────────────────────────────────
{
  const { groqChat } = await carregar()
  stubFetch({ vivosNaConta: ['travado-manualmente'], politica: (m) => respostaOK(m) })
  const { modelo } = await groqChat({ ...env, GROQ_CHAT_MODEL: 'travado-manualmente' }, { messages: [] })
  checar('6. GROQ_CHAT_MODEL tem prioridade', modelo === 'travado-manualmente', modelo)
}

// ── 7. Resposta suja ainda vira JSON ────────────────────────────────────────
{
  const { extrairJSON } = await carregar()
  const casos = [
    ['puro', '{"valores":{"cliente":"A"}}'],
    ['com cerca markdown', '```json\n{"valores":{"cliente":"A"}}\n```'],
    ['com texto em volta', 'Claro! Segue:\n{"valores":{"cliente":"A"}}\nEspero ter ajudado.'],
  ]
  for (const [nome, texto] of casos) {
    let okc = false
    try { okc = extrairJSON(texto).valores.cliente === 'A' } catch { okc = false }
    checar(`7. extrairJSON — ${nome}`, okc)
  }
  let lancou = false
  try { extrairJSON('') } catch { lancou = true }
  checar('7. extrairJSON — resposta vazia lança erro claro', lancou)
}

// ── 8. Transcrição tem a mesma proteção ─────────────────────────────────────
{
  const { groqTranscribe } = await carregar()
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).endsWith('/models')) {
      return resposta(200, { data: [{ id: 'whisper-large-v3' }] })
    }
    const m = opts.body.get('model')
    return m === 'whisper-large-v3-turbo'
      ? decomissionado(m)
      : resposta(200, { text: 'troquei o disjuntor do quadro' })
  }
  const { data, modelo } = await groqTranscribe(env, new Blob(['audio']), {})
  checar('8. Whisper desligado → cai no whisper reserva', modelo === 'whisper-large-v3', modelo)
  checar('8. Transcrição preservada', data.text.includes('disjuntor'))
}

console.log(falhas === 0 ? '\nTodos os cenários passaram.' : `\n${falhas} verificação(ões) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
