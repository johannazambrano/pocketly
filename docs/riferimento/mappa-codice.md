---
source-files: []
verified: 2026-11-10
---

# Mappa del Codice

Questa mappa censisce l'intero repository Pocketly (`src/`, `server/`, `scripts/`, `deploy/`). Per ciascun file sono indicati:
- **Percorso:** path relativo alla radice del repository.
- **Responsabilità:** scopo primario del modulo e simboli chiave esportati.
- **Test:** eventuale file di test unitario associato.
- **Documentazione:** pagina di documentazione collegata per approfondimenti.

---

## 1. Applicazione Principale, Router e Stile (`src/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/App.vue`](../../src/App.vue) | Radice dell'albero Vue: coordinamento header, layout, router view, bottom nav, toast, modali e dialoghi di conferma | — | [frontend.md](../architettura/frontend.md) |
| [`src/main.ts`](../../src/main.ts) | Bootstrap dell'app: creazione istanza Vue, registrazione Pinia, Vue Router, vue-i18n e montaggio su `#app` | — | [frontend.md](../architettura/frontend.md) |
| [`src/env.d.ts`](../../src/env.d.ts) | Dichiarazioni di tipo TypeScript per moduli `.vue` e client Vite | — | [frontend.md](../architettura/frontend.md) |
| [`src/style.css`](../../src/style.css) | Foglio di stile globale basato su Tailwind CSS 4, classi utility e variabili di colore | — | [frontend.md](../architettura/frontend.md) |
| [`src/router/index.ts`](../../src/router/index.ts) | Definizione delle 9 rotte (8 principali e 1 di dettaglio), lazy loading viste e metadati dei tab (`TABS`) | — | [frontend.md](../architettura/frontend.md) |

---

## 2. Modello Dati e Tipi (`src/types/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/types/models.ts`](../../src/types/models.ts) | Modello dati TypeScript (schema v2): `FinanceData`, `Cents`, `IsoDate`, `Id`, `OneTimeExpense`, `RecurringExpense`, `Income`, `Loan`, `Repayment`, `Simulation`, `ForecastSettings`, `BudgetSettings` | `services/migration.test.ts` | [modello-dati.md](./modello-dati.md) |

---

