---
source-files:
  - deploy/proxmox/README.md
  - deploy/proxmox/install-sync.sh
  - deploy/proxmox/update.sh
  - deploy/proxmox/publish.sh
  - deploy/proxmox/make-cert.sh
  - deploy/proxmox/pocketly-sync.service
  - deploy/proxmox/nginx/pocketly.conf
  - vite.config.ts
verified: 2026-11-10
---

# Architettura di Deploy e Infrastruttura

Questo documento illustra le modalità di pubblicazione di Pocketly, con particolare riferimento all'ambiente self-hosted raccomandato su Proxmox LXC e alla configurazione di sviluppo locale.

---

## 1. Architettura di Rete e Reverse Proxy

In produzione su server Linux (es. Debian in Proxmox LXC), Nginx funge da punto d'ingresso HTTPS unico per il frontend statico e per il server Python:

```mermaid
flowchart LR
    Client([Browser / PWA]) -- HTTPS:443 --> Nginx[Nginx Reverse Proxy]
    Nginx -- File statici --> Dist["/var/www/pocketly/ (dist/)"]
    Nginx -- proxy_pass /api/ --> Python["pocketly-sync.service (127.0.0.1:8787)"]
```

### Configurazione Nginx (`deploy/proxmox/nginx/pocketly.conf`)
- Terminazione TLS con certificato valido (Let's Encrypt o certificato interno CA creato con `make-cert.sh`).
- Caching aggressivo per gli asset con hash (`/assets/*`: `Cache-Control: public, max-age=31536000, immutable`).
- Nessun caching per il file del Service Worker e del manifest (`/sw.js`, `/manifest.webmanifest`: `Cache-Control: no-cache, no-store, must-revalidate`).
- Blocco `/api/`: inoltro a `http://127.0.0.1:8787` con header `X-Forwarded-For` e `Host` preservati.
- Limite dimensione body HTTP: `client_max_body_size 10M`.

---

## 2. Servizio Systemd (`pocketly-sync.service`)

Il backend Python viene eseguito come servizio di sistema non-root (`pocketly`):

```ini
[Unit]
Description=Pocketly sync server
After=network.target

[Service]
Type=simple
User=pocketly
Group=pocketly
EnvironmentFile=/etc/pocketly/sync.env
Environment=POCKETLY_HOST=127.0.0.1
Environment=POCKETLY_PORT=8787
Environment=POCKETLY_DATA_DIR=/var/lib/pocketly
ExecStart=/usr/bin/python3 /opt/pocketly/server/main.py
Restart=on-failure
RestartSec=5

# Isolamento di sicurezza del filesystem
StateDirectory=pocketly
StateDirectoryMode=0700
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true

[Install]
WantedBy=multi-user.target
```

---

## 3. Ambiente di Sviluppo Locale con Proxy Vite

Durante lo sviluppo locale, il frontend viene eseguito con Vite sulla porta 5173 e il server Python sulla porta predefinita 8787. In [`vite.config.ts`](../../vite.config.ts) è configurato il proxy di sviluppo:

```ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8787',
  },
}
```

Questo consente al frontend di effettuare chiamate a `/api/sync` e `/api/push/*` senza problemi di CORS (Cross-Origin Resource Sharing), simulando fedelmente l'ambiente di produzione.

---

## 4. Script di Installazione e Aggiornamento Proxmox

Nella cartella [`deploy/proxmox/`](../../deploy/proxmox/) sono presenti script pronti all'uso:
- `install-sync.sh`: installa Nginx, crea l'utente di sistema `pocketly`, configura directory con permessi restrittivi (`chmod 700 /var/lib/pocketly`), imposta il contatto VAPID (tramite la variabile `POCKETLY_VAPID_SUBJECT=mailto:...`) in `/etc/pocketly/sync.env`, installa la systemd unit e attiva Nginx.
- `publish.sh`: compila il frontend (`npm run build`), sincronizza i file in `/var/www/pocketly` e copia i moduli Python in `/opt/pocketly`.
- `update.sh`: automatizza il pull Git, la ricompilazione e il riavvio del servizio systemd sul server.
- `make-cert.sh`: genera un certificato TLS autofirmato o una CA locale per ambienti domestici sprovvisti di dominio pubblico.

La guida passo passo completa per Proxmox LXC è disponibile in [deploy/proxmox/README.md](../../deploy/proxmox/README.md).
