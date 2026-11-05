#!/usr/bin/env bash
# Installa (o aggiorna) il server di sincronizzazione nel container. Da lanciare come root, una volta:
#   deploy/proxmox/install-sync.sh
#
# - crea l'utente di sistema `pocketly` e la cartella dati /var/lib/pocketly;
# - genera la chiave del server in /etc/pocketly/sync.env (solo la prima volta) e la mostra;
# - installa e avvia il servizio pocketly-sync;
# - aggiorna la configurazione di nginx con il blocco /api/ (la versione precedente resta come .bak).
#
# Rilanciarlo è sicuro: la chiave e i dati esistenti non vengono toccati.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Va lanciato come root." >&2
  exit 1
fi

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE=/etc/pocketly/sync.env
NGINX_SITE=/etc/nginx/sites-available/pocketly

command -v python3 >/dev/null || apt install -y python3

if ! id pocketly >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /var/lib/pocketly --shell /usr/sbin/nologin pocketly
fi

install -d -m 0750 -o root -g pocketly /etc/pocketly
if [ ! -f "$ENV_FILE" ]; then
  KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  umask 027
  printf 'POCKETLY_SYNC_KEY=%s\n' "$KEY" > "$ENV_FILE"
  chown root:pocketly "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  NEW_KEY=1
else
  KEY="$(sed -n 's/^POCKETLY_SYNC_KEY=//p' "$ENV_FILE")"
  NEW_KEY=0
fi

sed "s#@REPO@#$REPO#g" "$REPO/deploy/proxmox/pocketly-sync.service" > /etc/systemd/system/pocketly-sync.service
systemctl daemon-reload
systemctl enable pocketly-sync >/dev/null
systemctl restart pocketly-sync

if [ -f "$NGINX_SITE" ] && ! cmp -s "$REPO/deploy/proxmox/nginx/pocketly.conf" "$NGINX_SITE"; then
  cp "$NGINX_SITE" "$NGINX_SITE.bak"
  echo "Configurazione di nginx precedente salvata in $NGINX_SITE.bak"
fi
cp "$REPO/deploy/proxmox/nginx/pocketly.conf" "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/pocketly
nginx -t
systemctl reload nginx

# Controllo: il server risponde tramite nginx?
sleep 1
if curl -ksf https://localhost/api/health | grep -q pocketly-sync; then
  echo "Server di sincronizzazione attivo."
else
  echo "ATTENZIONE: il server non risponde. Controlla con: journalctl -u pocketly-sync -n 50" >&2
  exit 1
fi

echo
if [ "$NEW_KEY" -eq 1 ]; then
  echo "Chiave del server (inseriscila nelle Impostazioni dell'app su ogni dispositivo):"
else
  echo "Chiave del server (già esistente, non è cambiata):"
fi
echo
echo "    $KEY"
echo
echo "Per rileggerla in seguito: cat $ENV_FILE"
