#!/usr/bin/env bash
# Crea una CA locale vincolata a un singolo IP e un certificato TLS per Pocketly (rete domestica senza dominio).
#
# Modalità consigliata (eseguire sul proprio PC di fiducia, così ca.key non tocca mai il container):
#   ./make-cert.sh 192.168.1.50 ./pocketly-certs
#   # Poi copiare sul container SOLO ca.crt, pocketly.crt e pocketly.key in /etc/nginx/ssl/
#
# Modalità alternativa (eseguire sul container e spostare subito ca.key fuori dal container):
#   ./make-cert.sh 192.168.1.50
#
# Rinnovo del certificato del sito con CA esistente (ca.key custodita fuori dal container):
#   CA_KEY=/percorso/ca.key ./make-cert.sh 192.168.1.50 [/etc/nginx/ssl]
#
# Sostituzione con una nuova CA (es. migrazione da vecchia CA senza vincoli o cambio IP):
#   ./make-cert.sh --new-ca 192.168.1.50 [cartella]
#
# Variabili opzionali:
#   CA_KEY      Percorso della chiave privata della CA (default: <cartella>/ca.key)
#   CERT_DAYS   Durata del certificato del sito in giorni, 1..825 (default: 825, limite Apple per CA locali)
#
# Sui dispositivi si installa SOLO ca.crt (verificandone l'impronta SHA-256).
set -euo pipefail

usage() {
  cat <<EOF
Uso: $0 [--new-ca] <IP-del-container> [cartella]

Opzioni:
  --new-ca     Crea una nuova CA anche se ca.crt esiste già nella cartella
  -h, --help   Mostra questo aiuto

Variabili d'ambiente opzionali:
  CA_KEY       Percorso di ca.key (default: <cartella>/ca.key)
  CERT_DAYS    Durata del certificato server in giorni, 1..825 (default: 825)
EOF
}

NEW_CA=0
POSITIONAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --new-ca)
      NEW_CA=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do POSITIONAL+=("$1"); shift; done
      ;;
    -*)
      echo "Opzione non riconosciuta: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [ ${#POSITIONAL[@]} -lt 1 ] || [ ${#POSITIONAL[@]} -gt 2 ]; then
  usage >&2
  exit 1
fi

IP="${POSITIONAL[0]}"
DIR="${POSITIONAL[1]:-/etc/nginx/ssl}"
CERT_DAYS="${CERT_DAYS:-825}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "Errore: openssl non trovato. Installalo prima di eseguire questo script." >&2
  exit 1
fi

# Valida CERT_DAYS (Apple impone massimo 825 giorni per certificati emessi da CA locali).
if ! [[ "$CERT_DAYS" =~ ^[0-9]+$ ]] || [ "$CERT_DAYS" -lt 1 ] || [ "$CERT_DAYS" -gt 825 ]; then
  echo "Errore: CERT_DAYS deve essere un intero tra 1 e 825 (ricevuto: $CERT_DAYS)." >&2
  exit 1
fi

