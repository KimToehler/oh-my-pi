import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { installWorkflow } from "./install-openspec-workflow.mjs";

const SCRIPT = path.join(import.meta.dir, "install-openspec-workflow.mjs");
const SOURCE = path.join(import.meta.dir, "..", "openspec");
const CANONICAL_SCHEMA = path.join(SOURCE, "schemas", "omp-gated");
const SCHEMA = "openspec/schemas/omp-gated";
const CONFIG = "openspec/config.yaml";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) {
		spawnSync("chmod", ["-R", "u+w", root]);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

function git(root: string, ...args: string[]): string {
	const result = spawnSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
		encoding: "utf8",
	});
	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout;
}

function tempDir(): string {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "opsx-install-")));
	roots.push(dir);
	return dir;
}

/** A git project with the given files committed; `uncommitted` files are written afterwards. */
function project(committed: Record<string, string> = {}, uncommitted: Record<string, string> = {}): string {
	const root = tempDir();
	git(root, "init", "-q");
	write(root, { "README.md": "project\n", ...committed });
	git(root, "add", "-A");
	git(root, "commit", "-qm", "init");
	write(root, uncommitted);
	return root;
}

function write(root: string, files: Record<string, string>): void {
	for (const [rel, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	}
}

function listFiles(dir: string, prefix = ""): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (rel === ".git") continue;
		if (entry.isDirectory()) out.push(...listFiles(dir, rel));
		else out.push(rel);
	}
	return out.sort();
}

/** Every project file outside .git with its sha256 (symlinks by target). */
function tree(root: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const rel of listFiles(root)) {
		const full = path.join(root, rel);
		const stat = fs.lstatSync(full);
		out[rel] = stat.isSymbolicLink()
			? `link:${fs.readlinkSync(full)}`
			: createHash("sha256").update(fs.readFileSync(full)).digest("hex");
	}
	return out;
}

const status = (root: string) => git(root, "status", "--porcelain", "--ignored", "--untracked-files=all");
const text = (r: { out: string[]; err: string[] }) => [...r.out, ...r.err].join("\n");
const canonicalFiles = listFiles(CANONICAL_SCHEMA);
const canonical = (rel: string) => fs.readFileSync(path.join(CANONICAL_SCHEMA, rel), "utf8");

/** The committed schema as an older install left it: every canonical file, `gate.md` with a local edit. */
function committedSchema(omit: string[] = []): Record<string, string> {
	const files: Record<string, string> = {};
	for (const rel of canonicalFiles) {
		if (omit.includes(rel)) continue;
		files[`${SCHEMA}/${rel}`] = rel === "templates/gate.md" ? `${canonical(rel)}\nlocal edit\n` : canonical(rel);
	}
	return files;
}

/** Asserts a refusal: exit 1, the message, and the project byte-identical with an unchanged git status. */
function expectRefused(root: string, pattern: RegExp): void {
	const before = tree(root);
	const statusBefore = status(root);
	const r = installWorkflow(root);
	expect(r.code).toBe(1);
	expect(text(r)).toMatch(pattern);
	expect(text(r)).not.toMatch(/\brm\b/);
	expect(tree(root)).toEqual(before);
	expect(status(root)).toBe(statusBefore);
}

describe("install", () => {
	test("fresh project: adds exactly the canonical schema and the team config, and OpenSpec resolves it", () => {
		const root = project();
		const before = tree(root);
		const r = installWorkflow(root);
		expect(r.code).toBe(0);
		const after = tree(root);
		const added = Object.keys(after).filter(rel => !(rel in before));
		expect(added.sort()).toEqual([CONFIG, ...canonicalFiles.map(rel => `${SCHEMA}/${rel}`)].sort());
		for (const rel of Object.keys(before)) expect(after[rel]).toBe(before[rel]);
		for (const rel of canonicalFiles) expect(fs.readFileSync(path.join(root, SCHEMA, rel), "utf8")).toBe(canonical(rel));
		expect(fs.readFileSync(path.join(root, CONFIG), "utf8")).toBe(fs.readFileSync(path.join(SOURCE, "config.yaml"), "utf8"));
		const which = spawnSync("openspec", ["schema", "which", "omp-gated"], {
			cwd: root,
			encoding: "utf8",
			env: { ...process.env, DO_NOT_TRACK: "1", OPENSPEC_TELEMETRY: "0" },
		});
		if (which.error === undefined) expect(which.stdout).toContain("Source: project");
	});

	test("update over a committed local edit and an extra file: replaced wholesale, the old bytes stay in HEAD, the config is untouched", () => {
		const config = "schema: omp-gated\n\nrules:\n  specs:\n    - our own rule\n";
		const root = project({ ...committedSchema(), [`${SCHEMA}/templates/extra.md`]: "ours\n", [CONFIG]: config });
		const r = installWorkflow(root);
		expect(r.code).toBe(0);
		expect(fs.readFileSync(path.join(root, SCHEMA, "templates/gate.md"), "utf8")).toBe(canonical("templates/gate.md"));
		expect(fs.existsSync(path.join(root, SCHEMA, "templates/extra.md"))).toBe(false);
		expect(fs.readFileSync(path.join(root, CONFIG), "utf8")).toBe(config);
		expect(status(root)).toBe(` D ${SCHEMA}/templates/extra.md\n M ${SCHEMA}/templates/gate.md\n`);
		expect(git(root, "show", `HEAD:${SCHEMA}/templates/gate.md`)).toContain("local edit");
		expect(text(r)).toContain(`${SCHEMA}/templates/gate.md`);
	});
});

