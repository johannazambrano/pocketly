#!/usr/bin/env bash
# Da eseguire nel container, dentro la copia del repository: scarica gli aggiornamenti,
# fa la build e sostituisce il sito servito da nginx.
#   deploy/proxmox/update.sh [/var/www/pocketly]
#
# La sostituzione avviene con uno scambio di cartelle, così il sito non resta mai a metà.
set -euo pipefail

DEST="${1:-/var/www/pocketly}"

cd "$(dirname "$0")/../.."

git pull --ff-only
npm ci
npm run build

rm -rf "$DEST.new" "$DEST.old"
mkdir -p "$DEST.new"
cp -a dist/. "$DEST.new"/
if [ -d "$DEST" ]; then mv "$DEST" "$DEST.old"; fi
mv "$DEST.new" "$DEST"
rm -rf "$DEST.old"

echo "Pubblicato in $DEST"

# Se la configurazione di nginx nel repository è cambiata, la copia (tenendo la precedente in .bak)
# e ricarica nginx. Se la nuova non passa `nginx -t` rimette la precedente: nginx resta com'era.
NGINX_CONF="/etc/nginx/sites-available/pocketly"
if [ -f "$NGINX_CONF" ] && ! cmp -s deploy/proxmox/nginx/pocketly.conf "$NGINX_CONF"; then
  if cp "$NGINX_CONF" "$NGINX_CONF.bak" 2>/dev/null && cp deploy/proxmox/nginx/pocketly.conf "$NGINX_CONF"; then
    if nginx -t; then
      systemctl reload nginx || echo "ATTENZIONE: ricarica di nginx non riuscita." >&2
      echo "Configurazione di nginx aggiornata e ricaricata (la precedente è in $NGINX_CONF.bak)."
    else
      cp "$NGINX_CONF.bak" "$NGINX_CONF"
      echo "ATTENZIONE: la nuova configurazione di nginx ha errori (vedi sopra): rimessa la precedente." >&2
    fi
  else
    echo "ATTENZIONE: non posso aggiornare $NGINX_CONF: lancia update.sh come root." >&2
  fi
fi

# Se il server di sincronizzazione è installato (install-sync.sh), lo riavvia con il codice nuovo.
if systemctl is-enabled --quiet pocketly-sync 2>/dev/null; then
  if systemctl restart pocketly-sync; then
    echo "Server di sincronizzazione riavviato"
  else
    echo "ATTENZIONE: riavvio del server di sincronizzazione non riuscito (serve root?)" >&2
  fi
fi
