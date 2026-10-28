// Verifica que a troca do codificador do JWT não desloga ninguém.
//
// Os tokens valem 90 dias. Os já emitidos foram gerados com
// btoa(JSON.stringify(payload)), que grava Latin-1 em base64 padrão. O código
// novo assina em base64url de bytes UTF-8. O verificador precisa aceitar os dois.
import { signJWT, verifyJWT } from '../src/index.js'

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres-aqui'
const daquiA90Dias = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90

let falhas = 0
function checar(nome, condicao, detalhe = '') {
  console.log(`${condicao ? '  OK  ' : ' FALHA'} │ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!condicao) falhas++
}

// Reproduz exatamente como o Worker antigo montava o token.
async function tokenNoFormatoAntigo(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const dados = `${header}.${body}`
  const chave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(dados))
  let bin = ''
  for (const b of new Uint8Array(assinatura)) bin += String.fromCharCode(b)
  const sig = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${dados}.${sig}`
}

// ── Token antigo, nome só com ASCII ──────────────────────────────────────────
{
  const antigo = await tokenNoFormatoAntigo({ sub: 'u1', nome: 'Carlos Souza', exp: daquiA90Dias })
  const p = await verifyJWT(antigo, SEGREDO)
  checar('token antigo (ASCII) continua válido', p?.nome === 'Carlos Souza', p?.nome)
}

// ── Token antigo com acento: o btoa gravou Latin-1 ───────────────────────────
{
  const antigo = await tokenNoFormatoAntigo({ sub: 'u2', nome: 'João da Conceição', exp: daquiA90Dias })
  const p = await verifyJWT(antigo, SEGREDO)
  checar('token antigo com acento não vira caractere quebrado', p?.nome === 'João da Conceição', p?.nome)
}

// ── Token novo: acento e emoji, que o btoa antigo nem conseguia gerar ────────
{
  const novo = await signJWT({ sub: 'u3', nome: 'João da Conceição ⚡', exp: daquiA90Dias }, SEGREDO)
  const p = await verifyJWT(novo, SEGREDO)
  checar('token novo com acento e emoji faz round-trip', p?.nome === 'João da Conceição ⚡', p?.nome)
}

// ── O emoji quebrava a geração antiga: confirma que era esse o bug ──────────
{
  let quebrou = false
  try { btoa(JSON.stringify({ nome: '⚡' })) } catch { quebrou = true }
  checar('o codificador antigo de fato quebrava com emoji', quebrou)
}

// ── Rejeições ────────────────────────────────────────────────────────────────
{
  const novo = await signJWT({ sub: 'u4', nome: 'Ana', exp: daquiA90Dias }, SEGREDO)
  checar('assinatura com outro segredo é recusada', (await verifyJWT(novo, 'outro-segredo-qualquer')) === null)
  checar('token adulterado é recusado', (await verifyJWT(novo.slice(0, -3) + 'aaa', SEGREDO)) === null)
  checar('lixo é recusado sem explodir', (await verifyJWT('nao-e-um-token', SEGREDO)) === null)

  const expirado = await signJWT({ sub: 'u5', nome: 'Ana', exp: Math.floor(Date.now() / 1000) - 10 }, SEGREDO)
  checar('token expirado é recusado', (await verifyJWT(expirado, SEGREDO)) === null)
}

console.log(falhas === 0 ? '\nTodos os cenários passaram.' : `\n${falhas} verificação(ões) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
