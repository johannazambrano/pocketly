---
source-files:
  - server/main.py
  - server/webpush.py
  - server/test_main.py
verified: 2026-11-11
---

# Architettura Backend

Il backend di Pocketly è progettato per essere estremamente leggero, sicuro e privo di dipendenze esterne.

---

## 1. Filosofia: Zero-Dependency Python

Il server è implementato interamente in **Python 3** (3.9 o successivo) utilizzando esclusivamente i moduli della libreria standard (`http.server`, `urllib`, `ipaddress`, `hashlib`, `hmac`, `secrets`, `threading`, `json`, `pathlib`). Non richiede pacchetti `pip` o ambienti virtuali.

Componenti principali:
- [`server/main.py`](../../server/main.py): server HTTP multithread con router REST, gestione persistenza atomica dei file, rate limiting contro attacchi a forza bruta e worker di dispatch delle notifiche.
- [`server/webpush.py`](../../server/webpush.py): crittografia Web Push RFC 8291 e RFC 8292. Implementa in puro Python curve ellittiche P-256 (NIST P-256 / secp256r1), firma ECDSA SHA-256 per token VAPID e validazione dei pacchetti cifrati `aes128gcm`.
- [`server/test_main.py`](../../server/test_main.py): suite completa di 27 test unitari eseguibile con `npm run test:server` su Windows, macOS e Linux (oppure a mano con `python3 -m unittest server.test_main`; su Windows `py -3 -m unittest server.test_main`).

Il server non accetta argomenti da riga di comando: si configura con variabili d'ambiente (`POCKETLY_SYNC_KEY` obbligatoria, almeno 32 caratteri, altrimenti esce con codice 2; `POCKETLY_HOST` default `127.0.0.1`; `POCKETLY_PORT` default `8787`; `POCKETLY_DATA_DIR` default `/var/lib/pocketly`; `POCKETLY_VAPID_SUBJECT`).

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
| `DELETE`| `/api/push/subscription` | Sì | Rimuove un dispositivo registrato (e le sue voci in calendario); il `deviceId` arriva nel corpo JSON `{"deviceId": "..."}`. |
| `PUT` | `/api/push/schedule` | Sì | Carica la pianificazione delle notifiche cifrate per i dispositivi (`items: [{id, deviceId, fireAt, payload}]` in `aes128gcm`). |
| `POST`| `/api/push/test` | Sì | Invia una notifica di prova immediata a un dispositivo specificato. |

---

## 3. Persistenza Atomica e Sicurezza File

I dati sono conservati nella cartella indicata da `POCKETLY_DATA_DIR` (default: `/var/lib/pocketly`):
- `current.json` (classe `Store`): contiene la versione corrente e il payload crittografato.
- `history/v*.json`: a ogni salvataggio la versione precedente finisce qui (`v000001.json`, …); se ne tengono le ultime 30 (`HISTORY_KEEP = 30`) per consentire il recupero in caso di emergenza.
- `push.json` (classe `PushStore`): un solo file con la coppia di chiavi VAPID del server (`vapid`, generata al primo uso se il file non esiste), i dispositivi registrati (`devices`, fino a 16, `MAX_PUSH_DEVICES`), il calendario delle notifiche (`schedule`, fino a 5000 voci, `MAX_PUSH_SCHEDULE`) e il registro delle notifiche già inviate per evitare duplicazioni (`sent`, conservato 30 giorni, `SENT_RETENTION_SECONDS`).

Tutte le scritture su disco utilizzano la funzione atomica `write_atomic`:
1. Viene creato un file temporaneo univoco `.tmp-*.json` nella stessa cartella.
2. Il file viene scritto e sincronizzato su disco.
3. Viene eseguita una ridenominazione atomica POSIX (`os.replace`) sul file di destinazione.  
In questo modo nessuna interruzione improvvisa di corrente o crash di processo può corrompere il database.

### Resilienza e Tolleranza ai Guasti (`PushDataError`)
Se il file `push.json` dovesse risultare illeggibile o corrotto (ad esempio a causa di troncamento manuale o formattazione non valida), il server non blocca l'intero avvio: solleva un'eccezione controllata `PushDataError` e continua l'esecuzione per garantire che la sincronizzazione finanziaria `/api/sync` e la conservazione dei backup continuino a funzionare regolarmente. Le richieste verso `/api/push/*` risponderanno con stato `503 Service Unavailable` finché il file non viene ripristinato.

---

## 4. Rate Limiting e Protezione Brute Force

Il server implementa una tabella in memoria (classe `Failures`) dei tentativi di accesso falliti indicizzata per IP sorgente, a finestra scorrevole:
- Soglia di errore: 10 tentativi falliti (`MAX_FAILURES = 10`).
- Finestra: 15 minuti (`FAILURE_WINDOW_SECONDS = 900`); contano solo i fallimenti degli ultimi 15 minuti, quelli più vecchi decadono da soli.
- Raggiunta la soglia, il server risponde subito `429 Too Many Requests` (`{"error": "too many attempts"}`), senza header `Retry-After`.
- Una chiamata con la chiave valida non azzera il contatore: i fallimenti recenti restano finché non escono dalla finestra.

---

## 5. Thread di Dispatch Web Push

Al momento dell'avvio del server viene avviato un thread daemon in background:
- Si sveglia ogni 30 secondi (`DISPATCH_INTERVAL_SECONDS = 30.0`).
- Controlla il calendario (`schedule` in `push.json`) alla ricerca di notifiche con `fireAt <= now`; quelle scadute da più di 24 ore (`PUSH_RETRY_WINDOW_SECONDS`) vengono scartate.
- Se trova notifiche mature, costruisce la richiesta HTTP RFC 8292 con l'header `Authorization: vapid t=..., k=...` firmato con la chiave privata VAPID del server.
- Inoltra il payload al gateway Web Push del browser (es. Google FCM, Apple Push, Mozilla Autopush).
- Se il gateway risponde con `404 Not Found` o `410 Gone` (il dispositivo ha revocato il permesso o disinstallato l'app), il server cancella automaticamente la sottoscrizione del dispositivo per evitare sprechi di risorse.
- All'avvio viene verificato il mittente `POCKETLY_VAPID_SUBJECT` tramite `vapid_subject_problem`: se l'indirizzo usa suffissi non pubblici (es. `.local`, `.lan`, `localhost`), il server emette un warning esplicito per prevenire rifiuti 403 da parte dei servizi push di Apple.
- Validazione anti-SSRF: la funzione `valid_endpoint` in [`server/webpush.py`](../../server/webpush.py) blocca qualsiasi tentativo di registrare endpoint push verso indirizzi IP privati o host non pubblici (`_public_host`), impedendo che client autenticati usino il server come proxy per sonde di rete interna.
- Invalidazione schedulazione su cambio chiavi: se un dispositivo rinnova le chiavi Web Push (`p256dh`/`auth`), il server rimuove le voci precedentemente pianificate cifrate con le vecchie chiavi, in attesa del nuovo scadenzario aggiornato inviato dal client.