## 3. Logica di Dominio Pura (`src/domain/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/domain/calculations.ts`](../../src/domain/calculations.ts) | Calcoli finanziari: `yearSummary`, `monthSummary`, `forecast`, `estimateCategoryIds`, `estimateMonthlyIncome`, `periodStartMonth`, `variableSpending`, `breakdownItems`, `upcomingCharges`, `oneTimeTagBreakdown` | [`src/domain/calculations.test.ts`](../../src/domain/calculations.test.ts) | [domain.md](./domain.md) |
| [`src/domain/recurrence.ts`](../../src/domain/recurrence.ts) | Regole temporali ricorrenze: `monthlyEquivalent`, `occursIn`, `dueDateIn`, `nextDueDate`, `amountInMonth`, `isActiveInYear` | [`src/domain/recurrence.test.ts`](../../src/domain/recurrence.test.ts) | [domain.md](./domain.md) |
| [`src/domain/budget.ts`](../../src/domain/budget.ts) | Logica budget mensile: calcolo consumato, programmato, ritmo di spesa (`pace`), suggeritore limiti (`suggestLimits) | [`src/domain/budget.test.ts`](../../src/domain/budget.test.ts) | [domain.md](./domain.md) |
| [`src/domain/merge.ts`](../../src/domain/merge.ts) | Algoritmo deterministico di merge a 3 vie: `mergeFinanceData`, `mergeIdList`, `deepEqual` | [`src/domain/merge.test.ts`](../../src/domain/merge.test.ts) | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/domain/notifications.ts`](../../src/domain/notifications.ts) | Calcolo promemoria futuri (`calculateUpcomingReminders`), formattazione messaggi e normalizzazione regole | [`src/domain/notifications.test.ts`](../../src/domain/notifications.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/domain/backupReminder.ts`](../../src/domain/backupReminder.ts) | Verifica necessità promemoria backup periodico in base a giorni trascorsi e presenza dati | [`src/domain/backupReminder.test.ts`](../../src/domain/backupReminder.test.ts) | [domain.md](./domain.md) |
| [`src/domain/defaults.ts`](../../src/domain/defaults.ts) | Inizializzazione dati: `createEmptyData` e `createDefaultData` con categorie e metodi predefiniti | — | [domain.md](./domain.md) |

---

## 4. State Management Pinia (`src/stores/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/stores/finance.ts`](../../src/stores/finance.ts) | Store centrale: gestione stato reattivo `FinanceData`, anno/mese correnti, computeds di bilancio e mutazioni CRUD | — | [frontend.md](../architettura/frontend.md) |
| [`src/stores/sync.ts`](../../src/stores/sync.ts) | Store di sincronizzazione: credenziali server, stato polling, avvio sync e gestione errori | `services/sync/engine.test.ts` | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/stores/notifications.ts`](../../src/stores/notifications.ts) | Store notifiche: permessi browser, sottoscrizione Web Push, scheduler locale e sync pianificazione push | [`src/stores/notifications.test.ts`](../../src/stores/notifications.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/stores/backup.ts`](../../src/stores/backup.ts) | Store promemoria backup: tracciamento timestamp ultimo export su IndexedDB | `services/backup.test.ts` | [frontend.md](../architettura/frontend.md) |
| [`src/stores/ui.ts`](../../src/stores/ui.ts) | Store interfaccia utente: gestione toast temporanei e richieste di conferma modali | — | [frontend.md](../architettura/frontend.md) |

---

## 5. Viste dell'Applicazione (`src/views/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/views/DashboardView.vue`](../../src/views/DashboardView.vue) | Vista principale (`/`): saldo, entrate, uscite, ripartizioni per categoria e metodo, stato backup | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/OneTimeView.vue`](../../src/views/OneTimeView.vue) | Vista spese una tantum (`/una-tantum`): lista spese, filtro per mese, filtro e spaccato per tag | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/RecurringView.vue`](../../src/views/RecurringView.vue) | Vista spese ricorrenti (`/ricorrenti`): lista, frequenze, costo equivalente mensile e configurazione promemoria | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/IncomeView.vue`](../../src/views/IncomeView.vue) | Vista entrate (`/entrate`): registrazione e consultazione delle entrate dell'anno | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/BudgetView.vue`](../../src/views/BudgetView.vue) | Vista budget (`/budget`): gestione limiti per categoria, monitoraggio ritmo giornaliero e barre di avanzamento | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/LoansView.vue`](../../src/views/LoansView.vue) | Vista prestiti (`/prestiti`): tracciamento crediti e debiti, storico rimborsi parziali e saldo residuo | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/ForecastView.vue`](../../src/views/ForecastView.vue) | Vista previsioni (`/previsioni`): proiezione fino a dicembre, simulazioni d'acquisto, stima automatica/manuale | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/SettingsView.vue`](../../src/views/SettingsView.vue) | Vista impostazioni (`/impostazioni`): anagrafiche (categorie, metodi, tag), backup AES-GCM, sync e Web Push | — | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/views/BreakdownDetailView.vue`](../../src/views/BreakdownDetailView.vue) | Vista dettaglio ripartizioni (`/dettaglio/:kind/:id`): elenco analitico delle voci (variabili e ricorrenti) di una riga | — | [componenti-e-viste.md](./componenti-e-viste.md) |

---

## 6. Componenti UI (`src/components/)

