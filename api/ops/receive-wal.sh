#!/bin/sh
set -eu
umask 077
[ "$#" -eq 1 ] || { echo 'usage: receive-wal.sh WAL_DIRECTORY' >&2; exit 64; }
[ "${PGUSER:-}" = ritmo_wal_receiver ] || { echo wal_requires_replication_identity >&2; exit 1; }
[ "${PGAPPNAME:-}" = ritmo_wal ] || { echo wal_requires_receiver_name >&2; exit 1; }
: "${PGHOST:?PGHOST required}"
[ -d "$1" ] && [ -w "$1" ] || { echo wal_requires_writable_directory >&2; exit 1; }
exec pg_receivewal --no-password --synchronous --slot=ritmo_wal --status-interval=1 --directory="$1"
