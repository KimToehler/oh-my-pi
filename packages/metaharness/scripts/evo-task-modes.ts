import { fail } from "./evo-task-shared";

const REGULAR_MODES: Record<string, number> = { "100644": 0o644, "100755": 0o755 };

/**
 * Git tree-entry modes of `files` at `rev`, mapped to filesystem permission bits. `@oh-my-pi/pi-natives/vcs`
 * `lsTree` returns paths only (no mode), so this is the one raw git read for modes (fixed argv, no shell,
 * literal pathspecs). Symlinks, submodules and any other non-regular entry are rejected.
 */
export async function readFixedModes(repo: string, rev: string, files: string[]): Promise<Record<string, number>> {
	const modes: Record<string, number> = {};
	if (files.length === 0) return modes;
	const proc = Bun.spawn(
		["git", "--literal-pathspecs", "-C", repo, "ls-tree", "-z", "--full-tree", rev, "--", ...files],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [out, err, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
	if (code !== 0) fail(`git ls-tree failed: ${err.trim()}`);
	for (const entry of out.split("\u0000")) {
		if (entry.length === 0) continue;
		const tab = entry.indexOf("\t");
		const mode = entry.slice(0, entry.indexOf(" "));
		const file = entry.slice(tab + 1);
		const perms = REGULAR_MODES[mode];
		if (perms === undefined) fail(`unsupported non-regular tree entry (mode ${mode}, e.g. symlink): ${file}`);
		modes[file] = perms;
	}
	for (const f of files) if (modes[f] === undefined) fail(`no tree entry for ${f} at ${rev}`);
	return modes;
}
