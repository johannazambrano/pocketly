import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { parseIsoDate } from '@/utils/dates'

export interface MonthTarget {
  year: number
  month: number
}

/**
 * Il mese prima o dopo quello scelto, condiviso da frecce, tasti ← → e swipe.
 * Da gennaio si torna a dicembre dell'anno prima, da dicembre si va a gennaio dell'anno dopo, ma solo verso anni che
 * compaiono nel menu dell'anno in alto.
 * Da "Tutti i mesi" le frecce entrano nei mesi: nell'anno in corso portano al mese di oggi, in un altro anno ‹ porta
 * a dicembre e › a gennaio (si entra dal bordo verso cui si va).
 */
export function useMonthStep() {
  const finance = useFinanceStore()

  function neighbour(delta: -1 | 1): MonthTarget | null {
    if (finance.selectedMonth === 'all') {
      const today = parseIsoDate(finance.today)
      const year = finance.selectedYear
      if (year === today.year) return { year, month: today.month }
      return { year, month: delta < 0 ? 11 : 0 }
    }
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
