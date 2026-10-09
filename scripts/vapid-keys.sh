#!/usr/bin/env bash
# Genereaza cheile VAPID pentru notificarile push (P-256, base64url), de pus in Render:
#   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (si optional VAPID_SUBJECT=mailto:contact@easyitp.ro)
# Se genereaza o singura data: daca se schimba, abonamentele existente nu mai primesc nimic (trebuie pornite din nou).
set -euo pipefail

pem="$(mktemp)"
trap 'rm -f "$pem"' EXIT
openssl ecparam -name prime256v1 -genkey -noout -out "$pem" 2>/dev/null

b64url() { base64 | tr -d '\n=' | tr '+/' '-_'; }

# cheia privata: scalarul de 32 de octeti din structura SEC1 (dupa antetul de 7 octeti)
private_key="$(openssl ec -in "$pem" -outform DER 2>/dev/null | tail -c +8 | head -c 32 | b64url)"
# cheia publica: punctul necomprimat (65 de octeti) de la finalul SubjectPublicKeyInfo
public_key="$(openssl ec -in "$pem" -pubout -outform DER 2>/dev/null | tail -c 65 | b64url)"

echo "VAPID_PUBLIC_KEY=$public_key"
echo "VAPID_PRIVATE_KEY=$private_key"
