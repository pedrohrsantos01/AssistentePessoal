#!/bin/sh
# PostgreSQL 18 client; connection and authentication come from libpq environment.
set -eu
umask 077
[ "$#" -eq 1 ] || { echo 'usage: backup.sh /private/path/name.dump' >&2; exit 64; }
: "${PGHOST:?PGHOST is required}" "${PGDATABASE:?PGDATABASE is required}" "${PGUSER:?PGUSER is required}"
archive=$1
[ ! -e "$archive" ] && [ ! -L "$archive" ] && [ ! -e "$archive.sha256" ] && [ ! -L "$archive.sha256" ] || { echo 'backup_destination_exists' >&2; exit 1; }
temporary=$(mktemp "$archive.partial.XXXXXX")
checksum=$(mktemp "$archive.sha256.partial.XXXXXX")
trap 'rm -f -- "$temporary" "$checksum"' EXIT HUP INT TERM
pg_dump --no-password --format=custom --file="$temporary"
# Archive metadata must be readable before publication; the full restore drill is separate.
pg_restore --list "$temporary" >/dev/null
hash=$(sha256sum "$temporary")
printf '%s\n' "${hash%% *}" >"$checksum"
# Same-directory hard links publish complete files atomically without overwriting an earlier backup.
ln -T -- "$temporary" "$archive"
ln -T -- "$checksum" "$archive.sha256"
echo 'backup_completed'
