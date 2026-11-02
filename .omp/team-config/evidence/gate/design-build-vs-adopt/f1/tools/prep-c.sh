#!/bin/bash
# Build the C-row fixtures for the re-run under the merged review flow (one-off evidence helper).
# usage: prep-c.sh <commit under test> <row>...
# Each fixture: /tmp/dba-f1/<row> as a fresh git repo with the row's scenario files (rows.py) and the
# schema tree at <commit> (fixture.py), plus the prompt, the delivered-bytes check before the run and
# `openspec schema which omp-gated`.
set -euo pipefail
SHA=$1; shift
T=/tmp/dba-f1 TOOLS=$(cd "$(dirname "$0")" && pwd)
export DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0
for r in "$@"; do
  rm -rf "${T:?}/$r" "$T/sessions/$r" "$T/$r".*
  mkdir -p "$T/$r"
  name=$(python3 "$TOOLS/rows.py" "$r" "$T/$r")
  python3 "$TOOLS/fixture.py" build "$T/$r" "$SHA" "$T/$r.delivered.sha256" > /dev/null
  (cd "$T/$r" && git init -q && git add -A && git -c user.name=f1 -c user.email=f1@example.invalid commit -qm fixture)
  python3 "$TOOLS/fixture.py" check "$T/$r" "$SHA" "$T/$r.delivered.sha256" > "$T/$r.check-before.txt"
  (cd "$T/$r" && openspec schema which omp-gated) > "$T/$r.schema-which.txt" 2>&1
  printf '%s' "Run steps 3 and 4 of the review instruction from \`openspec instructions review --change $name --json\` with the depth gate.md names: dispatch the round with the briefs and scope paragraphs verbatim, paths filled in, then the blocker-verifier triage with every blocker copied verbatim, and classify each blocker as step 4 says. Skip every commit and every write to review.md. Print every reviewer's and the verifier's full output and the classification. Edit nothing." > "$T/$r.prompt.txt"
  echo "$r $name $(tail -n 1 "$T/$r.check-before.txt")"
done
