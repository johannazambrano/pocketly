import type { TagTrendInfo, Verdict } from '@/domain/calculations'
import { useFormat } from '@/i18n'

/**
 * Testi, icona e colori del confronto con i mesi precedenti (`tagTrends`), uguali nelle righe di «Spese per
 * categoria/metodo» (`BreakdownList`) e nel dettaglio di una riga (`BreakdownDetailView`).
 */
export function useTrendText() {
  const { t, money } = useFormat()

  function label(trend: TagTrendInfo): string {
    const average = money(trend.previousAverage)
    const kind = trend.isPace ? 'trendPace' : 'trend'
    const tail = trend.verdict === 'above' ? 'Above' : trend.verdict === 'below' ? 'Below' : 'Inline'
    return t(`dashboard.${kind}${tail}`, { average })
  }

  function icon(verdict: Verdict): string {
    if (verdict === 'above') return 'fa-solid fa-arrow-trend-up'
    if (verdict === 'below') return 'fa-solid fa-arrow-trend-down'
    return 'fa-solid fa-minus'
  }

  /** Ambra tenue per «più del solito», verde tenue per «meno», grigio per «in linea»: niente rosso, non è un errore. */
  function tone(verdict: Verdict): string {
    if (verdict === 'above') return 'bg-caution-soft text-caution'
    if (verdict === 'below') return 'bg-accent-soft text-accent'
    return 'bg-surface-2 text-ink-3'
  }

  /** Lo stesso colore, solo per il testo (la riga sotto la barra in «Spese per categoria»). */
  function textTone(verdict: Verdict): string {
    if (verdict === 'above') return 'text-caution'
    if (verdict === 'below') return 'text-accent'
    return 'text-ink-3'
  }

  return { label, icon, tone, textTone }
}
