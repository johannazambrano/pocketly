# Revisione del ramo `feature/notifiche-spese-ricorrenti` (5b5e112)

Ciao! Ho fatto rivedere il ramo prima di unirlo a `main`. Ecco cosa è emerso.

## Cosa funziona già

- Si unisce a `main` senza conflitti. Sul codice unito passano tutti i test (328 Vitest); anche il controllo dei tipi e la build vanno a buon fine.
- I 15 test del server Python passano.
- La crittografia è corretta. La cifratura RFC 8291 è stata provata con il vettore ufficiale dell'Appendice A. I token VAPID sono stati verificati con una libreria indipendente (WebCrypto di Node).
- I testi sono coerenti con `main`, dove "Una tantum" ora si chiama "Spese variabili".

## Critico (da confermare con la prova su iPhone)

1. **`server/webpush.py:159`: mittente VAPID `mailto:pocketly@localhost`.**
   - **Problema:** sono segnalati casi in cui il servizio push di Apple risponde `403 BadJwtToken` se `sub` non è un `mailto:` o un URL `https` reale. Se succede, sugli iPhone non arriva nessuna notifica. In più `dispatch_due` (`server/main.py:285`) tratta ogni 4xx diverso da 429 come definitivo, quindi i promemoria vengono scartati senza alcun messaggio.
   - **Proposta:** un mittente configurabile, per esempio `POCKETLY_VAPID_SUBJECT=mailto:indirizzo-vero` oppure l'URL `https` del sito. Scrivere nel log gli stati diversi da 2xx.

## Importante

2. **Un dispositivo non aggiornato cancella i promemoria di tutti.**
   - **Problema:** la versione attuale normalizza i dati ricevuti con la sincronizzazione (`parseBackup` → `normalizeV2` in `migration.ts`). Ricostruisce ogni ricorrenza campo per campo, quindi scarta `notifications`. Un dispositivo vecchio (con `registerType: 'prompt'` può restarci a lungo) che modifica una ricorrenza carica i dati senza regole. L'unione a tre vie sugli altri dispositivi le fa sparire ovunque.
   - **Proposta:** alzare la versione del formato dei dati, così i client vecchi si fermano invece di sovrascrivere. In alternativa, aggiornare tutti i dispositivi prima di usare le notifiche.
3. **`src/stores/notifications.ts:181-203`: l'hash della pianificazione non rispecchia lo stato del server.**
   - **Problema:** l'hash contiene gli ID dei dispositivi ma non `p256dh`, `auth` ed endpoint.
     - Dopo un 404/410 il server rimuove il dispositivo; alla riapertura il dispositivo si registra di nuovo con lo stesso ID, l'hash è identico e l'invio viene saltato. Nessun promemoria arriva finché non cambia qualcosa.
     - Lo stesso succede se `push.json` è illeggibile, perché `_read_unlocked` rigenera le chiavi e azzera tutto.
     - Manca un gestore `pushsubscriptionchange`.
   - **Proposta:**
     - mettere nell'hash anche le chiavi;
     - forzare l'invio dopo ogni `subscribePush` riuscito;
     - a ogni apertura, confrontare la `p256dh` locale con quella sul server;
     - se `push.json` è corrotto, fermarsi con un errore invece di rigenerare le chiavi.
4. **L'invio della pianificazione la sostituisce per intero** (`src/domain/notifications.ts:156`, `server/main.py:212`).
   - **Problema:** il client manda solo le voci con `fireAt > now`. Se un dispositivo apre l'app nei secondi tra la scadenza e il dispatcher (che gira ogni 30 s), cancella quella notifica. Cancella anche i nuovi tentativi previsti per 24 h dopo errori 5xx, 429 o di rete.
   - **Proposta:** il server conserva le voci scadute e non ancora inviate, oppure il client include anche quelle con `fireAt > now − 24h`.
5. **`server/main.py:482`: oltre 1000 voci la pianificazione viene rifiutata per intero.**
   - **Problema:** 40 ricorrenze mensili × 5 regole × 2 mesi × 3 dispositivi fanno circa 1200 voci. Il server risponde 400 e il client registra solo un `console.warn`. Il codice `items[:MAX_PUSH_SCHEDULE]` alla riga 225 non viene mai raggiunto.
   - **Proposta:** un limite per dispositivo oppure più alto, e un errore visibile nell'interfaccia.
6. **Orizzonte di 60 giorni** (`notifications.ts:138`).
   - **Problema:** la pianificazione si rinnova solo quando un dispositivo apre l'app. Dopo 60 giorni senza aperture i promemoria smettono di arrivare, senza avvisi.
   - **Proposta:** spiegarlo nell'interfaccia o estendere l'orizzonte.
