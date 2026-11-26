---
source-files:
  - src/domain/calculations.ts
  - src/domain/recurrence.ts
  - src/domain/budget.ts
  - src/domain/merge.ts
  - src/domain/notifications.ts
  - src/domain/backupReminder.ts
  - src/domain/defaults.ts
  - src/domain/savings.ts
  - src/domain/search.ts
  - src/domain/tags.ts
verified: 2026-11-26
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

### `monthBalanceAfterSavings(data, year, month, today): Cents`
Il risultato di un mese come lo mostra la cifra grande della Dashboard: `monthSummary(...).balance` meno quanto è andato nei salvadanai nel mese (`savedBetween`, `PKT-19`).

### `averageBalanceBefore(data, year, month, today): Cents | null`
Media del risultato (`monthBalanceAfterSavings`: entrate meno uscite, meno quanto è andato nei salvadanai nel mese, come la cifra grande della Dashboard) dei mesi dell'anno precedenti a `month`, a partire dal mese di inizio del periodo attivo. `null` se non ci sono mesi precedenti da confrontare.

### `balanceVsAverage(data, year, month, today): { verdict, average } | null`
Il giudizio sotto la cifra grande per un mese passato: `compareToAverage` tra `monthBalanceAfterSavings` del mese e `averageBalanceBefore`. Le due parti tolgono i salvadanai allo stesso modo, così la frase parla della cifra che si vede. `null` senza mesi precedenti.

