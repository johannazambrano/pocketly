import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { availableYears, estimateMonthlyIncome, forecast, upcomingCharges, yearSummary } from './calculations'

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

const TODAY = '2026-11-20'

describe('yearSummary', () => {
  it('conta le ricorrenze solo nei mesi del periodo attivo', () => {
    const s = yearSummary(sample(), 2026, TODAY)
    // periodo: marzo–dicembre (primo movimento a marzo)
    expect(s.periodStartMonth).toBe(2)
    expect(s.totalIncome).toBe(400000)
    expect(s.oneTimeTotal).toBe(5000)
    // affitto 10 mesi + assicurazione giugno e dicembre
    expect(s.recurringInPeriod).toBe(70000 * 10 + 60000 * 2)
    expect(s.totalExpenses).toBe(5000 + 820000)
    // 700 + 600/6 = 800 €/mese
    expect(s.monthlyRecurring).toBe(80000)
    expect(s.byCategory.map((c) => c.id)).toEqual(['home', 'car', 'food'])
  })

  it('le ricorrenze valgono anche negli anni successivi', () => {
    const s = yearSummary(sample(), 2027, TODAY)
    expect(s.periodStartMonth).toBe(0)
    expect(s.recurringInPeriod).toBe(70000 * 12 + 60000 * 2)
  })

  it('separa il saldo a oggi dal previsto a fine anno', () => {
    const s = yearSummary(sample(), 2026, TODAY)
    // Fino al 20/11: spesa una tantum, affitto da marzo a novembre (9 addebiti), assicurazione di giugno.
    // L'affitto del 1/12 e l'assicurazione del 15/12 sono ancora futuri.
    expect(s.incomeToDate).toBe(400000)
    expect(s.expensesToDate).toBe(5000 + 70000 * 9 + 60000)
    expect(s.balanceToDate).toBe(400000 - 695000)
    // Il previsto aggiunge le uscite programmate; le entrate non sono ricorrenti, quindi restano quelle registrate.
    expect(s.projectedIncome).toBe(400000)
    expect(s.projectedBalance).toBe(400000 - 825000)
  })

  it('per un anno passato "a oggi" è tutto l’anno, per uno futuro è zero', () => {
    const past = yearSummary(sample(), 2026, '2027-02-01')
    expect(past.expensesToDate).toBe(past.totalExpenses)
    expect(past.incomeToDate).toBe(past.totalIncome)
    const future = yearSummary(sample(), 2026, '2025-06-01')
    expect(future.incomeToDate).toBe(0)
    expect(future.expensesToDate).toBe(0)
  })

  it('un addebito del giorno stesso conta come già avvenuto, quello del giorno dopo no', () => {
    const d = createEmptyData()
    d.recurringExpenses.push({
      id: 'r',
      name: 'Affitto',
      amount: 1000,
      frequency: 'monthly',
      startDate: '2026-01-15',
      endDate: null,
      categoryId: 'c',
      paymentMethodId: 'p',
    })
    d.oneTimeExpenses.push({ id: 'o', name: 'x', amount: 1, date: '2026-01-02', categoryId: 'c', paymentMethodId: 'p', notes: '' })
    expect(yearSummary(d, 2026, '2026-03-15').expensesToDate).toBe(1 + 1000 * 3)
    expect(yearSummary(d, 2026, '2026-03-14').expensesToDate).toBe(1 + 1000 * 2)
  })

  it('le entrate con data futura non sono ancora avvenute ma contano nel previsto', () => {
    const d = createEmptyData()
    d.incomes.push({ id: 'i', name: 'Stipendio', amount: 100000, date: '2026-12-27', categoryId: 'salary', paymentMethodId: 'bank' })
    const s = yearSummary(d, 2026, TODAY)
    expect(s.incomeToDate).toBe(0)
    expect(s.projectedIncome).toBe(100000)
  })
})

