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
 * Da "Tutti i mesi" le frecce entrano nei mesi, e ognuna in un mese diverso: nell'anno in corso ‹ porta al mese prima
 * di oggi e › a quello dopo (al mese di oggi porta "Questo mese"); in un altro anno ‹ porta a dicembre e › a gennaio
 * (si entra dal bordo verso cui si va).
 */
export function useMonthStep() {
  const finance = useFinanceStore()

  /** Il mese accanto a `month` dell'anno `year`, passando all'anno vicino solo se compare nel menu dell'anno. */
  function step(year: number, month: number, delta: -1 | 1): MonthTarget | null {
    let m = month + delta
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

  function neighbour(delta: -1 | 1): MonthTarget | null {
    if (finance.selectedMonth === 'all') {
      const today = parseIsoDate(finance.today)
      const year = finance.selectedYear
      if (year !== today.year) return { year, month: delta < 0 ? 11 : 0 }
      // Se il mese accanto a oggi è in un anno che non c'è nel menu, si entra almeno nel mese di oggi.
      return step(year, today.month, delta) ?? { year, month: today.month }
    }
    return step(finance.selectedYear, finance.selectedMonth, delta)
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
