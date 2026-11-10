> [!WARNING]
> **DOCUMENTO STORICO ARCHIVIATO**
> Questo documento rappresenta il piano di analisi iniziale per il ramo `feature/sync-and-xlsx-import`.
> Molte delle problematiche ivi segnalate (come l'algoritmo di merge a 3 vie, il proxy `/api` in Vite, ecc.) sono state completamente risolte nell'implementazione attuale.
> Per la documentazione aggiornata sull'architettura e lo stato dei difetti aperti, consulta:
> - [Dati e Sincronizzazione](../architettura/dati-e-sincronizzazione.md)
> - [Stato e Difetti Noti](../known-issues.md)

# Analisi di Coerenza Architetturale e Piano di Bonifica: `feature/sync-and-xlsx-import`

> **Progetto:** [Pocketly](projects/pocketly)  
> **Branch di Riferimento:** `feature/sync-and-xlsx-import` (8 commit, 23 file modificati, +2790 / -101 righe)  
> **Stato Attuale:** Non pronto per il merge / rilascio in produzione  

---

## 1. Obiettivo dell'Analisi (Goal Description)

Valutare la coerenza architetturale, funzionale e sistemistica delle nuove funzionalità introdotte nel branch `feature/sync-and-xlsx-import` rispetto al resto del codebase di Pocketly, agli standard di sviluppo dell'operatività Proxmox ([`apps/AGENTS.md`](AGENTS.md)) e allo stato di fatto del container LXC 108.

L'indagine ha riscontrato un'ottima integrazione su alcuni componenti isolati (come il flusso di aggiornamento PWA in [`UpdatePrompt.vue`](../../src/components/UpdatePrompt.vue), i calcoli mensili in [`calculations.ts`](../../src/domain/calculations.ts) e l'allineamento 1:1 dei dizionari i18n), ma ha evidenziato **incoerenze bloccanti** nel motore di sincronizzazione reattiva, nel calcolo degli hash, nella gestione della concorrenza, nella deduplicazione dei dati e nella configurazione degli ambienti di sviluppo e produzione.

---

## 2. Quadro Sinottico di Coerenza

| Area Funzionale | Grado di Coerenza | Rischio Operativo | Diagnosi Sintetica |
| :--- | :---: | :---: | :--- |
| **Sync Engine (Client/Server)** | ❌ **Incoerente / Bloccante** | **Alto** | Loop reattivo infinito (scritture continue ogni 60s su disco LXC 108, versione 1411), incompatibilità algoritmica checksum (SHA-256 vs Cyrb53) e trappola di encoding `ensure_ascii=True` in Python. |
| **Integrità Dati & Deduplicazione** | ❌ **Distruttivo** | **Critico** | La deduplicazione per firma `(data, nome, importo)` cancella silenziosamente transazioni legittime identiche (es. due corse in metro o due caffè nello stesso giorno) sia all'avvio dell'app che all'importazione. |
| **Gestione Conflitti & Deletion** | ❌ **Architettura Incompleta** | **Medio-Alto** | La fusione opera come mera unione di insiemi ($A \cup B$); assenza di tombstones o timestamp di cancellazione/modifica, causando la "resurrezione infinita" (zombie items) degli elementi eliminati. |
| **UI & Filtro Mensile** | ⚠️ **Parzialmente Coerente** | **Basso (UX Drift)** | [`MonthSelector.vue`](../../src/components/MonthSelector.vue) integrato su Dashboard e [`OneTimeView.vue`](../../src/views/OneTimeView.vue), ma del tutto assente da [`IncomeView.vue`](../../src/views/IncomeView.vue) e scollegato dal selettore locale di [`BudgetView.vue`](../../src/views/BudgetView.vue). |
| **Infrastruttura & Nginx (LXC 108)** | ⚠️ **Disallineato** | **Medio** | Reverse proxy `/api/` iniettato via bash `sed` in [`publish.sh`](../../deploy/proxmox/publish.sh) ma omesso da [`pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf). Manca il proxy in [`vite.config.ts`](../../vite.config.ts) e l'aggiornamento di [`apps/config/apps.json`](config/apps.json). |
| **Testing & Sviluppo Locale** | ⚠️ **Disallineato** | **Medio** | I test Python ([`server/test_server.py`](../../server/test_server.py)) falliscono per un errore di import del modulo `server`, non sono richiamati in `package.json`, e non ci sono test per i Pinia store. |
| **PWA & Caching Lifecycle** | ✅ **Coerente** | **Nessuno** | [`UpdatePrompt.vue`](../../src/components/UpdatePrompt.vue), service worker e header `no-store` perfettamente aderenti al Golden Path. |
| **Localizzazione (i18n)** | ✅ **Coerente** | **Nessuno** | Tipizzazione TypeScript rigorosa e parità 1:1 di tutte le nuove chiavi tra [`it.ts`](../../src/i18n/it.ts) ed [`en.ts`](../../src/i18n/en.ts). |

---

## 3. Dettaglio delle Incoerenze Rilevate

### 3.1. Il Ciclo Reattivo Infinito (Empiricamente riscontrato su LXC 108)
- **Meccanismo:** Quando il client riceve dati dal server (`sync.sync()`), invoca la callback `setLocalData(merged)` ([`src/stores/sync.ts#L120`](../../src/stores/sync.ts#L120)). L'assegnazione a `data.value` risveglia il watcher reattivo profondo in [`src/stores/finance.ts#L87`](../../src/stores/finance.ts#L87). Il watcher esegue `scheduleSave()` e `flush()`, il quale invoca `syncStore.schedulePush()`. Dopo 1000ms il client invia una `POST /api/sync` al server, generando un nuovo snapshot su disco, una rotazione di backup e un incremento di versione.
- **Riscontro reale sul container 108:**
  - Versione dei metadati: `1411`
  - In `journalctl -u pocketly-api.service`: ogni 60 secondi esatti avviene la sequenza:
    `GET /api/health` $\to$ `GET /api/sync` $\to$ `POST /api/sync` (dopo 2s) $\to$ scrittura file $\to$ nuovo backup.

### 3.2. Mismatch Algoritmico del Checksum e Trappola di Encoding
- **Mismatch di Algoritmo:** Il server calcola `sha256(raw).hexdigest()[:16]` ([`server/main.py#L39`](../../server/main.py#L39)), mentre il client usa `cyrb53` a 53-bit convertito in base 36 ([`src/utils/hash.ts#L22`](../../src/utils/hash.ts#L22)). La verifica `serverMeta.checksum === localHash` ([`src/stores/sync.ts#L107`](../../src/stores/sync.ts#L107)) fallisce sempre, costringendo a un fetch completo a ogni polling.
- **Trappola UTF-8 / JSON in Python:** In `server/main.py#L38`, `json.dumps(..., sort_keys=True)` senza `ensure_ascii=False` converte i caratteri accentati italiani (es. `"Caffè"`, `"Attività"`) in sequenze di escape `\u00e8`, mentre in JavaScript `JSON.stringify` produce byte UTF-8 diretti. Anche a parità di algoritmo, gli hash non combacerebbero.

### 3.3. Perdita Dati con la Deduplicazione per Firma
- In [`src/domain/merge.ts#L20-L148`](../../src/domain/merge.ts#L20-L148) e in [`server/main.py#L42-L150`](../../server/main.py#L42-L150), la deduplicazione accorpa e scarta le transazioni con la stessa firma `(data, nome, importo)`.
- **Impatto distruttivo:** Non solo annulla i suffissi stabili `:1`, `:2` generati dallo script di import Excel ([`scripts/xlsx_to_pocketly.py#L180-L182`](../../scripts/xlsx_to_pocketly.py#L180-L182)), ma distrugge transazioni lecite create dall'utente nella PWA (es. due caffè da 1,20 € o due ticket da 2,00 € registrati nello stesso giorno) al primo ricaricamento dell'app ([`finance.ts#L85`](../../src/stores/finance.ts#L85)).

### 3.4. Resurrezione degli Elementi Cancellati (Zombie Items)
- `mergeFinanceData` esegue una pura unione insiemistica delle chiavi per ID. Poiché gli oggetti non tracciano un timestamp di modifica o un flag di eliminazione (tombstone), la cancellazione di una spesa sul Dispositivo A viene annullata al sync successivo se il Dispositivo B o il server possiedono ancora quella voce.
- Inoltre, i limiti di budget azzerati ([`merge.ts#L278-L281`](../../src/domain/merge.ts#L278-L281)) e le categorie forecast disattivate ([`merge.ts#L283-L288`](../../src/domain/merge.ts#L283-L288)) non possono essere rimossi perché l'unione reintroduce costantemente le chiavi rimosse.

### 3.5. Disallineamento UI Store: `finance.merge` vs `setLocalData`
- In [`SettingsView.vue#L192, L208`](../../src/views/SettingsView.vue#L192) e in [`AppHeader.vue#L22`](../../src/components/AppHeader.vue#L22), viene passato `finance.merge` a `sync.sync()`.
- `finance.merge` esegue nuovamente `mergeFinanceData`, forza `selectedYear.value = new Date().getFullYear()` (resettando l'anno visualizzato dall'utente) e innesca un push HTTP non coordinato.

### 3.6. Disallineamento Dev Experience e Nginx
- [`vite.config.ts`](../../vite.config.ts) non ha la configurazione `server.proxy` per `/api/`: lo sviluppo locale con `npm run dev` riceve 404 per qualsiasi chiamata al backend locale.
- [`deploy/proxmox/nginx/pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf) non contiene il blocco `/api/`, introdotto in modo volatile via `sed` dentro [`publish.sh`](../../deploy/proxmox/publish.sh).
- [`apps/config/apps.json`](config/apps.json) non monitora `pocketly-api.service`.

---

## 4. Decisioni Critiche per l'Utente (User Review Required)

> [!IMPORTANT]
> **1. Strategia di Deduplicazione Transazioni:**
> Si propone di rimuovere la deduplicazione basata sulla tripla `(data, nome, importo)` e verificare **esclusivamente l'unicità per `id` (UUID)**. L'utente deve poter inserire due spese identiche nello stesso giorno senza vederne una cancellata silenziosamente. Sei d'accordo con questa impostazione?

> [!WARNING]
> **2. Modello di Risoluzione Conflitti e Cancellazioni:**
> L'attuale logica di unione $Target \cup Incoming$ resuscita le spese cancellate. Ci sono due alternative:
> - **Opzione A (Consigliata per architettura PWA a utente singolo):** *Last-Write-Wins (LWW) documentale*. Si gestisce la versione a livello di intero file: chi ha la versione/timestamp più recente sovrascrive, con backup storico garantito sul server.
> - **Opzione B (Multi-device asincrono avanzato):** *Tombstones*. Si estende il modello dati con un array `deletedIds: string[]` sincronizzato per impedire la resurrezione.

> [!CAUTION]
> **3. Chiave di Sincronizzazione (Autenticazione LAN vs Aperta):**
> Nel codice attuale la "Chiave di sincronizzazione" salvata nei settings della PWA non viene mai inviata al server (che opera in modalità aperta). Proponiamo di collegare formalmente l'header `X-Sync-Key` inviato dal client con la verifica di `auth.json` del server, impostando una chiave di default o un wizard di inizializzazione alla prima configurazione.

---

## 5. Domande Aperte (Open Questions)

1. **Filtro Mese in `IncomeView.vue`:** Desideri che il componente [`MonthSelector.vue`](../../src/components/MonthSelector.vue) venga aggiunto anche alla vista Entrate (come fatto per Spese Una Tantum), oppure preferisci mantenere l'elenco entrate non filtrato per mese?
2. **Selettore Mese in `BudgetView.vue`:** Vuoi che il mese selezionato nella navbar (`appStore.selectedMonth`) sia sincronizzato globalmente anche con la vista Budget, eliminando l'indice locale isolato?

---

## 6. Piano degli Interventi Proposti (Proposed Changes)

### Componente 1: Frontend Pinia Stores & Reattività

#### [MODIFY] [`src/stores/finance.ts`](../../src/stores/finance.ts)
- Introdurre un flag interno `let isApplyingRemote = false`.
- Nel deep watcher di `data`, inibire `scheduleSave` e `syncStore.schedulePush` se `isApplyingRemote` è attivo.
- Aggiungere un metodo dedicato `applyRemoteData(newData: FinanceData)` che imposta `isApplyingRemote = true`, aggiorna `data.value`, salva su IndexedDB/localStorage e ripristina il flag via `nextTick()`.
- Rimuovere la deduplicazione per firma da `init()` ([riga 85](../../src/stores/finance.ts#L85)).

#### [MODIFY] [`src/stores/sync.ts`](../../src/stores/sync.ts)
- Utilizzare `crypto.subtle.digest('SHA-256', ...)` per generare l'hash esadecimale a 16 caratteri corrispondente al server.
- Utilizzare `finance.applyRemoteData` anziché mutare direttamente lo store o invocare `finance.merge`.

#### [MODIFY] [`src/utils/hash.ts`](../../src/utils/hash.ts)
- Implementare funzione `sha256Hex(text: string): Promise<string>` per garantire il medesimo checksum tra client TypeScript e server Python.

---

### Componente 2: Domain Logic & Deduplicazione

#### [MODIFY] [`src/domain/merge.ts`](../../src/domain/merge.ts)
- Rimuovere la logica che scarta elementi con la stessa tripla `(date, name, amount)`.
- Mantenere la deduplicazione strettamente legata all'ID univoco.
- Correggere la gestione dei limiti di budget e delle categorie di forecast per consentire la cancellazione e il reset di valori booleani.

---

### Componente 3: Viste & UI

#### [MODIFY] [`src/views/SettingsView.vue`](../../src/views/SettingsView.vue)
- Sostituire il passaggio errato di `finance.merge` a `sync.sync()` con `finance.applyRemoteData`.
- Mostrare un avviso se il conteggio delle transazioni importate da Excel differisce da quelle effettivamente inserite.

#### [MODIFY] [`src/components/AppHeader.vue`](../../src/components/AppHeader.vue)
- Sostituire `finance.merge` con `finance.applyRemoteData` al click sul pulsante di sincronizzazione rapida.

#### [MODIFY] [`src/views/IncomeView.vue`](../../src/views/IncomeView.vue) *(opzionale su conferma utente)*
- Integrare [`MonthSelector.vue`](../../src/components/MonthSelector.vue) e filtrare l'elenco entrate sul mese selezionato.

---

### Componente 4: Backend Python & Concorrenza

#### [MODIFY] [`server/main.py`](../../server/main.py)
- Aggiungere `ensure_ascii=False` nel calcolo dell'hash SHA-256 a riga 38:
  ```python
  raw = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
  ```
- Introdurre un lock di concorrenza (`threading.Lock()`) per le scritture di `PocketlyStore`.
- Generare file temporanei univoci con `tempfile.NamedTemporaryFile` prima della sostituzione atomica con `os.replace`.
- Rimuovere la deduplicazione distruttiva per firma anche nel backend.

#### [MODIFY] [`server/test_server.py`](../../server/test_server.py)
- Risolvere il problema di `sys.path` per consentire l'esecuzione indipendente dei test con `python3 -m unittest`.

---

### Componente 5: Configurazione, Infrastruttura & Nginx

#### [MODIFY] [`vite.config.ts`](../../vite.config.ts)
- Aggiungere il proxy `/api` verso `http://127.0.0.1:3001` per abilitare il debug e lo sviluppo locale.

#### [MODIFY] [`deploy/proxmox/nginx/pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf)
- Inserire in modo dichiarativo e versionato il blocco `location /api/ { proxy_pass http://127.0.0.1:3001; ... }`.

#### [MODIFY] [`deploy/proxmox/publish.sh`](../../deploy/proxmox/publish.sh)
- Rimuovere i comandi `sed` che alterano al volo Nginx.
- Aggiungere verifica preliminare della presenza della libreria `python3-openpyxl` sul sistema target.

#### [MODIFY] [`apps/config/apps.json`](config/apps.json)
- Aggiornare la scheda di `pocketly` per includere `pocketly-api.service` e monitorare `/api/health`.

#### [MODIFY] [`package.json`](../../package.json)
- Aggiungere lo script `"test:server": "python3 -m unittest discover -s server -p '*test*.py'"`.

---

## 7. Piano di Verifica (Verification Plan)

### Test Automatizzati
1. **Frontend Unit & Store Tests:**
   - Creare un nuovo file di test `src/stores/sync.test.ts` con Vitest simulando:
     - Checksum identico con stringhe UTF-8 (caratteri accentati).
     - Ricezione di dati remoti $\to$ verifica che `isApplyingRemote` inibisca il loop di push.
     - Gestione di due transazioni con stessa firma (data, nome, importo) $\to$ verifica che non vengano rimosse.
   - Eseguire: `npm test` ed `npm run typecheck`.
2. **Backend Unit Tests:**
   - Eseguire: `npm run test:server` verificando l'assenza di errori e la corretta creazione atomica dei file e dei backup.

### Verifica Manuale su LXC 108
1. Deploy in staging/test tramite: `./scripts/app.sh deploy pocketly`.
2. Monitorare con `journalctl -u pocketly-api.service -f`:
   - Verificare che all'accesso e durante il polling di 60s **non** vengano eseguite chiamate `POST /api/sync` automatiche in assenza di modifiche utente.
   - Verificare che il contatore `version` rimanga stabile e non cresca all'infinito.
3. Test dell'import Excel via UI e verifica che le transazioni con nomi o importi simili non vengano eliminate.
