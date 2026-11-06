#!/bin/bash
# Assemble one F1 row's evidence into /tmp/fur-f1/evidence/<row>/ (staging before it enters the repo).
# usage: assemble.sh <row> <session dir name>...   One-off F1 evidence helper; it collects and never judges.
set -euo pipefail
R=$1; shift
F=/tmp/fur-f1/$R E=/tmp/fur-f1/evidence/$R
rm -rf "$E"; mkdir -p "$E"
cp "/tmp/fur-f1/$R.before.txt" "$E/before.txt"
/tmp/fur-f1/tools/snap.sh "$F" "${CHANGE:-widget-cache}" > "$E/after.txt"
# The run's diff against the fixture commit, untracked files and moves included (the fixture index is disposable).
git -C "$F" add -A
git -C "$F" diff --cached -M HEAD > "$E/git-diff.patch"
git -C "$F" reset -q
: > "$E/calls.md"
for s in "$@"; do
	[ -f "/tmp/fur-f1/$s.prompt.txt" ] && cp "/tmp/fur-f1/$s.prompt.txt" "$E/$s.prompt.txt"
	[ -f "/tmp/fur-f1/$s.out.txt" ] && cp "/tmp/fur-f1/$s.out.txt" "$E/$s.session-output.txt"
	python3 /tmp/fur-f1/tools/calllog.py "/tmp/fur-f1/sessions/$s" >> "$E/calls.md"
done
for f in /tmp/fur-f1/screens/$R.*; do [ -f "$f" ] && cp "$f" "$E/"; done
echo "assembled $E: $(find "$E" -type f | wc -l | tr -d ' ') files"
