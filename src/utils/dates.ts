import type { IsoDate } from '@/types/models'

export interface DateParts {
  year: number
  /** 0 = gennaio … 11 = dicembre */
  month: number
  day: number
}

/**
 * Le date sono trattate come giorni di calendario, senza fuso orario:
 * `new Date('2026-03-01')` verrebbe letto come UTC e in alcuni fusi
 * scivolerebbe nel mese precedente.
 */
export function parseIsoDate(date: IsoDate): DateParts {
  const [y, m, d] = date.split('-').map(Number)
  return { year: y ?? 0, month: (m ?? 1) - 1, day: d ?? 1 }
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function todayIso(): IsoDate {
  const now = new Date()
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

export function yearOf(date: IsoDate): number {
  return parseIsoDate(date).year
}

/** La data `days` giorni dopo (o prima, se negativo). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  const d = new Date(Date.UTC(year, month, day + days))
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Ultimo giorno del mese (0–11). */
export function lastDayOfMonth(year: number, month: number): IsoDate {
  return toIsoDate(year, month, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
}

/** Indice assoluto del mese (anno * 12 + mese), comodo per confronti e differenze. */
export function monthIndex(year: number, month: number): number {
  return year * 12 + month
}

export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { year, month, day } = parseIsoDate(value)
  const d = new Date(year, month, day)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
}

export function formatDate(date: IsoDate, locale: string): string {
  const { year, month, day } = parseIsoDate(date)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(year, month, day),
  )
}

export function monthName(month: number, locale: string, style: 'long' | 'short' = 'long'): string {
  const name = new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2000, month, 1))
  return name.charAt(0).toUpperCase() + name.slice(1)
}
