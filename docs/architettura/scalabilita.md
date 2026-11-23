---
source-files:
  - src/stores/finance.ts
  - src/stores/sync.ts
  - src/stores/notifications.ts
  - src/services/storage.ts
  - src/services/backup.ts
  - src/services/backupCrypto.ts
  - src/services/exportData.ts
  - src/services/sync/api.ts
  - src/services/sync/engine.ts
  - src/domain/calculations.ts
  - src/domain/budget.ts
  - src/domain/merge.ts
  - src/domain/search.ts
  - src/components/SearchModal.vue
  - src/components/TagManager.vue
  - src/views/OneTimeView.vue
  - src/views/IncomeView.vue
  - src/views/BreakdownDetailView.vue
  - server/main.py
  - server/webpush.py
  - deploy/proxmox/nginx/pocketly.conf
  - deploy/proxmox/pocketly-sync.service
verified: 2026-11-20
---

# Analisi e Progetto di Scalabilità (PKT-13)

Questo documento valuta la scalabilità dell'architettura attuale di **Pocketly** lungo tre assi di crescita (volume di dati storici, numero di dispositivi sincronizzati, eventuale passaggio al multi-utente) e definisce un piano evolutivo progressivo con le specifiche tecniche necessarie per implementarlo in **PKT-18**.

---

## 1. Sintesi del Verdetto

| Scenario | Valutazione attuale | Motivo principale |
|---|---|---|
| **Uso personale / coppia / famiglia** (1–5 dispositivi, ~500–2.000 movimenti/anno, fino a ~5 anni) | **Adeguata** | Payload cifrato ben sotto `MAX_BODY_BYTES` (5 MiB), `GET /api/sync` con `304 Not Modified`, IndexedDB e calcoli client sotto poche decine di ms (resta comunque migliorabile il costo del polling disco su `304` e dei ricalcoli a cascata). |
| **Storico molto esteso** (> 10.000 movimenti o > 10 anni su un solo archivio) | **Parziale — limiti noti** | Monolite JSON unico in `FinanceData`, doppio `watch(..., { deep: true })`, doppia serializzazione per sync/IndexedDB, ricalcoli ripetuti in `calculations.ts`, assenza di compressione prima della cifratura e nessun limite/debounce su liste e `SearchModal`. |
| **Molti dispositivi sullo stesso archivio** (> 10–16 device) | **Limitata** | `MAX_PUSH_DEVICES = 16`, merge CAS ottimistico su blob intero (`409` → retry), cifratura client Web Push sequenziale per `(reminder × device)`, dispatch Web Push sequenziale sul server con timeout da 10 s ciascuno. |
| **Multi-utente / SaaS** (molti utenti indipendenti sullo stesso server) | **Non scalabile così com'è** | Server single-tenant con una sola `POCKETLY_SYNC_KEY`, singoli file `current.json` / `push.json`, `ThreadingHTTPServer` con lettura/scrittura integrale su disco protetta da lock globale. |

---

## 2. Analisi dei Colli di Bottiglia Verificati

### 2.1 Persistenza locale e reattività client (`src/stores/`, `src/services/storage.ts`)
- **Archivio monolitico in IndexedDB:** [`deviceDataStore`](../../src/services/storage.ts) legge e scrive l'intero oggetto `FinanceData` sotto un'unica chiave (`DATA_KEY = 'finance-data'`). Ogni salvataggio esegue `JSON.parse(JSON.stringify(data))` per rimuovere i proxy Vue prima di scrivere in `idb-keyval`.
- **Doppio watcher profondo (`deep: true`):**
  - [`useFinanceStore`](../../src/stores/finance.ts) osserva l'intero `data` con `watch(data, scheduleSave, { deep: true })` (debounce 300 ms).
  - [`useSyncStore`](../../src/stores/sync.ts) osserva anch'esso `() => finance.data` con `watch(..., { deep: true })` (debounce 1500 ms).
  - [`useNotificationsStore`](../../src/stores/notifications.ts) osserva `finance.data.recurringExpenses` con `watch(..., { deep: true })` (debounce `SYNC_DEBOUNCE_MS = 2000`).
