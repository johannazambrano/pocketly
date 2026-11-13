import type { BudgetSettings, FinanceData, ForecastSettings, Tag } from '@/types/models'
import { harmonizedColors } from '@/utils/colors'
import { newId } from '@/utils/id'

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  it: ['Cibo e bevande', 'Trasporti', 'Altro', 'Salute e benessere', 'Finanza', 'Digitale', 'Auto', 'Vacanze', 'Stipendio'],
  en: ['Food and drinks', 'Transport', 'Other', 'Health and well-being', 'Financial', 'Digital', 'Car', 'Vacation', 'Salary'],
}

const DEFAULT_PAYMENT_METHODS: Record<string, string[]> = {
  it: ['Bonifico', 'Contanti', 'Carta di debito', 'Carta di credito', 'PayPal'],
  en: ['Bank transfer', 'Cash', 'Debit card', 'Credit card', 'PayPal'],
}

/** Le voci iniziali con colori in equilibrio, lontani anche da quelli già dati (`given`, aggiornato). */
function toTags(names: string[], given: string[]): Tag[] {
  const colors = harmonizedColors(names, given)
  given.push(...colors)
  return names.map((name, i) => ({ id: newId(), name, color: colors[i]! }))
}

export function defaultForecastSettings(): ForecastSettings {
  // Accesa di serie: la previsione deve dire dove si arriverà, comprese le entrate che si ripetono.
  return { estimateIncome: true, incomeCategoryIds: [] }
}

export function defaultBudgetSettings(): BudgetSettings {
  return { limits: {} }
}

export function createDefaultData(locale: string): FinanceData {
  const lang = locale in DEFAULT_CATEGORIES ? locale : 'en'
  const given: string[] = []
  return {
    schemaVersion: 2,
    categories: toTags(DEFAULT_CATEGORIES[lang]!, given),
    paymentMethods: toTags(DEFAULT_PAYMENT_METHODS[lang]!, given),
    tags: [],
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
    forecast: defaultForecastSettings(),
    budget: defaultBudgetSettings(),
    quickExpenses: [],
  }
}

export function createEmptyData(): FinanceData {
  return {
    schemaVersion: 2,
    categories: [],
    paymentMethods: [],
    tags: [],
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
    forecast: defaultForecastSettings(),
    budget: defaultBudgetSettings(),
    quickExpenses: [],
  }
}
