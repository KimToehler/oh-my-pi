#!/usr/bin/env bash
# RED proof for acp-progress-update-size (tasks.md 2.1): every new or changed test fails on the pre-fix ACP source
# by a failed assertion (not setup, compilation or discovery), and the background-job guard passes.
# Each test runs alone; full outputs go to red/<n>.txt next to this script.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
PRE_FIX=1d0d521531
SOURCE=packages/coding-agent/src/modes/acp

if ! git -C "$ROOT" diff --quiet "$PRE_FIX" -- "$SOURCE"; then
	echo "red-check: $SOURCE differs from $PRE_FIX; RED must run against the pre-fix source" >&2
	exit 1
fi

MAPPER=test/acp-event-mapper.test.ts
GOLDEN=test/acp-v1-golden.test.ts
V2=test/acp-v2.test.ts
# <file>|<exact test name>|<expected matcher>
RED_ROWS="$MAPPER|progress updates: a running call's update carries no rawOutput|toBe
$MAPPER|resolves live image blob refs for ACP content without expanding rawOutput|toBe
$MAPPER|does not serialize a wait progress envelope into content text|toBe
$GOLDEN|tool progress updates: unchanged progress is sent once per call|toEqual
$V2|tool progress updates: v2 progress frames carry no rawOutput and unchanged ones are sent once|toEqual"
GUARD_FILE=$MAPPER
GUARD_NAME="progress updates: a background job's final frame keeps rawOutput"

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
