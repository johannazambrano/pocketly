import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance'
import { parseIsoDate } from '@/utils/dates'
import { useMonthStep } from './useMonthStep'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
}))

describe('useMonthStep', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    setActivePinia(createPinia())
  })

  it('passa tra i mesi attraversando il cambio anno e si ferma ai limiti di finance.years', async () => {
    const finance = useFinanceStore()
    await finance.init('it')
    const currentYear = new Date().getFullYear()
    finance.data.oneTimeExpenses.push({
      id: 'past',
      name: 'Spesa anno precedente',
      amount: 1000,
      date: `${currentYear - 1}-06-15`,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notes: '',
    })

    const { previous, next, go } = useMonthStep()

    // Da gennaio dell'anno corrente torna a dicembre dell'anno precedente
    finance.selectedYear = currentYear
    finance.selectedMonth = 0
    expect(previous.value).toEqual({ year: currentYear - 1, month: 11 })
    expect(go(previous.value)).toBe(true)
    expect(finance.selectedYear).toBe(currentYear - 1)
    expect(finance.selectedMonth).toBe(11)

    // Da dicembre dell'anno precedente torna a gennaio dell'anno corrente
    expect(next.value).toEqual({ year: currentYear, month: 0 })
    expect(go(next.value)).toBe(true)
    expect(finance.selectedYear).toBe(currentYear)
    expect(finance.selectedMonth).toBe(0)

    // Ai margini di finance.years i passi fuori elenco sono null
    finance.selectedYear = currentYear - 1
    finance.selectedMonth = 0
    expect(previous.value).toBeNull()
    expect(go(previous.value)).toBe(false)

    finance.selectedYear = currentYear
    finance.selectedMonth = 11
    expect(next.value).toBeNull()
    expect(go(next.value)).toBe(false)
  })

  it("sull'anno intero senza fallback cambia anno; con effectiveMonth (Budget) parte dal mese mostrato", async () => {
    const finance = useFinanceStore()
    await finance.init('it')
    const currentYear = new Date().getFullYear()
    finance.data.oneTimeExpenses.push({
      id: 'past',
      name: 'Spesa anno precedente',
      amount: 1000,
      date: `${currentYear - 1}-06-15`,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notes: '',
    })

    finance.today = `${currentYear}-11-17`
    finance.selectedYear = currentYear
    finance.selectedMonth = 'all'

    // Comportamento standard (Dashboard / MonthSelector): sull'anno intero si sposta di anno in anno
    const standard = useMonthStep()
    expect(standard.previous.value).toEqual({ year: currentYear - 1, month: 'all' })
    expect(standard.next.value).toBeNull()

    // Comportamento Budget: se selectedMonth è 'all', mostra il mese di oggi senza mutare selectedMonth finché non si naviga
    const budgetMonthIndex = () =>
      finance.selectedMonth === 'all' ? parseIsoDate(finance.today).month : finance.selectedMonth
    const budgetStep = useMonthStep(budgetMonthIndex)

    expect(finance.selectedMonth).toBe('all')
    expect(budgetStep.previous.value).toEqual({ year: currentYear, month: 9 })
    expect(budgetStep.next.value).toEqual({ year: currentYear, month: 11 })

    // Cliccando ‹ aggiorna sia l'anno che selectedMonth al mese concreto precedente
    expect(budgetStep.go(budgetStep.previous.value)).toBe(true)
    expect(finance.selectedYear).toBe(currentYear)
    expect(finance.selectedMonth).toBe(9)
  })
})
