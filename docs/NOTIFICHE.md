# Sistema di Notifiche e Promemoria per le Spese Ricorrenti

Pocketly include un sistema di notifiche push e promemoria configurabili per le **spese ricorrenti** (mutui, bollette, abbonamenti, stipendi, assicurazioni), ispirato all'esperienza d'uso di **Google Calendar** e progettato secondo i principi di **Privacy-First (Zero-Knowledge)** e **Local-First**.

---

## 1. Panoramica e Principi Guida

1. **Configurazione flessibile stile Google Calendar**:
   - Ogni spesa ricorrente può avere **zero, una o più regole di notifica**.
   - Ogni regola specifica quanti giorni prima ricevere l'avviso e a che ora esatta (es. *3 giorni prima alle 09:00* e *lo stesso giorno alle 08:30*).
   - Preset rapidi disponibili: *Lo stesso giorno*, *1*, *2*, *3*, *5 giorni prima*, *1 settimana prima*, *2 settimane prima*, oppure *Personalizzato* (qualsiasi numero di giorni).
2. **Disattivazione predefinita per le spese esistenti**:
   - Le spese già presenti nel database rimangono con le notifiche **disattivate**, a meno che l'utente non le attivi manualmente o utilizzi l'azione di applicazione massiva nelle Impostazioni.
3. **Regole predefinite per le nuove spese**:
   - Nelle Impostazioni è possibile definire le regole predefinite globali (default: *1 giorno prima alle 09:00*) ereditate da ogni nuova spesa creata.
4. **Crittografia Zero-Knowledge end-to-end**:
   - Il server di sincronizzazione opzionale non legge mai i dettagli delle tue spese. I testi delle notifiche vengono cifrati dal browser tramite **W3C Web Push RFC 8291 (`aes128gcm`)** prima di essere trasmessi al server.

---

## 2. Architettura a Doppio Binario (Ibrida)

