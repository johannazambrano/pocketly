---
source-files:
  - server/main.py
  - server/webpush.py
  - src/stores/sync.ts
  - src/stores/notifications.ts
  - src/services/notifications/api.ts
  - src/services/sync/api.ts
verified: 2026-11-10
---

# Guida: Configurazione e Collaudo di Sync e Notifiche

Questa guida fornisce istruzioni operative per configurare, testare ed effettuare il debug del motore di sincronizzazione cifrata e delle notifiche Web Push.

---

## 1. Avvio dell'Ambiente di Test Completo

Per collaudare sync e push in locale, sono necessari due processi concorrenti:

### Terminale 1: Server Python Backend
```bash
# Avvio del server sulla porta predefinita 8787 con directory dati locale
python3 -m server.main --port 8787 --data-dir ./test-data
```
Al primo avvio, il server genererà automaticamente:
- Una chiave di accesso casuale stampata nel terminale se non specificata (puoi specificarne una fissa con `--key MIA_CHIAVE_LUNGA_ALMENO_32_CARATTERI_12345`).
- Il file `push.json` con la coppia di chiavi crittografiche VAPID (P-256) per le notifiche.

### Terminale 2: Frontend Vite Dev Server
```bash
npm run dev
```
Vite instraderà automaticamente le richieste `/api/*` verso `http://127.0.0.1:8787` grazie alla configurazione di proxy in `vite.config.ts`.

---

## 2. Configurazione e Test della Sincronizzazione

1. Apri il browser all'indirizzo `http://localhost:5173`.
2. Vai su **Impostazioni** (`/impostazioni`) nella sezione **Sincronizzazione**.
3. Incolla la chiave di accesso del server (la stessa configurata nel backend).
4. Clicca su **Collega dispositivo**:
   - Se il server è vuoto, il client caricherà i propri dati locali cifrati con la chiave derivata via PBKDF2/AES-GCM.
   - Se il server contiene già dei dati e il client locale è vuoto, il client scaricherà e decifrerà i dati remoti.
   - Se entrambi hanno dati preesistenti, l'interfaccia chiederà all'utente se intende conservare i dati locali o quelli del server per iniziare la base comune.
5. Per verificare la sincronizzazione:
   - Apri una finestra anonima del browser su `http://localhost:5173`.
   - Collega la stessa chiave di sincronizzazione.
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
   - Se il browser supporta le notifiche in background, apparirà la notifica di sistema "Test notifica riuscito".

---

## 4. Risoluzione Problemi Comuni (Troubleshooting)

| Sintomo | Causa Probabile | Soluzione |
|---|---|---|
| `SyncAuthError (401)` | La chiave inserita non corrisponde a quella del server | Verifica la chiave generata all'avvio di `server/main.py` o reimposta una chiave con `--key` |
| `SyncBlockedError (429)` | Più di 10 tentativi falliti con chiave errata | Attendi 15 minuti affinché il rate limiter resetti il blocco per il tuo indirizzo IP |
| Errore registrazione Web Push | Il browser richiede HTTPS per il PushManager | Su localhost HTTP è consentito; se accedi da IP locale Wi-Fi (es. `192.168.1.X`), è obbligatorio usare HTTPS con certificato valido (usa `deploy/proxmox/make-cert.sh`) |
| Gateway Push risponde `410 Gone` | La sottoscrizione del browser è scaduta o revocata | Disabilita e riabilita le notifiche dalle impostazioni dell'app per generare un nuovo token |
| Nessun addebito programmato | Data di scadenza oltre i 60 giorni | L'orizzonte di pianificazione push è di 60 giorni (`calculateUpcomingReminders`); le scadenze successive vengono pianificate man mano che si avvicinano |
| Push Apple non arrivano (403 BadJwtToken) | Mittente VAPID mancante o con host non pubblico | Imposta `POCKETLY_VAPID_SUBJECT=mailto:tuo.indirizzo@esempio.it` (deve avere dominio pubblico valido) in `/etc/pocketly/sync.env` e riavvia il server |
| Notifiche 503 / push disattivate | File `push.json` corrotto sul server | La sincronizzazione dati continua a funzionare; per ripristinare le notifiche verifica o rigenera `push.json` sul server |
| Stato sync 'outdated' | Dati sul server salvati da una versione più nuova dell'app | Aggiorna l'app client: versioni precedenti rifiutano dati più recenti per prevenire cancellazioni accidentali di campi |
