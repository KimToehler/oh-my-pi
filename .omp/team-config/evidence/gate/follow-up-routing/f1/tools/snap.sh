#!/bin/bash
# Snapshot one fixture: git status --porcelain, then SHA-256 of the gate record and every file it pins.
# usage: snap.sh <fixture dir> [<change name>]   (prints to stdout). One-off F1 evidence helper.
set -euo pipefail
D=$1; cd "$D"
echo "## git status --porcelain"
git status --porcelain
echo "## sha256 of the gate record and every pinned file"
REC=.omp/team-config/evidence/gate/${2:-widget-cache}.json
if [ ! -f "$REC" ]; then echo "no gate record at $REC"; exit 0; fi
{ echo "$REC"; jq -r '[.verdicts[]?.trailer_artifact, .qa[]?.artifact, .whole_diff.report] | map(select(. != null))[]' "$REC"; } | while read -r f; do
	if [ -f "$f" ]; then shasum -a 256 "$f"; else echo "MISSING $f"; fi
done
echo "## pinned digests recorded in the record vs actual"
jq -r '(.verdicts[]? | "\(.trailer_sha256) \(.trailer_artifact)"), (.qa[]? | "\(.artifact_sha256) \(.artifact)"), (.whole_diff | select(.report) | "\(.report_sha256) \(.report)")' "$REC" | while read -r want f; do
	have=$(shasum -a 256 "$f" | cut -d' ' -f1)
	[ "$have" = "$want" ] && echo "match $f" || echo "MISMATCH $f"
done
