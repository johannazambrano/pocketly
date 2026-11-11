import { describe, expect, it } from 'vitest'
import type { RecurringExpense } from '@/types/models'
import { isActiveInYear, monthlyEquivalent, nextDueDate, occursIn, splitRecurring } from './recurrence'

const rec = (over: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'r',
  name: 'r',
  amount: 1200,
  frequency: 'monthly',
  startDate: '2026-01-15',
  endDate: null,
  categoryId: 'c',
  paymentMethodId: 'p',
  ...over,
})

describe('monthlyEquivalent', () => {
  it('divide per il numero di mesi della frequenza (anche semestrale)', () => {
    expect(monthlyEquivalent(rec({ frequency: 'monthly' }))).toBe(1200)
    expect(monthlyEquivalent(rec({ frequency: 'quarterly' }))).toBe(400)
    expect(monthlyEquivalent(rec({ frequency: 'semiannual' }))).toBe(200)
    expect(monthlyEquivalent(rec({ frequency: 'annual' }))).toBe(100)
  })
})

describe('occursIn', () => {
  it('rispetta inizio, passo e fine', () => {
    const q = rec({ frequency: 'quarterly', startDate: '2026-02-01', endDate: '2026-11-30' })
    const months = Array.from({ length: 12 }, (_, m) => m).filter((m) => occursIn(q, 2026, m))
    expect(months).toEqual([1, 4, 7, 10])
    expect(occursIn(q, 2027, 1)).toBe(false)
  })

  it('continua negli anni successivi', () => {
    const a = rec({ frequency: 'annual', startDate: '2026-03-10' })
    expect(occursIn(a, 2027, 2)).toBe(true)
    expect(occursIn(a, 2027, 3)).toBe(false)
  })
})

describe('nextDueDate', () => {
  it('trova il prossimo addebito mensile', () => {
    expect(nextDueDate(rec(), '2026-10-07')).toBe('2026-10-15')
    expect(nextDueDate(rec(), '2026-10-16')).toBe('2026-11-15')
  })

  it('limita il giorno alla fine del mese', () => {
    expect(nextDueDate(rec({ startDate: '2026-01-31' }), '2026-02-01')).toBe('2026-02-28')
  })

  it('restituisce la data di inizio se è nel futuro, null se terminata', () => {
    expect(nextDueDate(rec({ startDate: '2027-05-01' }), '2026-10-07')).toBe('2027-05-01')
    expect(nextDueDate(rec({ endDate: '2026-09-30' }), '2026-10-07')).toBeNull()
  })

  it('gestisce le frequenze annuali', () => {
    expect(nextDueDate(rec({ frequency: 'annual', startDate: '2026-03-10' }), '2026-10-07')).toBe('2027-03-10')
  })
})

describe('isActiveInYear', () => {
  it('considera inizio e fine', () => {
    const r = rec({ startDate: '2026-06-01', endDate: '2027-02-01' })
    expect([2025, 2026, 2027, 2028].map((y) => isActiveInYear(r, y))).toEqual([false, true, true, false])
  })
})

describe('splitRecurring', () => {
  const changes = { name: 'r', amount: 1500, frequency: 'monthly' as const, endDate: null, categoryId: 'c', paymentMethodId: 'p' }

  it('ferma la serie il giorno prima e ne fa partire una nuova da quell addebito', () => {
    const { before, after } = splitRecurring(rec(), '2026-11-15', changes)
    expect(before).toMatchObject({ id: 'r', amount: 1200, startDate: '2026-01-15', endDate: '2026-11-14' })
    expect(after).toMatchObject({ amount: 1500, startDate: '2026-11-15', endDate: null })
    expect('id' in after).toBe(false)
  })

  it('gli addebiti prima restano, quelli da lì in poi hanno il nuovo importo', () => {
    const { before, after } = splitRecurring(rec(), '2026-11-15', changes)
    const next = { ...after, id: 'n' }
    expect(occursIn(before, 2026, 9)).toBe(true)
    expect(occursIn(before, 2026, 10)).toBe(false)
    expect(occursIn(next, 2026, 10)).toBe(true)
    expect(occursIn(next, 2026, 9)).toBe(false)
  })

  it('dal primo addebito non si divide: si modifica la serie intera', () => {
    expect(() => splitRecurring(rec(), '2026-01-15', changes)).toThrow()
  })
})

describe('occursIn con la fine a metà mese', () => {
  it('nel mese in cui finisce conta il giorno: finita il 14, niente addebito del 15', () => {
    expect(occursIn(rec({ endDate: '2026-11-14' }), 2026, 10)).toBe(false)
    expect(occursIn(rec({ endDate: '2026-11-15' }), 2026, 10)).toBe(true)
    expect(occursIn(rec({ endDate: '2026-11-30' }), 2026, 10)).toBe(true)
  })
})
