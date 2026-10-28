// Testa a leitura de carimbos do banco no fuso de Brasília (UTC-3).
// Fixa o fuso antes de qualquer Date, para o resultado não depender da máquina.
process.env.TZ = process.env.TZ_TESTE || 'America/Sao_Paulo'

import { parseData, formatarData, formatarHora, diaLocalISO } from './datas.js'

let falhas = 0
function checar(nome, obtido, esperado) {
  const ok = obtido === esperado
  console.log(`${ok ? '  OK  ' : ' FALHA'} │ ${nome} → ${obtido}${ok ? '' : ` (esperado ${esperado})`}`)
  if (!ok) falhas++
}

console.log(`fuso do teste: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`)

// Formato novo: UTC explícito.
checar('11:52Z vira 08:52 em Brasília', formatarHora('2026-08-20T11:52:33Z'), '08:52')
checar('data de 11:52Z continua 20/08', formatarData('2026-08-20T11:52:33Z'), '20/08/2026')

// Formato legado: UTC sem marcador. Era lido como hora local e adiantava 3h.
checar('legado "11:52:33" também vira 08:52', formatarHora('2026-08-20 11:52:33'), '08:52')
checar('legado e novo dão o mesmo instante',
  String(parseData('2026-08-20 11:52:33')?.getTime()),
  String(parseData('2026-08-20T11:52:33Z')?.getTime()))

// O caso que quebrava o filtro: registro do fim da noite UTC.
// 23:30Z = 20:30 do MESMO dia em Brasília. O toISOString() antigo devolvia
// o dia seguinte e a OS sumia do filtro.
checar('23:30Z é dia 20 no Brasil', diaLocalISO('2026-08-20T23:30:00Z'), '2026-08-20')
checar('23:30Z mostra 20:30', formatarHora('2026-08-20T23:30:00Z'), '20:30')
checar('02:00Z é dia 19 no Brasil', diaLocalISO('2026-08-20T02:00:00Z'), '2026-08-19')

// Entradas ruins não podem virar "Invalid Date" na tela.
checar('nulo vira travessão', formatarData(null), '—')
checar('lixo vira travessão', formatarData('nao-e-data'), '—')
checar('Date puro é aceito', diaLocalISO(new Date('2026-08-20T23:30:00Z')), '2026-08-20')

console.log(falhas === 0 ? '\nTodos os cenários passaram.' : `\n${falhas} verificação(ões) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
