import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { budgetMonth, suggestLimits } from './budget'

const spend = (id: string, date: string, amount: number, categoryId = 'food') => ({
  id,
  name: id,
  amount,
  date,
  categoryId,
  paymentMethodId: 'card',
  notes: '',
})

function sample(): FinanceData {
  const d = createEmptyData()
  d.budget.limits = { food: 40000, home: 100000 }
  d.oneTimeExpenses.push(
    spend('a', '2026-10-02', 10000),
    spend('b', '2026-10-10', 6000),
    spend('c', '2026-10-25', 4000), // data futura rispetto a oggi
    spend('d', '2026-09-30', 99999), // altro mese: non conta
    spend('e', '2026-10-05', 3000, 'fun'), // categoria senza limite
  )
  d.recurringExpenses.push(
    { id: 'r1', name: 'Affitto', amount: 70000, frequency: 'monthly', startDate: '2026-01-01', endDate: null, categoryId: 'home', paymentMethodId: 'bank' },
    { id: 'r2', name: 'Bollette', amount: 8000, frequency: 'monthly', startDate: '2026-01-20', endDate: null, categoryId: 'home', paymentMethodId: 'bank' },
  )
  return d
}

describe('budgetMonth', () => {
  const today = '2026-10-15'

  it('separa speso, in programma e rimanente per categoria', () => {
    const b = budgetMonth(sample(), 2026, 9, today)
    const food = b.lines.find((l) => l.categoryId === 'food')!
    expect(food).toMatchObject({ limit: 40000, spent: 16000, scheduled: 4000, remaining: 20000, status: 'ok' })
    // affitto già addebitato il 1°, bollette il 20: ancora in programma
    const home = b.lines.find((l) => l.categoryId === 'home')!
    expect(home).toMatchObject({ limit: 100000, spent: 70000, scheduled: 8000, remaining: 22000 })
  })

  it('totali, spese senza budget e ordine per quota consumata', () => {
    const b = budgetMonth(sample(), 2026, 9, today)
    expect(b.totalLimit).toBe(140000)
    expect(b.totalSpent).toBe(86000)
    expect(b.totalScheduled).toBe(12000)
    expect(b.totalRemaining).toBe(42000)
    expect(b.unbudgeted).toBe(3000)
    // home 78%, food 50%
    expect(b.lines.map((l) => l.categoryId)).toEqual(['home', 'food'])
  })

  it('stato: attenzione dall’80% e superato oltre il limite', () => {
    const d = createEmptyData()
    d.budget.limits = { a: 10000, b: 10000, c: 10000 }
    d.oneTimeExpenses.push(spend('1', '2026-10-01', 7999, 'a'), spend('2', '2026-10-01', 8000, 'b'), spend('3', '2026-10-01', 10001, 'c'))
    const status = Object.fromEntries(budgetMonth(d, 2026, 9, today).lines.map((l) => [l.categoryId, l.status]))
    expect(status).toEqual({ a: 'ok', b: 'warning', c: 'over' })
  })

  it('disponibile al giorno: il rimanente diviso per i giorni da oggi a fine mese, oggi compreso', () => {
    const b = budgetMonth(sample(), 2026, 9, today)
    expect(b.daysLeft).toBe(17) // 15..31 ottobre
    expect(b.dailyAvailable).toBe(Math.floor(42000 / 17))
  })

  it('budget esaurito: niente importo giornaliero', () => {
    const d = createEmptyData()
    d.budget.limits = { food: 10000 }
    d.oneTimeExpenses.push(spend('a', '2026-10-03', 12000))
    const b = budgetMonth(d, 2026, 9, today)
    expect(b.totalRemaining).toBe(-2000)
    expect(b.dailyAvailable).toBeNull()
    expect(b.status).toBe('over')
  })

  it('ritmo: le variabili si estendono ai giorni che restano, le ricorrenze valgono quanto sono', () => {
    const d = createEmptyData()
    d.budget.limits = { food: 100000 }
    d.oneTimeExpenses.push(spend('a', '2026-10-05', 15000), spend('b', '2026-10-14', 15000))
    d.recurringExpenses.push(
      { id: 'r', name: 'Abbonamento', amount: 5000, frequency: 'monthly', startDate: '2026-01-28', endDate: null, categoryId: 'food', paymentMethodId: 'bank' },
    )
    const b = budgetMonth(d, 2026, 9, today)
    // variabili 300 € in 15 giorni = 20 €/giorno × 16 giorni restanti = 320 €; più 300 € spesi e l'abbonamento da 50 €
    expect(b.lines[0]!.projected).toBe(30000 + 5000 + 32000)
    expect(b.projected).toBe(67000)
  })

  it('ritmo: nei primi giorni del mese non si fa nessuna proiezione', () => {
    const b = budgetMonth(sample(), 2026, 9, '2026-10-04')
    expect(b.lines.every((l) => l.projected === null)).toBe(true)
    expect(b.projected).toBeNull()
    expect(b.dailyAvailable).not.toBeNull()
  })

  it('mesi passati e futuri: nessun importo giornaliero né proiezione', () => {
    const past = budgetMonth(sample(), 2026, 8, today)
    expect(past.daysLeft).toBeNull()
    expect(past.dailyAvailable).toBeNull()
    expect(past.projected).toBeNull()
    expect(past.lines.find((l) => l.categoryId === 'food')).toMatchObject({ spent: 99999, scheduled: 0 })

    const future = budgetMonth(sample(), 2026, 10, today)
    expect(future.totalSpent).toBe(0)
    expect(future.lines.find((l) => l.categoryId === 'home')).toMatchObject({ spent: 0, scheduled: 78000 })
  })

  it('le ricorrenze non mensili contano solo nel mese di scadenza', () => {
    const d = createEmptyData()
    d.budget.limits = { car: 50000 }
    d.recurringExpenses.push(
      { id: 'r', name: 'Assicurazione', amount: 60000, frequency: 'semiannual', startDate: '2026-06-15', endDate: null, categoryId: 'car', paymentMethodId: 'bank' },
    )
    expect(budgetMonth(d, 2026, 11, '2026-10-15').lines[0]).toMatchObject({ scheduled: 60000, status: 'over' })
    expect(budgetMonth(d, 2026, 9, '2026-10-15').lines[0]).toMatchObject({ scheduled: 0, spent: 0 })
  })

  it('senza limiti non c’è niente da mostrare', () => {
    const b = budgetMonth(createEmptyData(), 2026, 9, today)
    expect(b.lines).toEqual([])
    expect(b.projected).toBeNull()
    expect(b.dailyAvailable).toBeNull()
  })
})

