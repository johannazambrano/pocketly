---
source-files:
  - src/types/models.ts
  - src/services/migration.ts
  - src/domain/defaults.ts
  - src/utils/dates.ts
  - src/utils/money.ts
  - src/utils/id.ts
  - src/domain/recurrence.ts
  - src/services/storage.ts
verified: 2026-11-13
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
- UUID v4 generato casualmente tramite `newId()` ([`src/utils/id.ts`](../../src/utils/id.ts)): usa `crypto.randomUUID()` dove disponibile (contesti sicuri: HTTPS o localhost), altrimenti costruisce a mano un UUID v4 da `crypto.getRandomValues`.
- Tutte le entità secondarie (transazioni, rate, promemoria) fanno riferimento alle anagrafiche (categorie, metodi di pagamento, tag) **esclusivamente per `Id`**.

### `IsoDate` (Data di Calendario)
- Stringa nel formato rigoroso `YYYY-MM-DD` (es. `"2026-03-15"`).
- Rappresenta una data di calendario pura senza componente temporale (ore/minuti) e senza fuso orario (`utils/dates.ts`).
- Non utilizzare oggetti `Date` Javascript all'interno del modello dati memorizzato.
- Le utility di parsing, manipolazione e confronto date in `src/utils/dates.ts` comprendono: `parseIsoDate`, `toIsoDate`, `todayIso`, `yearOf`, `addDays` (spostamento di `n` giorni), `lastDayOfMonth` (calcolo dell'ultimo giorno del mese per bilanci e proiezioni) e `monthIndex`.

### `Cents` (Importo Monetario)
- Numero intero che esprime l'importo in centesimi di euro (es. `1050` corrisponde a € 10,50).
- **Invariante:** gli importi memorizzati nel database non devono mai contenere decimali o virgole mobili.
- La conversione da stringa utente avviene con `toCents(value)`, che accetta sia la virgola sia il punto come separatore decimale ("12,50" o "12.5"); la formattazione con `formatCents(cents, locale)`, esposta ai componenti come `useFormat().money`.
- Per precompilare un campo da modificare si usa `centsToInput(cents, locale?)`, che scrive l'importo con il separatore decimale della lingua ("13,00" in italiano, "13.00" in inglese); i moduli lo usano tramite `useFormat().amountInput`.
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

### `QuickExpense` (Inserimento Rapido di Spesa Variabile)
```ts
export interface QuickExpense {
  id: Id
  name: string
  amount?: Cents // Importo fisso in centesimi, oppure assente se varia ogni volta
  categoryId: Id
  paymentMethodId: Id
  notes: string
  tagIds?: Id[]
}
```

Un `QuickExpense` con `amount` definito registra una `OneTimeExpense` in un solo tocco alla data corrente (`finance.triggerQuickExpense`); senza `amount` precompila il modulo di inserimento lasciando l'importo da scrivere. È facoltativo rispetto ai backup v2 precedenti (`normalizeV2` usa `[]` se assente) senza aumentare lo `schemaVersion`.

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
  endDate: IsoDate | null     // Ultimo giorno attivo (incluso), oppure null se a tempo indeterminato
  categoryId: Id
  paymentMethodId: Id
  seriesId?: Id               // Parti della stessa spesa dopo un cambio «da questo addebito in poi»: l'id della prima parte
  exceptions?: RecurringException[] // Addebiti cambiati da soli («Solo questo addebito»); assente se nessuno
  notifications?: NotificationRule[] // Regole di promemoria stile Google Calendar
}

