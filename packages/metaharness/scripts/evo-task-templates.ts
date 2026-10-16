export function taskToml(name: string): string {
	return [
		'schema_version = "1.3"',
		"",
		"[task]",
		`name = "evo/${name}"`,
		"",
		"[agent]",
		"timeout_sec = 1800.0",
		"",
		"[verifier]",
		"timeout_sec = 900.0",
		'network_mode = "no-network"',
		"",
		"[environment]",
		"build_timeout_sec = 900.0",
		'network_mode = "public"',
		"",
	].join("\n");
}

export function dockerfile(baseImage: string): string {
	return `FROM ${baseImage}\nCOPY repo/ /workspace/repo/\nWORKDIR /workspace/repo\n`;
}

/** Hidden verifier: overlay fixed tests, run the test command, write a numeric reward. */
export const TEST_SH = `#!/usr/bin/env bash
set -u
REPO_DIR="\${REPO_DIR:-/workspace/repo}"
TESTS_DIR="\${TESTS_DIR:-/tests}"
LOG_DIR="\${LOG_DIR:-/logs/verifier}"
mkdir -p "$LOG_DIR"
echo 0 > "$LOG_DIR/reward.txt"
cp -R "$TESTS_DIR/files/." "$REPO_DIR/" || exit 0
cmd="$(cat "$TESTS_DIR/command.txt")"
cd "$REPO_DIR" || exit 0
if bash -c "$cmd"; then
	echo 1 > "$LOG_DIR/reward.txt"
else
	echo 0 > "$LOG_DIR/reward.txt"
fi
exit 0
`;

/** Reference solution: overlay fixed non-test files and apply deletions. */
export const SOLVE_SH = `#!/usr/bin/env bash
set -eu
REPO_DIR="\${REPO_DIR:-/workspace/repo}"
SOLUTION_DIR="\${SOLUTION_DIR:-/solution}"
if [ -d "$SOLUTION_DIR/files" ]; then
	cp -R "$SOLUTION_DIR/files/." "$REPO_DIR/"
fi
if [ -f "$SOLUTION_DIR/deleted.txt" ]; then
	while IFS= read -r rel; do
		[ -n "$rel" ] && rm -f -- "$REPO_DIR/$rel"
	done < "$SOLUTION_DIR/deleted.txt"
fi
`;