describe('entrate non ricorrenti', () => {
  const salary = (id: string, date: string, amount: number) =>
    ({ id, name: 'Stipendio', amount, date, categoryId: 'salary', paymentMethodId: 'bank' }) as const
  const gift = (id: string, date: string, amount: number) =>
    ({ id, name: 'Regalo', amount, date, categoryId: 'gift', paymentMethodId: 'cash' }) as const

  it('senza stima i mesi senza entrate valgono 0, anche quelli futuri', () => {
    const rows = forecast(sample(), 2026, TODAY)
    expect(rows.map((r) => r.month)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(rows.find((r) => r.month === 2)!.income).toBe(200000)
    for (const m of [4, 5, 9, 10, 11]) {
      const row = rows.find((r) => r.month === m)!
      expect(row.income).toBe(0)
      expect(row.incomeEstimated).toBe(false)
    }
    expect(rows.find((r) => r.month === 11)!.expenses).toBe(70000 + 60000 + 50000)
    expect(rows.at(-1)!.cumulative).toBe(rows.reduce((acc, r) => acc + r.balance, 0))
  })

  it('un regalo una tantum non si propaga ai mesi successivi', () => {
    const d = createEmptyData()
    d.incomes.push(salary('s1', '2026-01-27', 150000), gift('g1', '2026-01-10', 50000), salary('s2', '2026-02-27', 150000))
    const rows = forecast(d, 2026, '2026-06-15')
    expect(rows.map((r) => r.income).slice(0, 4)).toEqual([200000, 150000, 0, 0])
  })

  describe('stima facoltativa', () => {
    const withEstimate = (d: FinanceData, ids = ['salary']) => {
      d.forecast = { estimateIncome: true, incomeCategoryIds: ids }
      return d
    }

    it('è spenta di default e senza categorie non stima nulla', () => {
      const d = sample()
      expect(estimateMonthlyIncome(d, TODAY)).toBe(0)
      d.forecast.estimateIncome = true
      expect(estimateMonthlyIncome(d, TODAY)).toBe(0)
    })

    it('usa la media degli ultimi 3 mesi con entrate nelle categorie scelte', () => {
      const d = withEstimate(createEmptyData())
      d.incomes.push(
        salary('a', '2026-01-27', 100000),
        salary('b', '2026-03-27', 150000),
        salary('c', '2026-04-27', 180000),
        salary('d', '2026-05-27', 210000),
      )
      // gennaio è fuori dagli ultimi 3 mesi con entrate
      expect(estimateMonthlyIncome(d, '2026-06-10')).toBe(180000)
    })

    it('i regali e le altre categorie non entrano nella stima', () => {
      const d = withEstimate(createEmptyData())
      d.incomes.push(salary('a', '2026-03-27', 150000), gift('g', '2026-03-05', 90000), salary('b', '2026-04-27', 150000))
      expect(estimateMonthlyIncome(d, '2026-06-10')).toBe(150000)
    })

    it('ignora le entrate con data futura', () => {
      const d = withEstimate(createEmptyData())
      d.incomes.push(salary('a', '2026-03-27', 100000), salary('b', '2026-12-27', 900000))
      expect(estimateMonthlyIncome(d, '2026-06-10')).toBe(100000)
    })

    it('si aggiunge dal mese corrente in poi e mai ai mesi passati', () => {
      const d = withEstimate(sample())
      const rows = forecast(d, 2026, TODAY)
      for (const m of [4, 5, 6, 7, 8, 9]) expect(rows.find((r) => r.month === m)).toMatchObject({ income: 0, incomeEstimated: false })
      expect(rows.find((r) => r.month === 10)).toMatchObject({ income: 200000, incomeEstimated: true })
      expect(rows.find((r) => r.month === 11)).toMatchObject({ income: 200000, incomeEstimated: true })
      expect(yearSummary(d, 2026, TODAY).projectedIncome).toBe(400000 + 200000 * 2)
    })

    it('non stima il mese corrente se lo stipendio è già registrato, ma tiene le altre entrate', () => {
      const d = withEstimate(createEmptyData())
      d.incomes.push(salary('a', '2026-05-27', 150000), salary('b', '2026-06-05', 150000), gift('g', '2026-06-07', 20000))
      const rows = forecast(d, 2026, '2026-06-10')
      expect(rows.find((r) => r.month === 5)).toMatchObject({ income: 170000, incomeEstimated: false })
      expect(rows.find((r) => r.month === 6)).toMatchObject({ income: 150000, incomeEstimated: true })
    })

    it('se manca lo stipendio ma c’è un regalo, stima lo stipendio e conserva il regalo', () => {
      const d = withEstimate(createEmptyData())
      d.incomes.push(salary('a', '2026-05-27', 150000), gift('g', '2026-06-07', 20000))
      const june = forecast(d, 2026, '2026-06-10').find((r) => r.month === 5)!
      expect(june).toMatchObject({ income: 170000, incomeEstimated: true })
    })

    it('in un anno futuro stima tutti i mesi', () => {
      const d = withEstimate(sample())
      const rows = forecast(d, 2027, TODAY)
      expect(rows).toHaveLength(12)
      expect(rows.every((r) => r.income === 200000 && r.incomeEstimated)).toBe(true)
    })
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
