#!/usr/bin/env bash
# F1 row m4-evidence-lookup: a scratch repository whose range has three commits (add src/engine.kt with a RED record
# holding a figure chosen for this run; fix src/engine.kt; delete the RED record), then the deployed GC patch on it.
# Usage: m4-build.sh FIGURE. Prints the repo and the delta directory.
set -eu
F1="$(cd "$(dirname "$0")" && pwd)"
C="$F1/captures/m4-evidence-lookup"; rm -rf "$C"; mkdir -p "$C"
FIG="$1"
R="$(mktemp -d /tmp/f1-m4-XXXX)"
git -C "$R" init -q -b main; git -C "$R" config user.email f1@test; git -C "$R" config user.name "F1 Row"
printf '.omp/\n' > "$R/.git/info/exclude"
mkdir -p "$R/.omp/plans" "$R/src" "$R/.omp/team-config/evidence/gate/demo/red"
cat > "$R/.omp/plans/demo.md" <<'MD'
# Demo engine deadline

## TODOs

- [x] 1.1 `Engine.stop` returns within the deadline. RED record `.omp/team-config/evidence/gate/demo/red/1.1.txt`
  holds the failing assertion of `EngineTest.stopsWithinDeadline` on the unfixed engine.
MD
printf 'readme\n' > "$R/README.md"; git -C "$R" add README.md; git -C "$R" commit -q -m base
BASE="$(git -C "$R" rev-parse HEAD)"
printf 'class Engine {\n    fun stop(): Long = drainAll()\n}\n' > "$R/src/engine.kt"
printf 'command: ./gradlew test --tests EngineTest.stopsWithinDeadline (unfixed engine)\nEngineTest > stopsWithinDeadline FAILED\n    AssertionError: stop took %s ms, expected at most 250 ms\nexit 1\n' "$FIG" > "$R/.omp/team-config/evidence/gate/demo/red/1.1.txt"
git -C "$R" add -f src/engine.kt .omp/team-config/evidence/gate/demo/red/1.1.txt; git -C "$R" commit -q -m "engine: stop drains every queue; RED record of task 1.1"
printf 'class Engine {\n    fun stop(): Long = drainUntil(deadlineMs = 250)\n}\n' > "$R/src/engine.kt"
git -C "$R" commit -q -am "engine: stop drains until the 250 ms deadline (task 1.1)"
git -C "$R" rm -q .omp/team-config/evidence/gate/demo/red/1.1.txt; git -C "$R" commit -q -m "drop the RED record of task 1.1"
OUT="$R/.omp/team-config/gate-deltas/F2-1.1-m4"
{ echo "node ~/.omp/agent/skills/review-work/scripts/gate-convergence.mjs patch --repo $R --base $BASE --head HEAD --out $OUT"
  node "$HOME/.omp/agent/skills/review-work/scripts/gate-convergence.mjs" patch --repo "$R" --base "$BASE" --head HEAD --out "$OUT"; echo "exit $?"; } > "$C/patch.stdout" 2>&1
cp "$OUT/manifest.json" "$C/manifest.json"
{ echo "grep -rn -- '$FIG' $R (working tree, .git excluded, delta directory excluded)"; grep -rn --exclude-dir=.git --exclude-dir=gate-deltas -- "$FIG" "$R"; echo "exit $?"
  echo "grep -ln -- '$FIG' in the delta directory"; grep -ln -- "$FIG" "$OUT"/*; echo "exit $?"; } > "$C/figure-location.txt" 2>&1 || true
echo "$R"; echo "$OUT"
