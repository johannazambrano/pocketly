#!/usr/bin/env bash
# Da eseguire sul container: crea una piccola CA locale e un certificato valido per l'IP indicato.
#   ./make-cert.sh 192.168.1.50 [cartella, default /etc/nginx/ssl]
#
# Sui dispositivi si installa SOLO ca.crt (una volta). Quando il certificato del sito scade
# basta rigenerarlo con questo script: la CA esistente viene riusata e i dispositivi non vanno toccati.
set -euo pipefail

IP="${1:?uso: $0 IP-del-container [cartella]}"
DIR="${2:-/etc/nginx/ssl}"

mkdir -p "$DIR"
cd "$DIR"

if [ ! -f ca.key ]; then
  openssl req -x509 -newkey rsa:4096 -nodes -days 3650 \
    -keyout ca.key -out ca.crt -subj "/CN=Pocketly locale CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
  chmod 600 ca.key
fi

openssl req -newkey rsa:2048 -nodes -keyout pocketly.key -out pocketly.csr -subj "/CN=$IP"

cat > pocketly.ext <<EOF
subjectAltName=IP:$IP
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in pocketly.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -out pocketly.crt -extfile pocketly.ext

rm -f pocketly.csr pocketly.ext
chmod 600 pocketly.key

echo
echo "Certificato per $IP creato in $DIR (scade tra 825 giorni)."
echo "Da installare sui dispositivi come certificato attendibile: $DIR/ca.crt"
