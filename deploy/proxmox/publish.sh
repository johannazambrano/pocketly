#!/usr/bin/env bash
# Esegue la build e carica dist/ sul container (da lanciare sul tuo PC, ad esempio da Git Bash).
#   deploy/proxmox/publish.sh utente@192.168.1.50 [/var/www/pocketly]
#
# L'utente SSH deve poter scrivere nella cartella di destinazione (e nel suo livello superiore).
# La sostituzione avviene con uno scambio di cartelle, così il sito non resta mai a metà.
set -euo pipefail

TARGET="${1:?uso: $0 utente@host [cartella-di-destinazione]}"
DEST="${2:-/var/www/pocketly}"

cd "$(dirname "$0")/../.."
npm run build

tar -C dist -cf - . | ssh "$TARGET" "set -e
  rm -rf '$DEST.new' '$DEST.old'
  mkdir -p '$DEST.new'
  tar -C '$DEST.new' -xf -
  if [ -d '$DEST' ]; then mv '$DEST' '$DEST.old'; fi
  mv '$DEST.new' '$DEST'
  rm -rf '$DEST.old'"

echo "Pubblicato su $TARGET:$DEST"