- **Doppia copia completa dei dati in memoria e IndexedDB:** [`SyncState.base`](../../src/services/sync/engine.ts) conserva una copia integrale dell'ultima versione sincronizzata in `CONFIG_KEY = 'sync-config'` per il merge a 3 vie (`snapshot(base)` + `JSON.parse(JSON.stringify(next.state))` in `saveConfig`).
- **Allocazione ripetuta in `tagUsage` (`src/stores/finance.ts`) *(risolto con `PKT-16`)*:** `countTagUsage` in [`tags.ts`](../../src/domain/tags.ts) calcola ora in un solo passaggio una `Map<Id, number>` esposta come `finance.tagUsageCounts`, e `tagUsage(kind, id)` esegue un lookup `O(1)`.

### 2.2 Calcoli di dominio, ricerca e rendering UI (`src/domain/`, `src/components/`, `src/views/`)
- **Scansioni lineari e ricalcoli a cascata in [`calculations.ts`](../../src/domain/calculations.ts):**
  - `yearSummary`, `forecast`, `estimateCategoryIds`, `estimateMonthlyIncome`, `availableYears`, `budgetMonth` e `suggestLimits` ([`budget.ts`](../../src/domain/budget.ts)), nonché `oneTimeOfYear` e `incomesOfYear` in `useFinanceStore`, scorrono gli array completi invocando ripetutamente `parseIsoDate` (`split('-').map(Number)`).
  - `incomeByMonth` esegue `for (let m = periodStartMonth(data, year); m < 12; m++)` richiamando `periodStartMonth(data, year)` ad **ogni** iterazione e filtrando `incomes` 12 volte.
  - `averageBalanceBefore` richiama `monthSummary` per ogni mese precedente dell'anno; ciascun `monthSummary` ricalcola da capo `incomeByMonth` → `estimateMonthlyIncome` → `estimateCategoryIds`, moltiplicando il lavoro su tutto lo storico delle entrate.
- **Ricerca live senza debounce né limite risultati (`SearchModal.vue`, `search.ts`):**
  - [`SearchModal.vue`](../../src/components/SearchModal.vue) ricalcola `searchFinance(finance.data, query.value, finance.today)` in modo sincrono ad ogni tasto digitato (costruendo e normalizzando via `normalize` stringhe per tutte le voci di `oneTimeExpenses`, `recurringExpenses`, `incomes`, `loans`, `savingsGoals`) e renderizza nel DOM l'intero array `results`.
