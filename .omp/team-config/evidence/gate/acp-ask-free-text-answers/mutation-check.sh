#!/usr/bin/env bash
# Negative control of the request-shape requirement (tasks.md 2.3): each mutation of the askDialog request in
# acp-agent.ts must fail at least one v1 request-shape test and the v2 test by a failed assertion. The clean
# source must then pass all of them. Outputs go to mutations/<patch>.txt next to this script.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
SOURCE=packages/coding-agent/src/modes/acp/acp-agent.ts
MUTATIONS="$HERE/mutations"

V1=test/acp-agent.test.ts
V2=test/acp-v2.test.ts
V1_TESTS="translates a recommended single-choice ask into one form
treats a single-choice custom answer as exclusive
uses only free-text fields for questions without options
packs multiple ask questions into one ordered form"
V2_TEST="ask free text: a v2 client's select value outside the options reaches the tool as free text"

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

failed_by_assertion() { # <output>
	grep -qxF -- " 1 fail" "$1" && grep -qF -- "error: expect(received)." "$1"
}

passed_clean() { # <output>
	grep -qxF -- " 0 fail" "$1" && grep -qxF -- " 1 pass" "$1"
}

tmp="$(mktemp)"
failed=0
for patch in i ii iii; do
	file="$MUTATIONS/$patch.patch"
	out="$MUTATIONS/$patch.txt"
	if ! source_is_clean; then
		echo "mutation-check: $SOURCE has uncommitted changes; refusing to apply $patch" >&2
		exit 1
	fi
	git -C "$ROOT" apply "$file"
	applied="$file"
	: >"$out"
	v1_caught=0
	while IFS= read -r name; do
		run_one "$V1" "$name" "$tmp"
		{ echo "=== $V1 :: $name"; cat "$tmp"; } >>"$out"
		if failed_by_assertion "$tmp"; then v1_caught=1; fi
	done <<EOF
$V1_TESTS
EOF
	run_one "$V2" "$V2_TEST" "$tmp"
	{ echo "=== $V2 :: $V2_TEST"; cat "$tmp"; } >>"$out"
	v2_caught=0
	if failed_by_assertion "$tmp"; then v2_caught=1; fi
	revert
	if ! source_is_clean; then
		echo "mutation-check: $SOURCE not restored after reversing $patch" >&2
		exit 1
	fi
	if [ "$v1_caught" = 1 ] && [ "$v2_caught" = 1 ]; then
		echo "MUTATION $patch caught (v1 and v2)"
	else
		echo "MUTATION $patch SURVIVED (v1 caught=$v1_caught, v2 caught=$v2_caught), see $out" >&2
		failed=1
	fi
done

out="$MUTATIONS/clean.txt"
: >"$out"
clean_ok=1
while IFS= read -r line; do
	test_file="${line%%|*}"
	name="${line#*|}"
	run_one "$test_file" "$name" "$tmp"
	{ echo "=== $test_file :: $name"; cat "$tmp"; } >>"$out"
	passed_clean "$tmp" || clean_ok=0
done <<EOF
$(printf '%s\n' "$V1_TESTS" | sed "s#^#$V1|#")
$V2|$V2_TEST
EOF
rm -f "$tmp"
if [ "$clean_ok" = 1 ]; then
	echo "CLEAN ok: all request-shape tests pass on $SOURCE"
else
	echo "CLEAN FAIL: a request-shape test fails on the clean source, see $out" >&2
	failed=1
fi

exit "$failed"
