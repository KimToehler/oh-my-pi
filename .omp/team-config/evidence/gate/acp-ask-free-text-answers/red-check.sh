#!/usr/bin/env bash
# RED proof for acp-ask-free-text-answers (tasks.md 2.1): every new test fails on the pre-fix decoding by a
# failed assertion (not setup, compilation or discovery), and the blank/non-string guard passes.
# Each test runs alone; full outputs go to red/<n>.txt next to this script.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
PRE_FIX=a00f09319b
SOURCE=packages/coding-agent/src/modes/acp/acp-agent.ts

if ! git -C "$ROOT" diff --quiet "$PRE_FIX" -- "$SOURCE"; then
	echo "red-check: $SOURCE differs from $PRE_FIX; RED must run against the pre-fix source" >&2
	exit 1
fi

V1=test/acp-agent.test.ts
V2=test/acp-v2.test.ts
# <file>|<exact test name>|<expected matcher>
RED_ROWS="$V1|ask free text: a single-select value outside the options is the free-text answer|toMatchObject
$V1|ask free text: multi-select items outside the options become free text beside the selections|toMatchObject
$V1|ask free text: multi-select with only typed items joins them by newline|toMatchObject
$V1|ask free text: multi-select keeps a repeated typed item once|toMatchObject
$V1|ask free text: multi-select ignores blank and non-string items|toMatchObject
$V1|ask free text: select text and companion text are both kept|toMatchObject
$V1|ask free text: the ask tool reports a folded Other answer instead of cancelling|not.toBeInstanceOf
$V2|ask free text: a v2 client's select value outside the options reaches the tool as free text|toMatchObject"
GUARD_FILE=$V1
GUARD_NAME="ask free text: a blank or non-string single-select value is no answer"

OUT="$HERE/red"
rm -rf "$OUT"
mkdir -p "$OUT"

# bun's -t is a regex over "<describe> > <name>"; escape the name and anchor its end.
name_pattern() {
	printf '%s$' "$(printf '%s' "$1" | sed 's/[][\.*^$()+?{}|/]/\\&/g')"
}

run_one() { # <file> <name> <output>
	(cd "$ROOT/packages/coding-agent" && bun test "$1" -t "$(name_pattern "$2")") >"$3" 2>&1 || true
}

has_line() { # <output> <exact line>
	grep -qxF -- "$2" "$1"
}

failed=0
n=0
while IFS='|' read -r file name matcher; do
	n=$((n + 1))
	out="$OUT/$n.txt"
	run_one "$file" "$name" "$out"
	ok=1
	has_line "$out" " 0 pass" || ok=0
	has_line "$out" " 1 fail" || ok=0
	awk -v n="> $name [" 'index($0, "(fail) ") == 1 && index($0, n) { f = 1 } END { exit !f }' "$out" || ok=0
	grep -qF -- "error: expect(received).$matcher(" "$out" || ok=0
	if [ "$ok" = 1 ]; then
		echo "RED ok   $n $name ($matcher)"
	else
		echo "RED FAIL $n $name: expected one assertion failure via $matcher, see $out" >&2
		failed=1
	fi
done <<EOF
$RED_ROWS
EOF

guard_out="$OUT/guard.txt"
run_one "$GUARD_FILE" "$GUARD_NAME" "$guard_out"
if has_line "$guard_out" " 1 pass" && has_line "$guard_out" " 0 fail"; then
	echo "GUARD ok $GUARD_NAME"
else
	echo "GUARD FAIL $GUARD_NAME, see $guard_out" >&2
	failed=1
fi

exit "$failed"
