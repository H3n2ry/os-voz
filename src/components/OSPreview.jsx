import { useState } from 'react'
import { downloadOSPDF } from '../lib/pdfGenerator'
import { CAMPOS_OS } from '../lib/osFields'

const statusConfig = {
  gerada:    { label: 'Gerada',    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  aprovada:  { label: 'Aprovada',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const TOPO = ['cliente', 'endereco', 'empresa_contratante', 'responsavel']
const SECOES = CAMPOS_OS.filter((c) => !TOPO.includes(c.key))

function val(valores, key) {
  const v = valores?.[key]
  return v && String(v).trim() ? String(v).trim() : null
}

// `header` = { logo, empresa, cnpj, telefone, responsavel } ou null
// `onChange(key, value)` — opcional; habilita a edição dos campos da OS.
export default function OSPreview({ header, os, onSave, saving, onChange }) {
  const [editing, setEditing] = useState(false)
  const st = statusConfig[os.status] ?? statusConfig.gerada
  const valores = os.valores || {}
  const logoSrc = header?.logo ? `data:image/jpeg;base64,${header.logo}` : null
  const responsavel = val(valores, 'responsavel') || header?.responsavel || os.tecnico

  // ── Modo edição: formulário com todos os campos ──────────────────────────
  if (editing && onChange) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-800 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-200">Editar OS</p>
          <button onClick={() => setEditing(false)} className="text-xs font-medium text-blue-400 hover:text-blue-300">
            Concluir
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-zinc-500">Corrija o que a IA tiver entendido errado.</p>
          {CAMPOS_OS.map((c) => (
            <label key={c.key} className="block">
              <span className="text-xs text-zinc-500">{c.label}</span>
              {c.multiline ? (
                <textarea
                  value={valores[c.key] ?? ''}
                  onChange={(e) => onChange(c.key, e.target.value)}
                  rows={3}
                  className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              ) : (
                <input
                  value={valores[c.key] ?? ''}
                  onChange={(e) => onChange(c.key, e.target.value)}
                  className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              )}
            </label>
          ))}
          <button
            onClick={() => setEditing(false)}
            className="w-full py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
          >
            Concluir edição
          </button>
        </div>
      </div>
    )
  }

  // ── Modo visualização: folha do documento ────────────────────────────────
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Folha branca simulando o documento */}
      <div className="bg-white text-zinc-900 p-5 m-3 rounded-lg shadow-inner">
        {/* Cabeçalho da empresa */}
        {(logoSrc || header?.empresa) && (
          <div className="flex items-center gap-3 mb-3">
            {logoSrc && <img src={logoSrc} alt="logo" className="w-12 h-12 object-contain" />}
            <div className="min-w-0">
              {header?.empresa && <p className="font-bold text-slate-900 truncate">{header.empresa}</p>}
              {header?.cnpj && <p className="text-xs text-slate-500">CNPJ: {header.cnpj}</p>}
              {header?.telefone && <p className="text-xs text-slate-500">{header.telefone}</p>}
            </div>
          </div>
        )}

        {/* Título + número/data */}
        <div className="flex items-end justify-between border-b-2 border-blue-600 pb-1.5 mb-3">
          <p className="text-base font-bold text-blue-600 tracking-wide">ORDEM DE SERVIÇO</p>
          <p className="text-[11px] text-slate-500 text-right leading-tight">
            {os.numero_os ? `Nº ${String(os.numero_os).padStart(4, '0')}` : 'Nº a definir'}<br />
            {os.data} {os.hora}
          </p>
        </div>

        {/* Identificação */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-400">Cliente</p>
            <p className="text-sm text-slate-900">{val(valores, 'cliente') || '—'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-400">Endereço</p>
            <p className="text-sm text-slate-900">{val(valores, 'endereco') || '—'}</p>
          </div>
          {val(valores, 'empresa_contratante') && (
            <div className="col-span-2">
              <p className="text-[9px] uppercase tracking-wide text-slate-400">Empresa contratante</p>
              <p className="text-sm text-slate-900">{val(valores, 'empresa_contratante')}</p>
            </div>
          )}
        </div>

        {/* Seções */}
        {SECOES.map((c) => {
          const v = val(valores, c.key)
          if (!v) return null
          return (
            <div key={c.key} className="mb-2.5">
              <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-600 mb-1">{c.label}</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-2 leading-relaxed">{v}</p>
            </div>
          )
        })}

        {/* Assinaturas */}
        <div className="flex justify-between gap-4 mt-6">
          {[responsavel || 'Responsável', 'Cliente'].map((label, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="border-t border-slate-400 mb-1" />
              <p className="text-[9px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between">
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${st.cls}`}>
          {st.label}
        </span>
        <div className="flex gap-2">
          {onChange && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Editar
            </button>
          )}
          <button
            onClick={() => downloadOSPDF(header, os)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </button>
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="py-2.5 px-5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
