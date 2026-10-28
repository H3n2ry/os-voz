import { groqChat, groqTranscribe, extrairJSON, diagnostico, GroqError } from './groq.js'

const CORS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

// Carimbo de tempo do banco: ISO-8601 explicitamente em UTC ("...Z").
// O formato antigo do datetime('now') — "2026-08-20 11:52:33" — é UTC sem dizer
// que é, e o navegador lia como hora local, jogando o horário 3h para frente.
const AGORA_UTC = "strftime('%Y-%m-%dT%H:%M:%SZ','now')"

// A origem permitida sai de ALLOWED_ORIGINS (lista separada por vírgula) no
// wrangler.toml. Vazio = libera geral, que é o comportamento histórico.
function origemPermitida(request, env) {
  const lista = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (lista.length === 0) return { 'Access-Control-Allow-Origin': '*' }
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin && lista.includes(origin) ? origin : lista[0],
    Vary: 'Origin',
  }
}

const FORMALIZA_PROMPT = `Você formaliza relatos informais de técnicos de campo, transformando-os nos valores dos campos de uma Ordem de Serviço.

Receberá:
1. CAMPOS: a lista de campos do documento, cada um com uma "key" e um "label".
2. RELATO: descrição informal (voz ou texto) do serviço executado.

Tarefa:
- Para cada campo, extraia do relato a informação correspondente e escreva o valor em linguagem formal, técnica e concisa.
- Use o "label" de cada campo para entender o que ele espera (ex.: "Cliente", "Endereço", "Data", "Serviço executado", "Materiais utilizados", "Observações").
- Extrair NÃO é inventar. Se o relato menciona a informação de forma coloquial, ela EXISTE e deve ser extraída:
  "na loja do joão" -> Cliente: "João" | "lá no mercado do zé" -> Cliente: "Mercado do Zé"
  "na casa da dona maria" -> Cliente: "Dona Maria" | "na avenida paulista" -> Endereço: "Avenida Paulista"
  Só devolva "" quando o relato realmente não disser nada sobre aquele campo.
- O relato vem de transcrição de voz: corrija a grafia de nomes próprios ("joao" -> "João", "sao paulo" -> "São Paulo").
- Cada informação vai no campo mais específico que couber. Não repita em "Observações" algo que já foi para "Cliente", "Serviço executado" ou "Materiais utilizados" — "Observações" é só para pendências, recomendações e avisos ao cliente.
- Datas no formato DD/MM/AAAA. Para campos de data/hora sem valor no relato, use a data/hora atual fornecida no contexto.
- Não inclua o rótulo dentro do valor (ex.: para o campo "Cliente" responda "Stamptech", não "Cliente: Stamptech").

Exemplo (ilustrativo — use sempre as keys que vierem em CAMPOS).
RELATO: "fui na loja do joao na paulista, troquei o disjuntor geral que tava queimado, botei dois de 40 amperes, avisei ele que o chuveiro do fundo vai precisar de cabo mais grosso"
{ "valores": {
  "cliente": "João",
  "endereco": "Avenida Paulista",
  "servico": "Substituição do disjuntor geral queimado e instalação de dois disjuntores de 40 A.",
  "materiais": "1 disjuntor geral; 2 disjuntores de 40 A",
  "observacoes": "Recomendada a substituição do cabo de alimentação do chuveiro dos fundos por bitola maior."
} }

Responda APENAS com JSON, sem markdown e sem blocos de código, no formato:
{ "valores": { "<key>": "<valor>", ... } }
Inclua exatamente as keys fornecidas em CAMPOS.`

// ─── Utilitários ─────────────────────────────────────────────────────────────

function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// A coluna email é UNIQUE e sensível a maiúsculas: sem normalizar, "Joao@x.com"
// e "joao@x.com" viram duas contas, e quem cadastrou com maiúscula não loga.
function normalizarEmail(valor) {
  return String(valor ?? '').trim().toLowerCase()
}

// ─── JWT (Web Crypto API) ─────────────────────────────────────────────────────

