---
source-files:
  - src/domain/calculations.ts
  - src/domain/recurrence.ts
  - src/domain/budget.ts
  - src/domain/merge.ts
  - src/domain/notifications.ts
  - src/domain/backupReminder.ts
  - src/domain/defaults.ts
verified: 2026-11-12
---

# Riferimento: Logica di Dominio

Tutta la logica di calcolo matematico, le regole contabili e i criteri di unione dati risiedono nella cartella [`src/domain/`](../../src/domain/). Tutti i moduli sono funzioni TypeScript pure senza dipendenze dalla reattività di Vue o da elementi browser.

---

## 1. Calcoli e Bilanci (`calculations.ts`)

Questo modulo è il motore di calcolo finanziario dell'applicazione.

### `periodStartMonth(data, year): number`
Mese di inizio del periodo attivo: il mese del primo movimento registrato nell'anno (spesa una tantum o entrata), oppure gennaio se non ce ne sono. Il periodo arriva sempre a dicembre.

### `yearSummary(data, year, today = todayIso()): YearSummary`
Calcola il riassunto contabile completo per l'anno specificato:
- `periodStartMonth`: mese di inizio del periodo attivo (vedi sopra).
- `totalIncome`: entrate registrate nell'anno, comprese quelle con data futura.
- `oneTimeTotal`, `recurringInPeriod`, `totalExpenses`: uscite dell'anno (una tantum registrate + addebiti ricorrenti programmati dal mese di inizio a dicembre).
- `incomeToDate`, `expensesToDate`, `balanceToDate`: valori consolidati avvenuti entro la data `today` (per un anno passato, tutto l'anno).
- `oneTimeToDate`, `recurringToDate`: scomposizione delle uscite già avvenute.
- `projectedIncome`, `projectedBalance`: entrate e saldo a fine anno considerando l'eventuale stima delle entrate per il mese corrente e i futuri (simulazioni escluse).
- `monthlyRecurring`: somma dei costi mensili equivalenti delle ricorrenze attive nell'anno.
- `byCategory`, `byPaymentMethod`: ripartizioni aggregate con ordinamento decrescente.
- `byCategoryToDate`, `byPaymentMethodToDate`: ripartizioni ristrette alle spese già effettuate.

### `monthBreakdown(data, year, month, cutoff?): MonthBreakdown`
Ripartizione delle uscite di un mese (`byCategory`, `byPaymentMethod`, `totalExpenses`): spese una tantum con data nel mese + addebiti ricorrenti con scadenza nel mese. Con `cutoff` conta solo ciò che ha data fino a quel giorno compreso.

### `monthSummary(data, year, month, today = todayIso()): MonthSummary`
Calcola i valori per un singolo mese (indice `0..11`):
- Determina se il mese è `'past'`, `'current'` o `'future'` (`timing`).
- Calcola le uscite una tantum e le ricorrenze che cadono specificamente in quel mese (`dueDateIn`), sia per tutto il mese sia solo per ciò che è già avvenuto (campi `...ToDate`).
- Integra la stima per il mese corrente/futuro se abilitata (`projectedIncome`, `projectedBalance`).

### `forecast(data, year, today = todayIso()): ForecastRow[]`
Genera le righe per la tabella di previsione mese per mese, dal mese di inizio del periodo attivo fino a dicembre:
- `income`: somma entrate registrate + eventuale stima (`incomeEstimated` indica se è stata aggiunta).
- `expenses`: totale uscite del mese (una tantum + ricorrenze con addebito in quel mese + simulazioni del mese).
- `balance`: `income - expenses`.
- `cumulative`: saldo cumulato progressivo che scorre da inizio periodo alla fine dell'anno.

### `estimateMonthlyIncome(data, today): Cents`
Calcola la stima dell'entrata fissa mensile:
- Considera le categorie configurate dall'utente in `data.forecast.incomeCategoryIds` oppure, se non specificate, quelle rilevate automaticamente da `estimateCategoryIds`.
- Calcola la media delle entrate avvenute (data fino a `today`) negli ultimi mesi con entrate (fino a `ESTIMATE_MONTHS = 3`) nelle sole categorie selezionate.
- Restituisce `0` se la stima è disattivata o in assenza di dati sufficienti.

### `estimateCategoryIds(data, today): Id[]`
Restituisce le categorie scelte dall'utente oppure, se non ne ha scelte, individua quelle che si ripetono: analizza i 3 mesi precedenti a quello di `today` e include le categorie che compaiono in almeno 2 mesi distinti (es. stipendio mensile).

### `variableSpending(data, today): VariableSpending`
Spese variabili (una tantum) del mese di oggi: `total` (tutto il mese), `toDate` (solo fino a oggi) e `previousAverage`, la media mensile dei mesi precedenti dell'anno a partire dal mese di inizio del periodo attivo (`null` se non ce ne sono).

### `compareToAverage(value, average, tolerance = 0.1): Verdict`
Confronta un valore con la sua media e restituisce un `Verdict` (`'above'` | `'inline'` | `'below'`): è `'inline'` se lo scarto resta entro il 10% di `|average|`.

### `averageBalanceBefore(data, year, month, today): Cents | null`
Media del saldo (entrate meno uscite, da `monthSummary`) dei mesi dell'anno precedenti a `month`, a partire dal mese di inizio del periodo attivo. `null` se non ci sono mesi precedenti da confrontare.

### `breakdownItems(data, year, month, field, tagId, today = todayIso()): BreakdownItem[]`
Estrae le singole voci (spese variabili e addebiti ricorrenti) che compongono una riga di "Spese per categoria" o "Spese per metodo di pagamento", con le medesime regole di consolidamento della dashboard (ordinate dalla più recente):
- Per l'intero anno (`month = 'all'`): dal mese di inizio del periodo a dicembre, solo ciò che è avvenuto fino a `today`.
- Per il mese in corso: include ciò che è avvenuto fino a `today`.
- Per mesi passati o futuri: include l'intero mese (anche voci solo programmate).
Consente alla vista `BreakdownDetailView` di presentare l'elenco analitico la cui somma coincide esattamente con il totale della riga.

### `upcomingCharges(data, today, until): UpcomingCharge[]`
Estrae tutte le uscite previste dopo `today` e fino a `until` compreso:
- Tutte le scadenze delle spese ricorrenti nel periodo `(today, until]`.
- Tutte le spese una tantum già registrate con data futura nel periodo `(today, until]`.
Le voci con data `<= today` sono escluse poiché già conteggiate nel consuntivo a data odierna. Restituisce elementi `UpcomingCharge` con `key`, `id`, `source` (`'recurring'` | `'oneTime'`), `name`, `amount`, `date` e `daysLeft`, ordinati per data.

### Altre funzioni
- `loanStatus(loan)`: restituisce `{ repaid, remaining }`, cioè la somma dei rimborsi e il residuo del prestito.
- `availableYears(data, currentYear)`: anni per cui esistono dati (spese, entrate, prestiti, simulazioni, inizio delle ricorrenze) più l'anno corrente, in ordine crescente.
- `oneTimeTagBreakdown(expenses)`: totale e conteggio delle spese una tantum per ciascun tag, ordinati per importo decrescente.

---

## 2. Spese Ricorrenti (`recurrence.ts`)

Gestisce il calcolo temporale delle scadenze e dei cicli periodici.

- `monthlyEquivalent(r)`: calcola `amount / FREQUENCY_MONTHS[frequency]`. Rappresenta il costo medio mensile spalmato.
- `occursIn(r, year, month): boolean`: verifica se una spesa ricorrente ha un addebito nel mese indicato (tenendo conto di `startDate`, `frequency` e `endDate`). Nel mese di `endDate` conta il giorno: una serie che finisce il 14 non ha l'addebito del 15 di quel mese.
- `scheduledDateIn(r, year, month): IsoDate | null`: la data che l'addebito del mese ha secondo la serie, senza eccezioni, adattando il giorno a fine mese (es. se la data di inizio era il 31, in aprile cade il 30 aprile).
- `chargeIn(r, year, month): Charge | null`: l'addebito del mese com'è davvero, con l'eccezione applicata (`r.exceptions`, «Solo questo addebito»): `date` (spostata, se l'eccezione la sposta nello stesso mese), `amount` (quello dell'eccezione o della serie), `original` (la data secondo la serie, che identifica l'addebito) ed `exception`. `null` se il mese non ha addebiti o se è stato saltato. Tutti i calcoli (riepiloghi, ripartizioni, dettaglio, prossimi addebiti, budget, previsioni, promemoria) passano da qui.
- `dueDateIn(r, year, month)` / `amountInMonth(r, year, month)`: data e importo di `chargeIn` (`null` / `0` se non c'è addebito o è saltato).
- `chargesBetween(r, from, to): Charge[]`: gli addebiti veri con data nell'intervallo, estremi inclusi; li usano i promemoria (`occurrencesBetween` in `notifications.ts` ne restituisce le date).
- `exceptionOn(r, original)`: l'eccezione dell'addebito con quella data secondo la serie.
- `withException(r, e)`: aggiunge o sostituisce l'eccezione dell'addebito `e.date`, ripulita (uno spostamento vale solo nello stesso mese); un'eccezione che non cambia niente toglie quella che c'era.
- `normalizeExceptions(raw)`: le eccezioni valide lette dai dati salvati o sincronizzati, una per addebito, in ordine.
- `nextDueDate(r, from: IsoDate): IsoDate | null`: la data del prossimo addebito secondo la serie (senza eccezioni) a partire da `from` inclusa (`null` se la ricorrenza è terminata); serve a individuare l'addebito da cui parte una modifica.
- `splitRecurring(r, from, changes)`: divide una ricorrenza da un addebito in poi. Restituisce `before` (la serie esistente con `endDate` il giorno prima di `from`) e `after` (una nuova serie con i valori di `changes` che parte da `from`). Solleva un errore se `from <= startDate`. Le eccezioni restano con la parte a cui appartengono i loro addebiti (quelle della parte nuova cadono se il giorno cambia). Le due parti ricevono lo stesso `seriesId` (`seriesKey(r)`: il `seriesId` della serie o il suo id).
- `splitRecurring(r, from, changes, start)`: con `start` diverso da `from` sposta il giorno dell'addebito (es. dal 14 al 15 da novembre): la nuova parte parte da `start`, la vecchia si ferma il giorno prima della prima delle due date, così nel mese del cambio c'è un addebito solo. Rifiuta uno `start` fuori da `moveWindow`.
- `moveWindow(r, from)`: dove si può spostare l'addebito `from`: dal giorno dopo l'addebito precedente al giorno prima del successivo (o alla fine della serie). Mensile del 14 spostato a novembre: dal 15/10 al 13/12.
- `seriesKey(r)`: la chiave della spesa a cui appartiene una parte (`seriesId ?? id`).
- `groupRecurringSeries(items, ref)`: raggruppa le parti per spesa e, per ciascuna, sceglie la parte da mostrare alla data `ref` (`current`: quella attiva, altrimenti l'ultima iniziata, altrimenti la prima), con `previous`, `next`, le parti in ordine e `active` (la parte mostrata è attiva a `ref`, quindi conta nel totale mensile).
- `isActiveInYear(r, year): boolean`: verifica solo che la ricorrenza sia attiva in almeno un giorno dell'anno (inizio non successivo all'anno, fine assente o non precedente).

---

## 3. Monitoraggio Budget (`budget.ts`)

Calcola lo stato di avanzamento e i limiti di spesa per il mese corrente o selezionato.

### `budgetMonth(data, year, month, today): BudgetMonth`
- Calcola per ciascuna categoria con limite (`BudgetLine`):
  - `spent`: uscite già avvenute (spese una tantum e addebiti ricorrenti con data `<= today`).
  - `scheduled`: uscite già inserite con data futura nello stesso mese (data `> today`).
  - `remaining`: `limit - spent - scheduled`. Se negativo, indica sforamento.
  - `status`:
    - `'ok'`: `spent + scheduled` sotto l'80% del limite.
    - `'warning'`: `spent + scheduled` ha raggiunto l'80% del limite (`BUDGET_WARNING_RATIO`) senza superarlo.
    - `'over'`: limite di categoria superato.
  - `projected`: spesa prevista a fine mese; solo per il mese di oggi e da `MIN_PACE_DAYS` (5) giorni in poi, altrimenti `null`. Estende ai giorni restanti solo le spese variabili; ricorrenze e spese già datate nel futuro valgono quanto sono.
- Restituisce anche i totali (`totalLimit`, `totalSpent`, `totalScheduled`, `totalRemaining`, `status`), le spese in categorie senza limite (`unbudgeted`), e per il mese di oggi `daysLeft` e `dailyAvailable`.

### `suggestLimits(data, year, month): Record<Id, Cents>`
Suggerisce limiti per categoria: media mensile delle spese variabili negli ultimi `ESTIMATE_MONTHS` mesi prima di quello indicato (escludendo quelli precedenti al primo movimento) più il costo mensile equivalente delle ricorrenze attive nel mese, arrotondati a multipli di 5 €.

---

## 4. Unione a Tre Vie (`merge.ts`)

Implementa l'algoritmo di merge deterministico tra `base`, `local` e `remote`.
- `deepEqual(a, b)`: comparatore strutturale ricorsivo per oggetti, array e tipi primitivi.
- `mergeFinanceData(base, local, remote)`: unisce i due rami di modifiche.
- Internamente (funzione non esportata `mergeIdList`) le liste di entità vengono confrontate per `id`, gestendo in modo pulito inserimenti, modifiche e cancellazioni senza bisogno di campi tombstone.

---

## 5. Notifiche e Promemoria (`notifications.ts`)

- `calculateUpcomingReminders(expenses, now, horizonDays = 60)`:
  Scansiona le spese ricorrenti e le relative regole di promemoria (`NotificationRule[]`), proiettando tutte le notifiche che cadranno nei successivi 60 giorni. Genera elementi `ScheduledReminder` contenenti tra l'altro:
  - `id`: identificativo univoco deterministico (`${expenseId}:${dueDate}:${daysBefore}:${time}`).
  - `dueDate`: data di scadenza della spesa.
  - `fireAt`: timestamp UTC esatto in secondi (non millisecondi) in cui la notifica deve scattare.
  - `amount`: importo in centesimi.
  - `expenseName`: nome della spesa.
- `calculateDueLocalReminders(expenses, now, lookbackHours = 24)`: promemoria già maturati nelle ultime ore per addebiti non ancora passati, usato dal motore locale all'apertura dell'app.
- `formatReminderMessage(reminder, t, formattedAmount, formattedDueDate)`:
  Genera titolo e corpo della notifica localizzati (es. titolo "Affitto in scadenza", corpo "Tra 2 giorni (…) addebito previsto di 650,00 €.").
- `pushTestCause(status)` → `PushTestCause`: dal codice con cui il servizio push ha risposto alla notifica di prova, la causa da mostrare: `rejectedSender` (401/403, di solito il mittente VAPID), `expired` (404/410, iscrizione scaduta), `unreachable` (0, il server non raggiunge il servizio), `other`.
- `pushServiceName(host)`: il nome del servizio push da mostrare (Apple, Google, Mozilla, Microsoft) a partire dall'host dell'endpoint; per gli altri, l'host stesso.

---

## 6. Promemoria Backup (`backupReminder.ts`)

- `isReminderDue(meta, currentHash, hasData, now)`:
  Restituisce true se ci sono dati utente (`hasData`, calcolato con `hasUserData(data)`), l'impronta attuale dei dati (`currentHash`) è diversa da quella dell'ultimo backup (`BackupMeta.lastBackupHash`), il promemoria non è rimandato (`snoozedUntil`, `SNOOZE_DAYS = 1`) e sono passati almeno `REMINDER_DAYS = 7` giorni dall'ultimo backup (o dal primo avvio del controllo, `startedAt`).
