import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleLogin() {
    setError('')
    setLoading(true)
    const { error } = await signIn(email, senha)
    setLoading(false)
    if (error) setError('E-mail ou senha incorretos.')
    else navigate('/')
  }

  async function handleSignUp() {
    setError('')
    setSuccess('')
    if (!nome.trim()) { setError('Informe seu nome.'); return }
    setLoading(true)
    const { error } = await signUp(email, senha, nome)
    setLoading(false)
    if (error) setError(error.message)
    else {
      setSuccess('Conta criada! Agora é só entrar com seu e-mail e senha.')
      setTab('login')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/50">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
            <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm6.5 10H21a9 9 0 01-8 8.94V23h-2v-2.06A9 9 0 013 12h2.5a6.5 6.5 0 0013 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-zinc-100">OS por Voz</h1>
        <p className="text-sm text-zinc-500 mt-1">Ordens de serviço geradas por voz</p>
      </div>

      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {['login', 'cadastro'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === 'cadastro' && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleSignUp())}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">{success}</p>}

          <button
            onClick={tab === 'login' ? handleLogin : handleSignUp}
            disabled={loading || !email || !senha}
            className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </div>
      </div>
    </div>
  )
}
