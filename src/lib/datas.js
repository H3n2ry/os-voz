// O banco grava os carimbos em UTC. Formatos que podem chegar:
//   "2026-08-20T11:52:33Z"  → novo, diz explicitamente que é UTC
//   "2026-08-20 11:52:33"   → legado, é UTC mas não diz; o navegador leria como
//                             hora local e mostraria 3h a mais no fuso de Brasília
// parseData() normaliza os dois para o mesmo instante.
export function parseData(valor) {
  if (!valor) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  const s = String(valor).trim()
  const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatarData(valor) {
  const d = parseData(valor)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}

export function formatarHora(valor) {
  const d = parseData(valor)
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

// "AAAA-MM-DD" no fuso do usuário — é o que o <input type="date"> devolve.
// Usar toISOString() aqui trocaria o dia de tudo que foi criado depois das 21h.
export function diaLocalISO(valor) {
  const d = parseData(valor)
  if (!d) return ''
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
