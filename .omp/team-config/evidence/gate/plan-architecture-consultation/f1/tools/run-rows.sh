#!/bin/bash
# Run F1 session rows as fresh ordinary `omp -p` sessions in the disposable home (one-off evidence helper).
# usage: run-rows.sh <row>...    prompt /tmp/pac-f1/<row>.prompt.txt, cwd /tmp/pac-f1/<row>,
#        session files in /tmp/pac-f1/sessions/<row>, final reply in /tmp/pac-f1/<row>.out.txt
# Answer mode: ANSWER=<file> run-rows.sh <row> resumes the row's latest session with the file's text
# (the user's answer to the session's question), appending to <row>.out.txt.
# HOME is the disposable home, so ~/.omp/agent resolves to the candidate installation; profile and
# agent-dir variables are unset; the router key stays in the operator's process environment.
set -uo pipefail
T=/tmp/pac-f1 J=${J:-4} MAXT=${MAXT:-60m}
export DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 PAC_HOME=${PAC_HOME:-${TMPDIR}pac-home}
run() {
  local r=$1 t0=$SECONDS
  mkdir -p "$T/sessions/$r"
  if [ -n "${ANSWER:-}" ]; then
    local s; s=$(ls -t "$T/sessions/$r"/*.jsonl | head -1)
    (cd "$T/$r" && env -u PI_PROFILE -u OMP_PROFILE -u PI_CODING_AGENT_DIR HOME="$PAC_HOME" \
      omp -p --wait-async --session-dir "$T/sessions/$r" --resume "$s" --max-time "$MAXT" "$(cat "$ANSWER")" >> "$T/$r.out.txt" 2>> "$T/$r.err.txt")
  else
    (cd "$T/$r" && env -u PI_PROFILE -u OMP_PROFILE -u PI_CODING_AGENT_DIR HOME="$PAC_HOME" \
      omp -p --wait-async --session-dir "$T/sessions/$r" --max-time "$MAXT" "$(cat "$T/$r.prompt.txt")" > "$T/$r.out.txt" 2> "$T/$r.err.txt")
  fi
  echo "$r rc=$? $((SECONDS - t0))s"
}
export -f run
export T MAXT ANSWER
printf '%s\n' "$@" | xargs -P "$J" -I{} bash -c 'run {}'
