#!/usr/bin/env bash
# Negative controls for acp-progress-update-size (tasks.md 3.2): each mutation of the fix (patches against the 3.1
# commit) must fail its named test by a failed assertion; the clean source must then pass both named tests.
# Outputs go to mutations/<patch>.txt next to this script.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
SOURCE=packages/coding-agent/src/modes/acp
MUTATIONS="$HERE/mutations"

MAPPER=test/acp-event-mapper.test.ts
GOLDEN=test/acp-v1-golden.test.ts
GUARD_TEST="progress updates: a background job's final frame keeps rawOutput"
DEDUP_TEST="tool progress updates: unchanged progress is sent once per call"
# <patch>|<file>|<exact test name>
ROWS="i|$MAPPER|$GUARD_TEST
ii|$GOLDEN|$DEDUP_TEST
iii|$GOLDEN|$DEDUP_TEST
iv|$GOLDEN|$DEDUP_TEST
v|$GOLDEN|$DEDUP_TEST"

applied=""
revert() {
	if [ -n "$applied" ]; then
		git -C "$ROOT" apply -R "$applied"
		applied=""
	fi
}
trap revert EXIT

source_is_clean() {
	git -C "$ROOT" diff --quiet -- "$SOURCE"
}

# bun's -t is a regex over "<describe> > <name>"; escape the name and anchor its end.
name_pattern() {
	printf '%s$' "$(printf '%s' "$1" | sed 's/[][\.*^$()+?{}|/]/\\&/g')"
}

run_one() { # <file> <name> <output>
	(cd "$ROOT/packages/coding-agent" && bun test "$1" -t "$(name_pattern "$2")") >"$3" 2>&1 || true
}

failed=0
while IFS='|' read -r patch file name; do
	patch_file="$MUTATIONS/$patch.patch"
	out="$MUTATIONS/$patch.txt"
	if ! source_is_clean; then
		echo "mutation-check: $SOURCE has uncommitted changes; refusing to apply $patch" >&2
		exit 1
	fi
	git -C "$ROOT" apply "$patch_file"
	applied="$patch_file"
	run_one "$file" "$name" "$out"
	revert
	if ! source_is_clean; then
		echo "mutation-check: $SOURCE not restored after reversing $patch" >&2
		exit 1
	fi
	if grep -qxF -- " 1 fail" "$out" && grep -qF -- "expect(received)." "$out"; then
		echo "MUTATION $patch caught by: $name"
	else
		echo "MUTATION $patch SURVIVED: $name, see $out" >&2
		failed=1
	fi
done <<EOF
$ROWS
EOF

out="$MUTATIONS/clean.txt"
tmp="$(mktemp)"
: >"$out"
clean_ok=1
for row in "$MAPPER|$GUARD_TEST" "$GOLDEN|$DEDUP_TEST"; do
	file="${row%%|*}"
	name="${row#*|}"
	run_one "$file" "$name" "$tmp"
	{ echo "=== $file :: $name"; cat "$tmp"; } >>"$out"
	grep -qxF -- " 0 fail" "$tmp" && grep -qxF -- " 1 pass" "$tmp" || clean_ok=0
done
rm -f "$tmp"
if [ "$clean_ok" = 1 ]; then
	echo "CLEAN ok: both named tests pass on $SOURCE"
else
	echo "CLEAN FAIL: a named test fails on the clean source, see $out" >&2
	failed=1
fi

exit "$failed"
