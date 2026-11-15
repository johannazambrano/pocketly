# Pocketly — Istruzioni per Agenti IA

Questo documento è la **fonte unica di verità** per qualsiasi agente IA (Claude, Gemini, Codex, Cursor o altri) che interagisce con il repository Pocketly. Leggi questo documento prima di apportare modifiche al codice.

---

## 1. Cos'è Pocketly e Stack Tecnologico

Pocketly è una **Progressive Web App (PWA)** per la gestione delle finanze personali, progettata con principi **privacy-first** e **offline-first**. Tutti i dati dell'utente risiedono localmente sul dispositivo (IndexedDB) e possono opzionalmente essere sincronizzati in modo cifrato end-to-end con un server personale leggero.

### Stack Frontend
- **Framework:** Vue 3 (Composition API con `<script setup lang="ts">`)
- **Linguaggio:** TypeScript (strict mode, `vue-tsc`)
- **Bundler & Tooling:** Vite, `@vite-pwa/assets-generator`, `vite-plugin-pwa`
- **State Management:** Pinia
- **Routing:** Vue Router (9 viste: 8 viste principali + 1 vista di dettaglio)
- **Persistenza locale:** IndexedDB tramite libreria `idb-keyval`
- **Stile:** Tailwind CSS v4 con gettoni di colore semantici (`src/style.css`), aspetto per piattaforma (iOS / Android / PC) e tema chiaro/scuro, caratteri `@fontsource` inclusi (Inter, Roboto), FontAwesome Free icons
- **i18n:** `vue-i18n` (supporto completo Italiano `it` e Inglese `en`)
- **Test:** Vitest

### Stack Backend & Deploy
- **Server:** Python 3 standard library (`server/main.py`, `server/webpush.py`) — zero dipendenze esterne (`pip`).
- **Funzionalità backend:** Zero-Knowledge sync cifrata con ETag/versione atomica, gateway Web Push RFC 8291 (`aes128gcm`) e RFC 8292 (VAPID).
- **Deploy:** Container Proxmox LXC, Nginx reverse proxy con TLS, systemd unit.

### Comandi Operativi
```bash
# Sviluppo frontend
npm run dev

# Controllo tipi TypeScript
npm run typecheck       # equivale a: vue-tsc -b

# Build di produzione
npm run build           # vue-tsc -b && vite build

# Test unitari frontend
npm run test            # vitest run

# Test server Python
npm run test:server     # node scripts/python.mjs -m unittest server.test_main (Windows, macOS e Linux)

# Validazione integrità documentazione e i18n
npm run docs:check      # node scripts/docs-check.mjs
```

---

## 2. Regola Aurea di Orientamento

> **NON IPOTIZZARE LA STRUTTURA DEL CODICE.**
> Prima di scrivere o modificare codice, consulta obbligatoriamente:
> 1. [Mappa del Codice](docs/riferimento/mappa-codice.md): per individuare file, responsabilità, dipendenze e test associati.
> 2. La pagina di documentazione collegata al modulo in esame in `docs/`.
> 3. L'indice generale della documentazione in [docs/README.md](docs/README.md).

---

## 3. Invarianti Architetturali Verificati

Ogni agente DEVE rispettare i seguenti invarianti architetturali, verificati sul codice sorgente dell'applicazione:

1. **Importi memorizzati sempre in centesimi interi:**
   Nel modello dati (`FinanceData`), tutte le cifre monetarie sono interi in centesimi (`Cents = number`). Non memorizzare mai importi decimali o floating point.  
   *Eccezione verificata:* il calcolo derivato del costo mensile equivalente (`monthlyEquivalent` in `src/domain/recurrence.ts`) è una suddivisione matematica (`amount / FREQUENCY_MONTHS[...]`) e può restituire valori frazionari.

2. **Formato date unificato `YYYY-MM-DD`:**
   Le date di calendario sono di tipo `IsoDate = string` nel formato `YYYY-MM-DD` (tempo locale, senza fuso orario né orari). Le utility di parsing e formattazione si trovano in `src/utils/dates.ts`. L'orario locale compare esclusivamente nelle regole di notifica (`NotificationRule.time`, stringa `HH:MM`).

3. **Entità referenziate per `Id`, mai per nome:**
   Categorie, metodi di pagamento e tag sono entità `Tag { id: Id, name: string, color: string }`. Le transazioni memorizzano riferimenti `categoryId: Id` e `paymentMethodId: Id`. La ridenominazione di una categoria o metodo non richiede la modifica delle transazioni.

