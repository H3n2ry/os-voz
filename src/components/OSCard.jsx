import { downloadOSPDF } from '../lib/pdfGenerator'
import { formatarData, formatarHora } from '../lib/datas'

const statusConfig = {
  gerada:    { label: 'Gerada',    cls: 'bg-amber-500/20 text-amber-400' },
  aprovada:  { label: 'Aprovada',  cls: 'bg-green-500/20 text-green-400' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-500/20 text-red-400' },
}

export default function OSCard({ os, header, adminActions, onStatusChange }) {
  const st = statusConfig[os.status] ?? statusConfig.gerada
  const data = formatarData(os.created_at)
  const hora = formatarHora(os.created_at)

  // Prefere o cabeçalho congelado na própria OS — é o que o gestor não tem.
  const cabecalho = os.cabecalho ?? header ?? null

  const osForPdf = {
    numero_os: os.numero_os,
    data,
    hora,
    cliente: os.cliente,
    tecnico: os.tecnico_nome,
    tecnico_nome: os.tecnico_nome,
    descricao_servico: os.descricao_servico,
    valores: os.valores ?? {},
    status: os.status,
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500">
            OS #{String(os.numero_os).padStart(4, '0')} • {data} às {hora}
          </p>
          <p className="font-semibold text-zinc-100 mt-0.5">{os.cliente}</p>
          <p className="text-sm text-zinc-400">{os.tipo_servico}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>
          {st.label}
        </span>
      </div>

      <p className="text-xs text-zinc-500">{os.endereco}</p>

      {adminActions && (
        <p className="text-xs text-zinc-500">
          Técnico: <span className="text-zinc-300">{os.tecnico_nome}</span>
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => downloadOSPDF(cabecalho, osForPdf)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PDF
        </button>

        {adminActions && os.status === 'gerada' && (
          <>
            <button
              onClick={() => onStatusChange(os.id, 'aprovada')}
              className="flex-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              Aprovar
            </button>
            <button
              onClick={() => onStatusChange(os.id, 'cancelada')}
              className="flex-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