# Valida l'indirizzo IP (IPv4 o IPv6) e prepara i vincoli Name Constraints (RFC 5280 / CA/B Forum §7.1.5).
validate_ipv4() {
  local ip="$1"
  [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  local IFS='.'
  local octets=($ip)
  for o in "${octets[@]}"; do
    if [ "${#o}" -gt 1 ] && [[ "$o" == 0* ]]; then return 1; fi
    if [ "$o" -gt 255 ]; then return 1; fi
  done
  return 0
}

validate_ipv6() {
  local ip="$1"
  [[ "$ip" == *:* ]] || return 1
  [[ "$ip" =~ ^[0-9a-fA-F:]+$ ]] || return 1
  # Evita più di una sequenza "::"
  local without_first="${ip/::/}"
  [[ "$without_first" != *::* ]] || return 1
  return 0
}

if validate_ipv4 "$IP"; then
  PERMITTED_IP="$IP/255.255.255.255"
  EXCLUDED_OTHER_IP="::/::"
elif validate_ipv6 "$IP"; then
  PERMITTED_IP="$IP/ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"
  EXCLUDED_OTHER_IP="0.0.0.0/0.0.0.0"
else
  echo "Errore: '$IP' non è un indirizzo IPv4 o IPv6 valido." >&2
  echo "Questo script crea una CA vincolata a un singolo IP (es. 192.168.1.50)." >&2
  exit 1
fi

mkdir -p "$DIR"
CA_CRT="$DIR/ca.crt"
CA_KEY_PATH="${CA_KEY:-$DIR/ca.key}"
mkdir -p "$(dirname "$CA_KEY_PATH")"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
chmod 700 "$TMPDIR"

NEW_CA_CREATED=0

if [ "$NEW_CA" -eq 1 ] || [ ! -f "$CA_CRT" ]; then
  if [ "$NEW_CA" -eq 0 ] && [ ! -f "$CA_CRT" ] && [ -f "$CA_KEY_PATH" ]; then
    echo "Errore: esiste già $CA_KEY_PATH ma manca $CA_CRT." >&2
    echo "Per evitare di sovrascrivere una chiave CA esistente, usa --new-ca se vuoi creare una nuova CA." >&2
    exit 1
  fi

  cat > "$TMPDIR/ca.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
O = Pocketly
CN = Pocketly CA ($IP)

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
nameConstraints = critical, @nc_sect

[nc_sect]
permitted;IP.0 = $PERMITTED_IP
excluded;IP.0 = $EXCLUDED_OTHER_IP
excluded;DNS.0 = ""
EOF

  echo "Creazione nuova CA locale (ECDSA P-384) vincolata al solo IP $IP."
  echo "Imposta una passphrase robusta per proteggere la chiave privata della CA ($CA_KEY_PATH):"
  (
    umask 077
    openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:secp384r1 -sha384 -days 3650 \
      -config "$TMPDIR/ca.cnf" -keyout "$TMPDIR/ca.key" -out "$TMPDIR/ca.crt"
  )
  SIGNING_CA_CRT="$TMPDIR/ca.crt"
  SIGNING_CA_KEY="$TMPDIR/ca.key"
  NEW_CA_CREATED=1
else
  if [ ! -f "$CA_KEY_PATH" ]; then
    echo "Errore: $CA_CRT esiste già, ma la chiave privata della CA non è presente in $CA_KEY_PATH." >&2
    echo "(È normale se hai spostato ca.key fuori dal container come consigliato.)" >&2
    echo >&2
    echo "Scegli una delle due opzioni:" >&2
    echo "  1. Per rinnovare il certificato con la CA esistente, indica il percorso di ca.key:" >&2
    echo "       CA_KEY=/percorso/temporaneo/ca.key $0 $IP $DIR" >&2
    echo "  2. Per creare una nuova CA (es. migrazione o cambio IP), lancia con --new-ca:" >&2
    echo "       $0 --new-ca $IP $DIR" >&2
    exit 1
  fi

  if ! openssl x509 -in "$CA_CRT" -noout -text | grep -q "X509v3 Name Constraints"; then
    echo "ATTENZIONE: la CA esistente in $CA_CRT non ha vincoli Name Constraints (vecchia versione)." >&2
    echo "Per sostituirla con una CA vincolata al solo IP $IP, rilancia con: $0 --new-ca $IP $DIR" >&2
  fi

  SIGNING_CA_CRT="$CA_CRT"
  SIGNING_CA_KEY="$CA_KEY_PATH"
fi

# Chiave e richiesta del certificato server (ECDSA P-256, senza passphrase per permettere il riavvio automatico di nginx).
# Il Subject non usa un CN con IP o hostname: i browser moderni leggono solo SAN (subjectAltName=IP:...) e l'assenza
# del CN evita che verificatori rigorosi lo confrontino con il blocco excluded;DNS:"".
(
  umask 077
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
    -keyout "$TMPDIR/pocketly.key" -out "$TMPDIR/pocketly.csr" -subj "/O=Pocketly"
)

cat > "$TMPDIR/pocketly.ext" <<EOF
subjectAltName = IP:$IP
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF

echo
echo "Firma del certificato server per $IP (inserisci la passphrase di ca.key se richiesta):"
openssl x509 -req -in "$TMPDIR/pocketly.csr" \
  -CA "$SIGNING_CA_CRT" -CAkey "$SIGNING_CA_KEY" \
  -rand_serial -sha256 -days "$CERT_DAYS" \
  -out "$TMPDIR/pocketly.crt" -extfile "$TMPDIR/pocketly.ext"

# Verifica rigorosa prima di sostituire i file esistenti (intercetta anche eventuali cambi IP su una CA vincolata).
if ! openssl verify -x509_strict -CAfile "$SIGNING_CA_CRT" -purpose sslserver "$TMPDIR/pocketly.crt" >/dev/null 2>&1; then
  echo "Errore: il certificato generato per $IP non supera la verifica rispetto a $SIGNING_CA_CRT." >&2
  openssl verify -x509_strict -CAfile "$SIGNING_CA_CRT" -purpose sslserver "$TMPDIR/pocketly.crt" >&2 || true
  echo "Se l'IP del container è cambiato, la CA vincolata al vecchio IP non può firmarlo: crea una nuova CA con --new-ca." >&2
  exit 1
fi

# Installazione atomica solo dopo verifica superata.
if [ "$NEW_CA_CREATED" -eq 1 ]; then
  (
    umask 077
    mv "$TMPDIR/ca.key" "$CA_KEY_PATH"
    chmod 600 "$CA_KEY_PATH"
  )
  mv "$TMPDIR/ca.crt" "$CA_CRT"
  chmod 644 "$CA_CRT"
  rm -f "$DIR/ca.srl"
fi

(
  umask 077
  mv "$TMPDIR/pocketly.key" "$DIR/pocketly.key"
  chmod 600 "$DIR/pocketly.key"
)
mv "$TMPDIR/pocketly.crt" "$DIR/pocketly.crt"
chmod 644 "$DIR/pocketly.crt"

EXPIRY="$(openssl x509 -in "$DIR/pocketly.crt" -noout -enddate | sed 's/^notAfter=//')"
FINGERPRINT="$(openssl x509 -in "$CA_CRT" -noout -fingerprint -sha256 | sed 's/^.*=//')"

echo
echo "Certificato per $IP creato e verificato in $DIR (valido $CERT_DAYS giorni, scade: $EXPIRY)."
echo "File necessari sul container in /etc/nginx/ssl/:"
echo "    $CA_CRT"
echo "    $DIR/pocketly.crt"
echo "    $DIR/pocketly.key"
echo
# ca.crt si scarica in HTTP (PKT-14): prima di dargli fiducia, sul dispositivo si confronta questa impronta con quella
# che il telefono o il PC mostrano nei dettagli del certificato.
echo "Impronta SHA-256 della CA (da confrontare sul dispositivo prima di installarla):"
echo "    $FINGERPRINT"
echo
echo "IMPORTANTE — Sicurezza della chiave CA ($CA_KEY_PATH):"
echo "  ca.key NON serve a nginx e NON deve restare sul container."
echo "  - Se hai eseguito lo script sul tuo PC: copia sul container solo ca.crt, pocketly.crt e pocketly.key,"
echo "    conserva ca.key (+ passphrase) in un password manager o supporto cifrato offline e cancella pocketly.key dal PC."
echo "  - Se hai eseguito lo script sul container: sposta ca.key fuori dal container ed eliminala con:"
echo "      rm -f \"$CA_KEY_PATH\""
echo "  - In alternativa, se non vuoi custodire ca.key puoi eliminarla del tutto (tra $CERT_DAYS giorni basterà creare una nuova CA)."
