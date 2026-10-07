import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { availableYears, forecast, upcomingCharges, yearSummary } from './calculations'

function sample(): FinanceData {
  const d = createEmptyData()
  d.oneTimeExpenses.push(
    { id: 'o1', name: 'Spesa', amount: 5000, date: '2026-03-10', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    { id: 'o2', name: 'Altro anno', amount: 999, date: '2025-12-31', categoryId: 'food', paymentMethodId: 'card', notes: '' },
  )
  d.incomes.push(
    { id: 'i1', name: 'Stipendio', amount: 200000, date: '2026-03-27', categoryId: 'salary', paymentMethodId: 'bank' },
    { id: 'i2', name: 'Stipendio', amount: 200000, date: '2026-04-27', categoryId: 'salary', paymentMethodId: 'bank' },
  )
  d.recurringExpenses.push(
    { id: 'r1', name: 'Affitto', amount: 70000, frequency: 'monthly', startDate: '2026-01-01', endDate: null, categoryId: 'home', paymentMethodId: 'bank' },
    { id: 'r2', name: 'Assicurazione', amount: 60000, frequency: 'semiannual', startDate: '2026-06-15', endDate: null, categoryId: 'car', paymentMethodId: 'bank' },
  )
  d.simulations.push({ id: 's1', name: 'TV', amount: 50000, year: 2026, month: 11 })
  return d
}

describe('yearSummary', () => {
  it('conta le ricorrenze solo nei mesi del periodo attivo', () => {
    const s = yearSummary(sample(), 2026)
    // periodo: marzo–dicembre (primo movimento a marzo)
    expect(s.periodStartMonth).toBe(2)
    expect(s.totalIncome).toBe(400000)
    expect(s.oneTimeTotal).toBe(5000)
    // affitto 10 mesi + assicurazione giugno e dicembre
    expect(s.recurringInPeriod).toBe(70000 * 10 + 60000 * 2)
    expect(s.totalExpenses).toBe(5000 + 820000)
    expect(s.balance).toBe(400000 - 825000)
    // 700 + 600/6 = 800 €/mese
    expect(s.monthlyRecurring).toBe(80000)
    expect(s.byCategory.map((c) => c.id)).toEqual(['home', 'car', 'food'])
  })

  it('le ricorrenze valgono anche negli anni successivi', () => {
    const s = yearSummary(sample(), 2027)
    expect(s.periodStartMonth).toBe(0)
    expect(s.recurringInPeriod).toBe(70000 * 12 + 60000 * 2)
  })
})

describe('forecast', () => {
  it('usa la media per i mesi senza entrate e include simulazioni', () => {
    const rows = forecast(sample(), 2026)
    expect(rows.map((r) => r.month)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const may = rows.find((r) => r.month === 4)!
    expect(may.incomeEstimated).toBe(true)
    expect(may.income).toBe(200000)
    const dec = rows.find((r) => r.month === 11)!
    expect(dec.expenses).toBe(70000 + 60000 + 50000)
    expect(rows.at(-1)!.cumulative).toBe(rows.reduce((acc, r) => acc + r.balance, 0))
  })
})

describe('upcomingCharges', () => {
  it('elenca gli addebiti entro la finestra, ordinati', () => {
    const list = upcomingCharges(sample(), '2026-11-20', 30)
    expect(list.map((c) => [c.id, c.date, c.daysLeft])).toEqual([
      ['r1', '2026-12-01', 11],
      ['r2', '2026-12-15', 25],
    ])
  })
})

describe('availableYears', () => {
  it('include anno corrente e anni dei dati', () => {
    expect(availableYears(sample(), 2026)).toEqual([2025, 2026])
  })
})
