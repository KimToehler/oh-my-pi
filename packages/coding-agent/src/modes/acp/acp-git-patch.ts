/**
 * Git-style unified diff builder for ACP `git_patch` diff payloads.
 *
 * Paths are absolute and carry no `a/`/`b/` prefixes; `/dev/null` names a
 * missing side. Path quoting follows git's `quote_c_style` with the default
 * `core.quotePath`.
 */
import { structuredPatchHunks } from "@oh-my-pi/pi-natives";

export interface GitPatchFile {
	/** Absolute path after the change. */
	path: string;
	/** Absolute path before the change when the file was moved. */
	oldPath?: string;
	/** Previous content; `null` when the file is created. */
	oldText: string | null;
	/** New content; `null` when the file is deleted. */
	newText: string | null;
}

const DEV_NULL = "/dev/null";
const CONTEXT_LINES = 3;
const SIMPLE_ESCAPES = new Map<number, string>([
	[0x07, "\\a"],
	[0x08, "\\b"],
	[0x09, "\\t"],
	[0x0a, "\\n"],
	[0x0b, "\\v"],
	[0x0c, "\\f"],
	[0x0d, "\\r"],
	[0x22, '\\"'],
	[0x5c, "\\\\"],
]);
const encoder = new TextEncoder();

/** Quote a path exactly like git's `quote_c_style` (core.quotePath=true). */
export function quoteGitPath(path: string): string {
	const bytes = encoder.encode(path);
	let needsQuote = false;
	for (const byte of bytes) {
		if (byte < 0x20 || byte === 0x22 || byte === 0x5c || byte >= 0x7f) {
			needsQuote = true;
			break;
		}
	}
	if (!needsQuote) return path;
	let out = '"';
	for (const byte of bytes) {
		const simple = SIMPLE_ESCAPES.get(byte);
		if (simple) out += simple;
		else if (byte < 0x20 || byte >= 0x7f) out += `\\${byte.toString(8).padStart(3, "0")}`;
		else out += String.fromCharCode(byte);
	}
	return `${out}"`;
}

/** Name on a `---`/`+++` line: git appends a tab to unquoted names containing spaces. */
function headerName(path: string): string {
	const quoted = quoteGitPath(path);
	return quoted === path && path.includes(" ") ? `${path}\t` : quoted;
}

/** Git reports the line before the hunk as start when a side has zero lines. */
function formatRange(start: number, count: number): string {
	if (count === 0) return `${Math.max(start - 1, 0)},0`;
	return count === 1 ? `${start}` : `${start},${count}`;
}

function buildFilePatch(file: GitPatchFile): string {
	const { oldText, newText } = file;
	const oldPath = file.oldPath ?? file.path;
	const lines = [`diff --git ${quoteGitPath(oldPath)} ${quoteGitPath(file.path)}`];
	if (oldText === null) lines.push("new file mode 100644");
	else if (newText === null) lines.push("deleted file mode 100644");
	else if (file.oldPath !== undefined && file.oldPath !== file.path) {
		if (oldText === newText) lines.push("similarity index 100%");
		lines.push(`rename from ${quoteGitPath(file.oldPath)}`, `rename to ${quoteGitPath(file.path)}`);
	}

	const hunks = structuredPatchHunks(oldText ?? "", newText ?? "", CONTEXT_LINES);
	if (hunks.length > 0) {
		lines.push(
			`--- ${oldText === null ? DEV_NULL : headerName(oldPath)}`,
			`+++ ${newText === null ? DEV_NULL : headerName(file.path)}`,
		);
		for (const hunk of hunks) {
			lines.push(
				`@@ -${formatRange(hunk.oldStart, hunk.oldLines)} +${formatRange(hunk.newStart, hunk.newLines)} @@`,
				...hunk.lines,
			);
		}
	}
	return `${lines.join("\n")}\n`;
}

/** Build a multi-file git-style patch with absolute, unprefixed paths. */
export function buildGitPatch(files: readonly GitPatchFile[]): string {
	return files.map(buildFilePatch).join("");
}
