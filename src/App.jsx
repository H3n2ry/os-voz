import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import NovaOS from './pages/NovaOS'
import ConfigurarMolde from './pages/ConfigurarMolde'
import Historico from './pages/Historico'
import Admin from './pages/Admin'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={<ProtectedRoute><Layout><NovaOS /></Layout></ProtectedRoute>}
        />
        <Route
          path="/configurar-molde"
          element={<ProtectedRoute><Layout><ConfigurarMolde /></Layout></ProtectedRoute>}
        />
        <Route
          path="/historico"
          element={<ProtectedRoute><Layout><Historico /></Layout></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute><Layout><Admin /></Layout></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