- **Liste senza paginazione o virtualizzazione:**
  - [`OneTimeView.vue`](../../src/views/OneTimeView.vue), [`IncomeView.vue`](../../src/views/IncomeView.vue) e [`BreakdownDetailView.vue`](../../src/views/BreakdownDetailView.vue) renderizzano tutte le righe filtrate in un unico `v-for`. Con `'all'` (tutto l'anno) su storici grandi si accumulano centinaia/migliaia di nodi DOM.
  - *Vincolo importante:* `OneTimeView` e `IncomeView` usano `useHighlight` per evidenziare e scorrere verso una voce aperta da Omnisearch (`?highlight=<id>`), e `BreakdownDetailView` usa `closeForm()` per riportare il focus su `[data-item-key="..."]`. Un'eventuale paginazione dovrà espandere la finestra visibile fino a includere la voce target.

### 2.3 Sincronizzazione E2E, Backup, Export ed Edge Crypto (`src/services/`)
- **Payload monolitico non compresso:**
  - [`syncOnce`](../../src/services/sync/engine.ts) serializza l'intero `FinanceData` in JSON e lo cifra con [`encryptWithKey`](../../src/services/backupCrypto.ts) (AES-256-GCM + base64, +~33% overhead) senza compressione preventiva.
  - Il limite server `MAX_BODY_BYTES = 5 * 1024 * 1024` (5 MiB) in [`server/main.py`](../../server/main.py) (allineato a `client_max_body_size 6m` in [`pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf), con `TIMEOUT_MS = 15_000` in [`api.ts`](../../src/services/sync/api.ts)) corrisponde indicativamente a **~10.000–14.000 movimenti totali** (~300–450 byte cifrati+base64 per voce).
- **Backup ed export interamente in RAM:**
  - [`serializeBackup`](../../src/services/backup.ts) usa `JSON.stringify(data, null, 2)` (indentato con spazi anche quando il contenuto viene poi cifrato da `encryptBackup`, aumentando il peso del file protetto).
  - [`exportData.ts`](../../src/services/exportData.ts) costruisce tutte le tabelle e genera il pacchetto XLSX/ZIP interamente in memoria sul thread UI (e in `zipWriter.ts` ricade su metodo 0 senza compressione se la compressione fallisce).
- **Costo del 3-way merge e polling:**
  - `syncOnce` esegue `deepEqual` ricorsivo sull'intero `FinanceData`, `snapshot(...)` e [`mergeFinanceData`](../../src/domain/merge.ts) (`repairReferences`). Con scritture simultanee da più device, `PUT /api/sync` ritorna `409` e ritenta fino a `MAX_ATTEMPTS = 3` scaricando ogni volta l'intero blob remoto, fino a `SyncBusyError`.
  - Il client esegue polling ogni `PERIODIC_MS = 20_000` ms (`useSyncStore`) più su `visibilitychange`, `focus`, `online`.
- **Cifratura Web Push sequenziale lato client (`src/stores/notifications.ts`):**
  - `runSyncPushSchedule` cifra sequenzialmente ogni coppia `(reminder, device)` con `encryptWebPushPayload` (ECDH P-256 + HKDF + AES-128-GCM) fino a `MAX_SCHEDULE_ITEMS = 5000` voci in un singolo `PUT /api/push/schedule` (~2,2–2,8 MiB al tetto, sotto `MAX_BODY_BYTES = 5 MiB`).

### 2.4 Backend Python, Web Push e Deploy (`server/`, `deploy/proxmox/`)
- **Lettura e parsing di `current.json` anche su `304 Not Modified`:**
  - [`Store.read`](../../server/main.py) non mantiene cache in memoria: ad ogni `GET /api/sync` (ogni 20 s per client aperto) riapre `current.json` da disco ed esegue `json.load(f)` solo per leggere `current["version"]` e confrontare `If-None-Match`.
- **Single-tenant su file JSON:**
  - Una sola chiave `POCKETLY_SYNC_KEY` in ambiente, nessun `tenantId`/`userId`.
  - `Store` riscrive l'intero `current.json` e salva le ultime `HISTORY_KEEP = 30` versioni integrali in `history/v*.json` (fino a ~150 MiB se i payload si avvicinano a 5 MiB).
  - `ThreadingHTTPServer` crea un thread per connessione senza pool limitato né timeout socket esplicito lato Python (`proxy_read_timeout 30s` in Nginx).
- **Crescita illimitata di `Failures.by_ip` in memoria:**
  - [`Failures`](../../server/main.py) ripulisce i timestamp scaduti (`FAILURE_WINDOW_SECONDS = 900`) per un IP solo quando quello stesso IP torna a chiamare `blocked(ip)`. Sotto scansioni da molti IP diversi su rete pubblica la mappa in RAM cresce fino al riavvio del servizio.
- **Web Push (`PushStore` e `send_web_push`):**
  - Limiti rigidi globali: `MAX_PUSH_DEVICES = 16` e `MAX_PUSH_SCHEDULE = 5000` in `push.json`, con orizzonte client di 60 giorni.
  - **Dispatch sequenziale bloccante:** `PushStore.dispatch_due` gira ogni `DISPATCH_INTERVAL_SECONDS = 30.0` s in un unico thread daemon (`pocketly-push-dispatcher`) chiamando `send_web_push` ([`server/webpush.py`](../../server/webpush.py), `timeout = 10.0` s) **in sequenza** per tutte le voci mature. Un endpoint lento o in timeout ritarda tutte le notifiche successive in coda.
  - **Riscrittura integrale di `push.json`:** ogni ciclo con invii o rimozioni e ogni `PUT /api/push/schedule` riscrive l'intero `push.json` (incluso `sent` a 30 giorni) con `os.fsync`.

---

## 3. Progetto Evolutivo di Scalabilità (a Fasi)

L'evoluzione va graduata per evitare complessità inutile finché Pocketly resta un'app personale/familiare, mantenendo invariati i principi **privacy-first**, **offline-first** e **Zero-Knowledge**.

### Fase 1 — Quick Wins (Zero Breaking Changes, compatibilità immediata)
Obiettivo: eliminare subito sprechi CPU/I/O sia sul server sia sul client senza cambiare formati dati, API o contratti di sync.
- **Backend:** cache in memoria di `Store.read()` con invalidazione sicura su `stat()`, pulizia periodica di `Failures.by_ip`, dispatch Web Push parallelo per `deviceId` in `PushStore.dispatch_due`.
- **Frontend:** rimozione dei ricalcoli a cascata in `calculations.ts`, conteggio diretto in `tagUsage`, JSON compatto dentro i backup cifrati, debounce e limite iniziale in `SearchModal.vue`, caricamento progressivo per liste annuali lunghe (`OneTimeView`, `IncomeView`, `BreakdownDetailView`).

### Fase 2 — Storico Pluriennale (> 10.000–50.000 movimenti) e Più Dispositivi
Obiettivo: portare il tetto pratico ben oltre i 10–15 anni di utilizzo e ridurre la banda di sync/backup.
- **Compressione prima della cifratura (`backupCrypto.ts`, `engine.ts`):** comprimere il JSON con `CompressionStream('gzip')` prima di AES-GCM (riduzione ~70–85% della dimensione, portando il limite di `5 MiB` a ~50k–80k voci), mantenendo retrocompatibilità in lettura e coordinando l'aggiornamento di tutti i dispositivi prima del deploy.
- **Partizione per anno (se i dati superano anche la compressione):** separare i dati "caldi" (anagrafiche + anno corrente/futuro + prestiti/salvadanai attivi) dagli anni chiusi (`archive-YYYY`), eseguendo merge a 3 vie (`mergeFinanceData`) e sync solo sui blocchi cambiati.
- **Riduzione copie reattive:** sostituire `JSON.parse(JSON.stringify(...))` con `structuredClone(toRaw(...))` in `storage.ts` / `sync.ts` / `engine.ts`, e valutare il backoff esponenziale lato server sui fallimenti temporanei Web Push.

### Fase 3 — Evoluzione Multi-Tenant / Multi-Utente (coordinata con `PKT-12` / `PKT-25`)
Obiettivo: permettere a più utenti/famiglie indipendenti di usare la stessa istanza server in isolamento e sicurezza.
- **Persistenza SQLite Zero-Dependency (`sqlite3` in modalità `WAL`):** sostituire la coppia globale `current.json` / `push.json` eliminando la riscrittura completa del file ad ogni sync/notifica, il lock globale su JSON e introducendo query indicizzate per `vault_id` (`tenant_id`) e `fire_at <= now`.
- **Autenticazione e quote per archivio:** sostituire `POCKETLY_SYNC_KEY` condivisa con il modello di identità, sessioni revocabili e archivi personali/condivisi definito in [Progetto Autenticazione](./autenticazione.md) (`PKT-12`, implementazione in `PKT-25`), applicando limiti (`MAX_BODY_BYTES`, `MAX_PUSH_DEVICES`, `MAX_PUSH_SCHEDULE`, rate limit) per singolo archivio/utente.
- **Worker HTTP:** sostituire `ThreadingHTTPServer` con un server WSGI/ASGI con pool limitato se la concorrenza supera poche decine di richieste/sec.

---

## 4. Specifiche Tecniche per l'Implementazione (Guida Operativa)

Questa sezione raccoglie i dettagli tecnici pronti all'uso per suddividere e svolgere i lavori in **PKT-18** senza dover riesaminare l'intera architettura.

### 4.1 Backend: Cache `Store.read()`, Pulizia `Failures` e Dispatch Push Parallelo (`server/main.py`, `server/test_main.py`)
1. **Cache `Store.read()` per evitare I/O sui `304 Not Modified`:**
   - In `Store.__init__`: aggiungere `self._cache_stat: Optional[tuple[int, int, int]] = None` (`(st_ino, st_mtime_ns, st_size)`) e `self._cache_data: Optional[dict] = None`.
   - In `Store.read()`: sotto `with self.lock:`, eseguire `st = self.current.stat()`. Se `FileNotFoundError`, azzerare la cache e restituire `{'version': 0, 'updatedAt': None, 'payload': None}`. Se `self._cache_data is not None` e `(st.st_ino, st.st_mtime_ns, st.st_size) == self._cache_stat`, restituire `self._cache_data` (i chiamanti trattano il dict in sola lettura). Altrimenti aprire, `json.load`, aggiornare cache e restituire.
   - In `Store.save()`: dopo `write_atomic(self.current, new)`, leggere `st = self.current.stat()` e aggiornare subito `self._cache_stat` e `self._cache_data = new`.
   - *Test:* verificare in `server/test_main.py` che due `GET /api/sync` con `If-None-Match` non rileggano `current.json` dal disco, ma che sostituendo manualmente `current.json` su disco la cache si invalidi al giro successivo.
2. **Pulizia periodica di `Failures.by_ip`:**
   - Aggiungere `_prune_all_unlocked(self, now: float)` chiamata in `add()` / `blocked()` quando `len(self.by_ip) > 256` (o simile soglia): filtra i timestamp entro `FAILURE_WINDOW_SECONDS` ed elimina le chiavi con lista vuota.
   - *Test:* popolare `Failures` con > 256 IP scaduti e verificare che vengano rimossi automaticamente.
3. **Dispatch Web Push parallelo per `deviceId` in `PushStore.dispatch_due`:**
   - Raggruppare gli elementi `due` per `deviceId` mantenendo l'ordine per dispositivo (`by_device: dict[str, list[dict]]`).
   - Eseguire un worker per ciascun `deviceId` fuori da `self.lock` tramite `concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(by_device)))`.
   - All'interno del singolo worker di device: inviare in sequenza, **interrompendo subito** il ciclo di quel device se `status_code in (404, 410)` (così non si inviano altri promemoria a una sottoscrizione scaduta) e restituendo al thread principale la lista degli esiti `(key, status_code, resp_body)` senza toccare `self._temp_errors` né `data` dai thread secondari.
   - Nel thread principale, acquisire `self.lock`, aggiornare `self._temp_errors`, `expired_devices`, `sent` e `schedule`, e chiamare `write_atomic(self.file, data)` una sola volta.
   - *Test:* verificare che `test_eccezione_su_un_dispositivo_non_ripete_gli_invii_agli_altri`, `test_invia_promemoria_scaduti_senza_duplicati_e_pulisce_410` e `test_errore_temporaneo_scritto_una_volta_sola` continuino a passare e che un dispositivo lento (con sleep simulato nel `fake_sender`) non ritardi gli invii verso gli altri dispositivi.

### 4.2 Frontend: Rimozione Ricalcoli in `calculations.ts`, `tagUsage` e `backup.ts`
1. **`src/domain/calculations.ts`:**
   - Estrarre `periodStartMonth` fuori dal ciclo `for` in `incomeByMonth` (attualmente viene invocato ad ogni iterazione `m`) e raggruppare `inYear(data.incomes, year)` per mese in una singola scansione `Map<number, { total: Cents; hasChosen: boolean }>`.
   - Accettare parametri opzionali precalcolati in helper interni così `yearSummary` e `averageBalanceBefore` calcolino `estimateCategoryIds`, `estimateMonthlyIncome`, `periodStartMonth` e `incomeByMonth` **una sola volta** per anno anziché ricalcolarli per ogni mese precedente in `averageBalanceBefore`.
   - Nessuna firma pubblica esportata deve cambiare; tutti i test esistenti in `calculations.test.ts` restano invariati a garanzia di non regressione.
2. **`src/stores/finance.ts`:**
   - In `tagUsage(kind, id)`: contare con un semplice contatore incrementale iterando sugli array interessati (`oneTimeExpenses`, `incomes`, `quickExpenses`, e `recurringExpenses` per categorie/metodi) senza creare `[...a, ...b, ...c, ...d]`.
   - Se serve (es. per `PKT-16`), esporre un helper `tagUsageCounts(kind: TagKind): Map<Id, number>` calcolato in un'unica passata.
3. **`src/services/backup.ts`:**
   - In `serializeBackup(data, password)`: passare `JSON.stringify(data)` (compatto) a `encryptBackup` quando `password` è presente, mantenendo `JSON.stringify(data, null, 2)` solo per i backup in chiaro leggibili dall'utente.

### 4.3 Ricerca e Liste Lunghe (`SearchModal.vue`, `OneTimeView.vue`, `IncomeView.vue`, `BreakdownDetailView.vue`)
1. **`src/components/SearchModal.vue`:**
   - Introdurre `debouncedQuery` aggiornato dopo `150 ms` con `watch(query, ...)` (azzeramento immediato se `query.trim() === ''`, e aggiornamento immediato su `@keydown.enter` prima di selezionare `results[0]`).
   - Limitare la lista renderizzata inizialmente (`VISIBLE_STEP = 50`) tramite `visibleLimit = ref(50)` (resettato ad ogni nuova ricerca), mostrando un pulsante `t('search.showAll', { n: results.length })` in fondo quando `results.length > visibleLimit`.
2. **Viste lista (`OneTimeView.vue`, `IncomeView.vue`, `BreakdownDetailView.vue`):**
   - Limitare le righe inizialmente renderizzate sopra una soglia (es. `100`) con pulsante «Mostra altri ({remaining})» (chiavi i18n allineate in `src/i18n/it.ts` e `src/i18n/en.ts`), mantenendo invariato il `total` calcolato sull'intero elenco filtrato (non solo sulle righe visibili).
   - Quando `useHighlight` (in `OneTimeView`/`IncomeView`) trova l'ID cercato oltre la soglia iniziale, espandere automaticamente `visibleLimit` fino all'indice dell'elemento prima del `nextTick` + `scrollIntoView`.

### 4.4 Compressione `EncryptedBackup` (Fase 2)
- **File:** `src/services/backupCrypto.ts`, `src/services/backup.ts`, `src/services/sync/engine.ts`, `server/main.py`.
- **Formato:** estendere `EncryptedBackup` con campo opzionale `compression?: 'gzip'` (oppure `version: 2`, verificando che `valid_payload` in `server/main.py` accetti `payload.get('version') in (1, 2)` e conservi la compatibilità con `ENCRYPTED_FORMAT = 'pocketly-encrypted-backup'`).
- **Flusso:** in cifratura (`encryptWithKey` / `encryptBackup`) comprimere il JSON UTF-8 con `CompressionStream('gzip')` (se disponibile) prima di `crypto.subtle.encrypt` e impostare `compression: 'gzip'`; in decifratura (`decryptWithKey`), dopo `crypto.subtle.decrypt`, se `file.compression === 'gzip'` decomprimere con `DecompressionStream('gzip')`, altrimenti decodificare direttamente UTF-8 (retrocompatibilità totale con tutti i backup `version: 1` esistenti).
- **Vincolo operativo:** prima di attivare la compressione sul sync, tutti i dispositivi collegati allo stesso server devono essere aggiornati a una versione dell'app che sappia leggere i payload compressi.

### 4.5 Schema SQLite Multi-Tenant (Fase 3, coordinata con `PKT-12` / `PKT-25`)
- Usare `sqlite3` della libreria standard Python (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`) in `POCKETLY_DATA_DIR/pocketly.db` (nel modello di [autenticazione.md](./autenticazione.md) §5.2 il `tenant_id` corrisponde a `vault_id`, unificando archivi personali e condivisi):
  - `sync_state(tenant_id TEXT PRIMARY KEY, version INTEGER NOT NULL, updated_at TEXT, payload_json TEXT NOT NULL)`
  - `sync_history(tenant_id TEXT NOT NULL, version INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (tenant_id, version))`
  - `push_devices(tenant_id TEXT NOT NULL, device_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (tenant_id, device_id))`
  - `push_schedule(tenant_id TEXT NOT NULL, id TEXT NOT NULL, device_id TEXT NOT NULL, fire_at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (tenant_id, id, device_id))` + indice `idx_push_schedule_fire_at ON push_schedule(fire_at)`
  - `push_sent(tenant_id TEXT NOT NULL, item_key TEXT NOT NULL, sent_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, item_key))`
- **Migrazione zero-downtime:** al primo avvio con schema SQLite, se esistono `current.json` / `history/v*.json` / `push.json`, importarli automaticamente sotto il `tenant_id` predefinito e rinominare i file JSON legacy in `.migrated`.

---

## 5. Attività Operative Derivate nel Backlog

L'esecuzione di questo piano è tracciata in [Backlog di Pocketly](../backlog.md) sotto l'attività:
- **PKT-18** — Implementazione piano di scalabilità (da PKT-13) *(stato: `da fare`, collegata direttamente a questo documento; chi la prenderà in carico potrà dividerla in sotto-attività per Fase 1 / Fase 2)*.
- L'evoluzione multi-tenant (Fase 3) è progettata in [Progetto Autenticazione](./autenticazione.md) (`PKT-12`) e coordinata con l'implementazione in **PKT-25**.
