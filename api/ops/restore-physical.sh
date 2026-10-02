#!/bin/sh
set -eu
umask 077
[ "$#" -eq 5 ] || { echo 'usage: restore-physical.sh BASE WAL NEW_PGDATA TARGET_LSN TIMELINE' >&2; exit 64; }
[ "${RITMO_RECOVERY_QUARANTINE:-}" = true ] || { echo recovery_requires_quarantine >&2; exit 1; }
for path in "$1" "$2" "$3"; do
    case "$path" in /*) ;; *) echo recovery_requires_absolute_paths >&2; exit 1;; esac
    case "$path" in *[!a-zA-Z0-9/._-]*) echo recovery_requires_safe_paths >&2; exit 1;; esac
done
printf '%s\n' "$4" | LC_ALL=C grep -Eq '^[0-9A-F]{1,8}/[0-9A-F]{1,8}$' || { echo recovery_requires_target_lsn >&2; exit 1; }
printf '%s\n' "$5" | LC_ALL=C grep -Eq '^[1-9][0-9]{0,9}$' || { echo recovery_requires_timeline >&2; exit 1; }
[ -d "$1" ] && [ -d "$2" ] || { echo recovery_requires_base_and_wal >&2; exit 1; }
[ ! -e "$3" ] && [ ! -L "$3" ] || { echo recovery_destination_exists >&2; exit 1; }
[ -d "$1/pg_tblspc" ] && [ -z "$(ls -A "$1/pg_tblspc")" ] || { echo recovery_tablespaces_unsupported >&2; exit 1; }
base=$(realpath "$1")
wal=$(realpath "$2")
destination=$(realpath -m "$3")
for path in "$base" "$wal" "$destination"; do
    case "$path" in *[!a-zA-Z0-9/._-]*) echo recovery_requires_safe_paths >&2; exit 1;; esac
done
case "$destination" in "$base"/*|"$wal"/*) echo recovery_requires_separate_destination >&2; exit 1;; esac
set -- "$base" "$wal" "$destination" "$4" "$5"
pg_verifybackup "$1"
mkdir -m 700 "$3"
cp -R "$1/." "$3/"
cat >> "$3/postgresql.auto.conf" <<EOF
# Isolated reconstruction only: API must remain quarantined.
synchronous_standby_names = ''
restore_command = 'cp $2/%f %p || cp $2/%f.partial %p'
recovery_target_lsn = '$4'
recovery_target_timeline = '$5'
recovery_target_inclusive = on
recovery_target_action = pause
EOF
: > "$3/recovery.signal"
echo recovery_prepared_quarantined
