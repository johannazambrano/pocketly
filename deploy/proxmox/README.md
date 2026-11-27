# Pubblicare Pocketly su un container Proxmox (rete locale, HTTPS sull'IP)

Guida da eseguire **dall'inizio alla fine nel container**, copiando i comandi uno dopo l'altro.
Alla fine Pocketly è raggiungibile da tutti i dispositivi di casa all'indirizzo `https://IP-DEL-CONTAINER/`
e si può installare come app.

**Come funziona:** Pocketly è un sito statico. Nel container nginx serve direttamente i file generati
dalla build (non fa da proxy verso altri servizi) e gestisce l'HTTPS. Non serve un dominio né un
reverse proxy esistente: il certificato lo emette una piccola CA locale per l'IP del container.
L'HTTPS è necessario perché l'installazione come app, l'uso offline e la persistenza dei dati
funzionano solo in un contesto sicuro.

> **Tutto va fatto nel container, non sull'host Proxmox.** Sull'host non si installa nulla.
> Per entrare nel container: console del container nell'interfaccia web di Proxmox (accedi come `root`),
> oppure dall'host `pct enter ID-DEL-CONTAINER`.

| File | A cosa serve |
|---|---|
| `nginx/pocketly.conf` | Configurazione del sito (HTTPS, redirect da HTTP, fallback per le rotte, cache, download di `ca.crt`). |
| `make-cert.sh` | Crea la CA locale vincolata al solo IP del container (`ca.key` cifrata, tenuta fuori dal container) e il certificato TLS per nginx. |
| `update.sh` | Scarica gli aggiornamenti, fa la build e pubblica il sito. |
| `publish.sh` | Alternativa: dal PC di sviluppo, fa la build e carica `dist/` sul container via SSH. |
| `install-sync.sh` | Facoltativo: installa il server di sincronizzazione tra dispositivi (punto 8). |
| `pocketly-sync.service` | Servizio systemd del server di sincronizzazione, installato da `install-sync.sh`. |

## 1. Il container

Serve un container LXC con template **Debian 12**: 1 CPU, **1 GB di RAM** (serve per la build) e 8 GB di disco.
Dagli un **IP fisso** (indirizzo statico oppure prenotazione DHCP sul router): il certificato è legato
all'IP, quindi se cambia va rigenerato. Avvialo ed entra come `root`.

Scopri l'IP del container (ti serve più avanti):

```bash
hostname -I
```

## 2. Installare i programmi

```bash
apt update && apt install -y git nginx openssl curl ca-certificates

# Node 22 (il Node di Debian è troppo vecchio per questa versione di Vite)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

Controllo, ogni comando deve rispondere con una versione:

```bash
nginx -v ; git --version ; openssl version ; node -v
```

`node -v` deve mostrare `v22.x`.

## 3. Scaricare il progetto

```bash
if [ -d /opt/pocketly ]; then
  git -C /opt/pocketly pull
else
  git clone https://github.com/johannazambrano/pocketly.git /opt/pocketly
