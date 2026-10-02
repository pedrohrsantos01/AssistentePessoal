#!/bin/sh
# PG18 native validation of a stopped independent archive; never query the primary.
set -eu
umask 077
export LC_ALL=C PG_COLOR=never
[ "$#" -ge 2 ] && [ "$#" -le 3 ] || { echo usage_select_base_wal >&2; exit 64; }
mode=${3:-target}
case "$mode" in target) [ "${RITMO_WAL_FROZEN:-}" = true ] || { echo wal_requires_verified_stop >&2; exit 1; };; closed) ;; *) exit 64;; esac
for path in "$1" "$2"; do
    case "$path" in /*) ;; *) exit 64;; esac
    case "$path" in *[!a-zA-Z0-9/._-]*) exit 64;; esac
    [ -d "$path" ] && [ ! -L "$path" ] || exit 1
    [ -z "$(find "$path" -type l -print -quit)" ] || { echo symlink_refused >&2; exit 1; }
done
base=$(realpath "$1"); wal=$(realpath "$2")
pg_verifybackup "$base" >/dev/null
[ "$(grep -o '"Start-LSN"' "$base/backup_manifest" | wc -l)" -eq 1 ] || { echo unsupported_base_ranges >&2; exit 1; }
start=$(sed -n 's/.*"Start-LSN"[[:space:]]*:[[:space:]]*"\([0-9A-F/]\{3,17\}\)".*/\1/p' "$base/backup_manifest")
timeline=$(sed -n 's/.*"Timeline"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$base/backup_manifest")
control=$(pg_controldata "$base")
system=$(printf '%s\n' "$control" | sed -n 's/^Database system identifier:[[:space:]]*//p')
[ "$(printf '%s\n' "$control" | sed -n 's/^Bytes per WAL segment:[[:space:]]*//p')" = 16777216 ] || { echo unsupported_segment_size >&2; exit 1; }
work=$(mktemp -d "$wal/.inspect.XXXXXX")
trap 'rm -rf -- "$work"' EXIT HUP INT TERM
mkdir "$work/wal"
for source in "$wal"/*; do
    name=${source##*/}
    printf '%s\n' "$name" | grep -Eq '^[0-9A-F]{24}(\.partial)?$' && printf '%s\n' "${name%.partial}" >> "$work/all-names" || true
done
[ -s "$work/all-names" ] || { echo wal_required >&2; exit 1; }
tip=$(sort "$work/all-names" | tail -1)
latest=$((0x$(printf '%s' "$tip" | cut -c1-8)))
latest_prefix=$(printf '%s' "$tip" | cut -c1-8)
# Closed files are immutable; target mode additionally requires a stopped receiver.
for source in "$wal"/*; do
    [ -f "$source" ] || { echo invalid_wal_file >&2; exit 1; }
    name=${source##*/}
    case "$name" in
        *.history) printf '%s\n' "$name" | grep -Eq '^[0-9A-F]{8}\.history$' || exit 1; cp "$source" "$work/wal/$name";;
        *) printf '%s\n' "$name" | grep -Eq '^[0-9A-F]{24}(\.partial)?$' || exit 1
           case "$name" in *.partial)
               # Historical partials are immutable after a fork; the current partial may still be changing.
               if [ "$mode" = closed ] && [ "$(printf '%s' "$name" | cut -c1-8)" = "$latest_prefix" ]; then continue; fi;; esac
           [ "$(wc -c < "$source")" -eq 16777216 ] || { echo invalid_segment_size >&2; exit 1; }
           [ "$(od -An -tu8 -j24 -N8 "$source" | tr -d ' ')" = "$system" ] || { echo wal_cluster_mismatch >&2; exit 1; }
           [ "$(od -An -tu4 -j32 -N4 "$source" | tr -d ' ')" = 16777216 ] || exit 1
           normalized=${name%.partial}
           [ ! -e "$work/wal/$normalized" ] || { echo duplicate_segment >&2; exit 1; }
           # Private inspection copy; never rename the authoritative .partial.
           ln "$source" "$work/wal/$normalized"
           printf '%s\n' "$normalized" >> "$work/names";;
    esac
