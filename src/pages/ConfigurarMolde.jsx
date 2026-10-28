import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { photoToImage } from '../lib/imagePrep'

export default function ConfigurarMolde() {
  const navigate = useNavigate()

  const [logo, setLogo] = useState(null)       // { base64, width, height } | null
  const [empresa, setEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [responsavel, setResponsavel] = useState('')

  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.molde.get()
      .then(({ molde }) => {
        if (molde) {
          if (molde.logo) setLogo({ base64: molde.logo, width: molde.logo_w, height: molde.logo_h })
          setEmpresa(molde.empresa || '')
          setCnpj(molde.cnpj || '')
          setTelefone(molde.telefone || '')
          setResponsavel(molde.responsavel || '')
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  async function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setProcessando(true)
    try {
      const prepared = await photoToImage(file, 400)
      setLogo(prepared)
    } catch (err) {
      setError('Não foi possível ler a imagem: ' + err.message)
    } finally {
      setProcessando(false)
    }
  }

  async function handleSalvar() {
    setSalvando(true)
    setError('')
    try {
      await api.molde.save({
        logo: logo?.base64 || '',
        logo_w: logo?.width || 0,
        logo_h: logo?.height || 0,
        empresa,
        cnpj,
        telefone,
        responsavel,
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const logoSrc = logo ? `data:image/jpeg;base64,${logo.base64}` : null

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Cabeçalho da OS</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          A IA monta a Ordem de Serviço sozinha. Aqui você só define o cabeçalho — sua logo e os dados da empresa — que aparece no topo de toda OS gerada.
        </p>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">Logo da empresa <span className="text-zinc-600 font-normal">(opcional)</span></p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
            {logoSrc ? (
              <img src={logoSrc} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-zinc-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6 6h.008v.008H6V6z" />
              </svg>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-block">
              <span className={`inline-block px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                processando ? 'border-blue-500 text-blue-400' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}>
                {processando ? 'Processando...' : logo ? 'Trocar logo' : 'Enviar logo'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={processando} />
            </label>
            {logo && (
              <button onClick={() => setLogo(null)} className="block text-xs text-zinc-500 hover:text-red-400">
                Remover logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dados */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-zinc-500">Nome da empresa</span>
          <input
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Ex.: Elétrica Silva"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">CNPJ <span className="text-zinc-600">(opcional)</span></span>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            inputMode="numeric"
            placeholder="Ex.: 12.345.678/0001-90"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Telefone / contato <span className="text-zinc-600">(opcional)</span></span>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Ex.: (11) 99999-0000"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Responsável padrão <span className="text-zinc-600">(opcional)</span></span>
          <input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Ex.: João Silva"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">{error}</p>}

      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95"
      >
        {salvando ? 'Salvando...' : 'Salvar cabeçalho'}
      </button>
    </div>
  )
}
