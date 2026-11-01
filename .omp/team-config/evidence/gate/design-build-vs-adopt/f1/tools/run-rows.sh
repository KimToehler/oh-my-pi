#!/bin/bash
# Run F1 session rows as fresh ordinary `omp -p` sessions, at most $J at a time (one-off evidence helper).
# usage: run-rows.sh <row>...   prompt from /tmp/dba-f1/<row>.prompt.txt, cwd /tmp/dba-f1/<row>,
# session files in /tmp/dba-f1/sessions/<row>, final reply in /tmp/dba-f1/<row>.out.txt
set -uo pipefail
T=/tmp/dba-f1 J=${J:-4}
export DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0
run() {
  local r=$1 t0=$SECONDS
  mkdir -p "$T/sessions/$r"
  (cd "$T/$r" && omp -p --session-dir "$T/sessions/$r" --max-time 45m "$(cat "$T/$r.prompt.txt")" > "$T/$r.out.txt" 2> "$T/$r.err.txt")
  echo "$r rc=$? $((SECONDS - t0))s"
}
export -f run
export T
printf '%s\n' "$@" | xargs -P "$J" -I{} bash -c 'run {}'
