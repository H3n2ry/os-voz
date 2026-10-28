import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import TourGuide from './TourGuide'
import { MontagemArt } from './TourArt'

const tourKey = (id) => `os_voz_tutorial_done_${id}`

const TOUR_STEPS = [
  {
    title: 'Bem-vindo ao OS por Voz! 👋',
    body: 'Em poucos passos você vai gerar Ordens de Serviço completas só falando. Vou te mostrar como funciona.',
  },
  {
    illustration: <MontagemArt />,
    title: 'Como a OS é montada',
    body: 'Você só fala o que foi feito. A IA formaliza o relato e monta a Ordem de Serviço sozinha, num layout profissional pronto — sem você preencher nem posicionar nada.',
  },
  {
    selector: '[data-tour="nova"]',
    title: '1. Fale o serviço',
    body: 'No dia a dia é só isto: toque no microfone e fale o que foi feito. Ao parar, a OS é gerada e preenchida automaticamente — você confere e salva.',
  },
  {
    selector: '[data-tour="historico"]',
    title: '2. Histórico',
    body: 'Todas as OS geradas ficam salvas aqui. Você pode rever e baixar o PDF quando quiser.',
  },
  {
    selector: '[data-tour="molde"]',
    title: '3. Seu cabeçalho (opcional)',
    body: 'Quer deixar com a cara da sua empresa? Adicione uma vez sua logo e os dados — eles aparecem no topo de toda OS. É opcional: dá pra usar sem isso.',
  },
  {
    title: 'Pronto para começar? 🚀',
    body: 'Toque no microfone e fale sua primeira Ordem de Serviço. É só isso.',
    cta: { label: 'Começar agora' },
  },
]

const IconHelp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9.5 9a2.5 2.5 0 014.5 1.5c0 1.5-2 2-2 3M12 17h.01" />
  </svg>
)

const IconNova = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const IconHistorico = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
  </svg>
)

const IconMolde = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12h6m-6 4h3M9 8h6m-9-5h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
  </svg>
)

const IconAdmin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
  </svg>
)

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showTour, setShowTour] = useState(false)

  // Mostra o tutorial automaticamente na primeira vez de cada usuário
  useEffect(() => {
    if (profile?.id && !localStorage.getItem(tourKey(profile.id))) {
      setShowTour(true)
    }
  }, [profile?.id])

  function finishTour(cta) {
    if (profile?.id) localStorage.setItem(tourKey(profile.id), '1')
    setShowTour(false)
    if (cta) navigate('/')
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors ${
      isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
    }`

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div>
          <p className="text-sm font-semibold text-zinc-100">OS por Voz</p>
          <p className="text-xs text-zinc-500">{profile?.nome ?? '...'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTour(true)}
            aria-label="Ver tutorial"
            className="flex items-center justify-center text-zinc-500 hover:text-blue-400 transition-colors p-1.5 rounded"
          >
            <IconHelp />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors py-1 px-2 rounded"
          >
            <IconLogout />
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-900 border-t border-zinc-800 flex justify-around safe-area-inset-bottom">
        <NavLink to="/" end className={navClass} data-tour="nova">
          <IconNova />
          Nova OS
        </NavLink>
        <NavLink to="/configurar-molde" className={navClass} data-tour="molde">
          <IconMolde />
          Cabeçalho
        </NavLink>
        <NavLink to="/historico" className={navClass} data-tour="historico">
          <IconHistorico />
          Histórico
        </NavLink>
        {profile?.is_admin && (
          <NavLink to="/admin" className={navClass}>
            <IconAdmin />
            Admin
          </NavLink>
        )}
      </nav>

      {showTour && <TourGuide steps={TOUR_STEPS} onFinish={finishTour} />}
    </div>
  )
}