fi
```

Se `/opt/pocketly` esiste già, il comando lo aggiorna invece di clonarlo di nuovo.

Se avevi clonato il ramo `deploy/proxmox` (come indicava una versione precedente di questa guida), passa a `main`:

```bash
cd /opt/pocketly && git fetch && git checkout main && git pull
```

Se git chiede nome utente e password, il repository è privato: come password non vale quella dell'account,
serve un *personal access token* (GitHub → Settings → Developer settings → Personal access tokens, con
permesso di lettura sui contenuti del repository).

Controllo:

```bash
ls /opt/pocketly/deploy/proxmox
```

Devono comparire `make-cert.sh`, `update.sh`, `nginx` e `README.md`. Se manca `update.sh`, hai una copia
vecchia del progetto: rilancia `git -C /opt/pocketly pull`.

## 4. Certificato e configurazione di nginx

> **Nota (deploy pubblico con dominio):** la CA locale serve solo quando si usa Pocketly su un indirizzo IP di casa senza dominio. In caso di distribuzione pubblica o deploy su un proprio dominio (anche puntato a un IP locale tramite DNS), la soluzione ottimale è usare certificati pubblici automatici (es. Let's Encrypt via ACME / challenge DNS-01), che evitano di installare qualsiasi CA sui dispositivi.

Per la rete locale su IP, la chiave privata della CA (`ca.key`) viene protetta con **passphrase** e **non deve restare sul container**: nginx usa solo `ca.crt`, `pocketly.crt` e `pocketly.key`. La CA emessa da `make-cert.sh` è inoltre vincolata al solo IP indicato (`nameConstraints` su IP + blocco di tutti i domini DNS).

### Modalità consigliata: generazione dal tuo PC di fiducia (`ca.key` non tocca mai il container)

Sostituisci `192.168.1.50` con l'IP trovato al punto 1. Sul tuo PC (con `openssl` installato, es. Linux, macOS o Git Bash su Windows):

```bash
cd /percorso/di/pocketly/deploy/proxmox
./make-cert.sh 192.168.1.50 ./pocketly-certs
```

Scegli una passphrase robusta per `ca.key` e annota l'**impronta SHA-256** stampata alla fine. Poi carica sul container **solo i 3 file necessari a nginx** (mai `ca.key`):

```bash
ssh root@192.168.1.50 'mkdir -p /etc/nginx/ssl'
scp ./pocketly-certs/ca.crt ./pocketly-certs/pocketly.crt ./pocketly-certs/pocketly.key root@192.168.1.50:/etc/nginx/ssl/
ssh root@192.168.1.50 'chmod 600 /etc/nginx/ssl/pocketly.key && chmod 644 /etc/nginx/ssl/ca.crt /etc/nginx/ssl/pocketly.crt'
```

Sul PC: **cancella `pocketly.key`** e sposta `ca.key` (+ la sua passphrase) e `ca.crt` in un **password manager** o archivio cifrato offline (ti serviranno solo per un eventuale rinnovo dopo 825 giorni). Se preferisci non custodire `ca.key`, puoi anche eliminarla del tutto (tra 825 giorni basterà creare una nuova CA).

### Modalità alternativa: generazione nel container (con rimozione immediata di `ca.key`)

Se non hai `openssl` sul PC, puoi lanciare lo script nel container e poi spostare subito `ca.key` fuori dal container:

```bash
cd /opt/pocketly/deploy/proxmox
./make-cert.sh 192.168.1.50
```

Se `./make-cert.sh` risponde "permesso negato", usa `bash make-cert.sh 192.168.1.50`. Subito dopo, **copia `ca.key` fuori dal container** (es. dal tuo PC: `scp root@192.168.1.50:/etc/nginx/ssl/ca.key .`, poi mettila in un password manager) e **rimuovila dal container**:

```bash
rm -f /etc/nginx/ssl/ca.key
```

### Attivazione del sito nginx (nel container)

```bash
cd /opt/pocketly/deploy/proxmox
cp nginx/pocketly.conf /etc/nginx/sites-available/pocketly
ln -sf /etc/nginx/sites-available/pocketly /etc/nginx/sites-enabled/pocketly
rm -f /etc/nginx/sites-enabled/default
```

## 5. Prima pubblicazione

```bash
cd /opt/pocketly
deploy/proxmox/update.sh
nginx -t && systemctl reload nginx
```

`update.sh` scarica gli ultimi aggiornamenti, installa le dipendenze, fa la build e copia il risultato in
`/var/www/pocketly`. Ci vuole qualche minuto la prima volta. `nginx -t` deve rispondere
"test is successful".

Controllo dal container stesso:

```bash
curl -ksI https://localhost/ | head -1        # deve mostrare HTTP/1.1 200 OK
```

## 6. Installare la CA sui dispositivi (una sola volta per dispositivo)

Dal dispositivo apri **`http://IP-DEL-CONTAINER/ca.crt`**: nginx lo serve in HTTP apposta, perché
il certificato è pubblico (la chiave no). Proprio perché arriva in HTTP, qualcuno sulla stessa rete potrebbe
sostituirlo: **prima di installarlo confronta l'impronta SHA-256** che il dispositivo mostra nei dettagli del
certificato con quella del container (la stampa `make-cert.sh`; per rileggerla:
`openssl x509 -in /etc/nginx/ssl/ca.crt -noout -fingerprint -sha256`). Se non coincidono, non installarlo.

Installalo come certificato attendibile:

- **Windows:** apri il file → *Installa certificato* → archivio *Autorità di certificazione radice attendibili*.
  Firefox usa un archivio proprio: *Impostazioni → Certificati → Importa*.
- **Android:** *Impostazioni → Sicurezza → Crittografia e credenziali → Installa un certificato → Certificato CA*.
- **iPhone/iPad:** installa il profilo scaricato, poi abilitalo in *Impostazioni → Generali → Info →
  Attendibilità certificati*.

Poi apri **`https://IP-DEL-CONTAINER/`**: dal browser potrai anche installare l'app.

### Sostituire una vecchia CA (migrazione da `Pocketly locale CA` senza vincoli)

Se avevi installato una CA creata con una versione precedente di `make-cert.sh` (nome `Pocketly locale CA`, senza `nameConstraints` e con `ca.key` nel container), procedi in questo ordine:

1. **Fai prima un backup JSON** dei dati da *Impostazioni → Dati e backup* (sullo stesso IP i dati nel browser restano, ma il backup protegge da qualsiasi imprevisto).
2. Genera la nuova CA con `./make-cert.sh --new-ca IP-DEL-CONTAINER` (dal PC oppure nel container rimuovendo poi `/etc/nginx/ssl/ca.key`), aggiorna i 3 file in `/etc/nginx/ssl/` e ricarica nginx (`nginx -t && systemctl reload nginx`).
3. Su **ogni dispositivo**, rimuovi la vecchia CA (`Pocketly locale CA`):
   - **iPhone/iPad:** *Impostazioni → Generali → VPN e gestione dispositivi* → rimuovi il profilo `Pocketly locale CA`.
   - **Android:** *Impostazioni → Sicurezza → Crittografia e credenziali → Credenziali utente* → rimuovi `Pocketly locale CA`.
   - **Windows:** esegui `certmgr.msc` → *Autorità di certificazione radice attendibili → Certificati* → elimina `Pocketly locale CA` (in Firefox anche *Impostazioni → Certificati*).
4. Installa la nuova CA (`Pocketly CA (IP-DEL-CONTAINER)`) seguendo il punto 6 sopra e **confrontando l'impronta SHA-256** prima di confermare.
5. Verifica l'apertura di `https://IP-DEL-CONTAINER/` su iPhone, Android e PC.

## 7. Importare i dati

I dati restano nel browser di ogni dispositivo. Su ognuno importa il backup JSON dalle Impostazioni
dell'app.

## 8. Sincronizzazione tra dispositivi (facoltativa)

Senza questo passo ogni dispositivo ha i suoi dati. Con il server di sincronizzazione i dispositivi che aprono
Pocketly da `https://IP-DEL-CONTAINER/` restano allineati. I dati vengono cifrati sul dispositivo con una password
scelta da te prima di essere inviati: sul server finiscono solo dati cifrati.

```bash
cd /opt/pocketly && deploy/proxmox/install-sync.sh
```

Lo script crea l'utente `pocketly`, la cartella dati `/var/lib/pocketly` e la chiave del server, avvia il servizio
`pocketly-sync` e aggiorna nginx (la configurazione precedente resta in `/etc/nginx/sites-available/pocketly.bak`).
Alla fine **mostra la chiave del server**: copiala, serve su ogni dispositivo. Per rileggerla:
`cat /etc/pocketly/sync.env`.

**Per le notifiche push** serve anche un mittente reale: i servizi di notifica (Apple, Google, Mozilla) vogliono un
contatto, e Apple può rifiutare un indirizzo che non esiste. Passalo allo script (anche in un secondo momento,
rilanciandolo):

```bash
cd /opt/pocketly && POCKETLY_VAPID_SUBJECT=mailto:tuo.indirizzo@esempio.it deploy/proxmox/install-sync.sh
```

Lo script lo scrive in `/etc/pocketly/sync.env` e riavvia il servizio. Se manca, il server parte lo stesso ma
all'avvio scrive un avviso nel log (`journalctl -u pocketly-sync -n 20`).

Poi, su ogni dispositivo: *Impostazioni → Sincronizzazione → Collega questo dispositivo*, con la chiave del server e
la password dei dati (la stessa su tutti i dispositivi).

- Il **primo** dispositivo carica i suoi dati sul server.
- Gli altri, se non hanno dati, prendono quelli del server. Se hanno già dati propri, l'app chiede quali tenere:
  la scelta sovrascrive l'altra parte, perché due elenchi di spese inseriti separatamente non si possono unire.
- Da lì in poi le modifiche (anche le cancellazioni) passano da un dispositivo all'altro da sole: all'avvio, quando
  l'app torna in primo piano, pochi secondi dopo ogni modifica e ogni 20 secondi mentre l'app è aperta.

**Copie di sicurezza:** il server conserva le ultime 30 versioni in `/var/lib/pocketly/history/`. Ognuna è un
normale backup protetto: per recuperarla copiala su un dispositivo e usa *Importa backup* con la password dei dati.

**La password dei dati non si può recuperare.** Se la perdi, i dati sui dispositivi restano, ma quelli sul server
non si leggono più: scollega tutti i dispositivi, ferma il servizio, svuota `/var/lib/pocketly` e ricollega
partendo dal dispositivo con i dati giusti.

Su Vercel il server non c'è: lì la sincronizzazione non compare.

## Aggiornare l'app in seguito

```bash
cd /opt/pocketly && deploy/proxmox/update.sh
```