function b64url(buf) {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Aceita base64url e base64 padrão — os tokens antigos continuam válidos.
function b64urlBytes(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function textoParaB64url(texto) {
  return b64url(new TextEncoder().encode(texto))
}

// Tokens novos vêm em UTF-8. Os antigos foram gerados com btoa(JSON.stringify()),
// que grava Latin-1 — daí o fallback, para não deslogar quem tem nome acentuado.
function jsonDoSegmento(seg) {
  const bytes = b64urlBytes(seg)
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('�')) return JSON.parse(utf8)
  let latin1 = ''
  for (const b of bytes) latin1 += String.fromCharCode(b)
  return JSON.parse(latin1)
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signJWT(payload, secret) {
  // base64url de bytes UTF-8: nome com acento ou emoji não quebra mais a geração.
  const header = textoParaB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = textoParaB64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64url(sig)}`
}

export async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const key = await importHmacKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC', key, b64urlBytes(sig), new TextEncoder().encode(`${header}.${body}`)
    )
    if (!valid) return null
    const payload = jsonDoSegmento(body)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ─── Senha (PBKDF2) ──────────────────────────────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256)
  const toHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${toHex(salt)}:${toHex(hash)}`
}

// Comparação em tempo constante: sair no primeiro byte diferente vaza, pelo
// tempo de resposta, o quanto de um hash o atacante já acertou.
function mesmoHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored ?? '').split(':')
  // Registro corrompido não pode virar 500 na tela de login.
  if (!saltHex || !hashHex || !/^[0-9a-f]+$/i.test(saltHex) || saltHex.length % 2) return false

  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256)
  const newHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return mesmoHash(newHex, hashHex)
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function getAuth(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return verifyJWT(auth.slice(7), env.JWT_SECRET)
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  const body = await request.json()
  const email = normalizarEmail(body.email)
  const nome = String(body.nome ?? '').trim()
  const senha = String(body.senha ?? '')

  if (!email || !senha || !nome) return err('Campos obrigatórios: email, senha, nome')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err('E-mail inválido')
  if (senha.length < 8) return err('A senha precisa ter pelo menos 8 caracteres')
  if (nome.length < 2) return err('Informe seu nome completo')

  const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first()
  if (existing) return err('E-mail já cadastrado')

  const id = crypto.randomUUID()
  const password_hash = await hashPassword(senha)
  await env.DB.prepare(
    `INSERT INTO users (id, email, nome, password_hash, created_at) VALUES (?, ?, ?, ?, ${AGORA_UTC})`
  ).bind(id, email, nome, password_hash).run()

  return ok({ ok: true })
}

async function handleLogin(request, env) {
  const { email, senha } = await request.json()
  // lower() na coluna também: protege contas antigas gravadas com maiúscula,
  // que de outro modo ficariam sem conseguir entrar.
  const user = await env.DB.prepare('SELECT * FROM users WHERE lower(email) = ?')
    .bind(normalizarEmail(email)).first()
  if (!user) return err('Credenciais inválidas', 401)

  const valid = await verifyPassword(String(senha ?? ''), user.password_hash)
  if (!valid) return err('Credenciais inválidas', 401)

  const token = await signJWT(
    {
      sub: user.id,
      email: user.email,
      nome: user.nome,
      is_admin: user.is_admin,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90,
    },
    env.JWT_SECRET
  )

  return ok({
    token,
    user: { id: user.id, email: user.email, nome: user.nome, funcao: user.funcao, is_admin: !!user.is_admin },
  })
}

async function handleMe(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const user = await env.DB.prepare(
    'SELECT id, email, nome, funcao, is_admin FROM users WHERE id = ?'
  ).bind(payload.sub).first()
  if (!user) return err('Usuário não encontrado', 404)

  return ok({ user: { ...user, is_admin: !!user.is_admin } })
}