| File | Responsabilità | Documentazione |
|---|---|---|
| [`src/components/AppHeader.vue`](../../src/components/AppHeader.vue) | Barra superiore: titolo app, selettore anno globale e indicatore di stato | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BackupReminder.vue`](../../src/components/BackupReminder.vue) | Banner discreto nella dashboard che avvisa se non si effettua un backup da molti giorni | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BalancePanel.vue`](../../src/components/BalancePanel.vue) | Pannello principale del saldo con entrate, uscite e bilancio fino a oggi | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BaseModal.vue`](../../src/components/BaseModal.vue) | Modale generica accessibile con backdrop, gestione ESC e pulsante di chiusura | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BottomNav.vue`](../../src/components/BottomNav.vue) | Barra inferiore fissa con gli 8 tab di navigazione principale | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BreakdownList.vue`](../../src/components/BreakdownList.vue) | Ripartizione percentuale delle spese per categoria o per metodo di pagamento | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/BudgetBar.vue`](../../src/components/BudgetBar.vue) | Barra progressiva colorata per il monitoraggio visivo dei limiti di spesa | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/ConfirmHost.vue`](../../src/components/ConfirmHost.vue) | Host globale per mostrare dialoghi di conferma distruttiva (es. eliminazione) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/EntryList.vue`](../../src/components/EntryList.vue) | Contenitore standard per liste di transazioni con stato vuoto e totale in fondo | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/EntryRow.vue`](../../src/components/EntryRow.vue) | Singola riga di transazione con pulsanti modifica ed elimina | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/LoanForm.vue`](../../src/components/LoanForm.vue) | Modulo di creazione/modifica prestito (tipo dato/ricevuto, importo, date, note) | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/MonthSelector.vue`](../../src/components/MonthSelector.vue) | Componente a schede per filtrare per mese o visualizzare l'intero anno | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/NotificationRulesEditor.vue`](../../src/components/NotificationRulesEditor.vue) | Editor multi-regola di promemoria (giorni prima e orario) per spese ricorrenti | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/components/NotificationSettings.vue`](../../src/components/NotificationSettings.vue) | Pannello impostazioni notifiche: permessi browser, Web Push e test notifica | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/components/PageHeader.vue`](../../src/components/PageHeader.vue) | Intestazione standard di ciascuna vista con titolo e pulsante primario d'azione | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/RecurringForm.vue`](../../src/components/RecurringForm.vue) | Modulo di inserimento/modifica spesa ricorrente, frequenze e promemoria | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/RepaymentForm.vue`](../../src/components/RepaymentForm.vue) | Modulo per aggiungere un rimborso parziale a un prestito esistente | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/SubmitButton.vue`](../../src/components/SubmitButton.vue) | Pulsante submit uniforme con stile coerente | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/SyncSettings.vue`](../../src/components/SyncSettings.vue) | Pannello impostazioni di sincronizzazione: inserimento chiave, connessione e reset | [dati-e-sincronizzazione.md](../architettura/dati-e-sincronizzazione.md) |
| [`src/components/TagBadge.vue`](../../src/components/TagBadge.vue) | Badge colorato per categoria, metodo o tag con lookup automatico dal nome | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagInput.vue`](../../src/components/TagInput.vue) | Input autocomplete per selezionare e creare al volo nuovi tag | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagManager.vue`](../../src/components/TagManager.vue) | Gestore anagrafica categorie, metodi e tag con modale di modifica colore/nome | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TagSelect.vue`](../../src/components/TagSelect.vue) | Menu a tendina standard per la selezione di una categoria o metodo di pagamento | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/ToastHost.vue`](../../src/components/ToastHost.vue) | Host overlay per visualizzare notifiche toast a scomparsa | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/TransactionForm.vue`](../../src/components/TransactionForm.vue) | Modulo versatile per inserimento/modifica spese una tantum o entrate | [componenti-e-viste.md](./componenti-e-viste.md) |
| [`src/components/UpdatePrompt.vue`](../../src/components/UpdatePrompt.vue) | Notifica non invasiva quando è disponibile un nuovo aggiornamento del service worker | [frontend.md](../architettura/frontend.md) |
| [`src/components/WelcomePanel.vue`](../../src/components/WelcomePanel.vue) | Pannello di primo benvenuto mostrato quando non ci sono ancora dati inseriti | [componenti-e-viste.md](./componenti-e-viste.md) |

---

## 7. Servizi I/O e Crittografia (`src/services/)

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
| [`src/services/notifications/api.ts`](../../src/services/notifications/api.ts) | Chiamate HTTP verso `/api/push/*` (`config`, `subscription`, `schedule`, `test) | `stores/notifications.test.ts` | [NOTIFICHE.md](../NOTIFICHE.md) |
| [`src/services/notifications/webpushCrypto.ts`](../../src/services/notifications/webpushCrypto.ts) | Crittografia Web Push RFC 8291 (`aes128gcm`) sul browser via Web Crypto API nativa | [`src/services/notifications/webpushCrypto.test.ts`](../../src/services/notifications/webpushCrypto.test.ts) | [NOTIFICHE.md](../NOTIFICHE.md) |

---

## 8. Utility e Composables (`src/utils/`, `src/composables/`, `src/i18n/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`src/composables/useConfirmDelete.ts`](../../src/composables/useConfirmDelete.ts) | Composable per richiedere conferma utente prima di eliminare voci | — | [frontend.md](../architettura/frontend.md) |
| [`src/composables/useMonthStep.ts`](../../src/composables/useMonthStep.ts) | Navigazione mensile sequenziale (avanti/indietro con cambio anno automatico) per frecce, swipe touch e tasti freccia | — | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/index.ts`](../../src/i18n/index.ts) | Configurazione i18n, selettore lingua e composable helper `useFormat` | — | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/it.ts`](../../src/i18n/it.ts) | Traduzioni in lingua italiana | `scripts/docs-check.mjs` | [frontend.md](../architettura/frontend.md) |
| [`src/i18n/en.ts`](../../src/i18n/en.ts) | Traduzioni in lingua inglese | `scripts/docs-check.mjs` | [frontend.md](../architettura/frontend.md) |
| [`src/utils/colors.ts`](../../src/utils/colors.ts) | Generazione e selezione colori unici non in conflitto per tag e categorie | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |
| [`src/utils/dates.ts`](../../src/utils/dates.ts) | Utility per date IsoDate: parsing `YYYY-MM-DD`, formattazione, calcolo indici mese | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/hash.ts`](../../src/utils/hash.ts) | Calcolo fingerprint e digest SHA-256 su stringhe | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |
| [`src/utils/id.ts`](../../src/utils/id.ts) | Generatore di ID unici casuali (`newId`) per entità e transazioni | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/money.ts`](../../src/utils/money.ts) | Conversione tra stringhe valutarie dell'utente e interi in centesimi (`toCents`, `formatCents) | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | [modello-dati.md](./modello-dati.md) |
| [`src/utils/uuidv5.ts`](../../src/utils/uuidv5.ts) | Generatore di UUID v5 deterministici basati su namespace e stringa | [`src/utils/utils.test.ts`](../../src/utils/utils.test.ts) | — |

