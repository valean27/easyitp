#!/usr/bin/env bash
# Muta baza de date intr-un proiect Neon nou (ex. din US East in Europa / Frankfurt).
# Folosire (in terminalul tau, NU in chat, ca parolele sa nu ajunga nicaieri):
#   OLD_DB='postgresql://USER:PAROLA@ep-vechi....us-east-1.aws.neon.tech/neondb?sslmode=require' \
#   NEW_DB='postgresql://USER:PAROLA@ep-nou....eu-central-1.aws.neon.tech/neondb?sslmode=require' \
#   bash scripts/move-db.sh
# Ambele conexiuni DIRECTE (fara "-pooler"). Baza noua trebuie sa fie goala. Necesita Docker.
set -euo pipefail
: "${OLD_DB:?Lipseste OLD_DB}"
: "${NEW_DB:?Lipseste NEW_DB}"
# Versiunea Postgres a serverelor: copia se face cu aceeasi versiune de client (si baza noua trebuie sa aiba aceeasi
# versiune majora ca cea veche, aleasa la crearea proiectului Neon)
major() { docker run --rm -e DB="$1" postgres:17-alpine sh -c 'psql "$DB" -tAc "show server_version_num"' | cut -c1-2; }
OLD_V=$(major "$OLD_DB"); NEW_V=$(major "$NEW_DB")
echo "Postgres: vechi $OLD_V, nou $NEW_V"
[ "$OLD_V" = "$NEW_V" ] || { echo "Versiuni diferite: creeaza proiectul nou cu Postgres $OLD_V"; exit 1; }
IMG=postgres:$OLD_V-alpine
DUMP="easyitp-move-$(date +%Y%m%d-%H%M).dump"

TABLES="app_users clients vehicles itp_records appointments fleets audit_events reminder_sends invoices payments station_deadlines"
count() {
  local url="$1" out=""
  for t in $TABLES; do
    n=$(docker run --rm -e DB="$url" $IMG sh -c "psql \"\$DB\" -tAc 'select count(*) from $t'" 2>/dev/null || echo "-")
    out="$out $t=$n"
  done
  echo "$out"
}

echo "1/4 Copie din baza veche..."
docker run --rm -e DB="$OLD_DB" $IMG sh -c 'pg_dump "$DB" -Fc --no-owner --no-privileges' > "$DUMP"
ls -l "$DUMP"

echo "2/4 Restaurare in baza noua..."
docker run --rm -i -e DB="$NEW_DB" $IMG sh -c 'pg_restore --no-owner --no-privileges --exit-on-error -d "$DB"' < "$DUMP"

echo "3/4 Comparare randuri:"
OLD=$(count "$OLD_DB"); NEW=$(count "$NEW_DB")
echo "  vechi:$OLD"
echo "  nou:  $NEW"
[ "$OLD" = "$NEW" ] && echo "  OK: aceleasi cifre" || { echo "  ATENTIE: cifrele difera"; exit 1; }

echo "4/4 Gata. Copia $DUMP contine date reale: tine-o privat sau sterge-o dupa ce verifici aplicatia."
