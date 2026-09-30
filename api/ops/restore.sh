#!/bin/sh
# Restore only into an isolated empty database whose runtime roles were provisioned separately.
set -eu
[ "$#" -eq 1 ] || { echo 'usage: restore.sh /private/path/name.dump' >&2; exit 64; }
: "${PGHOST:?PGHOST is required}" "${PGDATABASE:?PGDATABASE is required}" "${PGUSER:?PGUSER is required}"
archive=$1
[ -f "$archive" ] && [ -f "$archive.sha256" ] || { echo 'backup_pair_missing' >&2; exit 1; }
IFS= read -r expected <"$archive.sha256"
[ "${#expected}" -eq 64 ] || { echo 'backup_checksum_invalid' >&2; exit 1; }
case "$expected" in *[!0-9a-f]*) echo 'backup_checksum_invalid' >&2; exit 1;; esac
actual=$(sha256sum "$archive")
[ "${actual%% *}" = "$expected" ] || { echo 'backup_checksum_mismatch' >&2; exit 1; }
pg_restore --list "$archive" >/dev/null
# Catalog checks are operational metadata; no tenant data is inspected.
occupied=$(psql --no-password --no-psqlrc -v ON_ERROR_STOP=1 -At -c "
SELECT EXISTS(SELECT FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_')
 OR EXISTS(SELECT FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
 OR EXISTS(SELECT FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
 OR EXISTS(SELECT FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public')
 OR EXISTS(SELECT FROM pg_catalog.pg_extension WHERE extname<>'plpgsql');")
[ "$occupied" = 'f' ] || { echo 'restore_requires_empty_database' >&2; exit 1; }
# Preserve ACLs/RLS and Flyway history; the restoring migration owner owns the recovered objects.
pg_restore --no-password --dbname="$PGDATABASE" --no-owner --exit-on-error --single-transaction "$archive"
echo 'restore_completed'
