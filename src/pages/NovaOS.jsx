import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { downloadOSPDF } from '../lib/pdfGenerator'
import { CAMPOS_OS } from '../lib/osFields'
import AudioRecorder from '../components/AudioRecorder'
import OSPreview from '../components/OSPreview'

export default function NovaOS() {
  const { user, profile } = useAuth()

  const [header, setHeader] = useState(null)   // cabeçalho da empresa (opcional)
  const [carregando, setCarregando] = useState(true)

  const [transcricao, setTranscricao] = useState('')
  const [texto, setTexto] = useState('')
  const [mostrarTexto, setMostrarTexto] = useState(false)
  const [osGerada, setOsGerada] = useState(null)

  const [gerando, setGerando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salva, setSalva] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.molde.get()
      .then(({ molde }) => setHeader(molde))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  // Gera a OS a partir do relato (voz e/ou texto)
  async function gerar(relatoVoz) {
    const relato = [relatoVoz ?? transcricao, texto]
      .filter((s) => s && s.trim())
      .join('\n')
      .trim()

    setError('')
    if (!relato) {
      setError('Fale ou escreva o serviço antes de gerar a OS.')
      return
    }
    setGerando(true)
    setOsGerada(null)
    setSalva(false)
    try {
      const campos = CAMPOS_OS.map(({ key, label }) => ({ key, label }))
      const { valores, data, hora } = await api.gerarOS({ relato, campos })
      // Prévia do próximo número sequencial (o definitivo é atribuído ao salvar).
      let numero = null
      try { numero = (await api.os.proximoNumero()).numero } catch { /* rede: mostra ao salvar */ }
      setOsGerada({
        valores,
        data,
        hora,
        relato,
        numero_os: numero,
        tecnico: profile?.nome ?? user?.email,
        status: 'gerada',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setGerando(false)
    }
  }

  function valor(...keys) {
    for (const k of keys) if (osGerada?.valores?.[k]) return osGerada.valores[k]
    // "" e não null: as colunas são NOT NULL e o servidor recusava a OS inteira.
    return ''
  }

  // Edição manual caso a IA tenha entendido algo errado
  function editarCampo(key, value) {
    setOsGerada((o) => (o ? { ...o, valores: { ...o.valores, [key]: value } } : o))
  }

  async function handleSalvar() {
    if (!osGerada) return
    setSalvando(true)
    setError('')
    try {
      const descricao = CAMPOS_OS
        .map((c) => `${c.label}: ${osGerada.valores[c.key] || '—'}`)
        .join('\n')

      // 1) Persiste a OS primeiro — é o que importa para o histórico.
      //    O servidor atribui o número sequencial definitivo aqui.
      const { os } = await api.os.create({
        cliente: valor('cliente'),
        endereco: valor('endereco'),
        tipo_servico: valor('servico', 'tipo_servico'),
        descricao_servico: descricao,
        observacoes: valor('observacoes'),
        valores: osGerada.valores,
        audio_transcricao: osGerada.relato,
      })
      const osFinal = { ...osGerada, numero_os: os?.numero_os ?? osGerada.numero_os }
      setOsGerada(osFinal)
      setSalva(true)

      // 2) Tenta baixar o PDF com o número sequencial real — falha aqui não impede o salvamento.
      try {
        await downloadOSPDF(header, osFinal)
      } catch {
        setError('OS salva, mas não foi possível gerar o PDF agora. Você pode baixá-lo pelo Histórico.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSalvando(false)
    }
  }

  function handleNova() {
    setTranscricao('')
    setTexto('')
    setMostrarTexto(false)
    setOsGerada(null)
    setSalva(false)
    setError('')
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Nova Ordem de Serviço</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Fale o serviço — a OS é gerada e preenchida sozinha</p>
      </div>

      {/* Captura: voz (gera automático) ou texto */}
      {!osGerada && !gerando && (
        <>
          <AudioRecorder
            onTranscricao={setTranscricao}
            onComplete={(text) => gerar(text)}
            disabled={gerando}
          />

          {!mostrarTexto ? (
            <button
              onClick={() => setMostrarTexto(true)}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
            >
              Prefiro escrever
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Escreva o que foi feito</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex.: troquei o disjuntor do quadro da loja do João, usei 2 disjuntores de 40A..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
              <button
                onClick={() => gerar()}
                disabled={!texto.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95"
              >
                Gerar OS
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">{error}</p>}
        </>
      )}

      {/* Gerando */}
      {gerando && (
        <div className="text-center py-16 space-y-4">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <p className="text-zinc-100 font-medium">Gerando sua OS...</p>
            <p className="text-sm text-zinc-500 mt-1">Formalizando o relato e preenchendo o molde</p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {osGerada && !salva && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">OS pronta — confira e salve</p>
            <button onClick={handleNova} className="text-xs text-zinc-500 hover:text-zinc-300">Recomeçar</button>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">{error}</p>}
          <OSPreview header={header} os={osGerada} onSave={handleSalvar} saving={salvando} onChange={editarCampo} />
        </div>
      )}

      {/* Salva */}
      {salva && (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-green-400">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>
          <div>
            <p className="text-zinc-100 font-semibold">OS salva com sucesso!</p>
            <p className="text-sm text-zinc-500 mt-1">O PDF foi baixado e o registro salvo no histórico.</p>
          </div>
          <button onClick={handleNova} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors">
            Nova OS
          </button>
        </div>
      )}
    </div>
  )
}
