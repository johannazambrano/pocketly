import type { FinanceData, Tag } from '@/types/models'
import { PALETTE } from '@/utils/colors'
import { newId } from '@/utils/id'

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  it: ['Cibo e bevande', 'Trasporti', 'Altro', 'Salute e benessere', 'Finanza', 'Digitale', 'Auto', 'Vacanze', 'Stipendio'],
  en: ['Food and drinks', 'Transport', 'Other', 'Health and well-being', 'Financial', 'Digital', 'Car', 'Vacation', 'Salary'],
}

const DEFAULT_PAYMENT_METHODS: Record<string, string[]> = {
  it: ['Bonifico', 'Contanti', 'Carta di debito', 'Carta di credito', 'PayPal'],
  en: ['Bank transfer', 'Cash', 'Debit card', 'Credit card', 'PayPal'],
}

function toTags(names: string[], colorOffset = 0): Tag[] {
  return names.map((name, i) => ({ id: newId(), name, color: PALETTE[(i + colorOffset) % PALETTE.length]! }))
}

export function createDefaultData(locale: string): FinanceData {
  const lang = locale in DEFAULT_CATEGORIES ? locale : 'en'
  return {
    schemaVersion: 2,
    categories: toTags(DEFAULT_CATEGORIES[lang]!),
    paymentMethods: toTags(DEFAULT_PAYMENT_METHODS[lang]!, 8),
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
  }
}

export function createEmptyData(): FinanceData {
  return {
    schemaVersion: 2,
    categories: [],
    paymentMethods: [],
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
  }
}
