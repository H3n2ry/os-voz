import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const TOKEN_KEY = 'os_voz_token'
const USER_KEY = 'os_voz_user'

const AuthContext = createContext(null)

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // Começa com a sessão em cache: o usuário já entra logado, sem esperar a rede.
  const [user, setUser] = useState(() =>
    localStorage.getItem(TOKEN_KEY) ? readCachedUser() : null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    // Revalida em segundo plano. Só desloga se o token for realmente inválido (401).
    api.auth.me()
      .then(({ user }) => {
        setUser(user)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      })
      .catch((e) => {
        if (e?.status === 401) {
          // Token expirado/ inválido → encerra a sessão.
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setUser(null)
        }
        // Erro de rede/servidor: mantém a sessão em cache (não desloga).
      })
      .finally(() => setLoading(false))
  }, [])

  async function signIn(email, senha) {
    try {
      const { token, user } = await api.auth.login(email, senha)
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      setUser(user)
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  async function signUp(email, senha, nome) {
    try {
      await api.auth.register(email, senha, nome)
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  async function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  // profile é alias de user para compatibilidade com os componentes
  const value = { user, profile: user, loading, signIn, signUp, signOut }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