describe("refusals leave the project byte-identical", () => {
	test("a modified tracked file under the schema", () => {
		const root = project(committedSchema());
		write(root, { [`${SCHEMA}/schema.yaml`]: "edited\n" });
		expectRefused(root, new RegExp(`M ${SCHEMA}/schema\\.yaml`));
	});

	test("an untracked file under the schema", () => {
		const root = project(committedSchema(), { [`${SCHEMA}/notes.md`]: "mine\n" });
		expectRefused(root, new RegExp(`\\?\\? ${SCHEMA}/notes\\.md`));
	});

	test("an ignored file under the schema", () => {
		const root = project({ ...committedSchema(), ".gitignore": "*.local\n" }, { [`${SCHEMA}/x.local`]: "mine\n" });
		expectRefused(root, new RegExp(`!! ${SCHEMA}/x\\.local`));
	});

	test("an untracked config", () => {
		const root = project({}, { [CONFIG]: "schema: omp-gated\n" });
		expectRefused(root, new RegExp(`\\?\\? ${CONFIG}`));
	});

	test("a config with a foreign schema", () => {
		const root = project({ [CONFIG]: "schema: spec-driven\n" });
		expectRefused(root, /schema: spec-driven[^]*schema: omp-gated/);
	});

	test("a config without a schema line", () => {
		const root = project({ [CONFIG]: "rules:\n  specs: []\n" });
		expectRefused(root, /schema: omp-gated/);
	});

	test("a symlinked schema directory", () => {
		const root = project();
		const elsewhere = tempDir();
		fs.mkdirSync(path.join(root, "openspec/schemas"), { recursive: true });
		fs.symlinkSync(elsewhere, path.join(root, SCHEMA));
		git(root, "add", "-A");
		git(root, "commit", "-qm", "link");
		expectRefused(root, /symlink/);
	});

	test("a symlinked openspec directory", () => {
		const root = project();
		const elsewhere = tempDir();
		fs.symlinkSync(elsewhere, path.join(root, "openspec"));
		git(root, "add", "-A");
		git(root, "commit", "-qm", "link");
		expectRefused(root, /symlink/);
	});

	test("a directory that is not a git work tree", () => {
		const root = tempDir();
		write(root, { "file.txt": "x\n" });
		const before = tree(root);
		const r = installWorkflow(root);
		expect(r.code).toBe(1);
		expect(text(r)).toMatch(/git/);
		expect(tree(root)).toEqual(before);
	});

	test("a subdirectory instead of the work-tree root", () => {
		const root = project({ "sub/a.txt": "a\n" });
		const r = installWorkflow(path.join(root, "sub"));
		expect(r.code).toBe(1);
		expect(text(r)).toContain(root);
		expect(fs.existsSync(path.join(root, "openspec"))).toBe(false);
		expect(fs.existsSync(path.join(root, "sub", "openspec"))).toBe(false);
	});

	test("a missing canonical schema (agent dir not deployed)", () => {
		const root = project();
		const before = tree(root);
		const r = installWorkflow(root, { source: tempDir() });
		expect(r.code).toBe(1);
		expect(text(r)).toMatch(/schema/);
		expect(tree(root)).toEqual(before);
	});
});

