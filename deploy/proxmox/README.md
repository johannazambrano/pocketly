# Pubblicare Pocketly su un nodo Proxmox (rete locale, HTTPS sull'IP)

Pocketly è un sito statico: sul container serve solo nginx. Il codice è lo stesso che si pubblica su
Vercel o Netlify, qui cambia soltanto dove e come si serve.

**Perché HTTPS:** il service worker (installazione come app, uso offline) e la persistenza dei dati
funzionano solo in un contesto sicuro. Senza dominio si usa un certificato emesso da una piccola CA
locale per l'IP del container.

| File | A cosa serve |
|---|---|
| `nginx/pocketly.conf` | Configurazione del sito (HTTPS, redirect da HTTP, fallback per le rotte, cache). |
| `make-cert.sh` | Crea la CA locale e il certificato per l'IP del container. |
| `publish.sh` | Esegue la build e carica `dist/` sul container. |

## 1. Preparare il container

Container LXC Debian/Ubuntu con **IP fisso** (prenotazione DHCP o statico: il certificato è legato all'IP).

```bash
apt update && apt install -y nginx openssl
mkdir -p /var/www/pocketly
# L'utente SSH usato da publish.sh deve poter scrivere in /var/www:
chown UTENTE /var/www
```

## 2. Certificato e nginx

Copia sul container `make-cert.sh` e `nginx/pocketly.conf`, poi:

```bash
chmod +x make-cert.sh && ./make-cert.sh 192.168.1.50      # il tuo IP
cp pocketly.conf /etc/nginx/sites-available/pocketly
ln -s /etc/nginx/sites-available/pocketly /etc/nginx/sites-enabled/pocketly
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 3. Installare la CA sui dispositivi (una sola volta)

Scarica `/etc/nginx/ssl/ca.crt` dal container e installalo come certificato attendibile:

- **Windows:** doppio clic → *Installa certificato* → archivio *Autorità di certificazione radice attendibili*.
  Firefox usa un archivio proprio: *Impostazioni → Certificati → Importa*.
- **Android:** *Impostazioni → Sicurezza → Crittografia e credenziali → Installa un certificato → Certificato CA*.
- **iPhone/iPad:** apri il file e installa il profilo, poi abilitalo in *Impostazioni → Generali → Info →
  Attendibilità certificati*.

Poi apri `https://IP-DEL-CONTAINER/` dal dispositivo.

## 4. Pubblicare e aggiornare

Dal tuo PC (Git Bash), nella cartella del progetto:

```bash
deploy/proxmox/publish.sh utente@192.168.1.50
```

Esegue `npm run build` e sostituisce il contenuto di `/var/www/pocketly`. Non serve riavviare nginx.
Chi ha l'app aperta vede la richiesta di aggiornamento (`UpdatePrompt`).

## Da sapere

- **I dati restano nel browser di ogni dispositivo** e sono legati all'indirizzo: cambiando IP il browser
  riparte da zero. Per spostare i dati usa il backup JSON dalle Impostazioni.
- **Il certificato del sito dura 825 giorni.** Per rinnovarlo rilancia `./make-cert.sh IP` e
  `systemctl reload nginx`: la CA viene riusata, quindi i dispositivi non vanno toccati.
- **Se cambia l'IP** rigenera il certificato con quello nuovo (la CA resta valida).
- **Proteggi `ca.key`:** chi la possiede può emettere certificati accettati dai tuoi dispositivi.
  Non deve uscire dal container (lo script la crea con permessi `600`).
- Se lanci `make-cert.sh` da Git Bash su Windows invece che sul container, imposta prima
  `MSYS_NO_PATHCONV=1`, altrimenti `-subj "/CN=..."` viene scambiato per un percorso.