---

## 9. Backend Python (`server/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`server/main.py`](../../server/main.py) | Server HTTP REST in Python: gestione sync atomica, rate limit, worker push dispatch | [`server/test_main.py`](../../server/test_main.py) | [backend.md](../architettura/backend.md) |
| [`server/webpush.py`](../../server/webpush.py) | Implementazione Web Push RFC 8291/8292: curve P-256, firma ECDSA VAPID, validazione aes128gcm | [`server/test_main.py`](../../server/test_main.py) | [backend.md](../architettura/backend.md) |

---

## 10. Script di Supporto (`scripts/)

| File | Responsabilità | Test | Documentazione |
|---|---|---|---|
| [`scripts/xlsx_to_pocketly.py`](../../scripts/xlsx_to_pocketly.py) | Script CLI per la migrazione e conversione di fogli Excel complessi in JSON compatibile | — | [IMPORTA_DA_EXCEL.md](../IMPORTA_DA_EXCEL.md) |
| [`scripts/docs-check.mjs`](../../scripts/docs-check.mjs) | Script di validazione continua: link markdown, censimento file in mappa codice, simmetria i18n | — | [AGENTS.md](../../AGENTS.md) |

---

## 11. Infrastruttura e Deploy (`deploy/proxmox/)

| File | Responsabilità | Documentazione |
|---|---|---|
| [`deploy/proxmox/README.md`](../../deploy/proxmox/README.md) | Guida passo passo per deploy su Proxmox LXC Debian | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/install-sync.sh`](../../deploy/proxmox/install-sync.sh) | Script di installazione automatica (Nginx, utente `pocketly`, cartelle `/var/lib/pocketly) | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/make-cert.sh`](../../deploy/proxmox/make-cert.sh) | Generatore di CA e certificati TLS per server locale in rete domestica | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/pocketly-sync.service`](../../deploy/proxmox/pocketly-sync.service) | Definizione della systemd unit con parametri di sicurezza sandboxing | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/publish.sh`](../../deploy/proxmox/publish.sh) | Script per la compilazione frontend e rilascio locale su directory web | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/update.sh`](../../deploy/proxmox/update.sh) | Script di aggiornamento Git rapido con riavvio del servizio | [deploy.md](../architettura/deploy.md) |
| [`deploy/proxmox/nginx/pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf) | Configurazione Virtual Host Nginx per reverse proxy e caching PWA | [deploy.md](../architettura/deploy.md) |