done
[ -s "$work/names" ] || { echo wal_required >&2; exit 1; }
[ -f "$wal/$tip.partial" ] || { echo latest_partial_required >&2; exit 1; }
if [ "$mode" = target ]; then
    [ -f "$wal/$tip.partial" ] || { echo latest_partial_required >&2; exit 1; }
    [ "$(find "$wal" -maxdepth 1 -name "$(printf '%s' "$tip" | cut -c1-8)*.partial" | wc -l)" -eq 1 ] || { echo ambiguous_tail >&2; exit 1; }
fi
[ "$latest" -ge "$timeline" ] || { echo timeline_before_base >&2; exit 1; }
if [ "$latest" -gt "$timeline" ]; then
    history=$(printf '%08X.history' "$latest")
    [ -f "$work/wal/$history" ] || { echo history_required >&2; exit 1; }
    awk -v base="$timeline" -v start="$start" -v latest="$latest" '
      BEGIN { cursor=start; found=0; previous=0 }
      /^[[:space:]]*#/ || NF==0 { next }
      { if ($1 !~ /^[0-9]+$/ || $2 !~ /^[0-9A-F]+\/[0-9A-F]+$/ || $1<=previous || $1>=latest) exit 1;
        previous=$1; if ($1==base) found=1;
        if(found) { print $1,cursor,$2; cursor=$2 } }
      END { if(!found) exit 1; print latest,cursor,"tip" }' "$work/wal/$history" > "$work/ranges" || { echo invalid_history >&2; exit 1; }
else printf '%s %s tip\n' "$timeline" "$start" > "$work/ranges"; fi
while read -r branch from to; do
    if [ "$to" != tip ]; then
        pg_waldump -q -p "$work/wal" -t "$branch" -s "$from" -e "$to" || { echo parent_chain_invalid >&2; exit 1; }
    elif [ "$mode" = closed ]; then
        # Validate only through the last closed segment. Mutable cauda is preserved untouched.
        closed_tip=$(grep "^$latest_prefix" "$work/names" | sort | tail -1 || true)
        [ -n "$closed_tip" ] || continue
        log=$((0x$(printf '%s' "$closed_tip" | cut -c9-16)))
        seg=$((0x$(printf '%s' "$closed_tip" | cut -c17-24)))
        if [ "$seg" -eq 255 ]; then end=$(printf '%X/0' $((log+1))); else end=$(printf '%X/%X' "$log" $(((seg+1)*16777216))); fi
        pg_waldump -q -p "$work/wal" -t "$branch" -s "$from" -e "$end" || { echo closed_chain_invalid >&2; exit 1; }
    else
        (set +e; pg_waldump -p "$work/wal" -t "$branch" -s "$from" 2>"$work/error"; printf '%s\n' "$?" > "$work/exit") |
            awk '/^rmgr:/ { for(i=1;i<=NF;i++) if($i=="lsn:") { last=$(i+1); sub(/,$/,"",last) } } END {print last}' > "$work/last"
        # Native parser verifies each record CRC. Only a zero-padded end is normal.
        [ "$(cat "$work/exit")" -eq 1 ] || { echo unexpected_wal_end >&2; exit 1; }
        [ "$(wc -l < "$work/error")" -eq 1 ] || { echo wal_inspection_failed >&2; exit 1; }
        zero=$(sed -n 's/.*invalid record length at \([0-9A-F/]\{3,17\}\): expected at least 24, got 0$/\1/p' "$work/error")
        [ -n "$zero" ] && [ -s "$work/last" ] && [ -n "$(cat "$work/last")" ] || { echo nonempty_or_corrupt_tail >&2; cat "$work/error" >&2; exit 1; }
        high=$((0x${zero%/*})); low=$((0x${zero#*/}))
        expected=$(printf '%08X%08X%08X' "$branch" "$high" $((low/16777216)))
        [ "$expected" = "$tip" ] || { echo premature_wal_end >&2; exit 1; }
        offset=$((low%16777216))
        [ "$(dd if="$work/wal/$tip" bs=1048576 iflag=skip_bytes skip="$offset" 2>/dev/null | tr -d '\000' | wc -c)" -eq 0 ] || { echo data_after_wal_end >&2; exit 1; }
        printf '%s %s\n' "$(cat "$work/last")" "$branch"
    fi
done < "$work/ranges"
