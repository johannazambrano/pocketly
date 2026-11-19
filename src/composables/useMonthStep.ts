import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'

/** Un periodo: un mese di un anno, o l'anno intero (`'all'`). */
export interface MonthTarget {
  year: number
  month: number | 'all'
}

/**
 * Il periodo prima o dopo quello scelto, condiviso da frecce, tasti ← → e swipe.
 * - Su un mese: il mese prima o dopo; da gennaio si torna a dicembre dell'anno prima, da dicembre si va a gennaio
 *   dell'anno dopo.
 * - Sull'anno intero: l'anno prima o dopo, sempre intero.
 * - Con `effectiveMonth`: permette a una vista sempre mensile (es. Budget) di calcolare il passo rispetto al mese
 *   mostrato anche quando `finance.selectedMonth === 'all'`, aggiornando comunque `finance.selectedMonth` su `go`.
 * Si passa solo ad anni che compaiono nel menu del periodo (`finance.years`).
 */
export function useMonthStep(effectiveMonth?: () => number | 'all') {
  const finance = useFinanceStore()

  function neighbour(delta: -1 | 1): MonthTarget | null {
    const year = finance.selectedYear
    const current = effectiveMonth ? effectiveMonth() : finance.selectedMonth
    if (current === 'all') {
      const y = year + delta
      return finance.years.includes(y) ? { year: y, month: 'all' } : null
    }
    let m = current + delta
    let y = year
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    return finance.years.includes(y) ? { year: y, month: m } : null
  }

  const previous = computed(() => neighbour(-1))
  const next = computed(() => neighbour(1))

  function go(target: MonthTarget | null): boolean {
    if (!target) return false
    finance.selectedYear = target.year
    finance.selectedMonth = target.month
    return true
  }

  return { previous, next, go }
}