async function handleListOS(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const { results } = await env.DB.prepare(
    'SELECT * FROM ordens_servico WHERE tecnico_id = ? ORDER BY created_at DESC'
  ).bind(payload.sub).all()

  return ok({ ordens: results.map(parseOS) })
}

// Espia o próximo número sequencial sem consumi-lo (para exibir na prévia).
async function handleProximoNumero(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const row = await env.DB.prepare('SELECT seq FROM os_sequence WHERE id = 1').first()
  return ok({ numero: (row?.seq ?? 0) + 1 })
}

async function handleCreateOS(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const body = camposDaOS(await request.json())
  const id = crypto.randomUUID()

  // Congela o cabeçalho vigente dentro da própria OS. Sem isso o painel do
  // gestor gerava PDF sem timbre (ele não tem o molde do técnico), e trocar a
  // logo hoje mudava retroativamente o PDF de OS antigas.
  const molde = await env.DB.prepare('SELECT * FROM moldes WHERE user_id = ?').bind(payload.sub).first()
  const cabecalho = molde ? JSON.stringify(cabecalhoDoMolde(molde)) : null

  // Incremento e inserção no MESMO batch: o D1 roda o batch em uma única
  // transação. Isso garante as duas coisas que faltavam quando eram dois
  // comandos soltos:
  //   · duas OS salvas ao mesmo tempo nunca recebem o mesmo número
  //   · se o INSERT falhar, o rollback devolve o número (não queima a sequência)
  // O número vem de um subselect para ser lido já incrementado, dentro da transação.
  const [, inserida] = await env.DB.batch([
    env.DB.prepare('UPDATE os_sequence SET seq = seq + 1 WHERE id = 1'),
    env.DB.prepare(`
      INSERT INTO ordens_servico
        (id, numero_os, tecnico_id, tecnico_nome, cliente, endereco, tipo_servico,
         descricao_servico, materiais_utilizados, observacoes, valores, status, pdf_url,
         esboco_foto_url, audio_transcricao, cabecalho, created_at)
      VALUES (?, (SELECT seq FROM os_sequence WHERE id = 1), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'gerada', ?, ?, ?, ?, ${AGORA_UTC})
      RETURNING *
    `).bind(
      id, payload.sub, payload.nome,
      body.cliente, body.endereco, body.tipo_servico,
      body.descricao_servico, JSON.stringify(body.materiais_utilizados ?? []),
      body.observacoes ?? null, JSON.stringify(body.valores ?? {}),
      body.pdf_url ?? null, body.esboco_foto_url ?? null,
      body.audio_transcricao, cabecalho
    ),
  ])

  const os = inserida.results?.[0]
    ?? await env.DB.prepare('SELECT * FROM ordens_servico WHERE id = ?').bind(id).first()
  return ok({ os: parseOS(os) })
}

// cliente, endereco, tipo_servico, descricao_servico e audio_transcricao são
// NOT NULL na tabela. O app manda null quando a IA não acha o campo no relato
// (ex.: técnico que nunca fala o endereço) e o INSERT inteiro falhava com 500 —
// a OS simplesmente não era salva. Campo vazio vira "", nunca null.
export function camposDaOS(body) {
  const texto = (v) => (v == null ? '' : String(v))
  return {
    ...body,
    cliente: texto(body?.cliente),
    endereco: texto(body?.endereco),
    tipo_servico: texto(body?.tipo_servico),
    descricao_servico: texto(body?.descricao_servico),
    audio_transcricao: texto(body?.audio_transcricao),
  }
}

async function handleUpdateStatus(request, env, id) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)
  if (!payload.is_admin) return err('Acesso restrito a administradores', 403)

  const { status } = await request.json()
  if (!['gerada', 'aprovada', 'cancelada'].includes(status)) return err('Status inválido')

  await env.DB.prepare('UPDATE ordens_servico SET status = ? WHERE id = ?').bind(status, id).run()
  return ok({ ok: true })
}

