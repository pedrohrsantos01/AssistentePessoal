#!/bin/sh
# Administrative preparation only, after verified recovery with all writers stopped.
set -eu
[ "$#" -eq 0 ] || { echo 'usage: prepare-recovery.sh' >&2; exit 64; }
[ "${RITMO_RECOVERY_QUARANTINE:-}" = true ] || { echo 'recovery_requires_quarantine' >&2; exit 1; }
[ "${RITMO_RECOVERY_VERIFIED:-}" = true ] || { echo 'recovery_requires_verified_restore' >&2; exit 1; }
: "${PGHOST:?PGHOST is required}" "${PGDATABASE:?PGDATABASE is required}" "${PGUSER:?PGUSER is required}"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
psql --no-password --no-psqlrc --quiet -v ON_ERROR_STOP=1 --single-transaction -f "$script_dir/prepare-recovery.sql"
echo 'recovery_credentials_prepared'
