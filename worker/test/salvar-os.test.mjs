// Reproduz o bug "as OS pararam de salvar": o app manda endereco = null quando
// a IA não encontra endereço no relato, e a coluna é NOT NULL. Roda o INSERT
// de verdade num SQLite em memória com a tabela exatamente como está no D1
// de produção (copiada de sqlite_master em 28/10/2026).
import { DatabaseSync } from 'node:sqlite'
import { camposDaOS } from '../src/index.js'

let falhas = 0
function checar(nome, condicao, detalhe = '') {
  console.log(`${condicao ? '  OK  ' : ' FALHA'} │ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!condicao) falhas++
}

const db = new DatabaseSync(':memory:')
db.exec(`CREATE TABLE ordens_servico (
  id                   TEXT PRIMARY KEY,
  numero_os            INTEGER,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  tecnico_id           TEXT NOT NULL,
  tecnico_nome         TEXT NOT NULL,
  cliente              TEXT NOT NULL,
  endereco             TEXT NOT NULL,
  tipo_servico         TEXT NOT NULL,
  descricao_servico    TEXT NOT NULL,
  materiais_utilizados TEXT NOT NULL DEFAULT '[]',
  observacoes          TEXT,
  status               TEXT NOT NULL DEFAULT 'gerada'
                         CHECK (status IN ('gerada', 'aprovada', 'cancelada')),
  pdf_url              TEXT,
  esboco_foto_url      TEXT,
  audio_transcricao    TEXT NOT NULL,
  valores TEXT, cabecalho TEXT)`)

// Exatamente o que o app enviava para um relato sem endereço.
const doApp = {
  cliente: 'School Oliver',
  endereco: null,
  tipo_servico: 'Instalação de câmera',
  descricao_servico: 'Cliente: School Oliver\nEndereço: —',
  audio_transcricao: 'fui na school oliver pela disk telecom, instalei uma câmera',
}

function inserir(body) {
  db.prepare(`INSERT INTO ordens_servico
    (id, tecnico_id, tecnico_nome, cliente, endereco, tipo_servico, descricao_servico, audio_transcricao)
    VALUES (?, 'u1', 'Técnico', ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), body.cliente, body.endereco, body.tipo_servico, body.descricao_servico, body.audio_transcricao)
}

let erroAntigo = null
try { inserir(doApp) } catch (e) { erroAntigo = e.message }
checar('sem a correção o INSERT falha (reproduz o bug)', /NOT NULL/i.test(erroAntigo ?? ''), erroAntigo ?? 'não falhou')

let erroNovo = null
try { inserir(camposDaOS(doApp)) } catch (e) { erroNovo = e.message }
checar('com camposDaOS a OS é salva', erroNovo === null, erroNovo ?? '')

const tudoNull = camposDaOS({})
checar('campos ausentes viram ""', ['cliente', 'endereco', 'tipo_servico', 'descricao_servico', 'audio_transcricao'].every((k) => tudoNull[k] === ''))
checar('valores preenchidos não mudam', camposDaOS(doApp).cliente === 'School Oliver')

if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nTodos os testes passaram')
