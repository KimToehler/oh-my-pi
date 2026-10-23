#!/bin/bash
# Usage: run-fixture.sh <fixture-name> <attempt> [cwd]
# One isolated session dir per attempt; the verdict comes only from that dir.
set -uo pipefail
NAME="$1"; ATTEMPT="$2"; CWD="${3:-/Users/tim/git/oh-my-pi/.worktrees/evo2-reviewer-checks}"
OMP=/Users/tim/git/oh-my-pi/.worktrees/evo2-reviewer-checks/packages/coding-agent/src/cli.ts
FIX=/tmp/evo2-qa/fixtures/$NAME.md
SDIR=/tmp/evo2-qa/runs/$NAME/a$ATTEMPT
OUT=/tmp/evo2-qa/results/$NAME.a$ATTEMPT.json
mkdir -p "$SDIR" /tmp/evo2-qa/results
if ! ls "$SDIR"/*.jsonl >/dev/null 2>&1; then
	PROMPT="Dispatch exactly one task item: agent \"plan-reviewer\", task \"Review the plan at $FIX\", solutionSpace \"plan review; defects unknown\". Then reply with the subagent's verdict JSON verbatim and nothing else."
	(cd "$CWD" && PATH="$HOME/.cargo/bin:$PATH" bun "$OMP" --print --session-dir "$SDIR" "$PROMPT" > "$SDIR/reply.txt" 2> "$SDIR/stderr.txt")
fi
COUNT=$(find "$SDIR" -mindepth 2 -name '*.json' -exec grep -l '"verdict"' {} + 2>/dev/null | wc -l | tr -d ' ')
FILE=$(find "$SDIR" -mindepth 2 -name '*.json' -exec grep -l '"verdict"' {} + 2>/dev/null | head -1)
if [ "$COUNT" != "1" ] || ! jq -e '.verdict == "OKAY" or .verdict == "REJECT"' "$FILE" >/dev/null 2>&1; then
	jq -n --arg n "$NAME" --arg a "$ATTEMPT" --arg k "$COUNT" '{fixture:$n,attempt:$a,status:"no-verdict",verdictFiles:$k}' > "$OUT"
else
	jq --arg n "$NAME" --arg a "$ATTEMPT" --arg p "$FILE" '{fixture:$n,attempt:$a,status:"ok",path:$p,verdict,areas:[.blockers[]?.area],defects:[.blockers[]?.defect]}' "$FILE" > "$OUT"
fi
jq -c '{fixture,attempt,status,verdict,areas}' "$OUT"
