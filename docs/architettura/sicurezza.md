---
source-files:
  - server/main.py
  - server/webpush.py
  - deploy/proxmox/nginx/pocketly.conf
  - deploy/proxmox/make-cert.sh
  - deploy/proxmox/install-sync.sh
  - deploy/proxmox/pocketly-sync.service
  - vercel.json
  - public/push-worker.js
  - src/services/backupCrypto.ts
  - src/stores/sync.ts
  - src/services/exportData.ts
  - src/services/xlsx/zip.ts
verified: 2026-11-23
---

# Analisi di Sicurezza (PKT-14)

Analisi della sicurezza di Pocketly fatta il 2026-11-23 sul codice di `develop`: app nel browser, cifratura, sincronizzazione,
notifiche, server e pubblicazione. Per ogni punto: cosa si è trovato, quanto pesa e com'è stato risolto, o perché resta aperto.

**Chi può fare cosa.** Pocketly gira in una rete di casa (container Proxmox, raggiungibile solo dalla rete locale) e su Vercel
come versione di prova. Nell'analisi si considerano:
- chi è sulla stessa rete Wi-Fi, ma non conosce la chiave del server;
- chi conosce la chiave del server (`POCKETLY_SYNC_KEY`), cioè ogni dispositivo collegato alla sincronizzazione;
- chi ha in mano un telefono sbloccato con l'app;
- chi riesce a entrare nel container.

---

## 1. Cosa è già solido

- **Dati sul server solo cifrati.** Il dispositivo cifra con PBKDF2-SHA-256 (600.000 iterazioni) e AES-256-GCM
  ([`backupCrypto.ts`](../../src/services/backupCrypto.ts)); il server rifiuta tutto ciò che non ha il formato cifrato
  (`valid_payload` in [`main.py`](../../server/main.py)) e non conosce la password. Anche i promemoria delle notifiche
  arrivano cifrati per il singolo dispositivo (`aes128gcm`, RFC 8291).
- **File cifrati costruiti ad arte non bloccano l'app.** Le iterazioni accettate in lettura stanno tra 100.000 e
  5.000.000, sale e IV hanno la misura giusta.
- **Chiave del server.** 32 byte casuali (`secrets.token_urlsafe(32)` in [`install-sync.sh`](../../deploy/proxmox/install-sync.sh)),
  confrontata a tempo costante (`hmac.compare_digest`); dopo 10 tentativi sbagliati in 15 minuti lo stesso indirizzo
  riceve 429. L'indirizzo viene da `X-Real-IP`, che nginx riscrive sempre: dall'esterno non si può falsare.
- **Servizio chiuso.** `pocketly-sync` ascolta solo su `127.0.0.1`, gira con un utente suo, può scrivere solo nella sua
  cartella e ha le protezioni di systemd attive ([`pocketly-sync.service`](../../deploy/proxmox/pocketly-sync.service)).
  Il corpo delle richieste è limitato a 5 MB.
- **Notifiche verso la rete di casa bloccate.** Il server fa richieste solo verso servizi push con un nome pubblico in
  https: niente IP, `localhost`, `.lan`, `.local` (`valid_endpoint` in [`webpush.py`](../../server/webpush.py)).
- **Niente HTML scritto a mano nell'app.** Nessun `v-html`, `innerHTML` o `eval`: i testi di chi usa l'app (nomi, note,
  tag) passano sempre dall'escape di Vue.
- **Import ed export.** L'Excel si legge con limiti di dimensione per file e per voce dello zip
  ([`zip.ts`](../../src/services/xlsx/zip.ts)); nel CSV esportato un testo che comincia con `=`, `+`, `-` o `@` viene
  preceduto da `'`, così Excel non lo esegue come formula (`escapeCsvField` in
  [`exportData.ts`](../../src/services/exportData.ts)).
- **Nessuna libreria esterna sul server** (solo la libreria standard di Python) e poche nel browser.

---

## 2. Punti trovati

