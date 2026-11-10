---
source-files:
  - src/domain/calculations.ts
  - src/domain/recurrence.ts
  - src/domain/budget.ts
  - src/domain/merge.ts
  - src/domain/notifications.ts
  - src/domain/backupReminder.ts
  - src/domain/defaults.ts
verified: 2026-11-10
---

# Riferimento: Logica di Dominio

Tutta la logica di calcolo matematico, le regole contabili e i criteri di unione dati risiedono nella cartella [`src/domain/`](../../src/domain/). Tutti i moduli sono funzioni TypeScript pure senza dipendenze dalla reattività di Vue o da elementi browser.

---

## 1. Calcoli e Bilanci (`calculations.ts`)

Questo modulo è il motore di calcolo finanziario dell'applicazione.

### `yearSummary(data, year, today = todayIso()): YearSummary`
Calcola il riassunto contabile completo per l'anno specificato:
- `periodStartMonth`: mese di inizio del periodo attivo (primo movimento registrato nell'anno o gennaio).
- `totalIncome`, `totalExpenses`: entrate e uscite complessive programmate per l'anno fino a dicembre.
- `incomeToDate`, `expensesToDate`, `balanceToDate`: valori consolidati avvenuti rigorosamente entro la data `today`.
- `oneTimeToDate`, `recurringToDate`: scomposizione delle uscite già avvenute.
- `projectedIncome`, `projectedBalance`: entrate e saldo previsti considerando l'eventuale stima automatica/manuale per i mesi futuri.
- `byCategory`, `byPaymentMethod`: ripartizioni aggregate con ordinamento decrescente.
- `byCategoryToDate`, `byPaymentMethodToDate`: ripartizioni ristrette alle spese già effettuate.

### `monthSummary(data, year, month, today = todayIso()): MonthSummary`
Calcola i valori per un singolo mese (indice `0..11`):
- Determina se il mese è `'past'`, `'current'` o `'future'`.
- Calcola le uscite una tantum e le ricorrenze che cadono specificamente in quel mese (`dueDateIn`).
- Integra la stima per il mese corrente/futuro se abilitata.

### `forecast(data, year, today = todayIso()): ForecastRow[]`
Genera le righe per la tabella di previsione mese per mese fino a dicembre:
- `income`: somma entrate registrate + eventuale stima.
- `expenses`: totale uscite del mese (una tantum + ricorrenze con addebito in quel mese + eventuali simulazioni attive).
- `balance`: `income - expenses`.
- `cumulative`: saldo cumulato progressivo che scorre da inizio periodo alla fine dell'anno.

### `estimateMonthlyIncome(data, today): Cents`
Calcola la stima dell'entrata fissa mensile:
- Considera le categorie configurate dall'utente in `data.forecast.incomeCategoryIds` oppure, se non specificate, quelle rilevate automaticamente da `estimateCategoryIds`.
- Calcola la media delle entrate avvenute negli ultimi mesi (fino a `ESTIMATE_MONTHS = 3`) nelle sole categorie selezionate.
- Restituisce `0` se la stima è disattivata o in assenza di dati sufficienti.

### `estimateCategoryIds(data, today): Id[]`
Individua le categorie con entrate ricorrenti automatiche: analizza i 3 mesi precedenti e include le categorie che compaiono in almeno 2 mesi distinti (es. stipendio mensile).

### `breakdownItems(data, year, month, field, tagId, today = todayIso()): BreakdownItem[]`
Estrae le singole voci (spese variabili e addebiti ricorrenti) che compongono una riga di "Spese per categoria" o "Spese per metodo di pagamento", con le medesime regole di consolidamento della dashboard (ordinate dalla più recente):
- Per l'intero anno: include solo ciò che è avvenuto fino a `today`.
- Per il mese in corso: include ciò che è avvenuto fino a `today`.
- Per mesi passati o futuri: include l'intero mese (anche voci solo programmate).
Consente alla vista `BreakdownDetailView` di presentare l'elenco analitico la cui somma coincide esattamente con il totale della riga.

### `upcomingCharges(data, today, until): UpcomingCharge[]`
Estrae tutte le uscite previste dopo `today` e fino a `until` compreso:
- Tutte le scadenze delle spese ricorrenti nel periodo `(today, until]`.
- Tutte le spese una tantum già registrate con data futura nel periodo `(today, until]`.
Le voci con data `<= today` sono escluse poiché già conteggiate nel consuntivo a data odierna. Restituisce elementi `UpcomingCharge` con `key`, `id`, `source` (`'recurring'` | `'oneTime'`), `name`, `amount`, `date` e `daysLeft`.

---

## 2. Spese Ricorrenti (`recurrence.ts`)

Gestisce il calcolo temporale delle scadenze e dei cicli periodici.

- `monthlyEquivalent(r)`: calcola `amount / FREQUENCY_MONTHS[frequency]`. Rappresenta il costo medio mensile spalmato.
- `occursIn(r, year, month): boolean`: verifica se una spesa ricorrente ha un addebito nel mese indicato (tenendo conto di `startDate`, `frequency` e `endDate`).
- `dueDateIn(r, year, month): IsoDate | null`: calcola la data esatta (`YYYY-MM-DD`) dell'addebito nel mese, adattando il giorno a fine mese (es. se la data di inizio era il 31, in aprile cade il 30 aprile).
- `nextDueDate(r, from: IsoDate): IsoDate | null`: calcola la data del prossimo addebito a partire dalla data `from` inclusa.
- `amountInMonth(r, year, month): Cents`: restituisce `r.amount` se `occursIn` è vero, altrimenti `0`.
- `isActiveInYear(r, year): boolean`: verifica se la spesa ha almeno un addebito valido nell'anno specificato.

---

## 3. Monitoraggio Budget (`budget.ts`)

Calcola lo stato di avanzamento e i limiti di spesa per il mese corrente o selezionato.

### `budgetMonth(data, year, month, today): BudgetMonthResult`
- Calcola per ciascuna categoria con limite:
  - `spent`: uscite già avvenute (spese una tantum con data `<= today` + ricorrenze già scadute).
  - `scheduled`: uscite programmate nel resto del mese (spese una tantum con data `> today` + ricorrenze con scadenza nel mese successiva a `today`).
  - `remaining`: `limit - spent - scheduled`. Se negativo, indica sforamento.
  - `status`:
    - `'ok'`: spesa nei limiti e ritmo sostenibile.
    - `'warning'`: spesa non ancora superata ma ritmo giornaliero (`pace`) superiore al limite previsto.
    - `'over'`: limite di categoria superato.
  - `projected`: spesa stimata a fine mese estrapolando la media giornaliera sui giorni effettivi del mese.

### `suggestLimits(data, year, month): Record<Id, Cents>`
Suggerisce all'utente limiti ragionevoli calcolando la media storica di spesa effettiva per ciascuna categoria nei mesi precedenti.

---

## 4. Unione a Tre Vie (`merge.ts`)

Implementa l'algoritmo di merge deterministico tra `base`, `local` e `remote`.
- `deepEqual(a, b)`: comparatore strutturale ricorsivo per oggetti, array e tipi primitivi.
- `mergeFinanceData(base, local, remote)`: unisce i due rami di modifiche.
- `mergeIdList`: confronta le entità identificate per `id`, gestendo in modo pulito inserimenti, modifiche e cancellazioni senza bisogno di campi tombstone.

---

## 5. Notifiche e Promemoria (`notifications.ts`)

- `calculateUpcomingReminders(recurringExpenses, now, horizonDays = 60)`:
  Scansiona le spese ricorrenti attive e le relative regole di promemoria (`NotificationRule[]`), proiettando tutte le notifiche che cadranno nei successivi 60 giorni. Genera elementi contenenti:
  - `id`: identificativo univoco deterministico (`${expenseId}:${dueDate}:${daysBefore}:${time}`).
  - `dueDate`: data di scadenza della spesa.
  - `fireAt`: timestamp UTC esatto in secondi (non millisecondi) in cui la notifica deve scattare.
  - `amount`: importo in centesimi.
  - `expenseName`: nome della spesa.
- `formatReminderMessage(reminder, t, formattedAmount, formattedDueDate)`:
  Genera titolo e corpo della notifica localizzati (es. "Scadenza dopodomani: Affitto (€ 650,00)").

---

## 6. Promemoria Backup (`backupReminder.ts`)

- `shouldRemindBackup(lastExportedAt, today, intervalDays = 30)`:
  Restituisce true se sono trascorsi più di 30 giorni dall'ultimo backup esportato (o se non è mai stato esportato) e nel database sono presenti dati utente inseriti (`hasUserData(data)`).
