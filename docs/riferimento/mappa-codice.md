---
source-files: []
verified: 2026-11-12
---

# Mappa del Codice

Questa mappa censisce l'intero repository Pocketly (`src/`, `server/`, `scripts/`, `deploy/`). Per ciascun file sono indicati:
- **Percorso:** path relativo alla radice del repository.
- **Responsabilità:** scopo primario del modulo e simboli chiave esportati.
- **Test:** eventuale file di test unitario associato.
- **Documentazione:** pagina di documentazione collegata per approfondimenti.

---

## 1. Applicazione Principale, Router, Stile e Configurazione PWA (`src/`, `public/`, radice)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/App.vue`](../../src/App.vue) | Radice dell'albero Vue: coordinamento header, layout, router view, bottom nav, toast, modali e dialoghi di conferma | — | [frontend.md](../architettura/frontend.md) |
| [`src/main.ts`](../../src/main.ts) | Bootstrap dell'app: creazione istanza Vue, registrazione Pinia, Vue Router, vue-i18n e montaggio su `#app` | — | [frontend.md](../architettura/frontend.md) |
| [`src/env.d.ts`](../../src/env.d.ts) | Dichiarazioni di tipo TypeScript per moduli `.vue` e client Vite, e delle costanti di build (`__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILT_AT__`) | — | [frontend.md](../architettura/frontend.md) |
| [`src/style.css`](../../src/style.css) | Foglio di stile globale basato su Tailwind CSS 4: gettoni di colore con nomi di significato (`bg-surface`, `text-ink-2`, `border-line`…, valori nelle variabili `--pk-*` che cambiano per `html[data-platform]` e `html[data-theme]`), safe-area scroll padding, classi utility | — | [frontend.md](../architettura/frontend.md) |
| [`src/router/index.ts`](../../src/router/index.ts) | Definizione delle 9 rotte (8 principali e 1 di dettaglio), lazy loading viste e metadati dei tab (`TABS`) | — | [frontend.md](../architettura/frontend.md) |
| [`public/push-worker.js`](../../public/push-worker.js) | Service worker Web Push: gestione ricezione eventi push, icona badge e navigazione su click | — | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`index.html`](../../index.html) | Entry point HTML dell'applicazione PWA, meta tag viewport, thema e aggancio mount Vue | — | [frontend.md](../architettura/frontend.md) |
| [`vite.config.ts`](../../vite.config.ts) | Configurazione bundler Vite, integrazione Workbox PWA, proxy di sviluppo per `/api` verso porta 8787 e costanti di build (versione, commit corto, ora della build) | — | [deploy.md](../architettura/deploy.md) |
| [`pwa-assets.config.ts`](../../pwa-assets.config.ts) | Configurazione generazione automatica asset e icone PWA | — | [frontend.md](../architettura/frontend.md) |

---

## 2. Modello Dati e Tipi (`src/types/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/types/models.ts`](../../src/types/models.ts) | Modello dati TypeScript (schema v2): `FinanceData`, `Cents`, `IsoDate`, `Id`, `OneTimeExpense`, `RecurringExpense`, `Income`, `Loan`, `Repayment`, `Simulation`, `ForecastSettings`, `BudgetSettings` | `services/migration.test.ts` | [modello-dati.md](./modello-dati.md) |

---

