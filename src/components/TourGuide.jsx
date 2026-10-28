import { useState, useLayoutEffect, useEffect, useCallback } from 'react'

/**
 * Tour interativo com efeito spotlight.
 *
 * steps: [{ selector?, title, body, cta?: { label } }]
 *  - selector: CSS selector do elemento a destacar. Sem selector = card central.
 *  - cta.label: rótulo do botão no último passo (ex.: "Configurar molde").
 *
 * onFinish(cta | null): chamado ao concluir ("cta" do último passo) ou pular (null).
 */
export default function TourGuide({ steps, onFinish }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i] ?? {}

  const measure = useCallback(() => {
    if (!step.selector) { setRect(null); return }
    const el = document.querySelector(step.selector)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step.selector])

  useLayoutEffect(() => { measure() }, [measure, i])

  useEffect(() => {
    const on = () => measure()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
  }, [measure])

  const total = steps.length
  const last = i === total - 1
  const first = i === 0

  const finish = (cta) => onFinish?.(cta ?? null)
  const next = () => (last ? finish(step.cta) : setI(i + 1))
  const back = () => !first && setI(i - 1)

  const PAD = 8
  const cardStyle = rect
    ? {
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: `${Math.max(16, window.innerHeight - rect.top + 14)}px`,
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight / escurecimento */}
      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.82)',
            outline: '2px solid rgb(59, 130, 246)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-950/85" />
      )}

      {/* Bloqueia interação com o app durante o tour */}
      <div className="absolute inset-0" />

      {/* Card */}
      <div
        className="fixed w-[min(360px,calc(100vw-32px))] bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl shadow-black/60"
        style={cardStyle}
      >
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? 'w-5 bg-blue-500' : 'w-1.5 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {step.illustration && <div className="mb-3">{step.illustration}</div>}

        <h3 className="text-base font-bold text-zinc-100">{step.title}</h3>
        <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-5">
          <button onClick={() => finish(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
            Pular
          </button>
          <div className="flex gap-2">
            {!first && (
              <button
                onClick={back}
                className="px-3 py-2 text-sm text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                Voltar
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              {last ? step.cta?.label ?? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