describe('suggestLimits', () => {
  it('media delle variabili degli ultimi 3 mesi più il costo medio mensile delle ricorrenze', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(
      spend('0', '2026-05-01', 99999), // troppo vecchio
      spend('1', '2026-07-10', 30000),
      spend('2', '2026-08-10', 60000),
      spend('3', '2026-09-10', 0),
      spend('4', '2026-10-03', 99999), // il mese in corso non entra nella media
    )
    d.recurringExpenses.push(
      { id: 'r', name: 'Assicurazione', amount: 60000, frequency: 'annual', startDate: '2026-03-01', endDate: null, categoryId: 'food', paymentMethodId: 'bank' },
    )
    // variabili (300+600+0)/3 = 300 €; assicurazione 600/12 = 50 €
    expect(suggestLimits(d, 2026, 9)).toEqual({ food: 35000 })
  })

  it('i mesi prima del primo movimento non fanno media', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(spend('1', '2026-09-10', 20000), spend('2', '2026-10-03', 5000))
    // solo settembre è utilizzabile: 200 €, non 200/3
    expect(suggestLimits(d, 2026, 9)).toEqual({ food: 20000 })
  })

  it('arrotonda ai 5 € e scarta gli importi che arrivano a zero', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(spend('1', '2026-08-10', 12300), spend('2', '2026-08-11', 100, 'tiny'), spend('3', '2026-09-01', 0))
    // food: (123+0)/2 = 61,5 → 60 €; tiny: 0,5 € → 0
    expect(suggestLimits(d, 2026, 9)).toEqual({ food: 6000 })
  })

  it('una ricorrenza conclusa o non ancora iniziata non entra', () => {
    const d = createEmptyData()
    d.oneTimeExpenses.push(spend('1', '2026-08-10', 100, 'x'))
    d.recurringExpenses.push(
      { id: 'a', name: 'Finita', amount: 6000, frequency: 'monthly', startDate: '2026-01-01', endDate: '2026-08-31', categoryId: 'old', paymentMethodId: 'bank' },
      { id: 'b', name: 'Futura', amount: 6000, frequency: 'monthly', startDate: '2026-11-01', endDate: null, categoryId: 'new', paymentMethodId: 'bank' },
    )
    expect(Object.keys(suggestLimits(d, 2026, 9))).toEqual([])
  })

  it('senza movimenti non propone nulla', () => {
    expect(suggestLimits(createEmptyData(), 2026, 9)).toEqual({})
  })
})
