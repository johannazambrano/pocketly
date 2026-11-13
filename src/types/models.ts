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
  tagIds?: Id[]
}

/** Scorciatoia per spese variabili frequenti (es. caffè con importo fisso, pranzo con importo libero). */
export interface QuickExpense {
  id: Id
  name: string
  /** Importo fisso in centesimi, oppure assente se cambia ogni volta. */
  amount?: Cents
  categoryId: Id
  paymentMethodId: Id
  notes: string
  tagIds?: Id[]
}

export interface NotificationRule {
  /** Giorni prima dell'addebito: 0 = il giorno stesso, 1 = il giorno prima, ecc. (0..365). */
  daysBefore: number
  /** Orario locale nel formato HH:MM (es. "09:00"). */
  time: string
}

/**
 * Un addebito di una spesa ricorrente cambiato da solo («Solo questo addebito»): saltato, con un importo diverso o in
 * un altro giorno dello stesso mese. Gli altri addebiti restano quelli della serie.
 */
export interface RecurringException {
  /** La data che l'addebito avrebbe secondo la serie: lo identifica anche se viene spostato. */
  date: IsoDate
  /** Addebito saltato: non conta in nessun calcolo. */
  skipped?: true
  /** Importo di questo addebito, al posto di quello della serie. */
  amount?: Cents
  /** Giorno di questo addebito, nello stesso mese di `date`. */
  movedTo?: IsoDate
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
  /**
   * Collega le parti della stessa spesa nate da una modifica «da questo addebito in poi» (`splitRecurring`): tutte
   * hanno l'id della prima parte. Assente per una spesa mai divisa. La pagina Ricorrenti le mostra come una riga sola.
   */
  seriesId?: Id
  /** Addebiti cambiati da soli (saltati, importo o giorno diverso). Assente se nessuno. */
  exceptions?: RecurringException[]
  /**
   * Promemoria configurati per questa spesa (stile Google Calendar).
   * Presente solo quando c'è almeno una regola attiva; assente se disattivato.
   */
  notifications?: NotificationRule[]
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
 * Impostazioni della proiezione. Le entrate non sono ricorrenti, ma per default si stimano quelle che si
 * ripetono (es. lo stipendio) dal mese corrente in poi, così la previsione dice dove si arriverà davvero.
 * Senza categorie scelte la stima usa quelle che si ripetono da sole (vedi `estimateCategoryIds`);
 * regali ed entrate occasionali restano fuori.
 */
export interface ForecastSettings {
  estimateIncome: boolean
  /** Categorie scelte dall'utente; vuoto = scelta automatica tra le entrate che si ripetono. */
  incomeCategoryIds: Id[]
  /** True quando l'utente ha acceso o spento la stima di persona: da lì in poi vale la sua scelta. */
  estimateChosen?: boolean
}

/**
 * Budget mensile: un limite di spesa per categoria, uguale per ogni mese.
 * Le categorie senza limite non fanno parte del budget.
 */
export interface BudgetSettings {
  limits: Record<Id, Cents>
}

export interface FinanceData {
  schemaVersion: 2
  categories: Tag[]
  paymentMethods: Tag[]
  tags: Tag[]
  oneTimeExpenses: OneTimeExpense[]
  recurringExpenses: RecurringExpense[]
  incomes: Income[]
  loans: Loan[]
  simulations: Simulation[]
  forecast: ForecastSettings
  budget: BudgetSettings
  quickExpenses: QuickExpense[]
}

export const CURRENT_SCHEMA_VERSION = 2
