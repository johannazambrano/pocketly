import { describe, expect, it } from 'vitest'
import type { RecurringExpense } from '@/types/models'
import { dueDateIn, groupRecurringSeries, isActiveInYear, monthlyEquivalent, moveWindow, nextDueDate, occursIn, seriesKey, splitRecurring } from './recurrence'

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

  it('collega le due parti con l id della prima, anche dividendo di nuovo', () => {
    const { before, after } = splitRecurring(rec(), '2026-11-15', changes)
    expect(before.seriesId).toBe('r')
    expect(after.seriesId).toBe('r')
    const again = splitRecurring({ ...after, id: 'n' }, '2027-03-15', { ...changes, amount: 1700 })
    expect(again.before).toMatchObject({ id: 'n', seriesId: 'r', endDate: '2027-03-14' })
    expect(again.after.seriesId).toBe('r')
  })
})

describe('spostare il giorno da un addebito in poi', () => {
  const changes = { name: 'r', amount: 1300, frequency: 'monthly' as const, endDate: null, categoryId: 'c', paymentMethodId: 'p' }
  const netflix = rec({ startDate: '2026-01-14', amount: 1300 })
  /** Le date degli addebiti di tutte le parti in un anno, in ordine. */
  const charges = (parts: ReturnType<typeof rec>[], year = 2026) =>
    Array.from({ length: 12 }, (_, m) => parts.map((p) => dueDateIn(p, year, m)).filter(Boolean)).flat().sort()

  it('i limiti vanno dal giorno dopo l addebito precedente al giorno prima del successivo', () => {
    expect(moveWindow(netflix, '2026-11-14')).toEqual({ min: '2026-10-15', max: '2026-12-13' })
    expect(moveWindow(rec({ startDate: '2026-01-14', endDate: '2026-12-01' }), '2026-11-14').max).toBe('2026-12-01')
    expect(moveWindow(rec({ startDate: '2026-01-31' }), '2026-03-31')).toEqual({ min: '2026-03-01', max: '2026-04-29' })
  })

  it('dal 14 al 15: a novembre un addebito solo, il 15, e da lì sempre il 15', () => {
    const { before, after } = splitRecurring(netflix, '2026-11-14', changes, '2026-11-15')
    expect(before.endDate).toBe('2026-11-13')
    const list = charges([before, { ...after, id: 'n' }])
    expect(list.filter((d) => d!.startsWith('2026-11'))).toEqual(['2026-11-15'])
    expect(list.filter((d) => d!.startsWith('2026-10'))).toEqual(['2026-10-14'])
    expect(list.filter((d) => d!.startsWith('2026-12'))).toEqual(['2026-12-15'])
    expect(list).toHaveLength(12)
  })

  it('dal 14 al 10: a novembre un addebito solo, il 10', () => {
    const { before, after } = splitRecurring(netflix, '2026-11-14', changes, '2026-11-10')
    expect(before.endDate).toBe('2026-11-09')
    const list = charges([before, { ...after, id: 'n' }])
    expect(list.filter((d) => d!.startsWith('2026-11'))).toEqual(['2026-11-10'])
    expect(list).toHaveLength(12)
  })

  it('fuori dai limiti rifiuta: salterebbe o raddoppierebbe un addebito', () => {
    expect(() => splitRecurring(netflix, '2026-11-14', changes, '2026-10-14')).toThrow()
    expect(() => splitRecurring(netflix, '2026-11-14', changes, '2026-12-14')).toThrow()
  })
})

describe('groupRecurringSeries', () => {
  const old = rec({ id: 'a', seriesId: 'a', amount: 1300, endDate: '2026-11-14' })
  const now = rec({ id: 'b', seriesId: 'a', amount: 1599, startDate: '2026-11-15' })
  const other = rec({ id: 'x', name: 'Palestra' })

  it('una spesa divisa è una sola, con la parte in corso e com era prima', () => {
    const groups = groupRecurringSeries([now, other, old], '2026-11-20')
    expect(groups).toHaveLength(2)
    const netflix = groups.find((g) => g.key === 'a')!
    expect(netflix.parts.map((p) => p.id)).toEqual(['a', 'b'])
    expect(netflix).toMatchObject({ current: now, previous: old, next: null, active: true })
    expect(seriesKey(other)).toBe('x')
  })

  it('prima del cambio mostra la parte vecchia e il cambio programmato', () => {
    const netflix = groupRecurringSeries([old, now], '2026-11-12')[0]!
    expect(netflix).toMatchObject({ current: old, previous: null, next: now, active: true })
  })

  it('una spesa finita resta l ultima parte, ma non è attiva', () => {
    const ended = rec({ id: 'e', endDate: '2026-03-31' })
    expect(groupRecurringSeries([ended], '2026-11-12')[0]).toMatchObject({ current: ended, active: false })
  })

  it('una spesa non ancora iniziata mostra la prima parte, non attiva', () => {
    const future = rec({ id: 'f', startDate: '2027-02-01' })
    expect(groupRecurringSeries([future], '2026-11-12')[0]).toMatchObject({ current: future, active: false })
  })
})

describe('occursIn con la fine a metà mese', () => {
  it('nel mese in cui finisce conta il giorno: finita il 14, niente addebito del 15', () => {
    expect(occursIn(rec({ endDate: '2026-11-14' }), 2026, 10)).toBe(false)
    expect(occursIn(rec({ endDate: '2026-11-15' }), 2026, 10)).toBe(true)
    expect(occursIn(rec({ endDate: '2026-11-30' }), 2026, 10)).toBe(true)
  })
})