### `tagTrends(data, year, month, field, totals, today): Map<Id, TagTrendInfo>`
Calcola per ciascun tag (categoria o metodo di pagamento) il confronto tra l'importo consuntivato nel mese e la media mensile dei mesi precedenti dello stesso anno:
- La media parte dal primo mese (dall'inizio del periodo attivo) in cui il tag ha avuto spese: una voce comparsa a maggio non fa media sui mesi prima.
- Per i mesi passati: confronta l'importo totale del mese con la media mensile precedente.
- Per il mese in corso: confronta l'importo a oggi con quello che di solito c'era allo stesso giorno. Le spese variabili si proporzionano ai giorni passati (`pace`), come in `variableSpending`; gli addebiti ricorrenti dei mesi precedenti contano per intero se arrivati entro lo stesso giorno del mese, altrimenti non contano. Così un affitto addebitato il 1° non risulta «sopra il ritmo» nei primi giorni.
- Per l'intero anno (`month = 'all'`), per mesi futuri o per il primo mese del periodo attivo: restituisce una mappa vuota poiché non c'è una serie storica precedente su cui calcolare lo scostamento.
- Se un tag non ha spese nei mesi precedenti, viene omesso dalla mappa per evitare falsi allarmi o indicatori rumorosi.
- Restituisce per ciascun tag presente un oggetto `TagTrendInfo` contenente: `previousAverage`, `baseline` (ritmo o media intera), `verdict` (`'above'` | `'inline'` | `'below'`), `diffPercent` e `isPace`.

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
- `tagBreakdown(items)`: totale e conteggio delle voci (spese una tantum o entrate) per ciascun tag presente, ordinati per importo decrescente.
- `searchFinance(data, query, today)`: motore di ricerca globale pura full-text tokenizzata per trovare corrispondenze tra spese una tantum, ricorrenti, entrate, prestiti e salvadanai (match su nome, note, categorie, metodi e tag). Le ricorrenti sono raggruppate per serie (`groupRecurringSeries`): una spesa divisa in più parti è un solo risultato, con la parte in corso a `today`, e si trova cercando in una qualsiasi delle parti.
- `frequentTemplates(items, limit)`: estrae le voci più frequenti tra le transazioni passate ordinate per conteggio d'uso e recenza, per proporre template di precompilazione rapida.

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
- Dopo l'unione `repairReferences` rimette le categorie, i metodi di pagamento e i salvadanai cancellati su un dispositivo ma usati da voci aggiunte o cambiate sull'altro (es. un versamento in un salvadanaio cancellato altrove: il salvadanaio torna con i movimenti nuovi), e toglie dalle impostazioni le categorie che non esistono più.

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
  Restituisce true se ci sono dati utente (`hasData`, calcolato con `hasUserData(data)`: spese, entrate, ricorrenti, prestiti, salvadanai o inserimenti rapidi), l'impronta attuale dei dati (`currentHash`) è diversa da quella dell'ultimo backup (`BackupMeta.lastBackupHash`), il promemoria non è rimandato (`snoozedUntil`, `SNOOZE_DAYS = 1`) e sono passati almeno `REMINDER_DAYS = 7` giorni dall'ultimo backup (o dal primo avvio del controllo, `startedAt`).

---

## 7. Salvadanai e Obiettivi di Risparmio (`savings.ts`)

Questo modulo governa la pianificazione e l'accantonamento fondi verso traguardi finanziari specifici (`SavingsGoal`):
- `savedAmounts(movements)` e `withSavedAmounts(goals, movements)`: l'importo accantonato di ogni salvadanaio è la somma dei suoi movimenti (`SavingsMovement`), mai sotto zero. Le funzioni sotto lavorano sul tipo `SavedGoal` (salvadanaio + `currentAmount` calcolato).
- `savedBetween(movements, from, to, today)`: quanto è andato nei salvadanai tra due date (estremi compresi), versamenti meno prelievi, contando solo i movimenti fino a oggi; negativo se si è prelevato di più. La Dashboard lo toglie dalla cifra grande (`PKT-19`) e `averageBalanceBefore` dai mesi con cui la confronta.
- `calculateMonthsRemaining(today, targetDate)`: calcola quanti mesi effettivi mancano alla scadenza, arrotondando sui giorni solari (~30.4375 giorni/mese) con un minimo di 1 mese se entro lo stesso mese.
- `calculateRemainingAmount(goal)`: calcola l'importo ancora mancante (`targetAmount - currentAmount`), mai negativo.
- `calculateSavingsQuota(goal, today)`: calcola la quota mensile raccomandata (in centesimi interi, arrotondata per eccesso con `Math.ceil`) per raggiungere il target entro la data obiettivo. Se scaduto e non raggiunto, richiede l'intero importo residuo; se già completato restituisce 0.
- `calculateGoalProgress(goal)`: calcola la percentuale di avanzamento normalizzata tra 0 e 1.
- `goalStatus(goal, today)`: determina lo stato dell'obiettivo tra `'completed'` (raggiunto o superato), `'overdue'` (data superata e saldo inferiore al target) e `'active'` (in corso nei tempi).
- `savingsSummary(goals, today)`: produce metriche aggregate complete (totale target, totale accantonato, totale residuo, somma delle quote mensili dei soli obiettivi attivi, quanto manca agli obiettivi scaduti in `overdueRemaining`, progresso complessivo ponderato, in cui ogni salvadanaio conta al massimo il suo obiettivo, e conteggi per stato). Uno scaduto non entra nella quota mensile: non ha più mesi davanti, e sommarne tutto il mancante darebbe una cifra «al mese» falsa.
- `movementFor(movements, goalId, change)`: l'importo da registrare perché il salvadanaio cambi di `change` rispetto a quello che si vede. `savedAmounts` non mostra mai meno di zero, ma la somma dei movimenti può andarci (due prelievi su due dispositivi prima di sincronizzare): in quel caso il movimento copre anche il buco, così un versamento o l'importo scritto nel modulo arrivano davvero. Lo usa `finance.addSavingsMovement`.
- `sortSavingsGoals(goals, today)`: ordina la lista degli obiettivi dando priorità a quelli scaduti, poi a quelli attivi con scadenza più prossima, collocando i completati in fondo.

## 8. Categorie, metodi e tag (`tags.ts`)

- `sortTagsByName(tags, locale)`: restituisce un elenco nuovo in ordine alfabetico secondo la lingua dell'app (`Intl.Collator` con `sensitivity: 'base'` e `numeric: true`): maiuscole e accenti non contano, «Carta 2» viene prima di «Carta 10», a parità di nome resta l'ordine di creazione. Lo store lo espone come `finance.sortedTags` (categorie, metodi e tag), usato da menu a tendina (`TagSelect`), scelta dei tag (`TagInput`), Impostazioni (`TagManager`), Budget e Previsioni. In `data` le voci restano nell'ordine di creazione: salvataggio, sincronizzazione e backup non cambiano, e i valori proposti di partenza (es. la prima categoria in un modulo nuovo) restano quelli di prima.
- `countTagUsage(data, kind)`: calcola in un solo passaggio una `Map<Id, number>` con il numero di voci che usano ciascuna categoria, metodo di pagamento o tag (per i tag ogni movimento conta al più una volta). Esposto dallo store come `finance.tagUsageCounts` (e letto da `finance.tagUsage`).
- `filterAndSortTags(tags, usage, options)`: filtra per testo di ricerca (`normalizeTagSearch`, insensibile a maiuscole e accenti) e stato di utilizzo (`'all' | 'used' | 'unused'`) e ordina per nome (`'name'`) o per utilizzi decrescenti con spareggio alfabetico (`'usage'`).
- `groupTagsByLetter(tags)`: raggruppa un elenco ordinato alfabeticamente per lettera iniziale normalizzata (`A`–`Z`, oppure `#` per numeri e simboli), usato da `TagManager` per evitare elenchi troppo lunghi.
- `suggestTags(tags, usage, { query, excludeIds })`: i tag da proporre nel campo che cerca e crea (`TagInput`, `PKT-21`). A campo vuoto i più usati (al massimo `TAG_SUGGESTIONS_EMPTY`, 6); scrivendo prima il nome identico, poi chi inizia con il testo, poi chi lo contiene, ognuno dal più usato (al massimo `TAG_SUGGESTIONS_QUERY`, 8). Restituisce anche `exact`, il tag con il nome scritto senza badare a maiuscole e accenti, anche se già scelto: così il modulo non crea «caffe» se esiste «caffè». I tag già scelti non vengono proposti.