## 3. Logica di Dominio Pura (`src/domain/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/domain/calculations.ts`](../../src/domain/calculations.ts) | Calcoli finanziari: `yearSummary`, `monthSummary`, `monthBreakdown`, `forecast`, `estimateCategoryIds`, `estimateMonthlyIncome`, `periodStartMonth`, `variableSpending`, `compareToAverage` (verdetto sopra/in linea/sotto la media), `averageBalanceBefore`, `breakdownItems`, `upcomingCharges`, `loanStatus`, `availableYears`, `oneTimeTagBreakdown` | [`src/domain/calculations.test.ts`](../../src/domain/calculations.test.ts) | [domain.md](./domain.md) |
| [`src/domain/recurrence.ts`](../../src/domain/recurrence.ts) | Regole temporali ricorrenze: `monthlyEquivalent`, `occursIn`, `dueDateIn`, `nextDueDate`, `amountInMonth`, `splitRecurring` (divide una serie da un addebito in poi, collegando le parti con `seriesId`), `moveWindow` (dove si può spostare il giorno di un addebito), `seriesKey`, `groupRecurringSeries` (una spesa per riga), `isActiveInYear` | [`src/domain/recurrence.test.ts`](../../src/domain/recurrence.test.ts) | [domain.md](./domain.md) |
| [`src/domain/budget.ts`](../../src/domain/budget.ts) | Logica budget mensile (`budgetMonth`): consumato, programmato, stato con soglia `BUDGET_WARNING_RATIO`, proiezione a fine mese; suggeritore limiti (`suggestLimits`) | [`src/domain/budget.test.ts`](../../src/domain/budget.test.ts) | [domain.md](./domain.md) |
| [`src/domain/merge.ts`](../../src/domain/merge.ts) | Algoritmo deterministico di merge a 3 vie: `mergeFinanceData`, `deepEqual` (unione per ID interna) | [`src/domain/merge.test.ts`](../../src/domain/merge.test.ts) | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/domain/notifications.ts`](../../src/domain/notifications.ts) | Calcolo promemoria futuri (`calculateUpcomingReminders`), formattazione messaggi, normalizzazione regole e causa di una notifica di prova fallita (`pushTestCause`, `pushServiceName`) | [`src/domain/notifications.test.ts`](../../src/domain/notifications.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/domain/backupReminder.ts`](../../src/domain/backupReminder.ts) | Verifica necessità promemoria backup (`isReminderDue`): dati presenti e cambiati dall'ultimo backup, 7 giorni trascorsi, rinvio | [`src/domain/backupReminder.test.ts`](../../src/domain/backupReminder.test.ts) | [domain.md](./domain.md) |
| [`src/domain/defaults.ts`](../../src/domain/defaults.ts) | Inizializzazione dati: `createEmptyData` e `createDefaultData` con categorie e metodi predefiniti | — | [domain.md](./domain.md) |

---

## 4. State Management Pinia (`src/stores/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/stores/finance.ts`](../../src/stores/finance.ts) | Store centrale: gestione stato reattivo `FinanceData`, anno/mese correnti, computeds di bilancio e mutazioni CRUD | — | [frontend.md](../architettura/frontend.md) |
| [`src/stores/sync.ts`](../../src/stores/sync.ts) | Store di sincronizzazione: credenziali server, stato polling, avvio sync e gestione errori | `services/sync/engine.test.ts` | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/stores/notifications.ts`](../../src/stores/notifications.ts) | Store notifiche: permessi browser, sottoscrizione Web Push, scheduler locale e sync pianificazione push | [`src/stores/notifications.test.ts`](../../src/stores/notifications.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/stores/backup.ts`](../../src/stores/backup.ts) | Store promemoria backup: salva in IndexedDB (`'backup-meta'`) un `BackupMeta` con data e impronta dei dati dell'ultimo backup, e segnala modifiche non salvate | `services/backup.test.ts` | [frontend.md](../architettura/frontend.md) |
| [`src/stores/appearance.ts`](../../src/stores/appearance.ts) | Aspetto dell'app: piattaforma (automatica o scelta: iPhone, Android, PC) e tema (sistema, chiaro, scuro), salvati in `localStorage` (`'appearance-platform'`, `'appearance-theme'`) e applicati a `<html>` come `data-platform` e `data-theme` | — | [frontend.md](../architettura/frontend.md) |
| [`src/stores/ui.ts`](../../src/stores/ui.ts) | Store interfaccia utente: toast temporanei (gli errori restano 10 secondi e si chiudono con `dismissToast`), apertura del modulo rapido (`quickAddOpen`) e richieste di conferma (`confirm`, con `cancelLabel` facoltativo) | — | [frontend.md](../architettura/frontend.md) |

---

