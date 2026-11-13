#!/usr/bin/env bash
# F1 row s1-mixed, weaver part: the deployed GC patch on weaver's m5-app-design-workspace range 3e180e65..32dc8c5d,
# --out under /tmp. Prints the delta directory path last; outputs go to captures/s1-mixed/weaver-*.
set -u
F1="$(cd "$(dirname "$0")" && pwd)"
C="$F1/captures/s1-mixed"; mkdir -p "$C"
W="$HOME/git/weaver/.worktrees/m5-app-design-workspace"
OUT="$(mktemp -d /tmp/f1-weaver-XXXX)/delta"
{ echo "node ~/.omp/agent/skills/review-work/scripts/gate-convergence.mjs patch --repo $W --base 3e180e65 --head 32dc8c5d --out $OUT"
  node "$HOME/.omp/agent/skills/review-work/scripts/gate-convergence.mjs" patch --repo "$W" --base 3e180e65 --head 32dc8c5d --out "$OUT"; echo "exit $?"; } > "$C/weaver-patch.stdout" 2>&1
cp "$OUT/manifest.json" "$C/weaver-manifest.json"
cd "$OUT"
{ echo "(cat manifest.json; jq -r '.commits[].patch' manifest.json | xargs cat) | wc -c"
  (cat manifest.json; jq -r '.commits[].patch' manifest.json | xargs cat) | wc -c
  echo "du -sk ."; du -sk .
  echo "commits $(jq '.commits | length' manifest.json), with an evidence file $(jq '[.commits[] | select(.evidence)] | length' manifest.json)"
  echo "jq -r '.commits[].patch' manifest.json | xargs wc -c | sort -n | tail -3"; jq -r '.commits[].patch' manifest.json | xargs wc -c | sort -n | tail -3; } > "$C/weaver-sizes.txt" 2>&1
P="$(jq -r '.commits[] | select(.sha | startswith("678b0d00")) | .patch' manifest.json)"
cp "$P" "$C/weaver-678b0d00.patch"
{ echo "678b0d00 is $P, $(wc -c < "$P") bytes; evidence $(jq -r '.commits[] | select(.sha | startswith("678b0d00")) | .evidence' manifest.json)"
  echo "grep -c '^diff --git .*WebViewEngine.kt' $P"; grep -c '^diff --git .*WebViewEngine.kt' "$P"
  echo "grep -n -A3 '^Left out by GC patch' $P"; grep -n -A3 '^Left out by GC patch' "$P"
  echo "grep -c '^diff --git a/.omp/team-config/evidence/' $P"; grep -c '^diff --git a/.omp/team-config/evidence/' "$P"; } > "$C/weaver-678b0d00.txt" 2>&1
echo "$OUT"
