import type { Cents } from '@/types/models'

/** Converte un valore inserito dall'utente ("12,50", "12.5", 12.5) in centesimi. */
export function toCents(value: string | number): Cents | null {
  const normalized = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'))
  if (!Number.isFinite(normalized)) return null
  return Math.round(normalized * 100)
}

export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2)
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatCents(cents: Cents, locale: string): string {
  let f = formatters.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
    formatters.set(locale, f)
  }
  return f.format(cents / 100)
}
