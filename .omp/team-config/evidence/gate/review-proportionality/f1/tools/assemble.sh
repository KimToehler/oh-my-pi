#!/bin/bash
# Assemble one F1 row's evidence into /tmp/rp-f1/evidence/<row>/ (staging; scanned before it enters the repo).
# usage: assemble.sh <row> [<change name>]
set -euo pipefail
R=$1 N=${2:-}
F=/tmp/rp-f1/$R E=/tmp/rp-f1/evidence/$R
rm -rf "$E"; mkdir -p "$E/inputs" "$E/artifacts"
# scenario inputs: the fixture's committed files minus the delivered ones
git -C "$F" archive HEAD | tar -x -C "$E/inputs"
rm -rf "$E/inputs/.omp" "$E/inputs/openspec/schemas" "$E/inputs/openspec/config.yaml"
# resulting artifacts: the change folder(s) as the session left them, and git status of the fixture
if [ -n "$N" ]; then cp -R "$F/openspec/changes/$N" "$E/artifacts/"; fi
git -C "$F" status --short > "$E/artifacts/git-status.txt"
git -C "$F" diff > "$E/artifacts/git-diff.patch" || true
cp /tmp/rp-f1/$R.delivered.sha256 "$E/delivered.sha256"
cp /tmp/rp-f1/$R.check-before.txt "$E/delivered-check-before.txt"
[ -f /tmp/rp-f1/$R.check-after.txt ] && cp /tmp/rp-f1/$R.check-after.txt "$E/delivered-check-after.txt"
[ -f /tmp/rp-f1/$R.prompt.txt ] && cp /tmp/rp-f1/$R.prompt.txt "$E/prompt.txt"
[ -f /tmp/rp-f1/$R.out.txt ] && cp /tmp/rp-f1/$R.out.txt "$E/session-output.txt"
python3 /tmp/rp-f1/calllog.py /tmp/rp-f1/sessions/$R > "$E/calls.md"
echo "assembled $E: $(find "$E" -type f | wc -l) files"