export interface RecurringException {
  date: IsoDate               // La data dell'addebito secondo la serie: lo identifica anche se spostato
  skipped?: true              // Addebito saltato
  amount?: Cents              // Importo solo di questo addebito
  movedTo?: IsoDate           // Giorno solo di questo addebito, nello stesso mese di `date`
}
```

Le eccezioni sono facoltative e non cambiano lo `schemaVersion`: `parseBackup` tiene solo quelle valide (`normalizeExceptions`), una per addebito. Un dispositivo con una versione precedente dell'app le scarta quando legge i dati: su quel dispositivo gli addebiti tornano quelli della serie finché non si aggiorna l'app.

`endDate` è inclusiva al giorno: nel mese in cui la serie finisce, un addebito che cadrebbe dopo `endDate` non conta (vedi `occursIn`). `splitRecurring` ([`src/domain/recurrence.ts`](../../src/domain/recurrence.ts)) chiude una serie impostando `endDate` al giorno prima della divisione e ne apre una nuova da quella data (o dal giorno scelto, se l'addebito si sposta: allora la vecchia si ferma il giorno prima della prima delle due date); le due parti hanno lo stesso `seriesId` (l'id della prima parte), così l'app le mostra come una spesa sola. Il campo è facoltativo e non cambia lo `schemaVersion`: una spesa mai divisa non lo ha. Un dispositivo con una versione dell'app precedente lo scarta quando legge i dati (`parseBackup` tiene solo i campi che conosce): le cifre restano giuste, ma su quel dispositivo le parti tornano righe separate finché non si aggiorna l'app.

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
  quickExpenses: QuickExpense[]
}

export const CURRENT_SCHEMA_VERSION = 2
```

---

## 4. Migrazioni e Parsing Difensivo (`src/services/migration.ts`)

Il modulo `migration.ts` garantisce che Pocketly possa leggere e importare qualsiasi backup, compresi quelli provenienti dal vecchio prototipo HTML (schema v1) o file generati da versioni precedenti:

- **Riconoscimento automatico schema v1:**
  Nello schema v1 le spese erano suddivise per anno (`years[anno].oneTimeExpenses`, ecc.), gli importi erano numeri decimali in euro e le categorie erano stringhe letterali anziché ID. La funzione `migrateV1` converte gli importi in centesimi ed estrae le entità `Tag` con ID univoci. `parseBackup` riconosce anche il prototipo mono-anno più vecchio (array `oneTimeExpenses` alla radice) e lo migra come anno 2026.
- **Validazione difensiva `parseBackup(raw)`:**
  Non assume mai che il file importato sia valido. Convalida la presenza di ciascun array, ripulisce valori `null` o `undefined`, converte tipi non conformi e garantisce il ripristino di una struttura `FinanceData` semanticamente corretta.
- **Protezione versioni più recenti (`NewerFormatError`):**
  Se il file di backup o i dati provenienti dal server presentano uno `schemaVersion` maggiore di quello compreso dall'applicazione (`CURRENT_SCHEMA_VERSION = 2`), `parseBackup` solleva `NewerFormatError`. Lo store `sync.ts` riconosce l'eccezione impostando lo stato di problema `outdated`. Questo impedisce a versioni datate del client di sovrascrivere o cancellare dati che contengono campi introdotti in release future.
- **Valori predefiniti (`src/domain/defaults.ts`):**
  - `createEmptyData()`: genera un'istanza con array vuoti e impostazioni predefinite (stima delle entrate attiva, nessun limite di budget).
  - `createDefaultData(locale)`: genera un dataset iniziale con categorie e metodi di pagamento predefiniti nella lingua indicata (inglese se non supportata), con colori in equilibrio (`harmonizedColors`: ogni voce la tinta più lontana dalle precedenti, "Altro" grigia). Categorie in italiano: Cibo e bevande, Trasporti, Altro, Salute e benessere, Finanza, Digitale, Auto, Vacanze, Stipendio. Metodi: Bonifico, Contanti, Carta di debito, Carta di credito, PayPal.

---

## 5. Dove sono salvati i dati

- `FinanceData` è salvato in IndexedDB (libreria `idb-keyval`) sotto la chiave `'finance-data'` (`DATA_KEY` in [`src/services/storage.ts`](../../src/services/storage.ts)). Se la chiave è vuota, `deviceDataStore.load` prova a recuperare i dati del prototipo da `localStorage` (`finances_tracker_multiyr`, `finances_tracker_2026`).
- Le impostazioni del singolo dispositivo restano fuori da `FinanceData` e non si sincronizzano; stanno in IndexedDB: `'sync-config'` (store `sync`), `'notification-config'` e `'notifications-shown'` (store `notifications`), `'backup-meta'` (store `backup`, un `BackupMeta`). La lingua scelta è in `localStorage` sotto `'locale'`; l'aspetto (piattaforma e tema) sotto `'appearance-platform'` e `'appearance-theme'` (store `appearance`).
