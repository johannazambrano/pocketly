---
source-files:
  - src/types/models.ts
  - src/services/migration.ts
  - src/domain/defaults.ts
  - src/utils/dates.ts
  - src/utils/money.ts
verified: 2026-11-10
---

# Riferimento: Modello Dati e Tipi

Questo documento costituisce la specifica esaustiva del modello dati di Pocketly definito in [`src/types/models.ts`](../../src/types/models.ts) (schema v2).

---

## 1. Tipi Primitivi

```ts
export type Id = string
export type IsoDate = string
export type Cents = number
export type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual'
```

### `Id` (Identificatore Univoco)
- Stringa univoca alfanumerica generata casualmente tramite `newId()` ([`src/utils/id.ts`](../../src/utils/id.ts)) basato su `crypto.randomUUID()` o generatore fallback con nanoid alphabet.
- Tutte le entità secondarie (transazioni, rate, promemoria) fanno riferimento alle anagrafiche (categorie, metodi di pagamento, tag) **esclusivamente per `Id`**.

### `IsoDate` (Data di Calendario)
- Stringa nel formato rigoroso `YYYY-MM-DD` (es. `"2026-03-15"`).
- Rappresenta una data di calendario pura senza componente temporale (ore/minuti) e senza fuso orario (`utils/dates.ts`).
- Non utilizzare oggetti `Date` Javascript all'interno del modello dati memorizzato.
- Le utility di parsing, manipolazione e confronto date in `src/utils/dates.ts` comprendono: `parseIsoDate`, `toIsoDate`, `todayIso`, `yearOf`, `addDays` (spostamento di `n` giorni), `lastDayOfMonth` (calcolo dell'ultimo giorno del mese per bilanci e proiezioni) e `monthIndex`.

### `Cents` (Importo Monetario)
- Numero intero che esprime l'importo in centesimi di euro (es. `1050` corrisponde a € 10,50).
- **Invariante:** gli importi memorizzati nel database non devono mai contenere decimali o virgole mobili.
- La conversione da stringa utente avviene con `toCents(str)` e la formattazione con `money(cents)` o `formatCents(cents, locale)`.
- *Nota su valori derivati:* `monthlyEquivalent` in `src/domain/recurrence.ts` calcola `amount / FREQUENCY_MONTHS[frequency]`, che per frequenze trimestrali o annuali può risultare frazionario. Tale valore è un derivato temporaneo di calcolo e non viene mai salvato nel modello.

### `Frequency` (Cadenza Ricorrente)
- `'monthly'`: mensile (1 mese, 12 volte all'anno).
- `'quarterly'`: trimestrale (3 mesi, 4 volte all'anno).
- `'semiannual'`: semestrale (6 mesi, 2 volte all'anno).
- `'annual'`: annuale (12 mesi, 1 volta all'anno).

---

## 2. Entità e Modelli

### `Tag` (Anagrafica Categorie, Metodi e Tag)
```ts
export interface Tag {
  id: Id
  name: string
  color: string // Codice colore HEX (es. "#4f46e5")
}
```

### `OneTimeExpense` (Spesa Una Tantum)
```ts
export interface OneTimeExpense {
  id: Id
  name: string
  amount: Cents
  date: IsoDate
  categoryId: Id
  paymentMethodId: Id
  notes: string
  tagIds?: Id[] // Array opzionale di ID di tag applicati
}
```

### `NotificationRule` e `RecurringExpense` (Spesa Ricorrente)
```ts
export interface NotificationRule {
  /** Giorni prima dell'addebito: 0 = giorno stesso, 1 = giorno prima, ecc. */
  daysBefore: number
  /** Orario locale nel formato HH:MM (es. "09:00"). */
  time: string
}

export interface RecurringExpense {
  id: Id
  name: string
  amount: Cents
  frequency: Frequency
  startDate: IsoDate          // Data del primo addebito
  endDate: IsoDate | null     // Data di termine (inclusa), oppure null se a tempo indeterminato
  categoryId: Id
  paymentMethodId: Id
  notifications?: NotificationRule[] // Regole di promemoria stile Google Calendar
}
```

### `Income` (Entrata)
```ts
export interface Income {
  id: Id
  name: string
  amount: Cents
  date: IsoDate
  categoryId: Id
  paymentMethodId: Id
}
```

### `Loan` e `Repayment` (Prestiti)
```ts
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
  type: LoanType              // 'given' (prestato a terzi) o 'received' (ricevuto in prestito)
  date: IsoDate
  notes: string
  repayments: Repayment[]     // Elenco rimborsi progressivi registrati
}
```

### `Simulation` (Simulazione d'Acquisto)
```ts
export interface Simulation {
  id: Id
  name: string
  amount: Cents
  year: number
  month: number // 0 = Gennaio ... 11 = Dicembre
}
```

### `ForecastSettings` (Impostazioni Previsioni)
```ts
export interface ForecastSettings {
  estimateIncome: boolean       // Attiva/disattiva la stima per i mesi futuri
  incomeCategoryIds: Id[]       // Categorie scelte per la stima (vuoto = selezione automatica)
  estimateChosen?: boolean      // Flag che memorizza la preferenza esplicita dell'utente
}
```

### `BudgetSettings` (Impostazioni Budget)
```ts
export interface BudgetSettings {
  limits: Record<Id, Cents>     // Mappa { [categoryId]: limiteInCentesimi }
}
```

---

## 3. Struttura Radice: `FinanceData`

```ts
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
}

export const CURRENT_SCHEMA_VERSION = 2
```

---

## 4. Migrazioni e Parsing Difensivo (`src/services/migration.ts`)

Il modulo `migration.ts` garantisce che Pocketly possa leggere e importare qualsiasi backup, compresi quelli provenienti dal vecchio prototipo HTML (schema v1) o file generati da versioni precedenti:

- **Riconoscimento automatico schema v1:**
  Nello schema v1 le spese erano suddivise per anno (`data[year].oneTime`), gli importi erano numeri decimali in euro e le categorie erano stringhe letterali anziché ID. La funzione `migrateV1toV2` normalizza gli importi moltiplicandoli per 100 ed estrae le entità `Tag` con ID univoci.
- **Validazione difensiva `parseBackup(raw)`:**
  Non assume mai che il file importato sia valido. Convalida la presenza di ciascun array, ripulisce valori `null` o `undefined`, converte tipi non conformi e garantisce il ripristino di una struttura `FinanceData` semanticamente corretta.
- **Protezione versioni più recenti (`NewerFormatError`):**
  Se il file di backup o i dati provenienti dal server presentano uno `schemaVersion` maggiore di quello compreso dall'applicazione (`CURRENT_SCHEMA_VERSION = 2`), `parseBackup` solleva `NewerFormatError`. Lo store `sync.ts` riconosce l'eccezione impostando lo stato di problema `outdated`. Questo impedisce a versioni datate del client di sovrascrivere o cancellare dati che contengono campi introdotti in release future.
- **Valori predefiniti (`src/domain/defaults.ts`):**
  - `createEmptyData()`: genera un'istanza con array vuoti e impostazioni predefinite.
  - `createDefaultData()`: genera un dataset iniziale di benvenuto con categorie essenziali preconfigurate (Casa, Spesa, Trasporti, Svago, ecc.) con colori distinti.
