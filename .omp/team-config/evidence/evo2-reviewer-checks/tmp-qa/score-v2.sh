#!/bin/bash
# Usage: score-v2.sh <fixture-name> <attempt>...
# Fixture names: V2-<CHECK|DOMAIN>-<n>-<pos|neg>. One row per attempt, then the 2-of-3 row verdict.
# pos match: status ok, verdict REJECT, some area carries the label.
# neg match: status ok, no area carries the label (any verdict).
# Missing result file, no-verdict, or unparsable JSON is a mismatch.
set -uo pipefail
NAME="$1"; shift
LABEL=$(echo "$NAME" | sed -E 's/^V2-(CHECK|DOMAIN)-([0-9])-(pos|neg)$/\1 \2/')
WANT=${NAME##*-}
MATCHES=0; RUNS=0
for A in "$@"; do
	F=/tmp/evo2-qa/results/$NAME.a$A.json
	RUNS=$((RUNS + 1))
	if ! jq -e . "$F" >/dev/null 2>&1; then echo "$NAME a$A missing MISMATCH"; continue; fi
	ST=$(jq -r .status "$F"); V=$(jq -r '.verdict // "-"' "$F")
	HIT=$(jq --arg l "$LABEL" '[.areas[]? | select(test("(^|[^A-Za-z])(" + $l + ")([^0-9]|$)"; "i"))] | length' "$F")
	OK=MISMATCH
	if [ "$WANT" = pos ] && [ "$ST" = ok ] && [ "$V" = REJECT ] && [ "$HIT" -gt 0 ]; then OK=match; fi
	if [ "$WANT" = neg ] && [ "$ST" = ok ] && [ "$HIT" -eq 0 ]; then OK=match; fi
	[ "$OK" = match ] && MATCHES=$((MATCHES + 1))
	echo "$NAME a$A status=$ST verdict=$V hits=$HIT $OK"
done
if [ "$RUNS" -ge 3 ] && [ "$MATCHES" -ge 2 ]; then echo "$NAME ROW PASS ($MATCHES/$RUNS)"; else echo "$NAME ROW FAIL ($MATCHES/$RUNS)"; fi