describe("a failed copy rolls back", () => {
	test("tracked schema missing a canonical file: failure after that file was copied restores HEAD exactly", () => {
		const root = project(committedSchema(["templates/design.md"]));
		const before = tree(root);
		const r = installWorkflow(root, {
			hooks: {
				afterCopy(rel: string) {
					if (rel === "templates/design.md") throw new Error("ENOSPC: no space left on device");
				},
			},
		});
		expect(r.code).toBe(1);
		expect(text(r)).toContain("ENOSPC");
		expect(text(r)).toMatch(/rolled back/);
		expect(tree(root)).toEqual(before);
		expect(status(root)).toBe("");
	});

	test("fresh install: failure after the first file leaves no workflow path", () => {
		const root = project();
		const before = tree(root);
		const r = installWorkflow(root, {
			hooks: {
				afterCopy() {
					throw new Error("EIO: i/o error");
				},
			},
		});
		expect(r.code).toBe(1);
		expect(tree(root)).toEqual(before);
		expect(status(root)).toBe("");
	});

	test("a rollback whose checkout fails reports it did not complete and lists the dirty paths", () => {
		const root = project(committedSchema());
		const r = installWorkflow(root, {
			hooks: {
				afterCopy() {
					throw new Error("ENOSPC: no space left on device");
				},
				beforeRollbackCheckout() {
					throw new Error("ENOSPC: still full");
				},
			},
		});
		expect(r.code).toBe(1);
		expect(text(r)).toMatch(/rollback did not complete/);
		expect(text(r)).not.toMatch(/rolled back/);
		expect(text(r)).toContain(` D ${SCHEMA}/schema.yaml`);
		expect(text(r)).toContain(`git checkout HEAD -- ${SCHEMA}`);
		expect(text(r)).not.toMatch(/\brm\b/);
	});
});

describe("migration notices", () => {
	const OLD_CONFIG =
		"schema: omp-gated\n\noperations:\n  apply:\n    guidance:\n      - Run `node scripts/validate-openspec-change.mjs <change-dir>` before editing source.\n";
	const gate = (tier: string) =>
		canonical("templates/gate.md").replace(/^- \*\*Risk tier\*\*:.*$/m, tier);

	test("an older setup gets one notice per finding and none of its files change", () => {
		const root = project({
			[CONFIG]: OLD_CONFIG,
			"scripts/validate-openspec-change.mjs": "// old copy\n",
			"openspec/changes/open-one/gate.md": gate("- **Review tier**: standard"),
			".omp/commands/opsx-apply.md": "generated\n",
		});
		const flagged = [CONFIG, "scripts/validate-openspec-change.mjs", "openspec/changes/open-one/gate.md", ".omp/commands/opsx-apply.md"];
		const before = tree(root);
		const r = installWorkflow(root);
		expect(r.code).toBe(0);
		const notices = r.out.filter(line => line.startsWith("notice: "));
		expect(notices).toHaveLength(4);
		for (const rel of flagged) {
			expect(notices.filter(line => line.startsWith(`notice: ${rel} `))).toHaveLength(1);
			expect(tree(root)[rel]).toBe(before[rel]);
		}
	});

	test("an archived Review tier change, a Risk tier change and the deployed validator path produce no notice", () => {
		const root = project({
			[CONFIG]: fs.readFileSync(path.join(SOURCE, "config.yaml"), "utf8"),
			"openspec/changes/archive/2026-01-01-old/gate.md": gate("- **Review tier**: standard"),
			"openspec/changes/current/gate.md": gate("- **Risk tier**: product"),
			"openspec/changes/fenced/gate.md": `${gate("- **Risk tier**: product")}\n\`\`\`\n- **Review tier**: standard\n\`\`\`\n`,
		});
		const r = installWorkflow(root);
		expect(r.code).toBe(0);
		expect(r.out.filter(line => line.startsWith("notice: "))).toEqual([]);
	});
});

describe("command line", () => {
	test("defaults to the work-tree root of the current directory and exits 0", () => {
		const root = project({ "sub/a.txt": "a\n" });
		const r = spawnSync(process.execPath, [SCRIPT], { cwd: path.join(root, "sub"), encoding: "utf8" });
		expect(r.status).toBe(0);
		expect(fs.existsSync(path.join(root, SCHEMA, "schema.yaml"))).toBe(true);
	});

	test("a refusal exits 1 on stderr", () => {
		const root = project({ [CONFIG]: "schema: spec-driven\n" });
		const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("spec-driven");
	});
});
