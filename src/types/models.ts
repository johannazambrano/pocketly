/**
 * Modello dati dell'app (schema v2).
 *
 * Differenze principali rispetto al prototipo (schema v1):
 * - gli importi sono in centesimi interi, per evitare errori di arrotondamento;
 * - categorie e metodi di pagamento sono referenziati per id, quindi rinominarli
 *   non richiede di aggiornare ogni voce;
 * - le voci non sono più raggruppate per anno: l'anno si ricava dalla data.
 *   Le spese ricorrenti hanno una data di inizio (e opzionale di fine) e
 *   valgono automaticamente anche negli anni successivi.
 */

export type Id = string
/** Data di calendario nel formato YYYY-MM-DD, senza fuso orario. */
export type IsoDate = string
/** Importo in centesimi di euro. */
export type Cents = number

export type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export interface Tag {
  id: Id
  name: string
  color: string
}

export interface OneTimeExpense {
  id: Id
  name: string
  amount: Cents
  date: IsoDate
  categoryId: Id
  paymentMethodId: Id
  notes: string
}

export interface RecurringExpense {
  id: Id
  name: string
  amount: Cents
  frequency: Frequency
  /** Primo addebito: determina anche in quali mesi cadono i successivi. */
  startDate: IsoDate
  /** Ultimo giorno in cui la ricorrenza è attiva (incluso). */
  endDate: IsoDate | null
  categoryId: Id
  paymentMethodId: Id
}

export interface Income {
  id: Id
  name: string
  amount: Cents
  date: IsoDate
  categoryId: Id
  paymentMethodId: Id
}

export type LoanType = 'given' | 'received'

export interface Repayment {
  id: Id
  amount: Cents
  date: IsoDate
}

export interface Loan {
  id: Id
  name: string
  amount: Cents
  type: LoanType
  date: IsoDate
  notes: string
  repayments: Repayment[]
}

export interface Simulation {
  id: Id
  name: string
  amount: Cents
  year: number
  /** 0 = gennaio … 11 = dicembre */
  month: number
}

/**
 * Impostazioni della proiezione. Le entrate non sono ricorrenti: per default i mesi senza entrate
 * registrate valgono 0. La stima dei mesi futuri è facoltativa e usa solo le categorie scelte
 * (es. Stipendio), così regali e entrate occasionali non finiscono nelle previsioni.
 */
export interface ForecastSettings {
  estimateIncome: boolean
  incomeCategoryIds: Id[]
}

/**
 * Budget mensile: un limite di spesa per categoria, uguale per ogni mese.
 * Le categorie senza limite non fanno parte del budget.
 */
export interface BudgetSettings {
  limits: Record<Id, Cents>
}

/**
 * Un conto (es. il conto in banca, i contanti): saldo di partenza a una data più i movimenti successivi
 * fatti con i suoi metodi di pagamento. Ogni metodo di pagamento appartiene al massimo a un conto.
 */
export interface Account {
  id: Id
  name: string
  /** Saldo a fine giornata di `openingDate`: i movimenti di quel giorno sono già compresi. */
  openingAmount: Cents
  openingDate: IsoDate
  paymentMethodIds: Id[]
}

export interface FinanceData {
  schemaVersion: 2
  categories: Tag[]
  paymentMethods: Tag[]
  oneTimeExpenses: OneTimeExpense[]
  recurringExpenses: RecurringExpense[]
  incomes: Income[]
  loans: Loan[]
  simulations: Simulation[]
  forecast: ForecastSettings
  budget: BudgetSettings
  accounts: Account[]
}

export const CURRENT_SCHEMA_VERSION = 2