Il sistema supporta due modalità operative, selezionate automaticamente dall'app:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MODALITÀ LOCALE                               │
│                         (100% Offline / PWA)                            │
│                                                                         │
│  Spesa Ricorrente  ──►  checkLocalReminders()  ──►  Notification API    │
│  (IndexedDB)            (all'avvio / sblocco)       o Service Worker    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           MODALITÀ PUSH                                 │
│                   (con Server di Sincronizzazione)                      │
│                                                                         │
│  Spesa Ricorrente  ──►  Cifratura RFC 8291  ──►  Server Pocketly        │
│  (IndexedDB)            (crypto.subtle)          (server/main.py)       │
│                                                         │               │
│                                           Orario esatto │ (VAPID ES256) │
│                                                         ▼               │
│  Display Dispositivo  ◄──  push-worker.js  ◄──  Push Gateway Vendor     │
│  (anche ad app chiusa)     (Service Worker)     (Google FCM / Apple)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### A. Modalità Locale (Offline / Standalone)
Attiva quando l'app non è collegata a un server di sincronizzazione.

- **Come funziona**: Il motore di dominio ([`src/domain/notifications.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/domain/notifications.ts)) calcola le scadenze e i promemoria dovuti.
- **Quando si attiva**:
  1. All'avvio dell'applicazione (`init()`).
  2. Al ritorno in primo piano della pagina (`visibilitychange`, es. sblocco del telefono o passaggio da un'altra app).
  3. Periodicamente ogni 60 secondi mentre l'app è aperta a schermo attivo.
- **Deduplicazione**: Lo storico dei promemoria già mostrati è salvato in IndexedDB sotto la chiave `notifications-shown` con una finestra di validità di 30 giorni.
- **Caratteristiche**: Funziona completamente offline, senza server e senza connessione di rete. Tuttavia, per i limiti delle PWA imposti dai browser, se l'app viene terminata dal sistema e non viene aperta per diversi giorni, il browser non può eseguire timer JavaScript in background.

### B. Modalità Push (con Server di Sincronizzazione)
Attiva automaticamente non appena colleghi una chiave di sincronizzazione in *Impostazioni → Sincronizzazione*.

- **Come funziona**: 
  1. Il client calcola lo scadenzario dei promemoria futuri per i successivi 60 giorni.
  2. Per ogni dispositivo registrato, il client **cifra il payload** contenente titolo, testo, tag e URL con la chiave pubblica del dispositivo (`p256dh` e `auth`) usando `aes128gcm` via Web Crypto API.
  3. Lo scadenzario con i blob cifrati e la data/ora di invio (`fireAt`) viene inviato al server tramite `PUT /api/push/schedule`.
  4. Il server Python mantiene un thread dispatcher in background: al minuto esatto, invia la richiesta Web Push al push service di Google FCM, Apple APNs o Mozilla.
  5. Il server firma la richiesta usando **VAPID (RFC 8292)** con una coppia di chiavi asimmetriche su curva ellittica NIST P-256 (ES256), implementata in puro standard library Python senza dipendenze `pip`.
  6. Il sistema operativo riceve il pacchetto, risveglia il Service Worker ([`public/push-worker.js`](file:///mnt/c/progetti_locali/Jo/pocketly/public/push-worker.js)), che decifra nativamente il messaggio e mostra la notifica.
- **Caratteristiche**: La notifica viene recapitata **anche ad app completamente chiusa e a telefono in standby**. Il server non possiede la chiave privata del dispositivo e vede unicamente dati cifrati indecifrabili.

---

## 3. Guida Utente

### Attivare le notifiche
1. Apri Pocketly e vai in **Impostazioni**.
2. Scorri fino alla scheda **Notifiche promemoria**.
3. Clicca su **"Attiva notifiche su questo dispositivo"**.
4. Quando il browser mostra il pop-up di autorizzazione, seleziona **"Consenti"**.
5. Clicca su **"Invia notifica di prova"** per verificare che il sistema operativo mostri correttamente il banner.

### Configurare le regole su una Spesa Ricorrente
1. Vai nella sezione **Spese Ricorrenti**.
2. Tocca una spesa per modificarla (o tocca il pulsante `+` per crearne una nuova).
3. Troverai la sezione **Notifiche promemoria**:
   - Clicca sull'interruttore **"Notifiche promemoria"** per attivarle.
   - Scegli un preset (es. *1 giorno prima*, *Stesso giorno*, ecc.) oppure inserisci i giorni personalizzati.
   - Seleziona l'orario di avviso desiderato (es. `09:00`).
   - Puoi cliccare **"+ Aggiungi un'altra notifica"** per impostare promemoria multipli per la stessa spesa.
4. Salva la spesa: nella lista delle spese ricorrenti apparirà l'icona con il campanellino 🔔 che riassume il prossimo avviso programmato.

### Regole Predefinite e Applicazione Massiva
In **Impostazioni → Notifiche promemoria**:
- **Regole predefinite per nuove spese**: puoi impostare quali regole assegnare automaticamente alle spese create in futuro.
- **Applica a spese senza notifiche**: assegna le regole predefinite a tutte le spese ricorrenti esistenti che attualmente hanno le notifiche disattivate.
- **Sovrascrivi tutte le spese**: ripristina le regole predefinite su tutte le spese ricorrenti indistintamente.

---

## 4. Requisiti e Particolarità per Dispositivi Mobili

I browser moderni consentono le notifiche e i Service Worker **esclusivamente in contesti sicuri** (`https://` oppure `http://localhost`).

### Android
- Funziona direttamente da Google Chrome o installando la PWA sulla Home.
- **In fase di sviluppo locale**: se navighi su IP locale (es. `http://192.168.1.X:5173`), Chrome blocca i permessi notifiche. Per provarlo dal telefono senza certificati HTTPS:
  - Collega il telefono via USB al PC con debug USB attivo.
  - Da Chrome su PC apri `chrome://inspect/#devices` e imposta il Port Forwarding `5173 -> localhost:5173`.
  - Sul telefono apri `http://localhost:5173`. Essendo `localhost`, Chrome abilita le notifiche senza richiedere HTTPS.

### iOS / iPadOS (Apple)
Apple supporta le Web Push su iOS a partire da **iOS 16.4**, con due requisiti tassativi di sistema:
1. **Connessione HTTPS obbligatoria**: non è possibile abilitare le notifiche su connessioni HTTP non protette.
2. **Installazione su Schermata Home obbligatoria**:
   - Apri Pocketly in Safari.
   - Tocca l'icona di condivisione e seleziona **"Aggiungi alla schermata Home"**.
   - **Chiudi Safari e apri Pocketly toccando l'icona appena creata sulla Home**. Solo dall'icona installata iOS rende disponibile l'API `Notification.requestPermission()`.

---

## 5. Mappa dei File e Componenti

### Frontend (`src/`)

| File | Responsabilità |
|---|---|
| [`src/types/models.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/types/models.ts) | Definizione interfaccia `NotificationRule` (`daysBefore: number`, `time: string`) e campo `RecurringExpense.notifications`. |
| [`src/domain/notifications.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/domain/notifications.ts) | Funzioni pure: normalizzazione regole, calcolo occorrenze, verifica promemoria scaduti, generazione testi e badge. |
| [`src/stores/notifications.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/stores/notifications.ts) | Store Pinia: stato permessi, persistenza IndexedDB (con isolamento proxy reattivi), sincronizzazione schedulazione push, invio test con fallback locale. |
| [`src/services/notifications/webpushCrypto.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/services/notifications/webpushCrypto.ts) | Crittografia W3C RFC 8291 (`aes128gcm` tramite HKDF SHA-256 e Web Crypto API `crypto.subtle`). |
| [`src/services/notifications/api.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/services/notifications/api.ts) | Client REST per interagire con gli endpoint push del backend (`/api/push/*`). |
| [`src/components/NotificationRulesEditor.vue`](file:///mnt/c/progetti_locali/Jo/pocketly/src/components/NotificationRulesEditor.vue) | Componente UI a regole multiple con preset stile Google Calendar, orari e rimozione. |
| [`src/components/NotificationSettings.vue`](file:///mnt/c/progetti_locali/Jo/pocketly/src/components/NotificationSettings.vue) | Card impostazioni: switch dispositivo, pulsante test, rilevamento iOS, configurazione default ed esecuzione massiva. |
| [`src/components/RecurringForm.vue`](file:///mnt/c/progetti_locali/Jo/pocketly/src/components/RecurringForm.vue) | Integrazione dell'editor regole all'interno del form spesa ricorrente. |
| [`src/views/RecurringView.vue`](file:///mnt/c/progetti_locali/Jo/pocketly/src/views/RecurringView.vue) | Mostra il campanellino e il riassunto dell'avviso per ogni voce nella lista. |
| [`src/services/migration.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/services/migration.ts) | Preservazione e normalizzazione delle regole nei file di backup `.pocketly` (v2). |
| [`src/domain/merge.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/src/domain/merge.ts) | Risoluzione a 3 vie dei conflitti di sincronizzazione multi-dispositivo per le regole di notifica. |
| [`public/push-worker.js`](file:///mnt/c/progetti_locali/Jo/pocketly/public/push-worker.js) | Worker di ricezione eventi `push` e navigazione all'app su `notificationclick`. |

### Backend (`server/`)

| File | Responsabilità |
|---|---|
| [`server/webpush.py`](file:///mnt/c/progetti_locali/Jo/pocketly/server/webpush.py) | Crittografia VAPID RFC 8292 ES256: generazione chiavi NIST P-256, firma token JWT, invio HTTP/2 a push gateway in puro Python standard library. |
| [`server/main.py`](file:///mnt/c/progetti_locali/Jo/pocketly/server/main.py) | API HTTP del server Pocketly: gestione sottoscrizioni push, memorizzazione atomica dello schedulario cifrato, dispatcher in background. |
| [`server/test_main.py`](file:///mnt/c/progetti_locali/Jo/pocketly/server/test_main.py) | Suite di test unitari automatizzati per il backend push. |

### Configurazione e Deploy

| File | Responsabilità |
|---|---|
| [`vite.config.ts`](file:///mnt/c/progetti_locali/Jo/pocketly/vite.config.ts) | Configurazione Workbox con `importScripts: ['push-worker.js']` e proxy locale verso `8787`. |
| [`deploy/proxmox/nginx/pocketly.conf`](file:///mnt/c/progetti_locali/Jo/pocketly/deploy/proxmox/nginx/pocketly.conf) | Configurazione Nginx con header `Cache-Control: no-cache` per il Service Worker e routing `/api/`. |

---

## 6. Comandi Utili per lo Sviluppo e i Test

### Avvio in sviluppo
```bash
# Terminale 1: Server backend Python (necessario per testare Web Push remota)
python3 server/main.py

# Terminale 2: Frontend Vite
npm run dev
```

### Esecuzione dei test automatici
```bash
# Test frontend (logica di dominio, merge, crittografia, store, edge cases): 170 test
npm test

# Test backend Python (API push, VAPID, rate-limit, dispatcher, corruzione file): 21 test
PYTHONPATH=server python3 -m unittest discover -s server
```

### Configurazione Server (Variabili d'Ambiente)
- `POCKETLY_SYNC_KEY`: chiave segreta per la sincronizzazione (min. 32 caratteri).
- `POCKETLY_VAPID_SUBJECT`: indirizzo di contatto per il subject VAPID (default: `mailto:support@pocketly.local`). Su iOS / Apple APNs deve essere un'email valida o un URL `https://`.
- `POCKETLY_DATA_DIR`: directory di persistenza dei dati (default `/var/lib/pocketly`).
- `POCKETLY_PORT`: porta di ascolto (default `8787`).

### Verifica compilazione e build PWA
```bash
npm run build
```
Genera i bundle ottimizzati in `dist/`, comprensivi di `sw.js` e del manifesto PWA aggiornato.
