import type { Cents, Frequency, IsoDate, RecurringExpense } from '@/types/models'
import { monthIndex, parseIsoDate, toIsoDate } from '@/utils/dates'

export const FREQUENCIES: Frequency[] = ['monthly', 'quarterly', 'semiannual', 'annual']

export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

/** Costo medio mensile della ricorrenza. */
export function monthlyEquivalent(r: Pick<RecurringExpense, 'amount' | 'frequency'>): number {
  return r.amount / FREQUENCY_MONTHS[r.frequency]
}

/** True se la ricorrenza prevede un addebito nel mese indicato. */
export function occursIn(r: RecurringExpense, year: number, month: number): boolean {
  const start = parseIsoDate(r.startDate)
  const target = monthIndex(year, month)
  const offset = target - monthIndex(start.year, start.month)
  if (offset < 0 || offset % FREQUENCY_MONTHS[r.frequency] !== 0) return false
  if (r.endDate) {
    const end = parseIsoDate(r.endDate)
    if (target > monthIndex(end.year, end.month)) return false
  }
  return true
}

export function amountInMonth(r: RecurringExpense, year: number, month: number): Cents {
  return occursIn(r, year, month) ? r.amount : 0
}

/**
 * Data del prossimo addebito a partire da `from` (incluso), o null se la
 * ricorrenza è terminata. Il giorno è quello della data di inizio, limitato
 * all'ultimo giorno del mese (es. 31 → 30 aprile).
 */
export function nextDueDate(r: RecurringExpense, from: IsoDate): IsoDate | null {
  const start = parseIsoDate(r.startDate)
  const step = FREQUENCY_MONTHS[r.frequency]
  const f = parseIsoDate(from)
  let offset = Math.max(0, monthIndex(f.year, f.month) - monthIndex(start.year, start.month))
  offset = Math.ceil(offset / step) * step
  for (let i = 0; i < 2; i++, offset += step) {
    const abs = monthIndex(start.year, start.month) + offset
    const year = Math.floor(abs / 12)
    const month = abs % 12
    const day = Math.min(start.day, new Date(year, month + 1, 0).getDate())
    const due = toIsoDate(year, month, day)
    if (due < from) continue
    return r.endDate && due > r.endDate ? null : due
  }
  return null
}

/** True se la ricorrenza è attiva in almeno un giorno dell'anno. */
export function isActiveInYear(r: RecurringExpense, year: number): boolean {
  if (parseIsoDate(r.startDate).year > year) return false
  return !r.endDate || parseIsoDate(r.endDate).year >= year
}