4. **Logica di business e calcoli confinati in `src/domain/`:**
   Le formule contabili e i calcoli riutilizzabili risiedono in moduli puri e testati in `src/domain/` (`calculations.ts`, `recurrence.ts`, `budget.ts`, `merge.ts`, `notifications.ts`, `backupReminder.ts`), ad esempio `compareToAverage`, `averageBalanceBefore`, `splitRecurring`. Lo store Pinia (`src/stores/finance.ts`) espone proprietà computate delegando a tali funzioni. Le viste possono comporre cifre di presentazione a partire dai dati dello store (es. `DashboardView.vue` costruisce le cifre del pannello del saldo), ma una formula nuova o riusata in più punti va messa in `src/domain/` con i suoi test.

5. **Persistenza dati separata:**
   - I dati finanziari dell'utente (`FinanceData`) passano sempre e solo dall'interfaccia `DataStore` in `src/services/storage.ts` (salvati in IndexedDB nella chiave `'finance-data'`, costante `DATA_KEY`).
   - Le configurazioni di dispositivo / preferenze locali usano direttamente `idb-keyval` nei rispettivi store: `'sync-config'` (`stores/sync.ts`), `'notification-config'` e `'notifications-shown'` (`stores/notifications.ts`), `'backup-meta'` (`stores/backup.ts`). Lingua e aspetto stanno in `localStorage` (`'locale'`, `'appearance-platform'`, `'appearance-theme'`), perché servono prima del primo disegno. Non vengono sincronizzate.

6. **Sincronizzazione cifrata Zero-Knowledge e Merge a 3 Vie:**
   - Il server `server/main.py` non possiede la chiave di cifratura e memorizza esclusivamente payload cifrati `EncryptedBackup` con numero di versione crescente.
   - La sincronizzazione sfrutta l'algoritmo di merge a tre vie (`src/domain/merge.ts`) confrontando la versione base (l'ultima sincronizzata dal dispositivo), lo stato locale e lo stato remoto. Per questo motivo **non sono necessari tombstone** per tracciare le cancellazioni.

7. **Allineamento i18n obbligatorio:**
   Pocketly supporta sia l'italiano (`src/i18n/it.ts`) che l'inglese (`src/i18n/en.ts`). Ogni nuova etichetta, messaggio di errore o testo UI aggiunto in `it.ts` DEVE avere la corrispettiva chiave in `en.ts`. Lo script `npm run docs:check` verifica questo allineamento.

8. **Solo gettoni di colore, sei combinazioni da verificare:**
   Nei componenti non si scrivono colori fissi di Tailwind (`text-slate-700`) né esadecimali: si usano i gettoni semantici (`text-ink-2`, `bg-surface`, `text-accent`…) definiti in `src/style.css` e valorizzati per `data-platform` (`ios` / `android` / `desktop`) e `data-theme` (`light` / `dark`). Un gettone nuovo va valorizzato in ogni blocco (le regole Android vengono dopo lo scuro: Android scuro va ridetto). Il testo grigio non scende sotto `ink-4`; le cifre verdi usano `accent` (`accent-icon` solo per le icone). I colori di categorie, metodi e tag passano da `src/utils/colors.ts` (`pickUniqueColor`, `badgeColors`). Dettagli in [docs/architettura/frontend.md](docs/architettura/frontend.md).

---

## 4. Regole di Manutenzione per gli Agenti IA

Quando esegui una modifica nel repository, attieniti scrupolosamente a questo ciclo di vita:

1. **Aggiornamento documentazione contestuale (obbligatorio):**
   Ogni modifica al codice aggiorna, nello stesso commit, le pagine di documentazione collegate ai file toccati (vedi la mappa del codice). `npm run docs:check` deve passare prima del commit.
2. **Aggiornamento della Mappa del Codice:**
   Se aggiungi, sposti o elimini un file in `src/`, `server/` o `scripts/`, aggiorna tempestivamente [docs/riferimento/mappa-codice.md](docs/riferimento/mappa-codice.md).
3. **Cita simboli, non numeri di riga:**
   Nelle documentazioni e nei commenti, fai riferimento a nomi di funzioni, interfacce, costanti o classi (es. `monthlyEquivalent`, `FinanceData`). Non citare numeri di riga statici che decadono ad ogni modifica.
4. **Front-matter nei file di documentazione:**
   Ogni file in `docs/` contiene un'intestazione YAML front-matter che elenca i file sorgente correlati (`source-files`) e la data dell'ultima verifica (`verified`). Aggiorna questo metadato quando tocchi il modulo corrispondente.
5. **Verifica empirica prima di documentare:**
   Non dare mai per scontato che un bug sia stato risolto o che un componente funzioni in un certo modo. Esegui i test o controlla il codice direttamente.
6. **Checklist finale di completamento:**
   Prima di considerare terminato un task:
   - `npm run test` (test Vitest verdi)
   - `npm run typecheck` (zero errori TypeScript)
   - `npm run test:server` (test Python server verdi)
   - `npm run build` (build di produzione riuscita)
   - `npm run docs:check` (obbligatorio: nessun link rotto, mappa codice aggiornata, i18n allineato)
