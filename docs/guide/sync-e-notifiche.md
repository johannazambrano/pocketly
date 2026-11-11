---
source-files:
  - server/main.py
  - server/webpush.py
  - src/stores/sync.ts
  - src/stores/notifications.ts
  - src/services/notifications/api.ts
  - src/services/sync/api.ts
verified: 2026-11-11
---

# Guida: Configurazione e Collaudo di Sync e Notifiche

Questa guida fornisce istruzioni operative per configurare, testare ed effettuare il debug del motore di sincronizzazione cifrata e delle notifiche Web Push.

---

## 1. Avvio dell'Ambiente di Test Completo

Per collaudare sync e push in locale, sono necessari due processi concorrenti:

### Terminale 1: Server Python Backend
Il server non accetta argomenti da riga di comando: si configura solo con variabili d'ambiente.
```bash
# Chiave di accesso: obbligatoria, almeno 32 caratteri (se manca il server esce con codice 2)
export POCKETLY_SYNC_KEY="MIA_CHIAVE_LUNGA_ALMENO_32_CARATTERI_12345"
# Cartella dati locale (il default è /var/lib/pocketly)
export POCKETLY_DATA_DIR=./test-data
# Porta: il default 8787 è già quella del proxy Vite (POCKETLY_PORT per cambiarla)
python3 -m server.main      # su Windows: py -3 -m server.main
```
Su Windows (PowerShell) le variabili si impostano con `$env:NOME = "valore"`. Il server non genera né stampa chiavi: la chiave è quella che hai impostato. All'avvio, se manca, crea il file `push.json` con la coppia di chiavi crittografiche VAPID (P-256).

### Terminale 2: Frontend Vite Dev Server
```bash
npm run dev
```
Vite instraderà automaticamente le richieste `/api/*` verso `http://127.0.0.1:8787` grazie alla configurazione di proxy in `vite.config.ts`.

---

## 2. Configurazione e Test della Sincronizzazione

1. Apri il browser all'indirizzo `http://localhost:5173`.
2. Vai su **Impostazioni** (`/impostazioni`) nella sezione **Sincronizzazione**.
3. Incolla la chiave di accesso del server (il valore di `POCKETLY_SYNC_KEY`) e scegli la password dei dati (almeno 8 caratteri, la stessa su tutti i dispositivi).
4. Clicca su **Collega questo dispositivo**:
   - Se il server è vuoto, il client caricherà i propri dati locali cifrati con la chiave derivata dalla password via PBKDF2/AES-GCM.
   - Se il server contiene già dei dati e il client locale è vuoto, il client scaricherà e decifrerà i dati remoti.
   - Se entrambi hanno dati preesistenti, l'interfaccia chiederà all'utente se intende conservare i dati locali o quelli del server per iniziare la base comune.
5. Per verificare la sincronizzazione:
   - Apri una finestra anonima del browser su `http://localhost:5173`.
   - Collegala con la stessa chiave del server e la stessa password.
   - Aggiungi una spesa nella prima finestra: la modifica apparirà automaticamente nella seconda finestra dopo la sincronizzazione.

---

## 3. Configurazione e Collaudo Notifiche Web Push

Pocketly supporta due modalità di notifica:
1. **Notifiche locali in-app:** scattano quando l'app è aperta o in primo piano all'orario prefissato.
2. **Web Push remote:** scattano anche a browser chiuso / smartphone in standby, grazie al worker server che invia la notifica al gateway push (Google FCM, Apple Push, Mozilla Autopush).

### Procedura di Attivazione e Test:
1. In **Impostazioni → Notifiche**:
   - Clicca su **Abilita notifiche**: accetta la richiesta permessi del browser.
   - Se la sync è collegata, l'app contatta `GET /api/push/config` per recuperare la chiave pubblica VAPID del server.
   - Registra la sottoscrizione Web Push del browser chiamando `PUT /api/push/subscription`.
2. Clicca sul pulsante **Invia notifica di prova**:
   - Il client invia una notifica test a `/api/push/test`.
   - Il server invia il push al gateway del browser.
   - Se il browser supporta le notifiche in background, apparirà la notifica di sistema "Pocketly – Notifica di prova".

---

## 4. Risoluzione Problemi Comuni (Troubleshooting)

| Sintomo | Causa Probabile | Soluzione |
|---|---|---|
| `SyncAuthError (401)` | La chiave inserita non corrisponde a quella del server | Verifica il valore di `POCKETLY_SYNC_KEY` con cui è partito il server (in produzione è in `/etc/pocketly/sync.env`) |
| `SyncBlockedError (429)` | 10 tentativi falliti con chiave errata negli ultimi 15 minuti | Attendi che i tentativi falliti escano dalla finestra di 15 minuti (`FAILURE_WINDOW_SECONDS`) |
| Errore registrazione Web Push | Il browser richiede HTTPS per il PushManager | Su localhost HTTP è consentito; se accedi da IP locale Wi-Fi (es. `192.168.1.X`), è obbligatorio usare HTTPS con certificato valido (usa `deploy/proxmox/make-cert.sh`) |
| Gateway Push risponde `410 Gone` | La sottoscrizione del browser è scaduta o revocata | Disabilita e riabilita le notifiche dalle impostazioni dell'app per generare un nuovo token |
| Nessun addebito programmato | Data di scadenza oltre i 60 giorni | L'orizzonte di pianificazione push è di 60 giorni (`calculateUpcomingReminders`); le scadenze successive vengono pianificate man mano che si avvicinano |
| Push Apple non arrivano (403 BadJwtToken) | Mittente VAPID mancante o con host non pubblico | Imposta `POCKETLY_VAPID_SUBJECT=mailto:tuo.indirizzo@esempio.it` (deve avere dominio pubblico valido) in `/etc/pocketly/sync.env` e riavvia il server |
| Notifiche 503 / push disattivate | File `push.json` corrotto sul server | La sincronizzazione dati continua a funzionare; per ripristinare le notifiche verifica o rigenera `push.json` sul server |
| Stato sync 'outdated' | Dati sul server salvati da una versione più nuova dell'app | Aggiorna l'app client: versioni precedenti rifiutano dati più recenti per prevenire cancellazioni accidentali di campi |