| # | Punto | Peso | Stato |
|---|---|---|---|
| 1 | La CA locale installata sui dispositivi vale per qualsiasi sito, e la sua chiave sta sul container | alto | aperto, da decidere |
| 2 | Il sito non mandava intestazioni di sicurezza (CSP, protezione dall'inserimento in altre pagine…) | medio | risolto |
| 3 | Sul dispositivo dati, chiave del server e chiave di cifratura sono salvati in chiaro | medio | rimandato a `PKT-25` fase A |
| 4 | La password della sincronizzazione può avere solo 8 caratteri | medio-basso | aperto, da decidere |
| 5 | Il server delle notifiche accettava `http://127.0.0.1` e `localhost` anche in produzione, e seguiva i redirect | basso | risolto |
| 6 | `vue-i18n` con una vulnerabilità nota | basso | risolto |
| 7 | Gli indirizzi completi dei dispositivi finivano nei log del server | basso | risolto |
| 8 | Il tocco su una notifica poteva aprire un sito esterno | basso | risolto |
| 9 | `ca.crt` si scarica in HTTP senza un modo di verificarlo | basso | risolto (guida) |

### 1. CA locale senza limiti (alto, aperto)
[`make-cert.sh`](../../deploy/proxmox/make-cert.sh) crea una CA radice che i dispositivi installano come attendibile. La CA
non ha `nameConstraints`: un certificato firmato con la sua chiave vale per **qualsiasi** sito, non solo per l'IP del
container. La chiave (`ca.key`) sta in `/etc/nginx/ssl` sul container. Chi entra nel container può quindi fingersi
qualsiasi sito (banca, posta…) sui dispositivi che hanno installato la CA, senza che il browser avvisi.

**Rimedi possibili:**
- **CA nuova con il vincolo** `nameConstraints=critical,permitted;IP:<ip-del-container>/255.255.255.255` e chiave tenuta
  fuori dal container (serve solo per rinnovare il certificato, verso gennaio 2029). Chiude il problema, ma la CA va
  reinstallata su ogni dispositivo (e tolta la vecchia).
- **Solo togliere `ca.key` dal container**, conservandola altrove. Niente da reinstallare; riduce il rischio (chi entra
  nel container non trova la chiave), ma la CA resta valida per tutti i siti.

Da decidere chi usa l'app; fino ad allora il punto resta aperto.

### 2. Intestazioni di sicurezza (medio, risolto)
Né nginx né Vercel mandavano intestazioni di sicurezza. Ora le mandano entrambi
([`pocketly.conf`](../../deploy/proxmox/nginx/pocketly.conf), [`vercel.json`](../../vercel.json)):
- **`Content-Security-Policy`:** solo file di questo sito (`'self'`); `data:` e `blob:` per le immagini (l'icona di iOS
  incorporata in `index.html`, le esportazioni); `'unsafe-inline'` solo per gli stili (colori calcolati da Vue);
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Se un giorno un testo riuscisse
  a diventare codice, non potrebbe caricare script da fuori né mandare i dati altrove.
- **`X-Frame-Options: DENY`** (e `frame-ancestors 'none'`): l'app non si può mettere dentro un'altra pagina.
- **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy: no-referrer`**, **`Permissions-Policy`** (niente
  fotocamera, microfono, posizione, pagamenti, USB), **`Cross-Origin-Opener-Policy: same-origin`**.
- **`server_tokens off`:** nginx non dice più la sua versione.

HSTS non si usa: con un indirizzo IP i browser lo ignorano.

**Attenzione per chi tocca `pocketly.conf`:** nginx non eredita gli `add_header` del blocco `server` in un blocco
`location` che ne ha uno suo. Per questo `/index.html` ripete tutte le intestazioni e gli altri blocchi almeno `nosniff`.
Un nuovo `add_header` in un blocco richiede di ripeterle anche lì.

**Provato** con la versione costruita e la CSP attiva: nessun blocco nelle pagine principali; font, icone, service
worker, backup ed Excel scaricati funzionano.

### 3. Dati in chiaro sul dispositivo (medio, rimandato)
Sul dispositivo i dati stanno in IndexedDB senza cifratura; con loro la chiave del server e la chiave AES della
sincronizzazione (un `CryptoKey` non estraibile, ma usabile da chi apre l'app). Chi ha in mano il telefono sbloccato, o un
backup del browser, ha tutto. È il problema che risolve il blocco locale con cifratura dei dati, fase A di `PKT-25`
([autenticazione.md](autenticazione.md)): non si duplica qui.

### 4. Password della sincronizzazione corta (medio-basso, aperto)
La password che cifra i dati della sincronizzazione deve avere almeno 8 caratteri (`MIN_PASSWORD_LENGTH`). Chi conosce la
chiave del server può scaricare i dati cifrati (e il server tiene le ultime 30 versioni in `history/`) e provare le
password sul proprio computer, senza limiti di tentativi. Con 600.000 iterazioni ogni prova è lenta, ma una password di 8
caratteri comune resta alla portata.

**Rimedi possibili:** minimo di 12 caratteri per le password nuove (quelle già in uso continuano a funzionare), oppure solo
un avviso sotto il campo quando la password è corta o semplice. Da decidere chi usa l'app.

### 5. Notifiche verso indirizzi interni (basso, risolto)
`valid_endpoint` accettava `http://127.0.0.1` e `http://localhost`, pensati per i test ma attivi anche in produzione: con la
chiave del server si poteva far chiamare al server i servizi del container stesso. Inoltre `send_web_push` seguiva i
redirect, quindi un servizio push (o un nome che finge di esserlo) poteva rimandare la richiesta altrove. Ora sono accettati
solo indirizzi https con un nome pubblico e i redirect non si seguono (`_NoRedirect` in [`webpush.py`](../../server/webpush.py));
test in [`test_main.py`](../../server/test_main.py) (`test_rifiuta_endpoint_verso_la_rete_locale`, `NoRedirectTest`).

Resta un limite noto: un nome pubblico che punta a un IP della rete di casa passa il controllo, che guarda il nome e non
l'indirizzo. Serve comunque la chiave del server; chiuderlo del tutto vorrebbe dire risolvere il nome e controllare l'IP prima
di ogni invio.

### 6. Librerie (basso, risolto)
`npm audit` segnalava `vue-i18n` 11.4.13 (GHSA-83rm-6c8r-g728, XSS con `escapeParameter` e `v-html`): da noi non sfruttabile,
perché l'app non usa `v-html`, ma aggiornato a 11.4.23 con `npm audit fix`, insieme a `fast-uri` e `serialize-javascript`
(strumenti di build). Restano 4 avvisi moderati su `glob` e `minimatch`, dentro `workbox-build` di `vite-plugin-pwa`: servono
solo a costruire l'app e non finiscono in quella pubblicata. Correggerli richiederebbe di tornare a `vite-plugin-pwa` 1.1
(`npm audit fix --force`): si aspetta una versione nuova del plugin.

### 7. Indirizzi dei dispositivi nei log (basso, risolto)
L'indirizzo di una sottoscrizione push identifica il dispositivo; `main.py` nei log scriveva già solo il nome del servizio
(`endpoint_host`), ma `send_web_push` scriveva l'indirizzo completo. Ora anche lì solo il nome del servizio.

### 8. Tocco sulla notifica verso un sito esterno (basso, risolto)
[`push-worker.js`](../../public/push-worker.js) apriva l'indirizzo scritto nella notifica (`url`) così com'era: un indirizzo
assoluto avrebbe aperto un altro sito. Per costruire una notifica valida servono le chiavi del dispositivo, che il server
dà a chi conosce la sua chiave. Ora `safeAppPath` accetta solo percorsi dell'app (che cominciano con `/`, non con `//` o `/\`)
e negli altri casi apre `/ricorrenti`.

### 9. `ca.crt` scaricato in HTTP (basso, risolto nella guida)
La CA si scarica da `http://IP/ca.crt`, prima che il dispositivo si fidi dell'HTTPS: chi è sulla stessa rete potrebbe
sostituirla con la sua. `make-cert.sh` ora stampa l'impronta SHA-256 della CA e la [guida](../../deploy/proxmox/README.md)
chiede di confrontarla con quella mostrata dal dispositivo prima di installarla.

---

## 3. Punti minori, non corretti

- **Firma VAPID in Python puro.** [`webpush.py`](../../server/webpush.py) firma con un'implementazione P-256 che non è a tempo
  costante. Le firme partono dal server ogni 30 secondi verso i servizi push e nessuno può misurarne i tempi: rischio
  teorico, non si cambia per non aggiungere librerie al server.
- **Elenco dei tentativi falliti in memoria.** `Failures` tiene una voce per ogni indirizzo che ha sbagliato la chiave e non
  la toglie mai del tutto. In una rete di casa gli indirizzi sono pochi: nessun effetto pratico.
- **Chiavi dei dispositivi nella configurazione delle notifiche.** `GET /api/push/config` dà a chi ha la chiave del server
  le chiavi pubbliche e i segreti `auth` di tutti i dispositivi: serve perché ogni dispositivo cifri i promemoria per gli
  altri. Chi ha la chiave del server può quindi mandare notifiche finte; vedi il punto 8 per il loro effetto.
- **Versione di prova su Vercel.** È pubblica (con `noindex`) ma senza sincronizzazione: i dati restano sul dispositivo.
  Non vanno importati lì i dati veri se il dispositivo è condiviso.

---

## 4. Da ricontrollare

- Dopo ogni `update.sh`: `curl -skI https://localhost/ | grep -i content-security` sul container deve mostrare la CSP.
- Dopo un cambio di librerie: `npm audit --omit=dev` senza avvisi alti.
- Quando si aggiunge una risorsa esterna (font, script, servizio): va aggiunta alla CSP in **entrambi** i file, nginx e
  Vercel, altrimenti il browser la blocca.