## 5. Viste dell'Applicazione (`src/views/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/views/DashboardView.vue`](../../src/views/DashboardView.vue) | Vista principale (`/`): saldo, verdetti rispetto alla media (`compareToAverage`), ripartizioni, prossime scadenze modificabili con i moduli, delega tasti a `MonthSelector` | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/OneTimeView.vue`](../../src/views/OneTimeView.vue) | Vista spese una tantum (`/una-tantum`): lista spese, filtro per mese, filtro e spaccato per tag | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/RecurringView.vue`](../../src/views/RecurringView.vue) | Vista spese ricorrenti (`/ricorrenti`): una riga per spesa (`recurringSeriesOfYear`), «Storico» dei periodi, costo equivalente mensile della parte in corso e configurazione promemoria | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/IncomeView.vue`](../../src/views/IncomeView.vue) | Vista entrate (`/entrate`): registrazione e consultazione delle entrate dell'anno | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/BudgetView.vue`](../../src/views/BudgetView.vue) | Vista budget (`/budget`): gestione limiti per categoria, monitoraggio ritmo giornaliero e barre di avanzamento | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/LoansView.vue`](../../src/views/LoansView.vue) | Vista prestiti (`/prestiti`): tracciamento crediti e debiti, storico rimborsi parziali e saldo residuo | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/ForecastView.vue`](../../src/views/ForecastView.vue) | Vista previsioni (`/previsioni`): proiezione fino a dicembre, simulazioni d'acquisto, stima automatica/manuale | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/SettingsView.vue`](../../src/views/SettingsView.vue) | Vista impostazioni (`/impostazioni`): anagrafiche, backup AES-GCM, sync, Web Push, verifica aggiornamenti e ricarica server | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/BreakdownDetailView.vue`](../../src/views/BreakdownDetailView.vue) | Dettaglio ripartizioni (`/dettaglio/:kind/:id`): voci analitiche modificabili con i moduli, stato "non trovato", a11y focus heading, ritorno alla dashboard | — | [componenti-e-viste.md](./componenti-e-viste.md) |

---

## 6. Componenti UI (`src/components/`)

