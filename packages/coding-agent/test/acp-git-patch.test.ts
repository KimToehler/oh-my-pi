import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { $ } from "bun";
import { buildGitPatch, quoteGitPath } from "../src/modes/acp/acp-git-patch";

describe("buildGitPatch", () => {
	it("renders a modification with absolute paths", () => {
		const patch = buildGitPatch([{ path: "/w/a.txt", oldText: "one\ntwo\nthree\n", newText: "one\n2\nthree\n" }]);
		expect(patch).toBe(
			["diff --git /w/a.txt /w/a.txt", "--- /w/a.txt", "+++ /w/a.txt", "@@ -1,3 +1,3 @@", " one", "-two", "+2", " three", ""].join(
				"\n",
			),
		);
	});

	it("uses /dev/null as the old side for additions", () => {
		const patch = buildGitPatch([{ path: "/w/new.txt", oldText: null, newText: "hi\n" }]);
		expect(patch).toBe(
			["diff --git /w/new.txt /w/new.txt", "new file mode 100644", "--- /dev/null", "+++ /w/new.txt", "@@ -0,0 +1 @@", "+hi", ""].join(
				"\n",
			),
		);
	});

	it("uses /dev/null as the new side for deletions", () => {
		const patch = buildGitPatch([{ path: "/w/old.txt", oldText: "bye\n", newText: null }]);
		expect(patch).toBe(
			["diff --git /w/old.txt /w/old.txt", "deleted file mode 100644", "--- /w/old.txt", "+++ /dev/null", "@@ -1 +0,0 @@", "-bye", ""].join(
				"\n",
			),
		);
	});

	it("renders moves with content changes as rename from/to", () => {
		const patch = buildGitPatch([{ path: "/w/b.txt", oldPath: "/w/a.txt", oldText: "x\ny\n", newText: "x\nz\n" }]);
		expect(patch).toBe(
			[
				"diff --git /w/a.txt /w/b.txt",
				"rename from /w/a.txt",
				"rename to /w/b.txt",
				"--- /w/a.txt",
				"+++ /w/b.txt",
				"@@ -1,2 +1,2 @@",
				" x",
				"-y",
				"+z",
				"",
			].join("\n"),
		);
	});

	it("never emits a/ or b/ prefixes on any path line", () => {
		const patch = buildGitPatch([
			{ path: "/w/m.txt", oldText: "1\n", newText: "2\n" },
			{ path: "/w/n.txt", oldText: null, newText: "n\n" },
			{ path: "/w/d.txt", oldText: "d\n", newText: null },
			{ path: "/w/r2.txt", oldPath: "/w/r1.txt", oldText: "r\n", newText: "s\n" },
		]);
		const pathLines = patch.split("\n").filter(l => /^(diff --git|---|\+\+\+|rename (from|to)) /.test(l));
		expect(pathLines.length).toBeGreaterThan(0);
		for (const line of pathLines) {
			const names = line.replace(/^(diff --git|---|\+\+\+|rename from|rename to) /, "").split(" ");
			for (const name of names) {
				expect(name === "/dev/null" || name.startsWith("/")).toBe(true);
			}
		}
	});

	it("quotes paths with a newline like git and tabs unquoted names containing spaces", () => {
		const patch = buildGitPatch([{ path: "/w/a b\nc.txt", oldText: "1\n", newText: "2\n" }]);
		const lines = patch.split("\n");
		expect(lines[0]).toBe('diff --git "/w/a b\\nc.txt" "/w/a b\\nc.txt"');
		expect(lines[1]).toBe('--- "/w/a b\\nc.txt"');

		const spaced = buildGitPatch([{ path: "/w/a b.txt", oldText: "1\n", newText: "2\n" }]).split("\n");
		expect(spaced[0]).toBe("diff --git /w/a b.txt /w/a b.txt");
		expect(spaced[1]).toBe("--- /w/a b.txt\t");
	});

	it("quotes quotes, backslashes, control bytes and non-ASCII as octal like git", () => {
		expect(quoteGitPath('/w/q"\\\t\u0001')).toBe('"/w/q\\"\\\\\\t\\001"');
		expect(quoteGitPath("/w/é")).toBe('"/w/\\303\\251"');
		expect(quoteGitPath("/w/plain.txt")).toBe("/w/plain.txt");
	});

	it("marks a missing trailing newline on the affected side", () => {
		const patch = buildGitPatch([{ path: "/w/a.txt", oldText: "a\nb", newText: "a\nb\n" }]);
		expect(patch.split("\n").slice(3)).toEqual(["@@ -1,2 +1,2 @@", " a", "-b", "\\ No newline at end of file", "+b", ""]);
	});
});

describe("buildGitPatch applies with git", () => {
	it("passes git apply --check for modify+add+delete+rename in one patch", async () => {
		const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "acp-git-patch-")));
		try {
			await $`git init -q`.cwd(root).quiet();
			const files: Record<string, string> = {
				"mod.txt": "a\nb\nc\n",
				"del.txt": "gone\n",
				"mv src.txt": "m\nn\no\n",
				"we\nird.txt": "w\n",
			};
			for (const [name, text] of Object.entries(files)) await Bun.write(path.join(root, name), text);
			await $`git add -A`.cwd(root).quiet();

			const abs = (name: string) => path.join(root, name);
			const patch = buildGitPatch([
				{ path: abs("mod.txt"), oldText: files["mod.txt"], newText: "a\nB\nc\n" },
				{ path: abs("added file.txt"), oldText: null, newText: "fresh\n" },
				{ path: abs("del.txt"), oldText: files["del.txt"], newText: null },
				{ path: abs("moved.txt"), oldPath: abs("mv src.txt"), oldText: files["mv src.txt"], newText: "m\nN\no\n" },
				{ path: abs("we\nird.txt"), oldText: files["we\nird.txt"], newText: "w2\n" },
			]);

			const relativize = (token: string): string => {
				const quoted = token.startsWith('"');
				const raw = quoted ? token.slice(1, -1) : token;
				const rel = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
				return quoted ? `"${rel}"` : rel;
			};
			const prefixed = (token: string, prefix: "a/" | "b/"): string => {
				if (token === "/dev/null") return token;
				const rel = relativize(token);
				return rel.startsWith('"') ? `"${prefix}${rel.slice(1)}` : `${prefix}${rel}`;
			};
			const transformed = patch
				.split("\n")
				.map(line => {
					const header = /^(--- |\+\+\+ )(.*)$/.exec(line);
					if (header) {
						const name = header[2].replace(/\t$/, "");
						return `${header[1]}${prefixed(name, header[1] === "--- " ? "a/" : "b/")}`;
					}
					const diff = /^diff --git ("(?:[^"\\]|\\.)*"|\S+(?: \S+)*?) ("(?:[^"\\]|\\.)*"|\S+(?: \S+)*)$/.exec(line);
					if (diff) {
						return `diff --git ${prefixed(diff[1], "a/")} ${prefixed(diff[2], "b/")}`;
					}
					const rename = /^(rename (?:from|to)) (.*)$/.exec(line);
					if (rename) return `${rename[1]} ${relativize(rename[2])}`;
					return line;
				})
				.join("\n");

			const patchFile = path.join(root, "..", `${path.basename(root)}.patch`);
			await Bun.write(patchFile, transformed);
			try {
				const result = await $`git apply --check ${patchFile}`.cwd(root).quiet().nothrow();
				expect(result.stderr.toString()).toBe("");
				expect(result.exitCode).toBe(0);
			} finally {
				await fs.rm(patchFile, { force: true });
			}
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