7. **Notifiche doppie.**
   - **Problema:** con l'app aperta all'ora del promemoria, `checkLocalReminders` la mostra subito, poi arriva anche la push (`push-worker.js:45-80`). Su iOS la sostituzione per `tag` non è garantita.
   - **Proposta:** con l'iscrizione push attiva, il motore locale non mostra i promemoria già pianificati sul server.
8. **`stores/notifications.ts:78-80`: lo stato diventa "push" anche se l'iscrizione è fallita.**
   - **Problema:** succede per esempio su Firefox Android o con `pushManager` assente. L'interfaccia dice comunque "push attive anche ad app chiusa".
   - **Proposta:** uno stato `pushSubscribed` e il controllo `'PushManager' in window`.
9. **`stores/notifications.ts:171`: `isSyncingSchedule` scarta le richieste invece di accodarle.**
   - **Problema:** una modifica fatta durante un invio non arriva al server fino al prossimo evento.
   - **Proposta:** un flag "rifai", come in `syncNow` dello store di sincronizzazione.
10. **Pianificazione caricata prima della sincronizzazione.**
    - **Problema:** `sync.init()` e `notifications.init()` partono in parallelo. Un dispositivo aperto dopo settimane carica promemoria basati su dati vecchi.
    - **Proposta:** inviare la pianificazione solo dopo una sincronizzazione riuscita (`status === 'synced'`).

## Minore

- **`push-worker.js:92`:** `client.navigate()` fallisce sulle finestre non controllate. Inoltre ricarica l'intera app e fa perdere un modulo aperto. Meglio `focus()` + `postMessage` al router, con `openWindow` come ripiego.
- **`stores/notifications.ts:308, 426`:** su Android Chrome `new Notification()` lancia "Illegal constructor". `getRegistration()` può restituire una registrazione senza service worker attivo.
- **Icona badge:** `badge: '/favicon.svg'` non va bene su Android, che vuole un PNG monocromatico con trasparenza (per esempio `badge-96x96.png`).
- **`push-worker.js:13`:** `indexedDB.open('keyval-store')` senza versione crea il database vuoto se non esiste. Poi idb-keyval non crea più lo store `keyval` e l'app non salva più. È un caso raro.
- **`webpush.py:27`:** `tuple[int, int] | None` richiede Python 3.10, mentre la docstring dice 3.9+.
- **`webpush.py:195`:** si può registrare un endpoint verso la rete locale (SSRF). Il rischio è basso, perché serve la chiave di sincronizzazione.
- **Sincronizzazione scollegata:** se si scollega con le notifiche attive, iscrizione e pianificazione restano sul server.

## Da provare sul telefono

**iPhone/iPad (iOS 16.4 o successivo)**
- In Safari normale l'attivazione dev'essere bloccata, con l'invito ad aggiungere l'app alla Home.
- Dall'icona sulla Home, "Attiva" deve chiedere il permesso.
- Notifica di prova con l'app aperta e poi chiusa. Se non arriva, controllare nel log del server lo stato: un 403 conferma il punto 1.
- Ricorrenza con promemoria fra 3-5 minuti e app chiusa: deve arrivare una sola volta. Ripetere con l'app aperta, per controllare i doppi.
- Toccando la notifica deve aprirsi Ricorrenti nell'app installata.
- Negare il permesso, poi riabilitarlo da Impostazioni → Notifiche.
- Togliere l'app dalla Home e reinstallarla: devono arrivare ancora i promemoria (punto 3).

**Android Chrome**
- Gli stessi passi, anche dopo aver chiuso Chrome dai recenti.
- Controllare l'icona piccola nella barra di stato.
- Toccare la notifica con l'app già aperta su un'altra pagina.
- Su Firefox Android l'app non deve dire "push attive".

**Su entrambi**
- Modificare o eliminare una ricorrenza su un dispositivo: l'altro non deve ricevere il vecchio promemoria.
- Con un dispositivo alla versione vecchia, modificare una ricorrenza: le regole non devono sparire (punto 2).

## Non verificato

- Il comportamento reale dei servizi push di Apple, Google e Mozilla con questi token, compreso il 403 per `@localhost`.
- Se il container Proxmox raggiunge `web.push.apple.com` e `fcm.googleapis.com`. Se un firewall ispeziona il TLS, urllib fallisce e i promemoria vengono scartati dopo 24 h senza avvisi.
