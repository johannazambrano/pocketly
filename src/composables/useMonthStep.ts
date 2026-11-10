import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'

export interface MonthTarget {
  year: number
  month: number
}

/**
 * Il mese prima o dopo quello scelto, condiviso da frecce, tasti ← → e swipe.
 * Da gennaio si torna a dicembre dell'anno prima, da dicembre si va a gennaio dell'anno dopo, ma solo verso anni che
 * compaiono nel menu dell'anno in alto. Con "Tutti i mesi" non c'è un mese da cui partire.
 */
export function useMonthStep() {
  const finance = useFinanceStore()

  function neighbour(delta: -1 | 1): MonthTarget | null {
    if (finance.selectedMonth === 'all') return null
    let m = finance.selectedMonth + delta
    let y = finance.selectedYear
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