| File | Responsabilità | Documentazione |
|---|---|---|
| [`src/components/AppHeader.vue`](../../src/components/AppHeader.vue) | Barra superiore per piattaforma (iPhone: traslucida con anno e "+" tondo; Android: top app bar con il nome della pagina; PC: barra chiara con marchio e "+ Nuova spesa"), selettore anno globale e stato della sincronizzazione | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BackupReminder.vue`](../../src/components/BackupReminder.vue) | Banner discreto nella dashboard che avvisa se non si effettua un backup da molti giorni | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BalancePanel.vue`](../../src/components/BalancePanel.vue) | Pannello saldo: una sola cifra grande (previsto o saldo finale) con il saldo di oggi in una frase e la riga della stima; colore neutro se è positiva solo grazie alla stima, rosso solo sotto zero; entrate e uscite con i verdetti rispetto alla media e il conto "Come si arriva a questa cifra" | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BaseModal.vue`](../../src/components/BaseModal.vue) | Modale generica accessibile: focus sul titolo e ritorno all'origine, resto dell'app `inert`, pila di finestre sovrapposte, conferma prima di chiudere se `dirty`; foglio con la forma della piattaforma, su iPhone barra "Annulla · titolo · Fine" con `formId` | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BottomNav.vue`](../../src/components/BottomNav.vue) | Barra di navigazione inferiore/laterale per piattaforma (iPhone traslucida; Android con pillola sulla voce attiva e "+" flottante), evidenziazione della voce anche per viste figlie (`navParent`) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BreakdownList.vue`](../../src/components/BreakdownList.vue) | Ripartizione percentuale delle spese per categoria o per metodo di pagamento | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BudgetBar.vue`](../../src/components/BudgetBar.vue) | Barra progressiva colorata per il monitoraggio visivo dei limiti di spesa | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/ConfirmHost.vue`](../../src/components/ConfirmHost.vue) | Host globale per i dialoghi di conferma dello store `ui` (es. eliminazione), con etichetta di rinuncia personalizzabile | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/EntryList.vue`](../../src/components/EntryList.vue) | Contenitore standard per liste di transazioni con stato vuoto e totale in fondo | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/EntryRow.vue`](../../src/components/EntryRow.vue) | Singola riga di transazione: sul PC matita e cestino, sul telefono tutta la riga apre la modifica (› su iPhone, iniziale su Android) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/LoanForm.vue`](../../src/components/LoanForm.vue) | Modulo di creazione/modifica prestito (tipo dato/ricevuto, importo, date, note) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/MonthSelector.vue`](../../src/components/MonthSelector.vue) | Filtro mese unificato con la forma della piattaforma (iPhone: titolo-menu, ‹ › e segmenti «Mese | Tutto l'anno»; Android: ‹ chip-menu ›; PC: frecce e menu), stessi nomi ovunque: listener tastiera globali ← →, preservazione focus, transizione da `'all'` | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/NotificationRulesEditor.vue`](../../src/components/NotificationRulesEditor.vue) | Editor multi-regola di promemoria (giorni prima e orario) per spese ricorrenti | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/components/NotificationSettings.vue`](../../src/components/NotificationSettings.vue) | Pannello impostazioni notifiche: permessi browser, Web Push e test notifica | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/components/PageHeader.vue`](../../src/components/PageHeader.vue) | Intestazione di ciascuna vista: titolo grande su iPhone, solo per lettori di schermo su Android (il nome sta nella barra in alto), medio sul PC; pulsante "Aggiungi" (`page-add`) pieno sul PC, tenue a pillola sul telefono | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/RecurringForm.vue`](../../src/components/RecurringForm.vue) | Modulo di inserimento/modifica spesa ricorrente, frequenze e promemoria; in modifica sceglie tra "Da questo addebito in poi" (`splitRecurring`) e tutta la serie | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/RepaymentForm.vue`](../../src/components/RepaymentForm.vue) | Modulo per aggiungere un rimborso parziale a un prestito esistente | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/SubmitButton.vue`](../../src/components/SubmitButton.vue) | Pulsante submit uniforme; con `cancelLabel` affianca un pulsante "Annulla" esplicito; forma per piattaforma (su iPhone nessuno: sono nella barra del foglio) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/SyncSettings.vue`](../../src/components/SyncSettings.vue) | Pannello impostazioni di sincronizzazione: inserimento chiave, connessione e reset | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/components/TagBadge.vue`](../../src/components/TagBadge.vue) | Badge colorato per categoria, metodo o tag con lookup automatico dal nome; con `clickable` è un `<button>` | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagInput.vue`](../../src/components/TagInput.vue) | Input autocomplete per selezionare e creare al volo nuovi tag | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagManager.vue`](../../src/components/TagManager.vue) | Gestore anagrafica categorie, metodi e tag con modale di modifica colore/nome | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagSelect.vue`](../../src/components/TagSelect.vue) | Menu a tendina standard per la selezione di una categoria o metodo di pagamento | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/ToastHost.vue`](../../src/components/ToastHost.vue) | Host overlay per visualizzare notifiche toast a scomparsa | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TransactionForm.vue`](../../src/components/TransactionForm.vue) | Modulo versatile per inserimento/modifica spese una tantum o entrate | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/UpdatePrompt.vue`](../../src/components/UpdatePrompt.vue) | Notifica non invasiva e gestione ciclo di vita aggiornamenti Service Worker e risvegli iOS | [frontend.md](../architettura/frontend.md) |
| [`src/components/WelcomePanel.vue`](../../src/components/WelcomePanel.vue) | Pannello di primo benvenuto mostrato quando non ci sono ancora dati inseriti | [componenti-e-viste.md](./componenti-e-viste.md) |

---

## 7. Servizi I/O e Crittografia (`src/services/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/services/storage.ts`](../../src/services/storage.ts) | Interfaccia `DataStore` e implementazione `deviceDataStore` per salvataggio su IndexedDB | — | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/services/backup.ts`](../../src/services/backup.ts) | Esportazione/importazione file di backup (JSON in chiaro o cifrato con password) | [`src/services/backup.test.ts`](../../src/services/backup.test.ts) | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/services/backupCrypto.ts`](../../src/services/backupCrypto.ts) | Crittografia client-side: PBKDF2 + AES-GCM 256 via Web Crypto API nativa | [`src/services/backup.test.ts`](../../src/services/backup.test.ts) | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/services/migration.ts`](../../src/services/migration.ts) | Migrazione schemi (v1 -> v2) e parsing difensivo `parseBackup` contro dati malformati | [`src/services/migration.test.ts`](../../src/services/migration.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/services/excelImport.ts`](../../src/services/excelImport.ts) | Parsing client-side di file Excel `.xlsx` e conversione diretta in voci Pocketly | [`src/services/excelImport.test.ts`](../../src/services/excelImport.test.ts) | [IMPORTA_DA_EXCEL.md](../IMPORTA_DA_EXCEL.md) |
| [`src/services/xlsx/workbook.ts`](../../src/services/xlsx/workbook.ts) | Lettore XML del workbook Excel per fogli di calcolo `.xlsx` | `services/excelImport.test.ts` | [IMPORTA_DA_EXCEL.md](../IMPORTA_DA_EXCEL.md) |
| [`src/services/xlsx/zip.ts`](../../src/services/xlsx/zip.ts) | Decompressione ZIP in memoria per l'estrazione dei file XML interni ad XLSX | `services/excelImport.test.ts` | [IMPORTA_DA_EXCEL.md](../IMPORTA_DA_EXCEL.md) |
| [`src/services/sync/api.ts`](../../src/services/sync/api.ts) | Chiamate HTTP verso `/api/sync` (`GET` e `PUT`) con gestione errori e timeout | `services/sync/engine.test.ts` | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/services/sync/engine.ts`](../../src/services/sync/engine.ts) | Orchestratore sincronizzazione: pull, merge a 3 vie su base comune, cifratura e push | [`src/services/sync/engine.test.ts`](../../src/services/sync/engine.test.ts) | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/services/notifications/api.ts`](../../src/services/notifications/api.ts) | Chiamate HTTP verso `/api/push/*` (`config`, `subscription`, `schedule`, `test`) | `stores/notifications.test.ts` | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/services/notifications/webpushCrypto.ts`](../../src/services/notifications/webpushCrypto.ts) | Crittografia Web Push RFC 8291 (`aes128gcm`) sul browser via Web Crypto API nativa | [`src/services/notifications/webpushCrypto.test.ts`](../../src/services/notifications/webpushCrypto.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |

---

## 8. Utility e Composables (`src/utils/`, `src/composables/`, `src/i18n/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/composables/useConfirmDelete.ts`](../../src/composables/useConfirmDelete.ts) | Composable per richiedere conferma utente prima di eliminare voci | — | [frontend.md](../architettura/frontend.md) |
| [`src/composables/useAppUpdate.ts`](../../src/composables/useAppUpdate.ts) | Stato condiviso degli aggiornamenti dell'app (`updateReady`, `reloadPending`) e regole: `checkForUpdate` aspetta l'installazione, `applyUpdate`, ricarica solo della finestra che l'ha chiesto | — | [frontend.md](../architettura/frontend.md) |
| [`src/composables/useDirty.ts`](../../src/composables/useDirty.ts) | Tracciamento modifiche non salvate dei moduli (`useDirty`: `dirty`, `reset`), usato da `BaseModal` per chiedere conferma prima di chiudere | — | [frontend.md](../architettura/frontend.md) |
| [`src/composables/useMonthStep.ts`](../../src/composables/useMonthStep.ts) | Navigazione mensile sequenziale (avanti/indietro con cambio anno) e transizione da `'all'` a mese specifico | — | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/index.ts`](../../src/i18n/index.ts) | Configurazione i18n, selettore lingua (`setLocale`) e composable helper `useFormat` (`money`, `amountInput`, `date`, `month`, `percent`) | — | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/it.ts`](../../src/i18n/it.ts) | Traduzioni in lingua italiana | `scripts/docs-check.mjs` | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/en.ts`](../../src/i18n/en.ts) | Traduzioni in lingua inglese | `scripts/docs-check.mjs` | [frontend.md](../architettura/frontend.md) |
| [`src/utils/colors.ts`](../../src/utils/colors.ts) | Tavolozza OKLCH in equilibrio (`PALETTE`, `OTHER_COLOR`), tinta più lontana per le voci nuove (`pickUniqueColor`), riarmonizzazione (`harmonizedColors`), etichette leggibili (`badgeColors`) | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |
| [`src/utils/dates.ts`](../../src/utils/dates.ts) | Utility per date IsoDate: parsing `YYYY-MM-DD`, formattazione, calcolo indici mese, `addDays`, `lastDayOfMonth` | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/hash.ts`](../../src/utils/hash.ts) | Calcolo fingerprint e digest SHA-256 su stringhe | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |
| [`src/utils/id.ts`](../../src/utils/id.ts) | Generatore di ID unici casuali (`newId`) per entità e transazioni | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/platform.ts`](../../src/utils/platform.ts) | Riconoscimento della piattaforma dal browser (`detectPlatform`: iOS, anche iPad che si presenta come Mac; Android; altrimenti PC) | [`src/utils/platform.test.ts`](../../src/utils/platform.test.ts) | [frontend.md](../architettura/frontend.md) |
| [`src/utils/money.ts`](../../src/utils/money.ts) | Conversione tra stringhe valutarie dell'utente e interi in centesimi: `toCents` (virgola o punto), `centsToInput` (separatore della lingua), `formatCents` | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/uuidv5.ts`](../../src/utils/uuidv5.ts) | Generatore di UUID v5 deterministici basati su namespace e stringa | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |

---

## 9. Backend Python (`server/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`server/main.py`](../../server/main.py) | Server HTTP REST in Python: gestione sync atomica, rate limit, worker push dispatch | [`server/test_main.py`](../../server/test_main.py) | [backend.md](../architettura/backend.md) |
| [`server/webpush.py`](../../server/webpush.py) | Implementazione Web Push RFC 8291/8292: curve P-256, firma ECDSA VAPID, validazione aes128gcm | [`server/test_main.py`](../../server/test_main.py) | [backend.md](../architettura/backend.md) |

---

## 10. Script di Supporto (`scripts/`)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`scripts/xlsx_to_pocketly.py`](../../scripts/xlsx_to_pocketly.py) | Script CLI per la migrazione e conversione di fogli Excel complessi in JSON compatibile | — | [IMPORTA_DA_EXCEL.md](../IMPORTA_DA_EXCEL.md) |
| [`scripts/python.mjs`](../../scripts/python.mjs) | Avvia Python in modo portabile (`python3`, `python` o `py -3`) per `test:server` | — | [AGENTS.md](../../AGENTS.md) |
| [`scripts/docs-check.mjs`](../../scripts/docs-check.mjs) | Script di validazione continua: link markdown, censimento file in mappa codice, simmetria i18n | — | [AGENTS.md](../../AGENTS.md) |

---

## 11. Infrastruttura e Deploy (`deploy/proxmox/`)

| File | Responsabilità | Documentazione |
|---|---|---|
| [`deploy/proxmox/README.md`](../../deploy/proxmox/README.md) | Guida passo passo per deploy su Proxmox LXC Debian | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/install-sync.sh`](../../deploy/proxmox/install-sync.sh) | Script di installazione automatica (Nginx, utente `pocketly`, cartelle `/var/lib/pocketly`) | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/make-cert.sh`](../../deploy/proxmox/make-cert.sh) | Generatore di CA e certificati TLS per server locale in rete domestica | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/pocketly-sync.service`](../../deploy/proxmox/pocketly-sync.service) | Definizione della systemd unit con parametri di sicurezza sandboxing | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/publish.sh`](../../deploy/proxmox/publish.sh) | Script per la compilazione frontend e rilascio locale su directory web | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/update.sh`](../../deploy/proxmox/update.sh) | Script di aggiornamento Git, build, allineamento Nginx (copia in `.bak`, ripristino se `nginx -t` fallisce) e riavvio servizi | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/nginx/pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf) | Configurazione Virtual Host Nginx per reverse proxy e caching PWA | [deploy.md](../architettura/deploy.md) |
