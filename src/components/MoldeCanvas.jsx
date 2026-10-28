import { useRef, useState, useLayoutEffect } from 'react'

// Renderiza a imagem do molde com os campos posicionados por cima.
// mode 'view'  → mostra os valores (read-only)
// mode 'edit'  → mostra os rótulos, arrastáveis/selecionáveis; clicar no fundo dispara onCanvasClick
export default function MoldeCanvas({
  molde,
  campos,
  valores,
  mode = 'view',
  selectedKey,
  onSelectField,
  onMoveField,
  onCanvasClick,
  showEmptyBoxes = false,
}) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const renderedH = width * (molde.img_h / molde.img_w)
  const src = `data:image/jpeg;base64,${molde.bg_image}`

  function coordsFromEvent(e) {
    const rect = wrapRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
  }

  function handleBgClick(e) {
    if (mode !== 'edit' || !onCanvasClick) return
    onCanvasClick(coordsFromEvent(e))
  }

  function startDrag(e, campo) {
    if (mode !== 'edit') return
    e.stopPropagation()
    onSelectField?.(campo.key)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = campo.key
  }
  function onDrag(e) {
    if (!dragRef.current) return
    e.stopPropagation()
    onMoveField?.(dragRef.current, coordsFromEvent(e))
  }
  function endDrag(e) {
    if (!dragRef.current) return
    e.stopPropagation()
    dragRef.current = null
  }

  return (
    <div
      ref={wrapRef}
      onClick={handleBgClick}
      className="relative w-full bg-white rounded-lg overflow-hidden select-none touch-none"
      style={{ height: renderedH || undefined }}
    >
      <img src={src} alt="Molde" draggable={false} className="absolute inset-0 w-full h-full" />

      {campos.map((c) => {
        const valor = valores ? (valores[c.key] ?? '') : ''
        if (mode === 'view' && !showEmptyBoxes && !valor) return null

        const fontSize = (c.size ?? 0.02) * renderedH
        const selected = selectedKey === c.key
        const editCls =
          mode === 'edit'
            ? selected
              ? 'ring-2 ring-blue-500 bg-blue-500/10 cursor-move'
              : 'ring-1 ring-dashed ring-zinc-500/70 bg-white/50 cursor-move'
            : ''

        return (
          <div
            key={c.key}
            onPointerDown={(e) => startDrag(e, c)}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            className={`absolute leading-tight ${editCls}`}
            style={{
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              width: `${c.w * 100}%`,
              fontSize: fontSize ? `${fontSize}px` : undefined,
              color: '#111',
              whiteSpace: c.multiline ? 'pre-wrap' : 'normal',
              wordBreak: 'break-word',
            }}
          >
            {mode === 'edit' ? (valor || c.label) : valor}
          </div>
        )
      })}
    </div>
  )
}
