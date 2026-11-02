#!/bin/bash
# Copy a finished C row's evidence from /tmp/dba-f1 into f1/<row> (one-off evidence helper).
# usage: assemble-c.sh <commit under test> <row>...
# Runs the delivered-bytes check after the row, extracts the call log (subagent sessions included),
# and keeps the fixture's design.md and `git status --short`.
set -euo pipefail
SHA=$1; shift
T=/tmp/dba-f1 TOOLS=$(cd "$(dirname "$0")" && pwd)
E=$(dirname "$TOOLS")
for r in "$@"; do
  python3 "$TOOLS/fixture.py" check "$T/$r" "$SHA" "$T/$r.delivered.sha256" > "$T/$r.check-after.txt" || true
  rm -rf "${E:?}/$r"
  mkdir -p "$E/$r/artifacts"
  cp "$T/$r.prompt.txt" "$E/$r/prompt.txt"
  cp "$T/$r.out.txt" "$E/$r/output.txt"
  cp "$T/$r.delivered.sha256" "$E/$r/delivered.sha256"
  cp "$T/$r.check-before.txt" "$E/$r/delivered-check-before.txt"
  cp "$T/$r.check-after.txt" "$E/$r/delivered-check-after.txt"
  python3 "$TOOLS/calllog.py" "$T/sessions/$r" > "$E/$r/calls.md"
  for d in "$T/sessions/$r"/*/; do
    [ -d "$d" ] || continue
    echo; echo "# Subagent sessions"
    for f in "$d"*.jsonl; do
      [ -f "$f" ] || continue
      echo; echo "## $(basename "$f" .jsonl)"
      jq -r 'select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model' "$f" | sort | uniq -c
    done
  done >> "$E/$r/calls.md"
  design=$(find "$T/$r/openspec/changes" -name design.md -maxdepth 2 | head -1)
  [ -n "$design" ] && cp "$design" "$E/$r/artifacts/design.md"
  (cd "$T/$r" && git status --short) > "$E/$r/artifacts/git-status.txt"
  echo "$r $(tail -n 1 "$E/$r/delivered-check-after.txt") status=$(wc -l < "$E/$r/artifacts/git-status.txt")"
done
