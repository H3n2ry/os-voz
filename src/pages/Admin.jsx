import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import OSCard from '../components/OSCard'
import { formatarData, formatarHora, diaLocalISO } from '../lib/datas'

const STATUS_OPTIONS = ['todos', 'gerada', 'aprovada', 'cancelada']

// Aspas dentro do valor precisam ser dobradas, senão um cliente chamado
// 'Loja "do" João' quebra a coluna e desalinha a planilha inteira.
function celulaCSV(valor) {
  const texto = valor == null ? '' : String(valor)
  return `"${texto.replace(/"/g, '""')}"`
}

function exportCSV(ordens) {
  const headers = ['Nº OS', 'Data', 'Hora', 'Técnico', 'Cliente', 'Endereço', 'Tipo de Serviço', 'Status']
  const rows = ordens.map((os) => [
    os.numero_os,
    formatarData(os.created_at),
    formatarHora(os.created_at),
    os.tecnico_nome,
    os.cliente,
    os.endereco,
    os.tipo_servico,
    os.status,
  ].map(celulaCSV))
  const csv = '﻿' + [headers.map(celulaCSV), ...rows].map((r) => r.join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ordens_servico_${diaLocalISO(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Admin() {
  const { profile } = useAuth()
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTecnico, setFiltroTecnico] = useState('')

  useEffect(() => {
    if (profile?.is_admin) fetchOrdens()
    else setLoading(false)
  }, [profile])

  async function fetchOrdens() {
    setLoading(true)
    try {
      const { ordens } = await api.os.listAll()
      setOrdens(ordens ?? [])
    } catch {
      // silencia erros de rede
    } finally {
      setLoading(false)
    }
  }

  const [erro, setErro] = useState('')

  async function handleStatusChange(id, novoStatus) {
    setErro('')
    const anterior = ordens.find((os) => os.id === id)?.status
    // Atualiza na hora e desfaz se o servidor recusar — antes o estado local
    // divergia silenciosamente do banco quando a chamada falhava.
    setOrdens((prev) => prev.map((os) => os.id === id ? { ...os, status: novoStatus } : os))
    try {
      await api.os.updateStatus(id, novoStatus)
    } catch (e) {
      setOrdens((prev) => prev.map((os) => os.id === id ? { ...os, status: anterior } : os))
      setErro(e.message || 'Não foi possível atualizar o status.')
    }
  }

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <p className="text-zinc-400 text-sm">Acesso restrito a administradores.</p>
      </div>
    )
  }

  const tecnicos = [...new Set(ordens.map((os) => os.tecnico_nome))]

  const filtradas = ordens.filter((os) => {
    const matchStatus = filtroStatus === 'todos' || os.status === filtroStatus
    const matchTecnico = !filtroTecnico || os.tecnico_nome === filtroTecnico
    return matchStatus && matchTecnico
  })

  const totais = {
    gerada: ordens.filter((o) => o.status === 'gerada').length,
    aprovada: ordens.filter((o) => o.status === 'aprovada').length,
    cancelada: ordens.filter((o) => o.status === 'cancelada').length,
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Painel Administrativo</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{ordens.length} ordens no total</p>
        </div>
        <button
          onClick={() => exportCSV(filtradas)}
          className="flex items-center gap-1.5 text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 px-3 py-2 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          CSV
        </button>
      </div>

      {erro && <p className="text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">{erro}</p>}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Geradas',    value: totais.gerada,    cls: 'text-amber-400' },
          { label: 'Aprovadas',  value: totais.aprovada,  cls: 'text-green-400' },
          { label: 'Canceladas', value: totais.cancelada, cls: 'text-red-400' },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${item.cls}`}>{item.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{item.label}</p>
          </div>
        ))}
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

        {tecnicos.length > 1 && (
          <select
            value={filtroTecnico}
            onChange={(e) => setFiltroTecnico(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os técnicos</option>
            {tecnicos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">Nenhuma OS encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((os) => (
            <OSCard key={os.id} os={os} adminActions onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  )
}
