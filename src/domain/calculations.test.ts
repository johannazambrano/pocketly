import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { availableYears, averageBalanceBefore, breakdownItems, compareToAverage, estimateCategoryIds, estimateMonthlyIncome, forecast, frequentTemplates, monthBreakdown, monthSummary, oneTimeTagBreakdown, tagBreakdown, tagTrends, upcomingCharges, variableSpending, yearSummary } from './calculations'

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

  it('le ripartizioni "a oggi" tornano con le uscite a oggi', () => {
    const s = yearSummary(sample(), 2026, TODAY)
    expect(s.oneTimeToDate + s.recurringToDate).toBe(s.expensesToDate)
    expect(s.oneTimeToDate).toBe(5000)
    const sumOf = (rows: { total: number }[]) => rows.reduce((acc, r) => acc + r.total, 0)
    expect(sumOf(s.byCategoryToDate)).toBe(s.expensesToDate)
    expect(sumOf(s.byPaymentMethodToDate)).toBe(s.expensesToDate)
    // Quelle di tutto l'anno comprendono anche affitto e assicurazione di dicembre.
    expect(sumOf(s.byCategory)).toBe(s.totalExpenses)
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

    it('senza entrate che si ripetono non stima nulla', () => {
      // sample(): stipendi solo a marzo e aprile, nessuno nei 3 mesi prima di novembre
      expect(estimateMonthlyIncome(sample(), TODAY)).toBe(0)
    })

    it('se spenta non stima nulla, anche con le categorie scelte', () => {
      const d = withEstimate(sample())
      d.forecast.estimateIncome = false
      expect(estimateMonthlyIncome(d, TODAY)).toBe(0)
    })

    it('senza categorie scelte usa quelle che si ripetono in almeno 2 dei 3 mesi precedenti', () => {
      const d = createEmptyData()
      d.incomes.push(
        salary('a', '2026-08-27', 180000),
        salary('b', '2026-09-27', 180000),
        salary('c', '2026-10-27', 180000),
        gift('g', '2026-09-10', 50000),
      )
      expect(d.forecast).toMatchObject({ estimateIncome: true, incomeCategoryIds: [] })
      expect(estimateCategoryIds(d, '2026-11-06')).toEqual(['salary'])
      expect(estimateMonthlyIncome(d, '2026-11-06')).toBe(180000)
      // Il previsto di novembre comprende lo stipendio atteso.
      expect(monthSummary(d, 2026, 10, '2026-11-06').projectedIncome).toBe(180000)
    })

    it('le categorie scelte dall’utente prevalgono su quelle automatiche', () => {
      const d = withEstimate(createEmptyData(), ['gift'])
      d.incomes.push(salary('a', '2026-09-27', 180000), salary('b', '2026-10-27', 180000), gift('g', '2026-10-10', 50000))
      expect(estimateCategoryIds(d, '2026-11-06')).toEqual(['gift'])
      expect(estimateMonthlyIncome(d, '2026-11-06')).toBe(50000)
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

describe('compareToAverage', () => {
  it('in linea entro il 10% della media, sopra o sotto oltre', () => {
    expect(compareToAverage(10500, 10000)).toBe('inline')
    expect(compareToAverage(9000, 10000)).toBe('inline')
    expect(compareToAverage(11001, 10000)).toBe('above')
    expect(compareToAverage(8999, 10000)).toBe('below')
  })

  it('con una media negativa il margine si calcola sul valore assoluto', () => {
    expect(compareToAverage(-10500, -10000)).toBe('inline')
    expect(compareToAverage(-5000, -10000)).toBe('above')
    expect(compareToAverage(-20000, -10000)).toBe('below')
  })
})

describe('averageBalanceBefore', () => {
  it('fa la media del saldo dei mesi precedenti, dal primo mese con movimenti', () => {
    // periodo da marzo; saldi: marzo 2000 − 50 − 700 = 1250, aprile 2000 − 700 = 1300 → media 1275
    expect(averageBalanceBefore(sample(), 2026, 4, TODAY)).toBe(127500)
  })

  it('il primo mese del periodo non ha mesi con cui confrontarsi', () => {
    expect(averageBalanceBefore(sample(), 2026, 2, TODAY)).toBeNull()
  })
})

describe('variableSpending', () => {
  const spend = (id: string, date: string, amount: number) =>
    ({ id, name: id, amount, date, categoryId: 'c', paymentMethodId: 'p', notes: '' }) as const

  it('somma le spese una tantum del mese di oggi e le confronta con la media dei mesi precedenti', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(
      spend('a', '2026-03-10', 10000),
      spend('b', '2026-04-10', 20000),
      spend('c', '2026-06-01', 30000),
      spend('d', '2026-06-20', 5000),
      spend('e', '2026-07-01', 99999), // mese futuro: non conta
      spend('f', '2025-12-31', 99999), // altro anno: non conta
    )
    // mesi precedenti dal primo movimento: marzo 100, aprile 200, maggio 0 → media 100
    expect(variableSpending(d, '2026-06-15')).toEqual({ month: 5, total: 35000, toDate: 30000, previousAverage: 10000 })
  })

  it('i mesi prima del primo movimento non fanno media', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(spend('a', '2026-05-10', 20000), spend('b', '2026-06-02', 5000))
    expect(variableSpending(d, '2026-06-15')).toEqual({ month: 5, total: 5000, toDate: 5000, previousAverage: 20000 })
  })

  it('il primo mese non ha una media di confronto', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(spend('a', '2026-06-02', 5000))
    expect(variableSpending(d, '2026-06-15')).toEqual({ month: 5, total: 5000, toDate: 5000, previousAverage: null })
  })

  it('senza spese il mese vale 0', () => {
    expect(variableSpending(createEmptyData(), '2026-06-15')).toEqual({ month: 5, total: 0, toDate: 0, previousAverage: null })
  })
})

describe('upcomingCharges', () => {
  it('elenca gli addebiti entro la finestra, ordinati', () => {
    const list = upcomingCharges(sample(), '2026-11-20', '2026-12-20')
    expect(list.map((c) => [c.id, c.date, c.daysLeft])).toEqual([
      ['r1', '2026-12-01', 11],
      ['r2', '2026-12-15', 25],
    ])
  })

  it('esclude ciò che ha la data di oggi e comprende le spese variabili future', () => {
    const data = sample()
    data.oneTimeExpenses.push(
      { id: 'oggi', name: 'Oggi', amount: 100, date: '2026-11-20', categoryId: 'food', paymentMethodId: 'card', notes: '' },
      { id: 'dopo', name: 'Concerto', amount: 6000, date: '2026-11-25', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    )
    const list = upcomingCharges(data, '2026-11-20', '2026-11-30')
    expect(list.map((c) => [c.key, c.source])).toEqual([['o-dopo', 'oneTime']])
  })

  it('sul mese in corso la somma coincide con "ancora in arrivo"', () => {
    const data = sample()
    data.oneTimeExpenses.push(
      { id: 'dopo', name: 'Concerto', amount: 6000, date: '2026-11-25', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    )
    data.recurringExpenses.push(
      { id: 'r3', name: 'Palestra', amount: 4500, frequency: 'monthly', startDate: '2026-01-28', endDate: null, categoryId: 'home', paymentMethodId: 'bank' },
    )
    const m = monthSummary(data, 2026, 10, TODAY)
    const list = upcomingCharges(data, TODAY, '2026-11-30')
    expect(list.reduce((acc, c) => acc + c.amount, 0)).toBe(m.expenses - m.expensesToDate)
  })
})

describe('availableYears', () => {
  it('include anno corrente e anni dei dati', () => {
    expect(availableYears(sample(), 2026)).toEqual([2025, 2026])
  })
})

describe('monthBreakdown', () => {
  it('calcola correttamente le spese per categoria e metodo per un singolo mese', () => {
    // sample() ha:
    // Marzo (month 2): spesa una tantum 5000 (cat: food, pm: card) + ricorrente affitto 70000 (cat: home, pm: bank)
    const res = monthBreakdown(sample(), 2026, 2)
    expect(res.totalExpenses).toBe(75000)
    expect(res.byCategory).toEqual([
      { id: 'home', total: 70000 },
      { id: 'food', total: 5000 },
    ])
    expect(res.byPaymentMethod).toEqual([
      { id: 'bank', total: 70000 },
      { id: 'card', total: 5000 },
    ])
  })

  it('include ricorrenti semestrali solo nei mesi in cui scadono', () => {
    // Giugno (month 5): affitto (home 70000) + assicurazione (car 60000)
    const res = monthBreakdown(sample(), 2026, 5)
    expect(res.totalExpenses).toBe(130000)
    expect(res.byCategory).toEqual([
      { id: 'home', total: 70000 },
      { id: 'car', total: 60000 },
    ])

    // Luglio (month 6): solo affitto (home 70000), assicurazione non scade a luglio
    const july = monthBreakdown(sample(), 2026, 6)
    expect(july.totalExpenses).toBe(70000)
    expect(july.byCategory).toEqual([{ id: 'home', total: 70000 }])
  })

  it('restituisce liste vuote e totale 0 se non ci sono uscite nel mese', () => {
    const res = monthBreakdown(sample(), 2024, 0)
    expect(res.totalExpenses).toBe(0)
    expect(res.byCategory).toEqual([])
    expect(res.byPaymentMethod).toEqual([])
  })
})

describe('monthSummary', () => {
  it('calcola entrate, uscite totali, saldo e ripartizione per un dato mese', () => {
    const res = monthSummary(sample(), 2026, 2)
    expect(res.income).toBe(200000)
    expect(res.expenses).toBe(75000)
    expect(res.balance).toBe(125000)
    expect(res.oneTimeTotal).toBe(5000)
    expect(res.recurringInMonth).toBe(70000)
    expect(res.byCategory).toHaveLength(2)
    expect(res.byPaymentMethod).toHaveLength(2)
  })

  it('nel mese corrente separa ciò che è avvenuto da ciò che deve ancora arrivare', () => {
    const d = sample()
    d.oneTimeExpenses.push(
      { id: 'n1', name: 'Spesa', amount: 4000, date: '2026-11-03', categoryId: 'food', paymentMethodId: 'card', notes: '' },
      { id: 'n2', name: 'Concerto', amount: 6000, date: '2026-11-25', categoryId: 'fun', paymentMethodId: 'card', notes: '' },
    )
    d.incomes.push({ id: 'n3', name: 'Stipendio', amount: 200000, date: '2026-11-27', categoryId: 'salary', paymentMethodId: 'bank' })
    // Il 5 novembre: affitto (1/11) e spesa del 3 avvenuti; concerto e stipendio ancora da venire.
    const res = monthSummary(d, 2026, 10, '2026-11-05')
    expect(res.timing).toBe('current')
    expect(res.expensesToDate).toBe(70000 + 4000)
    expect(res.oneTimeToDate).toBe(4000)
    expect(res.recurringToDate).toBe(70000)
    expect(res.expenses).toBe(70000 + 4000 + 6000)
    expect(res.incomeToDate).toBe(0)
    expect(res.balanceToDate).toBe(-74000)
    expect(res.byCategoryToDate).toEqual([
      { id: 'home', total: 70000 },
      { id: 'food', total: 4000 },
    ])
    // Il previsto conta tutte le uscite del mese e le entrate registrate, anche future; le simulazioni no.
    expect(res.projectedIncome).toBe(200000)
    expect(res.projectedBalance).toBe(200000 - 80000)
  })

  it('un mese passato è tutto avvenuto, uno futuro non ha ancora nulla di avvenuto', () => {
    const past = monthSummary(sample(), 2026, 2, '2026-11-05')
    expect(past.timing).toBe('past')
    expect(past.expensesToDate).toBe(past.expenses)
    expect(past.incomeToDate).toBe(past.income)
    expect(past.byCategoryToDate).toEqual(past.byCategory)
    const future = monthSummary(sample(), 2026, 11, '2026-11-05')
    expect(future.timing).toBe('future')
    expect(future.expensesToDate).toBe(0)
    expect(future.byCategoryToDate).toEqual([])
    expect(future.expenses).toBe(70000 + 60000)
  })

  it('il previsto del mese aggiunge la stima delle entrate se attivata', () => {
    const d = sample()
    d.forecast.estimateIncome = true
    d.forecast.incomeCategoryIds = ['salary']
    const dec = monthSummary(d, 2026, 11, '2026-11-05')
    expect(dec.income).toBe(0)
    expect(dec.projectedIncome).toBe(200000)
    expect(dec.projectedBalance).toBe(200000 - 130000)
  })

  it('funziona correttamente in un mese senza entrate ma con uscite', () => {
    const res = monthSummary(sample(), 2026, 0)
    expect(res.income).toBe(0)
    expect(res.expenses).toBe(70000)
    expect(res.balance).toBe(-70000)
    expect(res.recurringInMonth).toBe(70000)
    expect(res.oneTimeTotal).toBe(0)
  })
})

describe('tagBreakdown / oneTimeTagBreakdown', () => {
  it('restituisce un array vuoto se non ci sono elementi o nessuno ha tag', () => {
    expect(tagBreakdown([])).toEqual([])
    expect(
      tagBreakdown([
        { amount: 100 },
        { amount: 200, tagIds: [] },
      ]),
    ).toEqual([])
  })

  it('calcola totale e conteggio aggregato per tag, ordinati per importo decrescente', () => {
    const expenses = [
      { id: '1', name: 'Volo', amount: 35000, date: '2026-07-15', categoryId: 'c1', paymentMethodId: 'p1', notes: '', tagIds: ['vacanza'] },
      { id: '2', name: 'Hotel', amount: 65000, date: '2026-07-16', categoryId: 'c1', paymentMethodId: 'p1', notes: '', tagIds: ['vacanza', 'alloggio'] },
      { id: '3', name: 'Cena', amount: 8000, date: '2026-07-16', categoryId: 'c2', paymentMethodId: 'p1', notes: '', tagIds: ['vacanza'] },
      { id: '4', name: 'Regalo', amount: 5000, date: '2026-07-20', categoryId: 'c3', paymentMethodId: 'p1', notes: '', tagIds: ['regali'] },
    ]

    const breakdown = tagBreakdown(expenses)
    expect(breakdown).toEqual([
      { id: 'vacanza', total: 108000, count: 3 },
      { id: 'alloggio', total: 65000, count: 1 },
      { id: 'regali', total: 5000, count: 1 },
    ])
    // Verifica retrocompatibilità
    expect(oneTimeTagBreakdown(expenses)).toEqual(breakdown)
  })

  it('funziona anche con entrate dotate di tag', () => {
    const incomes = [
      { id: 'i1', name: 'Bonus', amount: 100000, date: '2026-07-15', categoryId: 'c1', paymentMethodId: 'p1', notes: '', tagIds: ['lavoro', 'premio'] },
      { id: 'i2', name: 'Stipendio', amount: 200000, date: '2026-07-27', categoryId: 'c1', paymentMethodId: 'p1', notes: '', tagIds: ['lavoro'] },
    ]
    expect(tagBreakdown(incomes)).toEqual([
      { id: 'lavoro', total: 300000, count: 2 },
      { id: 'premio', total: 100000, count: 1 },
    ])
  })
})

describe('breakdownItems', () => {
  const total = (items: { amount: number }[]) => items.reduce((acc, i) => acc + i.amount, 0)

  it('sull’anno in corso le voci sommano la riga "a oggi" della dashboard', () => {
    const data = sample()
    const s = yearSummary(data, 2026, TODAY)
    for (const row of s.byCategoryToDate) {
      expect(total(breakdownItems(data, 2026, 'all', 'categoryId', row.id, TODAY))).toBe(row.total)
    }
    for (const row of s.byPaymentMethodToDate) {
      expect(total(breakdownItems(data, 2026, 'all', 'paymentMethodId', row.id, TODAY))).toBe(row.total)
    }
  })

  it('nel mese in corso contano solo le voci fino a oggi, nei mesi passati e futuri tutto il mese', () => {
    const data = sample()
    for (const month of [9, 10, 11]) {
      const m = monthSummary(data, 2026, month, TODAY)
      const rows = m.timing === 'current' ? m.byCategoryToDate : m.byCategory
      for (const row of rows) {
        expect(total(breakdownItems(data, 2026, month, 'categoryId', row.id, TODAY))).toBe(row.total)
      }
    }
  })

  it('elenca un addebito ricorrente per ogni scadenza, dalla più recente', () => {
    const items = breakdownItems(sample(), 2026, 'all', 'categoryId', 'home', TODAY)
    expect(items.every((i) => i.source === 'recurring')).toBe(true)
    expect(items[0]!.date).toBe('2026-11-01')
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })
})

describe('frequentTemplates', () => {
  it('restituisce array vuoto se non ci sono elementi', () => {
    expect(frequentTemplates([])).toEqual([])
  })

  it('ordina per frequenza decrescente e prende i dati della versione più recente', () => {
    const items = [
      { name: 'Caffè', amount: 120, date: '2026-06-01', categoryId: 'c1', paymentMethodId: 'p1', notes: 'Bar' },
      { name: 'Caffè', amount: 130, date: '2026-06-05', categoryId: 'c1', paymentMethodId: 'p1', notes: 'Prezzo aumentato' },
      { name: 'Pranzo', amount: 1200, date: '2026-06-02', categoryId: 'c1', paymentMethodId: 'p1' },
      { name: 'Supermercato', amount: 4500, date: '2026-06-03', categoryId: 'c1', paymentMethodId: 'p1' },
      { name: 'Supermercato', amount: 5000, date: '2026-06-04', categoryId: 'c1', paymentMethodId: 'p1' },
      { name: 'Supermercato', amount: 4800, date: '2026-06-06', categoryId: 'c1', paymentMethodId: 'p1', tagIds: ['spesa'] },
    ]

    const templates = frequentTemplates(items, 2)
    expect(templates).toHaveLength(2)
    // Supermercato (3 volte)
    expect(templates[0]?.name).toBe('Supermercato')
    expect(templates[0]?.count).toBe(3)
    // Prende i dati dell'ultima occorrenza (2026-06-06)
    expect(templates[0]?.amount).toBe(4800)
    expect(templates[0]?.tagIds).toEqual(['spesa'])

    // Caffè (2 volte)
    expect(templates[1]?.name).toBe('Caffè')
    expect(templates[1]?.count).toBe(2)
    expect(templates[1]?.amount).toBe(130)
    expect(templates[1]?.notes).toBe('Prezzo aumentato')
  })
})

describe('tagTrends', () => {
  it('restituisce mappa vuota per mese all o totals vuoto', () => {
    const d = createEmptyData()
    expect(tagTrends(d, 2026, 'all', 'categoryId', [{ id: 'c1', total: 5000 }], '2026-06-15').size).toBe(0)
    expect(tagTrends(d, 2026, 5, 'categoryId', [], '2026-06-15').size).toBe(0)
  })

  it('restituisce mappa vuota per mesi futuri o se non ci sono mesi precedenti', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push({ id: 'o1', name: 'Spesa', amount: 5000, date: '2026-03-10', categoryId: 'c1', paymentMethodId: 'p1', notes: '' })
    // Mese 2 (marzo) è il primo mese con movimenti: nessun mese precedente
    expect(tagTrends(d, 2026, 2, 'categoryId', [{ id: 'c1', total: 5000 }], '2026-06-15').size).toBe(0)
    // Mese 7 (agosto) è futuro rispetto a oggi (2026-06-15)
    expect(tagTrends(d, 2026, 7, 'categoryId', [{ id: 'c1', total: 5000 }], '2026-06-15').size).toBe(0)
  })

  it('calcola la media dei mesi passati e assegna i verdetti correttamente', () => {
    const d = createEmptyData()
    // Gennaio (mese 0): c1 = 10000, c2 = 4000
    d.oneTimeExpenses.push(
      { id: 'o1', name: 'A', amount: 10000, date: '2026-01-10', categoryId: 'c1', paymentMethodId: 'p1', notes: '' },
      { id: 'o2', name: 'B', amount: 4000, date: '2026-01-12', categoryId: 'c2', paymentMethodId: 'p1', notes: '' },
    )
    // Febbraio (mese 1): c1 = 10000
    d.oneTimeExpenses.push(
      { id: 'o3', name: 'C', amount: 10000, date: '2026-02-10', categoryId: 'c1', paymentMethodId: 'p1', notes: '' },
    )
    // Marzo (mese 2): mese passato rispetto a TODAY = '2026-06-15'
    // Media c1 su gen-feb (2 mesi): (10000 + 10000) / 2 = 10000
    // Media c2 su gen-feb (2 mesi): (4000 + 0) / 2 = 2000

    // Caso 1: c1 con 12000 (> 10000 + 10%) -> above
    const res1 = tagTrends(d, 2026, 2, 'categoryId', [{ id: 'c1', total: 12000 }], '2026-06-15')
    const t1 = res1.get('c1')
    expect(t1).toBeDefined()
    expect(t1?.previousAverage).toBe(10000)
    expect(t1?.baseline).toBe(10000)
    expect(t1?.verdict).toBe('above')
    expect(t1?.diffPercent).toBe(20)
    expect(t1?.isPace).toBe(false)

    // Caso 2: c1 con 10500 (entro 10%) -> inline
    const res2 = tagTrends(d, 2026, 2, 'categoryId', [{ id: 'c1', total: 10500 }], '2026-06-15')
    expect(res2.get('c1')?.verdict).toBe('inline')
    expect(res2.get('c1')?.diffPercent).toBe(5)

    // Caso 3: c1 con 8000 (< 10000 - 10%) -> below
    const res3 = tagTrends(d, 2026, 2, 'categoryId', [{ id: 'c1', total: 8000 }], '2026-06-15')
    expect(res3.get('c1')?.verdict).toBe('below')
    expect(res3.get('c1')?.diffPercent).toBe(-20)

    // Categoria mai usata prima (c3) non ha media precedente e viene ignorata
    const res4 = tagTrends(d, 2026, 2, 'categoryId', [{ id: 'c3', total: 5000 }], '2026-06-15')
    expect(res4.has('c3')).toBe(false)
  })

  it('per il mese in corso proietta la media precedente al ritmo atteso (pace)', () => {
    const d = createEmptyData()
    // Gennaio e Febbraio: spesa c1 di 31000 centesimi (310 €) ciascuno
    d.oneTimeExpenses.push(
      { id: 'o1', name: 'A', amount: 31000, date: '2026-01-10', categoryId: 'c1', paymentMethodId: 'p1', notes: '' },
      { id: 'o2', name: 'B', amount: 31000, date: '2026-02-10', categoryId: 'c1', paymentMethodId: 'p1', notes: '' },
    )
    // Oggi è 10 marzo 2026 (marzo ha 31 giorni).
    // Media precedente: 31000. Ritmo al giorno 10: Math.round(31000 * 10 / 31) = 10000.
    const today = '2026-03-10'
    const totals = [{ id: 'c1', total: 10000 }]
    const trends = tagTrends(d, 2026, 2, 'categoryId', totals, today)

    const info = trends.get('c1')
    expect(info).toBeDefined()
    expect(info?.previousAverage).toBe(31000)
    expect(info?.baseline).toBe(10000)
    expect(info?.verdict).toBe('inline')
    expect(info?.isPace).toBe(true)
    expect(info?.diffPercent).toBe(0)
  })

  it('funziona allo stesso modo per i metodi di pagamento', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(
      { id: 'o1', name: 'A', amount: 5000, date: '2026-01-10', categoryId: 'c1', paymentMethodId: 'card', notes: '' },
    )
    const trends = tagTrends(d, 2026, 1, 'paymentMethodId', [{ id: 'card', total: 6000 }], '2026-03-01')
    const info = trends.get('card')
    expect(info).toBeDefined()
    expect(info?.previousAverage).toBe(5000)
    expect(info?.verdict).toBe('above')
  })
})
