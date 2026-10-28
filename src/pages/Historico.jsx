import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import OSCard from '../components/OSCard'
import { diaLocalISO } from '../lib/datas'

const STATUS_OPTIONS = ['todos', 'gerada', 'aprovada', 'cancelada']

export default function Historico() {
  const { user } = useAuth()
  const [ordens, setOrdens] = useState([])
  const [header, setHeader] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroData, setFiltroData] = useState('')

  useEffect(() => {
    if (user) fetchOrdens()
  }, [user])

  async function fetchOrdens() {
    setLoading(true)
    try {
      const [{ ordens }, { molde }] = await Promise.all([api.os.list(), api.molde.get()])
      setOrdens(ordens ?? [])
      setHeader(molde)
    } catch {
      // silencia erros de rede
    } finally {
      setLoading(false)
    }
  }

  const filtradas = ordens.filter((os) => {
    const matchStatus = filtroStatus === 'todos' || os.status === filtroStatus
    // Compara no fuso do usuário: o <input type="date"> devolve o dia local.
    const matchData = !filtroData || diaLocalISO(os.created_at) === filtroData
    return matchStatus && matchData
  })

  return (
    <div className="px-4 py-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Histórico de OS</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{ordens.length} ordens registradas</p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                filtroStatus === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {s === 'todos' ? 'Todas' : s}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">
            {ordens.length === 0 ? 'Nenhuma OS gerada ainda.' : 'Nenhuma OS corresponde ao filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((os) => <OSCard key={os.id} os={os} header={header} />)}
        </div>
      )}
    </div>
  )
}
