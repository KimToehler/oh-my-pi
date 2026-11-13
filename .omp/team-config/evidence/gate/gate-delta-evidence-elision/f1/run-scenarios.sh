#!/usr/bin/env bash
# F1 scenario rows s1-s8 of gate-delta-evidence-elision (tasks.md 3.1). Every row runs the DEPLOYED
# gate-convergence.mjs in a scratch repository built for it and writes its outputs by redirection into
# captures/<row>/. The row files judge those captures; this script decides nothing.
set -u
F1="$(cd "$(dirname "$0")" && pwd)"
GC=(node "${GC_SCRIPT:-$HOME/.omp/agent/skills/review-work/scripts/gate-convergence.mjs}")
E=.omp/team-config/evidence/

scratch() { # $1 row -> repo path; base commit holds src/a.ts, .omp/ is ignored as in real repos
	local repo
	repo="$(mktemp -d "${TMPDIR:-/tmp}/f1-$1-XXXX")"
	git -C "$repo" init -q -b main
	git -C "$repo" config user.email f1@test
	git -C "$repo" config user.name "F1 Row"
	mkdir -p "$repo/src" "$repo/.omp/plans"
	printf '.omp/\n' > "$repo/.git/info/exclude"
	printf '# demo\n' > "$repo/.omp/plans/demo.md"
	printf 'line one\nline two\nline three\n' > "$repo/src/a.ts"
	git -C "$repo" add src/a.ts
	git -C "$repo" commit -q -m base
	echo "$repo"
}
put() { # repo (file content)... message: writes each file (printf %b), adds it with -f, commits, prints the sha
	local repo="$1"; shift
	while [ $# -gt 1 ]; do
		mkdir -p "$(dirname "$repo/$1")"
		printf '%b' "$2" > "$repo/$1"
		git -C "$repo" add -f -- "$1"
		shift 2
	done
	git -C "$repo" commit -q -m "$1"
	git -C "$repo" rev-parse HEAD
}
gc() { "${GC[@]}" "$1" --repo "$REPO" "${@:2}"; }
gcp() { "${GC[@]}" "$1" --repo "$REPO" --plan .omp/plans/demo.md "${@:2}"; }
reject='{"verdict":"REJECT","summary":"no","blockers":[{"area":"a","defect":"d","evidence":"e","change":"c"}]}'
ledger() { cat "$REPO/.omp/team-config/ledger.jsonl"; }
lsha() { shasum -a 256 "$REPO/.omp/team-config/ledger.jsonl" | cut -d' ' -f1; }
row() { C="$F1/captures/$1"; rm -rf "$C"; mkdir -p "$C"; REPO="$(scratch "$1")"; echo "== $1 in $REPO"; }

# s1-mixed (scratch part; the weaver range runs from s1-weaver.sh)
row s1-mixed
BASE="$(git -C "$REPO" rev-parse HEAD)"
SHA="$(put "$REPO" src/engine.kt 'fun stop() = deadline()\n' "${E}gate/demo/f1/logcat.txt" 'I/WebView: start\nE/WebView: renderer busy\nI/WebView: stop\n' 'fix engine with its capture')"
{ gc patch --base "$BASE" --head "$SHA" --out .omp/team-config/gate-deltas/mixed; echo "exit $?"; } > "$C/patch.stdout" 2>&1
D="$REPO/.omp/team-config/gate-deltas/mixed"
ls -l "$D" | sed 1d | awk '{print $1, $NF}' > "$C/listing.txt"
cp "$D/manifest.json" "$D/001.patch" "$D/001.evidence.patch" "$C/"

# s2-evidence-only
row s2-evidence-only
BASE="$(git -C "$REPO" rev-parse HEAD)"
SHA="$(put "$REPO" "${E}gate/demo/f1/row.md" 'Head: x\nVerdict: PASS\n' "${E}gate/demo/f1/captures/shot.png" '\x89PNG\x00\x00\x00\x01\x02\x00' 'evidence only')"
{ gc patch --base "$BASE" --head "$SHA" --out .omp/team-config/gate-deltas/ev; echo "exit $?"; } > "$C/patch.stdout" 2>&1
D="$REPO/.omp/team-config/gate-deltas/ev"
cp "$D/manifest.json" "$D/001.patch" "$D/001.evidence.patch" "$C/"
git -C "$REPO" show -s --format=fuller "$SHA" > "$C/header.txt"
git -C "$REPO" show --format= --no-renames --patch "$SHA" > "$C/whole-diff.txt"
{ cmp "$D/001.evidence.patch" "$C/whole-diff.txt" && echo "001.evidence.patch == whole diff of the commit"; } > "$C/cmp.txt" 2>&1

# s3-no-evidence (a merge included)
row s3-no-evidence
BASE="$(git -C "$REPO" rev-parse HEAD)"
put "$REPO" src/a.ts 'line one\nchanged\nline three\n' 'fix a' > /dev/null
git -C "$REPO" checkout -q -b side "$BASE"
put "$REPO" src/c.ts 'side\n' 'side work' > /dev/null
git -C "$REPO" checkout -q main
git -C "$REPO" merge -q --no-ff -m 'merge side' side
{ gc patch --base "$BASE" --head HEAD --out .omp/team-config/gate-deltas/plain; echo "exit $?"; } > "$C/patch.stdout" 2>&1
D="$REPO/.omp/team-config/gate-deltas/plain"
cp "$D/manifest.json" "$C/"
ls "$D" > "$C/files.txt"
for p in $(jq -r '.commits[] | .patch + ":" + .sha' "$D/manifest.json"); do
	git -C "$REPO" show --format=fuller --no-renames --patch "${p#*:}" > "$C/git-show-${p%%:*}"
	{ cmp "$D/${p%%:*}" "$C/git-show-${p%%:*}" && echo "${p%%:*} == git show ${p#*:} ($(git -C "$REPO" log -1 --format=%p "${p#*:}" | wc -w | tr -d ' ') parents)"; } >> "$C/cmp.txt" 2>&1
done

# s4-negative-patch: the mixed patch of s1 must hold the engine hunk and no line of the capture
row s4-negative-patch
P="$F1/captures/s1-mixed"
{ echo "grep -n '^+fun stop() = deadline()\$' 001.patch"; grep -n '^+fun stop() = deadline()$' "$P/001.patch"; echo "exit $?"
  echo "grep -n WebView 001.patch"; grep -n 'WebView' "$P/001.patch"; echo "exit $?"
  echo "grep -n deadline 001.evidence.patch"; grep -n 'deadline' "$P/001.evidence.patch"; echo "exit $?"
  echo "grep -c '^+.*WebView' 001.evidence.patch"; grep -c '^+.*WebView' "$P/001.evidence.patch"; echo "exit $?"; } > "$C/checks.txt"

# s5-new-round-trip
row s5-new-round-trip
gcp baseline --sha HEAD > "$C/baseline.txt" 2>&1
BASE="$(git -C "$REPO" rev-parse HEAD)"
put "$REPO" src/engine.kt 'fun stop() = deadline()\n' "${E}gate/demo/f1/logcat.txt" 'E/WebView: renderer busy\n' 'fix engine with its capture' > /dev/null
HEAD_="$(put "$REPO" "${E}gate/demo/f1/row.md" 'Verdict: PASS\n' 'F1 row')"
{ gc patch --base "$BASE" --head "$HEAD_" --out .omp/team-config/gate-deltas/rt; echo "exit $?"; } > "$C/patch.stdout" 2>&1
D="$REPO/.omp/team-config/gate-deltas/rt"
cp "$D/manifest.json" "$C/"
printf '%s' "$reject" > "$D/verdict.json"
{ gcp delta --lane F2 --dir .omp/team-config/gate-deltas/rt --row R1; echo "exit $?"; } > "$C/delta.txt" 2>&1
{ gcp accept --lane F2 --dir .omp/team-config/gate-deltas/rt --by f1 --reason residual; echo "exit $?"; } > "$C/accept.txt" 2>&1
ledger | jq -c 'select(.event=="fix_delta_review") | {verdict, round, fix_shas: (.fix_shas|length)}' > "$C/ledger-lines.txt"

# s6-old-dir: hand-written whole-commit patches and a manifest without left_out
row s6-old-dir
gcp baseline --sha HEAD > "$C/baseline.txt" 2>&1
BASE="$(git -C "$REPO" rev-parse HEAD)"
put "$REPO" src/a.ts 'line one\nline two fixed\nline three\n' 'fix a' > /dev/null
HEAD_="$(put "$REPO" src/engine.kt 'fun stop() = deadline()\n' "${E}gate/demo/f1/logcat.txt" 'E/WebView: renderer busy\n' 'fix engine with its capture')"
D="$REPO/.omp/team-config/gate-deltas/old"; mkdir -p "$D"
i=0; : > "$D/entries"
for sha in $(git -C "$REPO" rev-list --reverse "$BASE..$HEAD_"); do
	i=$((i + 1)); n="$(printf '%03d' $i)"
	git -C "$REPO" show --format=fuller --no-renames --patch "$sha" > "$D/$n.patch"
	jq -nc --arg sha "$sha" --arg s "$(git -C "$REPO" log -1 --format=%s "$sha")" --arg p "$n.patch" --arg h "$(shasum -a 256 "$D/$n.patch" | cut -d' ' -f1)" '{sha:$sha,subject:$s,patch:$p,sha256:$h}' >> "$D/entries"
done
jq -s --arg b "$BASE" --arg h "$HEAD_" '{base_sha:$b, head_sha:$h, commits:.}' "$D/entries" > "$D/manifest.json"; rm "$D/entries"
cp "$D/manifest.json" "$C/"
printf '%s' "$reject" > "$D/verdict.json"
{ gcp delta --lane F2 --dir .omp/team-config/gate-deltas/old --row R1; echo "exit $?"; } > "$C/delta.txt" 2>&1
{ gcp accept --lane F2 --dir .omp/team-config/gate-deltas/old --by f1 --reason residual; echo "exit $?"; } > "$C/accept.txt" 2>&1
ledger | jq -c 'select(.event=="fix_delta_review") | {verdict, round, fix_shas: (.fix_shas|length)}' > "$C/ledger-lines.txt"

mixed_range() { # $1 name -> D: a fresh new-form directory holding 001 (source only) and 002 (fix with capture)
	gcp baseline --sha HEAD > /dev/null 2>&1 || true
	local base head
	base="$(git -C "$REPO" rev-parse HEAD)"
	put "$REPO" "src/$1.ts" 'fix\n' "fix $1" > /dev/null
	head="$(put "$REPO" "src/engine-$1.kt" 'fun stop() = deadline()\n' "${E}gate/demo/f1/$1.txt" 'E/WebView: renderer busy\n' "fix engine $1")"
	gc patch --base "$base" --head "$head" --out ".omp/team-config/gate-deltas/$1" > /dev/null
	D="$REPO/.omp/team-config/gate-deltas/$1"
	printf '{"verdict":"OKAY","summary":"ok"}' > "$D/verdict.json"
}
refuse() { # $1 dir name: delta on it, with the ledger hash before and after
	local before
	before="$(lsha)"
	{ echo "== $1"; gcp delta --lane F2 --dir ".omp/team-config/gate-deltas/$1" --row R1; echo "exit $?"; echo "ledger sha256 before $before after $(lsha)"; } >> "$C/refusals.txt" 2>&1
}

# s7-edited: four edits, each on a fresh new-form directory
row s7-edited
mixed_range patch-edited; chmod u+w "$D/002.patch"; printf 'tampered\n' > "$D/002.patch"; refuse patch-edited
mixed_range evidence-edited; chmod u+w "$D/002.evidence.patch"; printf 'tampered\n' > "$D/002.evidence.patch"; refuse evidence-edited
mixed_range evidence-removed; rm -f "$D/002.evidence.patch"; refuse evidence-removed
mixed_range evidence-not-expected
printf '+invented\n' > "$D/001.evidence.patch"
h="$(shasum -a 256 "$D/001.evidence.patch" | cut -d' ' -f1)"
chmod u+w "$D/manifest.json"
jq --arg h "$h" '.commits[0] += {evidence: "001.evidence.patch", evidence_sha256: $h}' "$D/manifest.json" > "$D/m.tmp" && mv "$D/m.tmp" "$D/manifest.json"
refuse evidence-not-expected

# s8-negative-manifest: left_out src/ (patches recomputed in the src/ form), without its slash, null; delta and accept
row s8-negative-manifest
for value in src/ .omp/team-config/evidence null; do
	name="v-$(printf '%s' "$value" | tr -c 'a-z' '-')"
	mixed_range "$name"
	printf '%s' "$reject" > "$D/verdict.json"
	chmod -R u+w "$D"
	if [ "$value" = src/ ]; then node "$F1/src-form.mjs" "$REPO" "$D" src/; fi
	jq --argjson v "$(if [ "$value" = null ]; then echo null; else jq -n --arg v "$value" '$v'; fi)" '.left_out = $v' "$D/manifest.json" > "$D/m.tmp" && mv "$D/m.tmp" "$D/manifest.json"
	cp "$D/manifest.json" "$C/manifest-$name.json"
	for cmd in delta accept; do
		before="$(lsha)"
		{ echo "== left_out $value, $cmd"
		  if [ $cmd = delta ]; then gcp delta --lane F2 --dir ".omp/team-config/gate-deltas/$name" --row R1; else gcp accept --lane F2 --dir ".omp/team-config/gate-deltas/$name" --by f1 --reason r; fi
		  echo "exit $?"
		  echo "ledger sha256 before $before after $(lsha)"; } >> "$C/refusals.txt" 2>&1
	done
done
echo done
