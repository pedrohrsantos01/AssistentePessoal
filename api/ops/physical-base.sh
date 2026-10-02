#!/bin/sh
set -eu
umask 077
# Backup streams must never impersonate the continuous synchronous receiver.
PGAPPNAME=ritmo_base
export PGAPPNAME
[ "$#" -eq 1 ] || { echo 'usage: physical-base.sh NEW_BASE_DIRECTORY' >&2; exit 64; }
case "$1" in /*) ;; *) echo base_requires_absolute_path >&2; exit 1;; esac
case "$1" in *[!a-zA-Z0-9/._-]*) echo base_requires_safe_path >&2; exit 1;; esac
destination=$(realpath -m "$1")
case "$destination" in *[!a-zA-Z0-9/._-]*) echo base_requires_safe_path >&2; exit 1;; esac
set -- "$destination"
[ ! -e "$1" ] && [ ! -L "$1" ] && [ ! -e "$1.incomplete" ] && [ ! -L "$1.incomplete" ] || { echo base_destination_exists >&2; exit 1; }
: "${PGHOST:?PGHOST required}" "${PGUSER:?PGUSER required}" "${PGDATABASE:?PGDATABASE required}"
[ "$(psql --no-password --no-psqlrc -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_catalog.pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')")" = 0 ] || { echo base_tablespaces_unsupported >&2; exit 1; }
pg_basebackup --no-password --pgdata="$1.incomplete" --format=plain --wal-method=stream --checkpoint=fast --manifest-checksums=SHA256
pg_verifybackup "$1.incomplete"
mv "$1.incomplete" "$1"
sync -f "$1"
echo physical_base_verified