Non serve riavviare nginx: se `nginx/pocketly.conf` è cambiato, `update.sh` aggiorna `/etc/nginx/sites-available/pocketly` (la versione precedente resta come `.bak`) e ricarica nginx; se la nuova configurazione ha errori, rimette la precedente e lo scrive. Chi ha l'app aperta vede la richiesta di aggiornamento. Se il server di sincronizzazione è installato, `update.sh` lo riavvia con il codice nuovo (lancia `update.sh` come root per consentire l'allineamento di nginx e il riavvio del servizio).

## Se qualcosa non funziona

| Sintomo | Cosa controllare |
|---|---|
| `nginx -t` dà errore su `ssl_certificate` | Il certificato non è stato creato: rilancia `make-cert.sh` (punto 4) e controlla che esistano `/etc/nginx/ssl/pocketly.crt` e `pocketly.key`. |
| `nginx` non parte, "address already in use" | Qualcosa usa già le porte 80/443 nel container: `ss -tlnp \| grep -E ':80 \|:443 '`. |
| Si vede la pagina "Welcome to nginx" | Il sito `default` è ancora attivo: `rm -f /etc/nginx/sites-enabled/default && systemctl reload nginx`. |
| La build si interrompe con `Killed` | Poca memoria: porta il container a 2 GB di RAM (o aggiungi swap) e rilancia `update.sh`. |
| Il browser avvisa che la connessione non è privata | La CA non è installata su quel dispositivo (punto 6), oppure stai aprendo un indirizzo diverso dall'IP del certificato. |
| `git pull` o `update.sh` chiede credenziali | Repository privato: serve un token (punto 3). |
| In *Impostazioni* la sincronizzazione dice che funziona solo dall'indirizzo di casa | Il server non risponde: `systemctl status pocketly-sync` e `curl -ks https://localhost/api/health`. |
| La sincronizzazione dice "chiave del server non corretta" | Ricopia la chiave da `/etc/pocketly/sync.env` (senza `POCKETLY_SYNC_KEY=`). |
| Dopo un aggiornamento l'app mostra ancora la versione vecchia | Accetta la richiesta di aggiornamento dell'app («È disponibile un aggiornamento»), oppure usa «Verifica aggiornamenti» o «Ricarica dal server» nella scheda *Aggiornamenti* delle Impostazioni (oppure `Ctrl+F5` su browser desktop). |

## Da sapere

- **I dati sono legati all'indirizzo.** Cambiando IP il browser riparte da zero: usa il backup JSON dalle
  Impostazioni per spostarli (oppure la sincronizzazione, punto 8, dopo aver aperto il nuovo indirizzo).
- **Il certificato del sito dura 825 giorni** (massimo ammesso da Apple per CA locali; personalizzabile con `CERT_DAYS=398`). Per rinnovarlo senza toccare i dispositivi, rilancia `./make-cert.sh IP ./pocketly-certs` dal PC dove conservi `ca.crt` e `ca.key` (poi ricopia `pocketly.crt` e `pocketly.key` sul container e lancia `systemctl reload nginx`), oppure nel container passando temporaneamente `CA_KEY=/percorso/ca.key ./make-cert.sh IP` e rimuovendo subito la copia temporanea di `ca.key`. Se avevi scelto di eliminare `ca.key`, crea una nuova CA con `./make-cert.sh --new-ca IP` e reinstalla `ca.crt` sui dispositivi.
- **Se cambia l'IP:** la CA è vincolata al singolo IP tramite `nameConstraints`, quindi serve una **nuova CA** (`./make-cert.sh --new-ca NUOVO-IP`) da installare sui dispositivi (e i dati vanno portati sul nuovo indirizzo con backup o sincronizzazione).
- **Non lasciare mai `ca.key` sul container:** `ca.key` è cifrata con passphrase e non serve a nginx. Custodiscila solo offline (password manager o archivio cifrato) oppure eliminala dopo aver emesso `pocketly.crt`. Se `ca.key` manca in `/etc/nginx/ssl`, `make-cert.sh` si ferma per evitare di sovrascrivere accidentalmente `ca.crt`.

## Alternativa: pubblicare dal PC di sviluppo

Se preferisci non fare la build nel container (basta nginx e openssl, e non servono Node né git), dal PC con il
progetto, in Git Bash:

```bash
deploy/proxmox/publish.sh utente@IP-DEL-CONTAINER
```

Esegue la build in locale e carica `dist/` in `/var/www/pocketly`. L'utente SSH deve poter scrivere in `/var/www`
(`chown UTENTE /var/www` nel container). Il certificato e la configurazione di nginx (punti 4 e 6) vanno
comunque fatti nel container.
