---
source-files:
  - server/main.py
  - server/webpush.py
  - server/test_main.py
verified: 2026-11-10
---

# Architettura Backend

Il backend di Pocketly è progettato per essere estremamente leggero, sicuro e privo di dipendenze esterne.

---

## 1. Filosofia: Zero-Dependency Python

Il server è implementato interamente in **Python 3** utilizzando esclusivamente i moduli della libreria standard (`http.server`, `urllib`, `ssl`, `hashlib`, `hmac`, `secrets`, `threading`, `json`, `pathlib`). Non richiede pacchetti `pip` o ambienti virtuali.

Componenti principali:
- [`server/main.py`](../../server/main.py): server HTTP multithread con router REST, gestione persistenza atomica dei file, rate limiting contro attacchi a forza bruta e worker di dispatch delle notifiche.
- [`server/webpush.py`](../../server/webpush.py): crittografia Web Push RFC 8291 e RFC 8292. Implementa in puro Python curve ellittiche P-256 (NIST P-256 / secp256r1), firma ECDSA SHA-256 per token VAPID e validazione dei pacchetti cifrati `aes128gcm`.
- [`server/test_main.py`](../../server/test_main.py): suite completa di 27 test unitari eseguibile con `npm run test:server` (oppure `python3 -m unittest server.test_main`).

---

## 2. Specifiche API REST

Tutti gli endpoint risiedono sotto il prefisso `/api/`. L'autenticazione richiede l'header:
```http
Authorization: Bearer <CHIAVE_DI_ACCESSO>
```
La chiave di accesso viene verificata mediante confronto a tempo costante (`hmac.compare_digest`).

### Tabella degli Endpoint

| Metodo | Path | Autenticato | Descrizione |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check, restituisce `{"service": "pocketly-sync", "api": 1}` |
| `GET` | `/api/sync` | Sì | Restituisce il blob cifrato salvato e l'ETag della versione. Supporta `If-None-Match`. |
| `PUT` | `/api/sync` | Sì | Scrive un nuovo blob cifrato tramite payload JSON `{"baseVersion": n, "payload": {...}}`. Ritorna `200` con la nuova versione o `409 Conflict` se `baseVersion` non è allineata all'ultima versione remota. |
| `GET` | `/api/push/config` | Sì | Restituisce la chiave pubblica VAPID del server e la lista dei dispositivi registrati. |
| `PUT` | `/api/push/subscription` | Sì | Registra o aggiorna la sottoscrizione Web Push di un dispositivo (`deviceId`, `endpoint`, chiavi `p256dh` e `auth`). |
| `DELETE`| `/api/push/subscription` | Sì | Rimuove un dispositivo registrato tramite query parameter `?device_id=...`. |
| `PUT` | `/api/push/schedule` | Sì | Carica la pianificazione delle notifiche cifrate per i dispositivi (`items: [{id, deviceId, fireAt, payload}]` in `aes128gcm`). |
| `POST`| `/api/push/test` | Sì | Invia una notifica di prova immediata a un dispositivo specificato. |

---

## 3. Persistenza Atomica e Sicurezza File

I dati sono conservati nella directory `--data-dir` (default: `./data`):
- `sync.json`: contiene la versione corrente e il payload crittografato.
- `sync_history.json`: mantiene fino a 30 versioni storiche (`HISTORY_KEEP = 30`) per consentire il recupero in caso di emergenza.
- `push.json`: contiene la coppia di chiavi VAPID del server (generate automaticamente al primo avvio se assenti) e la lista dei dispositivi registrati (fino a 16 dispositivi per istanza).
- `push_schedule.json`: contiene la lista delle notifiche pianificate nel futuro (fino a 5000 voci `MAX_PUSH_SCHEDULE`) e il registro delle notifiche già inviate per evitare duplicazioni (`SENT_RETENTION_SECONDS = 30 giorni`).

Tutte le scritture su disco utilizzano la funzione atomica `write_atomic`:
1. Viene creato un file temporaneo univoco `.tmp-*.json` nella stessa cartella.
2. Il file viene scritto e sincronizzato su disco.
3. Viene eseguita una ridenominazione atomica POSIX (`os.replace`) sul file di destinazione.  
In questo modo nessuna interruzione improvvisa di corrente o crash di processo può corrompere il database.

### Resilienza e Tolleranza ai Guasti (`PushDataError`)
Se il file `push.json` dovesse risultare illeggibile o corrotto (ad esempio a causa di troncamento manuale o formattazione non valida), il server non blocca l'intero avvio: solleva un'eccezione controllata `PushDataError` e continua l'esecuzione per garantire che la sincronizzazione finanziaria `/api/sync` e la conservazione dei backup continuino a funzionare regolarmente. Le richieste verso `/api/push/*` risponderanno con stato `503 Service Unavailable` finché il file non viene ripristinato.

---

## 4. Rate Limiting e Protezione Brute Force

Il server implementa una tabella in memoria dei tentativi di accesso falliti indicizzata per IP sorgente:
- Soglia di errore: 10 tentativi falliti (`MAX_FAILURES = 10`).
- Finestra di blocco: 15 minuti (`FAILURE_WINDOW_SECONDS = 900`).
- Se la soglia viene superata, il server risponde immediatamente con `429 Too Many Requests` con header `Retry-After: 900`.
- Una chiamata corretta con la chiave valida azzera il contatore per quell'IP.

---

## 5. Thread di Dispatch Web Push

Al momento dell'avvio del server viene avviato un thread daemon in background:
- Si sveglia ogni 30 secondi (`DISPATCH_INTERVAL_SECONDS = 30.0`).
- Controlla `push_schedule.json` alla ricerca di notifiche con `fireAt <= now`.
- Se trova notifiche mature, costruisce la richiesta HTTP RFC 8292 con l'header `Authorization: vapid t=..., k=...` firmato con la chiave privata VAPID del server.
- Inoltra il payload al gateway Web Push del browser (es. Google FCM, Apple Push, Mozilla Autopush).
- Se il gateway risponde con `404 Not Found` o `410 Gone` (il dispositivo ha revocato il permesso o disinstallato l'app), il server cancella automaticamente la sottoscrizione del dispositivo per evitare sprechi di risorse.
- All'avvio viene verificato il mittente `POCKETLY_VAPID_SUBJECT` tramite `vapid_subject_problem`: se l'indirizzo usa suffissi non pubblici (es. `.local`, `.lan`, `localhost`), il server emette un warning esplicito per prevenire rifiuti 403 da parte dei servizi push di Apple.
- Validazione anti-SSRF: la funzione `valid_endpoint` in [`server/webpush.py`](../../server/webpush.py) blocca qualsiasi tentativo di registrare endpoint push verso indirizzi IP privati o host non pubblici (`_public_host`), impedendo che client autenticati usino il server come proxy per sonde di rete interna.
- Invalidazione schedulazione su cambio chiavi: se un dispositivo rinnova le chiavi Web Push (`p256dh`/`auth`), il server rimuove le voci precedentemente pianificate cifrate con le vecchie chiavi, in attesa del nuovo scadenzario aggiornato inviato dal client.