async function handleListAllOS(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)
  if (!payload.is_admin) return err('Acesso restrito a administradores', 403)

  const { results } = await env.DB.prepare(
    'SELECT * FROM ordens_servico ORDER BY created_at DESC'
  ).all()

  return ok({ ordens: results.map(parseOS) })
}

async function handleTranscribe(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const formData = await request.formData()
  const audio = formData.get('audio')
  if (!audio) return err('Arquivo de áudio não enviado')

  // O modelo é resolvido em groq.js — se o atual for desligado, troca sozinho.
  const { data, modelo } = await groqTranscribe(env, audio, { language: 'pt' })
  return ok({ transcricao: data.text, modelo })
}

async function handleGerarOS(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const { relato, campos } = await request.json()
  if (!relato || !relato.trim()) return err('Relato é obrigatório')
  if (!Array.isArray(campos) || campos.length === 0) return err('Campos do molde não informados')

  const now = new Date()
  const data = now.toLocaleDateString('pt-BR')
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const listaCampos = campos.map(c => `- key: "${c.key}" | label: "${c.label}"`).join('\n')
  const userContent =
    `CAMPOS:\n${listaCampos}\n\n` +
    `RELATO DO TÉCNICO:\n${relato}\n\n` +
    `CONTEXTO: técnico=${payload.nome}; data atual=${data}; hora atual=${hora}`

  // O modelo é resolvido em groq.js — se o atual for desligado, troca sozinho.
  const { data: resposta, modelo } = await groqChat(env, {
    max_completion_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FORMALIZA_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const parsed = extrairJSON(resposta.choices?.[0]?.message?.content)
  const valores = parsed.valores ?? parsed
  return ok({ valores, data, hora, modelo })
}

// Diagnóstico dos modelos de IA. Público de propósito: serve para monitoramento
// externo (UptimeRobot e afins) e não expõe nada sensível — só nomes de modelo.
async function handleHealthModels(request, env) {
  const d = await diagnostico(env)
  return ok(d, d.ok ? 200 : 503)
}

// ─── Molde (1 por técnico) ────────────────────────────────────────────────────

// O "molde" agora é só o cabeçalho da empresa (logo + dados). A IA monta a OS
// num layout profissional padrão; o usuário não marca campos.
// Reaproveitamos as colunas existentes: bg_image=logo, img_w/h=dims da logo,
// campos=JSON com { empresa, telefone, responsavel }.
async function handleGetMolde(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const row = await env.DB.prepare('SELECT * FROM moldes WHERE user_id = ?').bind(payload.sub).first()
  if (!row) return ok({ molde: null })
  return ok({ molde: cabecalhoDoMolde(row) })
}

// Traduz a linha da tabela `moldes` no cabeçalho que o app consome.
function cabecalhoDoMolde(row) {
  let meta = {}
  try { const p = JSON.parse(row.campos); if (p && !Array.isArray(p)) meta = p } catch { /* legado */ }
  return {
    logo: row.bg_image || '',
    logo_w: row.img_w || 0,
    logo_h: row.img_h || 0,
    empresa: meta.empresa || '',
    cnpj: meta.cnpj || '',
    telefone: meta.telefone || '',
    responsavel: meta.responsavel || '',
  }
}

async function handleSaveMolde(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  const body = await request.json()
  const logo = body.logo || ''
  const logo_w = body.logo_w || 0
  const logo_h = body.logo_h || 0
  const meta = JSON.stringify({
    empresa: (body.empresa || '').trim(),
    cnpj: (body.cnpj || '').trim(),
    telefone: (body.telefone || '').trim(),
    responsavel: (body.responsavel || '').trim(),
  })

  await env.DB.prepare(`
    INSERT INTO moldes (user_id, bg_image, img_w, img_h, campos, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ${AGORA_UTC}, ${AGORA_UTC})
    ON CONFLICT(user_id) DO UPDATE SET
      bg_image   = excluded.bg_image,
      img_w      = excluded.img_w,
      img_h      = excluded.img_h,
      campos     = excluded.campos,
      updated_at = ${AGORA_UTC}
  `).bind(payload.sub, logo, logo_w, logo_h, meta).run()

  return ok({ ok: true })
}

async function handleDeleteMolde(request, env) {
  const payload = await getAuth(request, env)
  if (!payload) return err('Não autorizado', 401)

  await env.DB.prepare('DELETE FROM moldes WHERE user_id = ?').bind(payload.sub).run()
  return ok({ ok: true })
}

// O D1 devolve materiais_utilizados, valores e cabecalho como string JSON.
// Uma linha corrompida não pode derrubar a listagem inteira com 500.
function jsonOu(valor, padrao) {
  if (valor == null || valor === '') return padrao
  if (typeof valor !== 'string') return valor
  try {
    return JSON.parse(valor)
  } catch {
    return padrao
  }
}

function parseOS(os) {
  if (!os) return null
  return {
    ...os,
    materiais_utilizados: jsonOu(os.materiais_utilizados, []),
    valores: jsonOu(os.valores, {}),
    cabecalho: jsonOu(os.cabecalho, null),
  }
}

// ─── Router principal ─────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = origemPermitida(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, ...cors } })

    const res = await rotear(request, env)
    // A origem permitida é carimbada num lugar só, na saída.
    const comCors = new Response(res.body, res)
    for (const [k, v] of Object.entries(cors)) comCors.headers.set(k, v)
    return comCors
  },

  // Verificação semanal: avisa nos logs se um modelo preferido saiu do ar,
  // idealmente antes de alguém em campo esbarrar no problema.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      diagnostico(env).then((d) => {
        const msg = JSON.stringify(d.modelos)
        if (d.ok) console.log('[groq] verificação semanal OK —', msg)
        else console.error('[groq] ATENÇÃO: modelo preferido indisponível —', msg)
      })
    )
  },
}

