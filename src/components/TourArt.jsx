/**
 * Ilustração usada no tutorial para mostrar COMO a OS é montada:
 * o modelo mantém cabeçalho e rodapé, os campos marcados (contorno
 * tracejado) são preenchidos com texto formal, e a voz alimenta tudo.
 */
export function MontagemArt() {
  const campos = [
    { l: 'Cliente', v: 'Stamptech Ltda' },
    { l: 'Serviço', v: 'Troca de disjuntor 40A' },
    { l: 'Data', v: '02/06/2026' },
  ]

  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-700 p-3">
      <div className="rounded-lg bg-zinc-100 p-2.5">
        {/* Cabeçalho (preservado do modelo) */}
        <div className="flex items-center gap-2 border-b border-zinc-300 pb-1.5">
          <div className="w-6 h-6 rounded bg-blue-600 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-2/3 rounded bg-zinc-400" />
            <div className="h-1 w-1/3 rounded bg-zinc-300" />
          </div>
          <span className="text-[8px] font-bold text-zinc-500">OS #0042</span>
        </div>

        {/* Campos marcados sendo preenchidos */}
        <div className="space-y-1.5 py-2">
          {campos.map((f, idx) => (
            <div key={f.l} className="flex items-center gap-2">
              <span className="text-[8px] w-12 shrink-0 text-zinc-500">{f.l}</span>
              <div className="flex-1 rounded border border-dashed border-blue-500 bg-blue-500/10 px-1.5 py-0.5">
                <span
                  className="inline-block text-[8px] text-zinc-800 animate-pulse"
                  style={{ animationDelay: `${idx * 250}ms` }}
                >
                  {f.v}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé (preservado do modelo) */}
        <div className="flex justify-between border-t border-zinc-300 pt-1.5">
          <div className="h-1 w-16 rounded bg-zinc-300" />
          <div className="h-1 w-10 rounded bg-zinc-300" />
        </div>
      </div>

      {/* Selo de voz */}
      <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-blue-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
        Sua voz preenche os campos automaticamente
      </div>
    </div>
  )
}
