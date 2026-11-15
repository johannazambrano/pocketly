import type { Cents } from '@/types/models'

/** Converte un valore inserito dall'utente ("12,50", "12.5", 12.5) in centesimi. */
export function toCents(value: string | number): Cents | null {
  const normalized = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'))
  if (!Number.isFinite(normalized)) return null
  return Math.round(normalized * 100)
}

/**
 * Cosa non va in un importo scritto in un modulo: vuoto, illeggibile (es. "12,5,0") o non più di zero. `null` se va
 * bene. Serve a dire il problema preciso invece di un messaggio solo per tutti i casi.
 */
export type AmountProblem = 'empty' | 'unreadable' | 'notPositive'
export function amountProblem(raw: string): AmountProblem | null {
  if (raw.trim() === '') return 'empty'
  const cents = toCents(raw)
  if (cents === null) return 'unreadable'
  return cents > 0 ? null : 'notPositive'
}

/**
 * L'importo da mettere in un campo da modificare, con il separatore decimale della lingua ("13,00" in italiano, "13.00"
 * in inglese), come lo si scriverebbe a mano. `toCents` legge entrambi.
 */
export function centsToInput(cents: Cents, locale?: string): string {
  const fixed = (cents / 100).toFixed(2)
  if (!locale) return fixed
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.'
  return decimal === '.' ? fixed : fixed.replace('.', decimal)
}

const formatters = new Map<string, Intl.NumberFormat>()

export function formatCents(cents: Cents, locale: string): string {
  let f = formatters.get(locale)
  if (!f) {
    // Separatore delle migliaia sempre: in italiano Intl lo omette sotto 10.000 ("2724,30 €" accanto a "15.395,70 €").
    // 'always' non è ancora nei tipi della lib TypeScript usata dal progetto; i browser più vecchi lo leggono come `true`.
    f = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', useGrouping: 'always' as unknown as boolean })
    formatters.set(locale, f)
  }
  return f.format(cents / 100)
}