async function rotear(request, env) {
  const { pathname } = new URL(request.url)
  const method = request.method

  try {
      if (pathname === '/auth/register'  && method === 'POST') return handleRegister(request, env)
      if (pathname === '/auth/login'     && method === 'POST') return handleLogin(request, env)
      if (pathname === '/auth/me'        && method === 'GET')  return handleMe(request, env)
      if (pathname === '/os'             && method === 'GET')  return handleListOS(request, env)
      if (pathname === '/os/proximo-numero' && method === 'GET') return handleProximoNumero(request, env)
      if (pathname === '/os'             && method === 'POST') return handleCreateOS(request, env)
      if (pathname === '/os/admin'       && method === 'GET')  return handleListAllOS(request, env)
      if (pathname === '/molde'          && method === 'GET')    return handleGetMolde(request, env)
      if (pathname === '/molde'          && method === 'PUT')    return handleSaveMolde(request, env)
      if (pathname === '/molde'          && method === 'DELETE') return handleDeleteMolde(request, env)
      if (pathname === '/transcribe'     && method === 'POST') return handleTranscribe(request, env)
      if (pathname === '/gerar-os'       && method === 'POST') return handleGerarOS(request, env)
      if (pathname === '/health/models'  && method === 'GET')  return handleHealthModels(request, env)

      const statusMatch = pathname.match(/^\/os\/(.+)\/status$/)
      if (statusMatch && method === 'PATCH') return handleUpdateStatus(request, env, statusMatch[1])

    return err('Rota não encontrada', 404)
  } catch (e) {
    // Falha da Groq vira mensagem que o técnico entende — o log guarda o detalhe.
    if (e instanceof GroqError) {
      console.error('[groq] falha final:', e.message)
      return err(
        e.status === 429
          ? 'A IA está sobrecarregada no momento. Tente de novo em alguns instantes.'
          : 'A IA está indisponível no momento. Tente de novo em alguns instantes.',
        502
      )
    }
    // Erro inesperado: o detalhe (inclusive stack do D1) fica no log, não na tela.
    console.error('[erro]', method, pathname, e?.stack ?? e)
    return err('Erro interno no servidor. Tente de novo em alguns instantes.', 500)
  }
}
