// Garante que a transcrição sai sempre em pt-BR e sem alucinações do Whisper.
import assert from 'node:assert/strict'
import { groqTranscribe, limparTranscricao } from '../src/groq.js'

let falhas = 0
async function caso(nome, fn) {
  try { await fn(); console.log(`ok   ${nome}`) }
  catch (e) { falhas++; console.error(`FALHA ${nome}\n  ${e.message}`) }
}

const seg = (text, extra = {}) => ({ text, no_speech_prob: 0.01, avg_logprob: -0.2, compression_ratio: 1.3, ...extra })

await caso('mantém a fala normal em português', () => {
  const data = { segments: [seg(' Troquei o disjuntor geral.'), seg(' Cliente João.')] }
  assert.equal(limparTranscricao(data), 'Troquei o disjuntor geral. Cliente João.')
})

await caso('descarta frase de legenda alucinada em outro idioma', () => {
  const data = { segments: [seg(' Instalei duas tomadas.'), seg(' Thank you for watching!'), seg(' ご視聴ありがとうございました')] }
  assert.equal(limparTranscricao(data), 'Instalei duas tomadas.')
})

await caso('descarta trecho que o Whisper marca como silêncio', () => {
  const data = { segments: [seg(' Fui na loja.'), seg(' Hello.', { no_speech_prob: 0.9, avg_logprob: -1.5 })] }
  assert.equal(limparTranscricao(data), 'Fui na loja.')
})

await caso('descarta texto repetido em loop', () => {
  const data = { segments: [seg(' Ok.'), seg(' a a a a a a a a a a a a', { compression_ratio: 3.1 })] }
  assert.equal(limparTranscricao(data), 'Ok.')
})

await caso('áudio só com alucinação vira texto vazio', () => {
  assert.equal(limparTranscricao({ text: 'Legendas pela comunidade Amara.org' }), '')
})

await caso('pede pt, temperatura 0, prompt pt-BR e verbose_json à Groq', async () => {
  let enviado
  globalThis.fetch = async (url, opts) => {
    enviado = opts.body
    return { ok: true, status: 200, json: async () => ({ text: 'x', segments: [seg(' Serviço feito.')] }), text: async () => '' }
  }
  const env = { GROQ_API_KEY: 'fake', GROQ_TRANSCRIBE_MODEL: '' }
  const { texto } = await groqTranscribe(env, new Blob(['a'], { type: 'audio/webm' }))
  assert.equal(texto, 'Serviço feito.')
  assert.equal(enviado.get('language'), 'pt')
  assert.equal(enviado.get('temperature'), '0')
  assert.equal(enviado.get('response_format'), 'verbose_json')
  assert.match(enviado.get('prompt'), /português do Brasil/)
})

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\ntranscrição: tudo ok')
