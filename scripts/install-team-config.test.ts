import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TempDir } from "@oh-my-pi/pi-utils";
import { type InstallOptions, installTeamConfig } from "./install-team-config";

const dirs: TempDir[] = [];
afterEach(async () => {
	await Promise.all(dirs.splice(0).map(dir => dir.remove()));
});

async function setup(files: Record<string, string>) {
	const tmp = await TempDir.create("@team-config-");
	dirs.push(tmp);
	const repoDir = path.join(tmp.path(), "repo");
	const agentDir = path.join(tmp.path(), "agent");
	await fs.mkdir(path.join(repoDir, "team-config", "agent"), { recursive: true });
	for (const [rel, content] of Object.entries(files)) await Bun.write(path.join(repoDir, "team-config", rel), content);
	let run = 0;
	const install = (extra?: Partial<InstallOptions>) =>
		installTeamConfig({ repoDir, agentDir, timestamp: `t${++run}`, ...extra });
	const repo = (rel: string) => path.join(repoDir, "team-config", rel);
	const agent = (rel: string) => path.join(agentDir, rel);
	const read = (file: string) => Bun.file(file).text();
	return { agentDir, install, repo, agent, read };
}

describe("installTeamConfig", () => {
	test("seeds once and never overwrites the user's copy", async () => {
		const t = await setup({ "seed/config.yml": "team: 1\n" });
		expect((await t.install()).seeded).toEqual(["config.yml"]);
		await Bun.write(t.agent("config.yml"), "mine: 1\n");
		await Bun.write(t.repo("seed/config.yml"), "team: 2\n");
		expect((await t.install()).seeded).toEqual([]);
		expect(await t.read(t.agent("config.yml"))).toBe("mine: 1\n");
	});

	test("updates a managed file it wrote without a backup, but backs up a local edit first", async () => {
		const t = await setup({ "agent/rules/a.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/rules/a.md"), "v2\n");
		const clean = await t.install();
		expect(clean.updated).toEqual(["rules/a.md"]);
		expect(clean.backupDir).toBeUndefined();

		await Bun.write(t.agent("rules/a.md"), "local edit\n");
		await Bun.write(t.repo("agent/rules/a.md"), "v3\n");
		const edited = await t.install();
		expect(await t.read(t.agent("rules/a.md"))).toBe("v3\n");
		expect(await t.read(path.join(edited.backupDir!, "rules/a.md"))).toBe("local edit\n");
	});

	test("backs up a same-named file that predates the manifest", async () => {
		const t = await setup({ "agent/AGENTS.md": "team\n" });
		await Bun.write(t.agent("AGENTS.md"), "personal\n");
		const report = await t.install();
		expect(await t.read(t.agent("AGENTS.md"))).toBe("team\n");
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("personal\n");
	});

	test("manifest handles files named like Object.prototype members", async () => {
		const t = await setup({ "agent/constructor": "c\n", "agent/__proto__": "p\n", "agent/keep.md": "k\n" });
		await t.install();
		expect(await t.read(t.agent("constructor"))).toBe("c\n");
		expect(await t.read(t.agent("__proto__"))).toBe("p\n");
		const manifestFile = t.agent(".team-config-manifest.json");
		const parsed = JSON.parse(await t.read(manifestFile)) as { files: Record<string, unknown> };
		expect(Object.hasOwn(parsed.files, "constructor")).toBe(true);
		expect(Object.hasOwn(parsed.files, "__proto__")).toBe(true);

		await fs.rm(t.repo("agent/constructor"));
		await fs.rm(t.repo("agent/__proto__"));
		const report = await t.install();
		expect(report.removed.sort()).toEqual(["__proto__", "constructor"]);
		expect(await Bun.file(t.agent("constructor")).exists()).toBe(false);
		expect(await Bun.file(t.agent("__proto__")).exists()).toBe(false);
		const after = JSON.parse(await t.read(manifestFile)) as { files: Record<string, unknown> };
		expect(Object.hasOwn(after.files, "constructor")).toBe(false);
		expect(Object.hasOwn(after.files, "__proto__")).toBe(false);
		expect(Object.hasOwn(after.files, "keep.md")).toBe(true);
	});

	test("removes files that left the repo, keeps local edits in backup, and leaves unmanaged files alone", async () => {
		const t = await setup({
			"agent/skills/old/SKILL.md": "old\n",
			"agent/rules/gone.md": "gone\n",
			"agent/rules/keep.md": "keep\n",
		});
		await Bun.write(t.agent("rules/mine.md"), "mine\n");
		await t.install();
		await Bun.write(t.agent("rules/gone.md"), "edited\n");
		await fs.rm(t.repo("agent/skills"), { recursive: true });
		await fs.rm(t.repo("agent/rules/gone.md"));

		const report = await t.install();
		expect(report.removed).toEqual(["rules/gone.md", "skills/old/SKILL.md"]);
		await expect(fs.stat(t.agent("skills"))).rejects.toThrow("ENOENT");
		expect(await t.read(path.join(report.backupDir!, "rules/gone.md"))).toBe("edited\n");
		expect(await t.read(t.agent("rules/mine.md"))).toBe("mine\n");
		expect(await t.read(t.agent("rules/keep.md"))).toBe("keep\n");
	});

	test("keeps the executable bit of shipped scripts", async () => {
		const t = await setup({ "agent/skills/s/run.sh": "#!/bin/sh\n" });
		await fs.chmod(t.repo("agent/skills/s/run.sh"), 0o755);
		await t.install();
		expect((await fs.stat(t.agent("skills/s/run.sh"))).mode & 0o111).not.toBe(0);
	});

	test("never touches pre-existing files that look like temp files", async () => {
		const t = await setup({ "agent/rules/a.md": "v1\n" });
		await Bun.write(t.agent("rules/a.md.team-config-tmp"), "sentinel-1");
		await Bun.write(t.agent(".team-config-manifest.json.tmp"), "sentinel-2");
		await t.install();
		expect(await t.read(t.agent("rules/a.md"))).toBe("v1\n");
		expect(await t.read(t.agent("rules/a.md.team-config-tmp"))).toBe("sentinel-1");
		expect(await t.read(t.agent(".team-config-manifest.json.tmp"))).toBe("sentinel-2");
	});

	test("rejects a symlinked parent directory without changing anything", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n", "agent/AGENTS.md": "team\n" });
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await Bun.write(path.join(outside, "a.md"), "outside\n");
		await fs.mkdir(t.agentDir, { recursive: true });
		await fs.symlink(outside, t.agent("rules"));
		await expect(t.install()).rejects.toThrow(t.agent("rules"));
		expect(await fs.readdir(outside)).toEqual(["a.md"]);
		expect(await t.read(path.join(outside, "a.md"))).toBe("outside\n");
		expect((await fs.readdir(t.agentDir)).sort()).toEqual(["rules"]);
	});

	test("replaces a symlinked target with a regular file and moves the link into the backup", async () => {
		const t = await setup({ "agent/AGENTS.md": "team\n" });
		const outsideFile = path.join(path.dirname(t.agentDir), "outside.md");
		await Bun.write(outsideFile, "outside\n");
		await fs.mkdir(t.agentDir, { recursive: true });
		await fs.symlink(outsideFile, t.agent("AGENTS.md"));
		const report = await t.install();
		expect((await fs.lstat(t.agent("AGENTS.md"))).isFile()).toBe(true);
		expect(await t.read(t.agent("AGENTS.md"))).toBe("team\n");
		expect(await t.read(outsideFile)).toBe("outside\n");
		expect((await fs.lstat(path.join(report.backupDir!, "AGENTS.md"))).isSymbolicLink()).toBe(true);
	});

	test("installs through a symlinked agent dir", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n" });
		const real = path.join(path.dirname(t.agentDir), "real-agent");
		await fs.mkdir(real, { recursive: true });
		await fs.symlink(real, t.agentDir);
		await t.install();
		expect(await t.read(path.join(real, "rules/a.md"))).toBe("team\n");
	});

	test("rejects when the managed source root disappears and keeps installed files", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n" });
		await t.install();
		await fs.rm(t.repo("agent"), { recursive: true });
		await expect(t.install()).rejects.toThrow("ENOENT");
		expect(await t.read(t.agent("rules/a.md"))).toBe("team\n");
	});

	test("rejects on an unreadable nested source dir without removing anything", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n", "agent/old.md": "old\n" });
		await t.install();
		await fs.rm(t.repo("agent/old.md"));
		await fs.chmod(t.repo("agent/rules"), 0o000);
		try {
			await expect(t.install()).rejects.toThrow();
		} finally {
			await fs.chmod(t.repo("agent/rules"), 0o755);
		}
		expect(await t.read(t.agent("old.md"))).toBe("old\n");
		expect(await t.read(t.agent("rules/a.md"))).toBe("team\n");
	});

	test("rejects a managed source file replaced by a symlink and keeps installed files", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n", "agent/b.md": "b\n", "agent/other.md": "other\n" });
		await t.install();
		await fs.rm(t.repo("agent/rules/a.md"));
		await fs.symlink(t.repo("agent/other.md"), t.repo("agent/rules/a.md"));
		await expect(t.install()).rejects.toThrow(
			`Unsupported entry in team config source (symlink): ${t.repo("agent/rules/a.md")}`,
		);
		expect(await t.read(t.agent("rules/a.md"))).toBe("team\n");
		expect(await t.read(t.agent("b.md"))).toBe("b\n");
		expect(await t.read(t.agent("other.md"))).toBe("other\n");
	});

	test("rejects a managed source directory replaced by a symlink and keeps its files installed", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n", "agent/real/x.md": "x\n" });
		await t.install();
		await fs.rm(t.repo("agent/rules"), { recursive: true });
		await fs.symlink(t.repo("agent/real"), t.repo("agent/rules"));
		await expect(t.install()).rejects.toThrow(
			`Unsupported entry in team config source (symlink): ${t.repo("agent/rules")}`,
		);
		expect(await t.read(t.agent("rules/a.md"))).toBe("team\n");
		expect(await t.read(t.agent("real/x.md"))).toBe("x\n");
	});

	test("rejects a symlink named like an Object.prototype member (only exact listed names are skipped)", async () => {
		const t = await setup({ "agent/a.md": "a\n" });
		await fs.symlink(t.repo("agent/a.md"), t.repo("agent/constructor"));
		await expect(t.install()).rejects.toThrow(
			`Unsupported entry in team config source (symlink): ${t.repo("agent/constructor")}`,
		);
		await expect(fs.lstat(t.agent("a.md"))).rejects.toThrow("ENOENT");
	});

	test("rejects a symlink under seed/", async () => {
		const t = await setup({ "seed/config.yml": "team: 1\n", "agent/a.md": "a\n" });
		await fs.symlink(t.repo("seed/config.yml"), t.repo("seed/link.yml"));
		await expect(t.install()).rejects.toThrow(
			`Unsupported entry in team config source (symlink): ${t.repo("seed/link.yml")}`,
		);
		await expect(fs.lstat(t.agent("a.md"))).rejects.toThrow("ENOENT");
	});

	test("rejects a managed source root replaced by a symlink and keeps installed files", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n" });
		await t.install();
		const manifestBefore = await t.read(t.agent(".team-config-manifest.json"));
		const empty = path.join(path.dirname(t.agentDir), "empty-source");
		await fs.mkdir(empty, { recursive: true });
		await fs.rm(t.repo("agent"), { recursive: true });
		await fs.symlink(empty, t.repo("agent"));
		await expect(t.install()).rejects.toThrow(t.repo("agent"));
		expect(await t.read(t.agent("rules/a.md"))).toBe("team\n");
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(manifestBefore);
	});

	test("rejects a symlinked seed root without seeding", async () => {
		const t = await setup({ "agent/a.md": "a\n" });
		const real = path.join(path.dirname(t.agentDir), "real-seed");
		await Bun.write(path.join(real, "config.yml"), "team: 1\n");
		await fs.symlink(real, t.repo("seed"));
		await expect(t.install()).rejects.toThrow(t.repo("seed"));
		await expect(fs.lstat(t.agent("config.yml"))).rejects.toThrow("ENOENT");
	});

	test("never overwrites a pre-existing backup file that shares the run's timestamp", async () => {
		const t = await setup({ "agent/rules/a.md": "v1\n" });
		await t.install();
		const sentinel = t.agent("backups/team-config-t2/rules/a.md");
		await Bun.write(sentinel, "sentinel\n");
		await Bun.write(t.agent("rules/a.md"), "local edit\n");
		const report = await t.install();
		expect(await t.read(sentinel)).toBe("sentinel\n");
		expect(report.backupDir).not.toBe(t.agent("backups/team-config-t2"));
		expect(await t.read(path.join(report.backupDir!, "rules/a.md"))).toBe("local edit\n");
	});

	test("does not write through a symlink planted at the backup leaf", async () => {
		const t = await setup({ "agent/AGENTS.md": "team\n" });
		await t.install();
		const outsideFile = path.join(path.dirname(t.agentDir), "outside.md");
		await Bun.write(outsideFile, "outside\n");
		await fs.mkdir(t.agent("backups/team-config-t2"), { recursive: true });
		await fs.symlink(outsideFile, t.agent("backups/team-config-t2/AGENTS.md"));
		await Bun.write(t.agent("AGENTS.md"), "local edit\n");
		const report = await t.install();
		expect(await t.read(outsideFile)).toBe("outside\n");
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("local edit\n");
	});

	test("does not write through a symlink planted at the run's backup dir", async () => {
		const t = await setup({ "agent/AGENTS.md": "team\n" });
		await t.install();
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await fs.mkdir(outside, { recursive: true });
		await fs.mkdir(t.agent("backups"), { recursive: true });
		await fs.symlink(outside, t.agent("backups/team-config-t2"));
		await Bun.write(t.agent("AGENTS.md"), "local edit\n");
		const report = await t.install();
		expect(await fs.readdir(outside)).toEqual([]);
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("local edit\n");
	});

	test("rejects a symlinked backups dir before changing anything, even when no backup is needed", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n" });
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await fs.mkdir(outside, { recursive: true });
		await fs.mkdir(t.agentDir, { recursive: true });
		await fs.symlink(outside, t.agent("backups"));
		await expect(t.install()).rejects.toThrow(t.agent("backups"));
		expect(await fs.readdir(outside)).toEqual([]);
		expect((await fs.readdir(t.agentDir)).sort()).toEqual(["backups"]);
	});

	test("installs a mode-only change without backup and restores a locally removed exec bit", async () => {
		const t = await setup({ "agent/skills/s/run.sh": "#!/bin/sh\n" });
		await t.install();
		expect((await fs.stat(t.agent("skills/s/run.sh"))).mode & 0o111).toBe(0);
		await fs.chmod(t.repo("agent/skills/s/run.sh"), 0o755);
		const gained = await t.install();
		expect(gained.updated).toEqual(["skills/s/run.sh"]);
		expect(gained.backupDir).toBeUndefined();
		expect((await fs.stat(t.agent("skills/s/run.sh"))).mode & 0o777).toBe(0o755);

		await fs.chmod(t.agent("skills/s/run.sh"), 0o644);
		const restored = await t.install();
		expect(restored.updated).toEqual(["skills/s/run.sh"]);
		expect(restored.backupDir).toBeUndefined();
		expect((await fs.stat(t.agent("skills/s/run.sh"))).mode & 0o777).toBe(0o755);

		const settled = await t.install();
		expect(settled.updated).toEqual([]);
	});

	test("installs the bytes it hashed even when the source changes before apply", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install({ beforeApply: () => Bun.write(t.repo("agent/AGENTS.md"), "v2\n").then(() => {}) });
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v1\n");
		const manifest = await Bun.file(t.agent(".team-config-manifest.json")).json();
		expect(manifest.files["AGENTS.md"]).toEqual({
			hash: new Bun.CryptoHasher("sha256").update("v1\n").digest("hex"),
		});
	});

	test("aborts instead of overwriting a managed file edited after planning", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		await expect(
			t.install({ beforeApply: () => Bun.write(t.agent("AGENTS.md"), "edited\n").then(() => {}) }),
		).rejects.toThrow(t.agent("AGENTS.md"));
		expect(await t.read(t.agent("AGENTS.md"))).toBe("edited\n");
	});

	test("aborts when a parent directory becomes a symlink after planning", async () => {
		const t = await setup({ "agent/rules/a.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/rules/a.md"), "v2\n");
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await Bun.write(path.join(outside, "a.md"), "outside\n");
		await expect(
			t.install({
				beforeApply: async () => {
					await fs.rename(t.agent("rules"), path.join(path.dirname(t.agentDir), "moved-rules"));
					await fs.symlink(outside, t.agent("rules"));
				},
			}),
		).rejects.toThrow(t.agent("rules"));
		expect(await fs.readdir(outside)).toEqual(["a.md"]);
		expect(await t.read(path.join(outside, "a.md"))).toBe("outside\n");
	});

	test("aborts when a managed file's mode changes after planning", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		await expect(t.install({ beforeApply: () => fs.chmod(t.agent("AGENTS.md"), 0o600) })).rejects.toThrow(
			t.agent("AGENTS.md"),
		);
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v1\n");
		expect((await fs.stat(t.agent("AGENTS.md"))).mode & 0o777).toBe(0o600);
	});

	test("aborts when a symlink is retargeted after planning", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await Bun.write(path.join(outside, "one.md"), "one\n");
		await Bun.write(path.join(outside, "two.md"), "two\n");
		await fs.mkdir(t.agentDir, { recursive: true });
		await fs.symlink(path.join(outside, "one.md"), t.agent("AGENTS.md"));
		await expect(
			t.install({
				beforeApply: async () => {
					await fs.rm(t.agent("AGENTS.md"));
					await fs.symlink(path.join(outside, "two.md"), t.agent("AGENTS.md"));
				},
			}),
		).rejects.toThrow(t.agent("AGENTS.md"));
		expect(await fs.readlink(t.agent("AGENTS.md"))).toBe(path.join(outside, "two.md"));
		expect(await t.read(path.join(outside, "one.md"))).toBe("one\n");
		expect(await t.read(path.join(outside, "two.md"))).toBe("two\n");
	});

	test("rejects a symlinked manifest before writing anything", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		const outside = path.join(path.dirname(t.agentDir), "outside.json");
		const linked = '{"version":1,"files":{}}\n';
		await Bun.write(outside, linked);
		await fs.mkdir(t.agentDir, { recursive: true });
		await fs.symlink(outside, t.agent(".team-config-manifest.json"));
		await expect(t.install()).rejects.toThrow(t.agent(".team-config-manifest.json"));
		expect(await fs.readlink(t.agent(".team-config-manifest.json"))).toBe(outside);
		expect(await t.read(outside)).toBe(linked);
		expect(await Bun.file(t.agent("AGENTS.md")).exists()).toBe(false);
	});

	test("final manifest write refuses a manifest changed after planning and keeps its bytes", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		const changed = '{"version":1,"files":{}}\n';
		// A change before apply is caught by the intent write, before any mutation; one during apply, by the final write.
		await expect(
			t.install({ beforeApply: () => Bun.write(t.agent(".team-config-manifest.json"), changed).then(() => {}) }),
		).rejects.toThrow("changed after planning");
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v1\n");
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(changed);
		await expect(
			t.install({ afterStep: () => Bun.write(t.agent(".team-config-manifest.json"), changed).then(() => {}) }),
		).rejects.toThrow("manifest was not updated");
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v2\n");
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(changed);
	});

	test("surfaces a failed partial manifest write together with the apply error", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n", "agent/b.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		await Bun.write(t.repo("agent/b.md"), "v2\n");
		const changed = '{"version":1,"files":{}}\n';
		// AGENTS.md is applied first (so the partial manifest is due); the b.md edit then aborts the apply; the manifest change makes the partial write's recheck fail too.
		const failure = await t
			.install({
				afterStep: async rel => {
					if (rel !== "AGENTS.md") return;
					await Bun.write(t.agent("b.md"), "edited\n");
					await Bun.write(t.agent(".team-config-manifest.json"), changed);
				},
			})
			.then(
				() => undefined,
				err => err as unknown,
			);
		expect(failure).toBeInstanceOf(AggregateError);
		const [original, writeErr] = (failure as AggregateError).errors as Error[];
		expect(original.message).toContain(t.agent("b.md"));
		expect(writeErr.message).toContain(t.agent(".team-config-manifest.json"));
		expect((failure as Error).message.startsWith(original.message)).toBe(true);
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(changed);
	});

	const manifestPath = ".team-config-manifest.json";
	const failOn = (kind: "intent" | "partial" | "final") => async (got: string) => {
		if (got === kind) throw new Error(`injected ${kind} manifest write failure`);
	};

	test("a failed final manifest write leaves the touched path adopted, so a later edit back to the old bytes is backed up", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		await expect(t.install({ writeManifestHook: failOn("final") })).rejects.toThrow("injected final");
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v2\n");

		await Bun.write(t.agent("AGENTS.md"), "v1\n");
		await Bun.write(t.repo("agent/AGENTS.md"), "v3\n");
		const report = await t.install();
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v3\n");
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("v1\n");
	});

	test("a failed partial manifest write leaves the touched path adopted, so a later edit back to the old bytes is backed up", async () => {
		const t = await setup({ "agent/a.md": "v1\n", "agent/b.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/a.md"), "v2\n");
		await Bun.write(t.repo("agent/b.md"), "v2\n");
		const failure = await t
			.install({
				writeManifestHook: failOn("partial"),
				afterStep: async rel => {
					if (rel === "a.md") throw new Error("abort mid-apply");
				},
			})
			.then(
				() => undefined,
				err => err as unknown,
			);
		expect(failure).toBeInstanceOf(AggregateError);
		expect(await t.read(t.agent("a.md"))).toBe("v2\n");
		expect(await t.read(t.agent("b.md"))).toBe("v1\n");

		await Bun.write(t.agent("a.md"), "v1\n");
		await Bun.write(t.repo("agent/a.md"), "v3\n");
		const report = await t.install();
		expect(await t.read(t.agent("a.md"))).toBe("v3\n");
		expect(await t.read(path.join(report.backupDir!, "a.md"))).toBe("v1\n");
	});

	test("a successful partial manifest keeps written paths adopted, so a later edit is backed up", async () => {
		const t = await setup({ "agent/a.md": "v1\n", "agent/b.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/a.md"), "v2\n");
		await Bun.write(t.repo("agent/b.md"), "v2\n");
		await expect(
			t.install({
				afterStep: async rel => {
					if (rel === "a.md") throw new Error("abort mid-apply");
				},
			}),
		).rejects.toThrow("abort mid-apply");
		const entry = (await Bun.file(t.agent(manifestPath)).json()).files["a.md"];
		expect(entry.adopted).toBe(true);
		expect(entry.hash).toBe(new Bun.CryptoHasher("sha256").update("v2\n").digest("hex"));

		await Bun.write(t.agent("a.md"), "user edit\n");
		await Bun.write(t.repo("agent/a.md"), "v3\n");
		const report = await t.install();
		expect(await t.read(t.agent("a.md"))).toBe("v3\n");
		expect(await t.read(path.join(report.backupDir!, "a.md"))).toBe("user edit\n");
	});

	test("a partial manifest keeps a removed path adopted; only the final manifest drops it", async () => {
		const t = await setup({ "agent/a.md": "v1\n", "agent/b.md": "v1\n" });
		await t.install();
		await fs.rm(t.repo("agent/a.md"));
		await Bun.write(t.repo("agent/b.md"), "v2\n");
		await expect(
			t.install({
				afterStep: async rel => {
					if (rel === "a.md") throw new Error("abort mid-apply");
				},
			}),
		).rejects.toThrow("abort mid-apply");
		expect(await Bun.file(t.agent("a.md")).exists()).toBe(false);
		const partial = (await Bun.file(t.agent(manifestPath)).json()).files["a.md"];
		expect(partial.adopted).toBe(true);

		await t.install();
		expect((await Bun.file(t.agent(manifestPath)).json()).files["a.md"]).toBeUndefined();
		expect(await t.read(t.agent("b.md"))).toBe("v2\n");
	});

	test("a failed intent manifest write aborts before any mutation", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n", "agent/old.md": "old\n" });
		await t.install();
		const before = await t.read(t.agent(manifestPath));
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		await fs.rm(t.repo("agent/old.md"));
		await expect(t.install({ writeManifestHook: failOn("intent") })).rejects.toThrow("injected intent");
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v1\n");
		expect(await t.read(t.agent("old.md"))).toBe("old\n");
		expect(await t.read(t.agent(manifestPath))).toBe(before);
		expect(await fs.readdir(t.agentDir)).not.toContain("backups");
	});

	test("backs up an adopted file once, then treats it as owned", async () => {
		const t = await setup({ "agent/AGENTS.md": "orig\n" });
		await Bun.write(t.agent("AGENTS.md"), "orig\n");
		const adopt = await t.install();
		expect(adopt.backupDir).toBeUndefined();
		expect((await Bun.file(t.agent(".team-config-manifest.json")).json()).files["AGENTS.md"].adopted).toBe(true);

		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		const second = await t.install();
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v2\n");
		expect(await t.read(path.join(second.backupDir!, "AGENTS.md"))).toBe("orig\n");

		await Bun.write(t.repo("agent/AGENTS.md"), "v3\n");
		const third = await t.install();
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v3\n");
		expect(third.backupDir).toBeUndefined();
	});

	test("moves an adopted file into the backup when it leaves the repo", async () => {
		const t = await setup({ "agent/AGENTS.md": "orig\n", "agent/b.md": "b\n" });
		await Bun.write(t.agent("b.md"), "b\n");
		await t.install();
		await fs.rm(t.repo("agent/b.md"));
		const report = await t.install();
		expect(report.removed).toEqual(["b.md"]);
		expect(await t.read(path.join(report.backupDir!, "b.md"))).toBe("b\n");
		expect(await Bun.file(t.agent("b.md")).exists()).toBe(false);
	});

	test("reads a version 1 manifest as adopted and rewrites it as version 2", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await fs.mkdir(t.agentDir, { recursive: true });
		await Bun.write(t.agent("AGENTS.md"), "v1\n");
		const sha = new Bun.CryptoHasher("sha256").update("v1\n").digest("hex");
		await Bun.write(
			t.agent(".team-config-manifest.json"),
			JSON.stringify({ version: 1, files: { "AGENTS.md": sha } }),
		);
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		const report = await t.install();
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("v1\n");
		const manifest = await Bun.file(t.agent(".team-config-manifest.json")).json();
		expect(manifest.version).toBe(2);
		expect(manifest.files["AGENTS.md"].adopted).toBeUndefined();
	});

	test("loads a version 1 manifest shaped like a real one (tabs, trailing newline)", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await fs.mkdir(t.agentDir, { recursive: true });
		await Bun.write(t.agent("AGENTS.md"), "v1\n");
		const sha = new Bun.CryptoHasher("sha256").update("v1\n").digest("hex");
		await Bun.write(
			t.agent(".team-config-manifest.json"),
			`{\n\t"version": 1,\n\t"files": {\n\t\t"AGENTS.md": "${sha}"\n\t}\n}\n`,
		);
		const report = await t.install();
		expect(report.updated).toEqual([]);
		expect((await Bun.file(t.agent(".team-config-manifest.json")).json()).version).toBe(2);
	});

	describe("manifest backup", () => {
		const manifestName = ".team-config-manifest.json";
		const sidecarName = ".team-config-manifest.sha256";

		test("backs up a hand-written v2 manifest byte-for-byte, then replaces it", async () => {
			const t = await setup({ "agent/AGENTS.md": "v1\n" });
			await fs.mkdir(t.agentDir, { recursive: true });
			await Bun.write(t.agent("AGENTS.md"), "v1\n");
			const original = '{"files":{},"version":2}';
			await Bun.write(t.agent(manifestName), original);
			const report = await t.install();
			expect(report.backedUp).toContain(manifestName);
			expect(await t.read(path.join(report.backupDir!, manifestName))).toBe(original);
			expect(await t.read(t.agent(manifestName))).not.toBe(original);
			expect((await Bun.file(t.agent(manifestName)).json()).files["AGENTS.md"]).toBeDefined();
		});

		test("does not back up a manifest the installer wrote", async () => {
			const t = await setup({ "agent/AGENTS.md": "v1\n" });
			await t.install();
			expect(await Bun.file(t.agent(sidecarName)).exists()).toBe(true);
			const second = await t.install();
			expect(second.backupDir).toBeUndefined();
			expect(second.backedUp).toEqual([]);
			expect(await fs.readdir(t.agentDir)).not.toContain("backups");
		});

		test("backs up a v1 manifest without a sidecar once, then not again", async () => {
			const t = await setup({ "agent/AGENTS.md": "v1\n" });
			await fs.mkdir(t.agentDir, { recursive: true });
			await Bun.write(t.agent("AGENTS.md"), "v1\n");
			const sha = new Bun.CryptoHasher("sha256").update("v1\n").digest("hex");
			const original = `{\n\t"version": 1,\n\t"files": {\n\t\t"AGENTS.md": "${sha}"\n\t}\n}\n`;
			await Bun.write(t.agent(manifestName), original);
			const first = await t.install();
			expect(await t.read(path.join(first.backupDir!, manifestName))).toBe(original);
			const second = await t.install();
			expect(second.backupDir).toBeUndefined();
		});

		test("rejects a symlinked sidecar before any mutation", async () => {
			const t = await setup({ "agent/AGENTS.md": "v1\n" });
			await t.install();
			await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
			const outside = path.join(path.dirname(t.agentDir), "outside.sha256");
			await Bun.write(outside, "x\n");
			await fs.rm(t.agent(sidecarName));
			await fs.symlink(outside, t.agent(sidecarName));
			const manifestBefore = await t.read(t.agent(manifestName));
			await expect(t.install()).rejects.toThrow(t.agent(sidecarName));
			expect(await fs.readlink(t.agent(sidecarName))).toBe(outside);
			expect(await t.read(outside)).toBe("x\n");
			expect(await t.read(t.agent("AGENTS.md"))).toBe("v1\n");
			expect(await t.read(t.agent(manifestName))).toBe(manifestBefore);
		});
	});

	describe("strict manifest schema", () => {
		const sha = new Bun.CryptoHasher("sha256").update("v1\n").digest("hex");
		const cases: Array<[string, unknown]> = [
			["a duplicated top-level files member", `{"version":2,"files":{"AGENTS.md":{"hash":"${sha}"}},"files":{}}`],
			[
				"a duplicated file entry key",
				`{"version":2,"files":{"AGENTS.md":{"hash":"${sha}"},"AGENTS.md":{"hash":"${sha}"}}}`,
			],
			[
				"an escaped-equivalent duplicate member",
				`{"version":2,"files":{"AGENTS.md":{"hash":"${sha}"}},"\\u0066iles":{}}`,
			],
			["a duplicated entry hash member", `{"version":2,"files":{"AGENTS.md":{"hash":"${sha}","hash":"${sha}"}}}`],
			["an extra top-level key", { version: 2, files: {}, extra: 1 }],
			["an extra top-level key in a version 1 manifest", { version: 1, files: {}, extra: 1 }],
			["an extra entry key", { version: 2, files: { "AGENTS.md": { hash: sha, note: "x" } } }],
			["a non-hex hash", { version: 2, files: { "AGENTS.md": { hash: "not-a-hash" } } }],
			["a non-hex version 1 hash", { version: 1, files: { "AGENTS.md": "zz" } }],
			["a non-true adopted flag", { version: 2, files: { "AGENTS.md": { hash: sha, adopted: false } } }],
		];
		for (const [name, manifest] of cases) {
			test(`rejects ${name} naming the manifest and leaves the agent dir unchanged`, async () => {
				const t = await setup({ "agent/AGENTS.md": "v2\n", "agent/b.md": "b\n" });
				await fs.mkdir(t.agentDir, { recursive: true });
				await Bun.write(t.agent("AGENTS.md"), "v1\n");
				const manifestFile = t.agent(".team-config-manifest.json");
				await Bun.write(
					manifestFile,
					typeof manifest === "string" ? manifest : JSON.stringify(manifest, null, "\t"),
				);
				const snapshot = async () =>
					Promise.all(
						(await fs.readdir(t.agentDir, { recursive: true })).sort().map(async rel => {
							const stat = await fs.stat(t.agent(rel));
							return [rel, stat.isFile() ? await t.read(t.agent(rel)) : "<dir>"];
						}),
					);
				const before = await snapshot();
				await expect(t.install()).rejects.toThrow(manifestFile);
				expect(await snapshot()).toEqual(before);
			});
		}
	});

	test("leaves no manifest or managed file when a fresh install aborts before its first step", async () => {
		const t = await setup({ "agent/rules/a.md": "team\n" });
		const outside = path.join(path.dirname(t.agentDir), "outside");
		await Bun.write(path.join(outside, "keep.md"), "outside\n");
		await expect(
			t.install({
				beforeApply: async () => {
					await fs.symlink(outside, t.agent("rules"));
				},
			}),
		).rejects.toThrow(t.agent("rules"));
		expect(await Bun.file(t.agent(".team-config-manifest.json")).exists()).toBe(false);
		expect(await fs.readdir(outside)).toEqual(["keep.md"]);
		expect(await t.read(path.join(outside, "keep.md"))).toBe("outside\n");
	});

	test("treats a local edit that later matches the source as adopted, so the next update backs it up", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.agent("AGENTS.md"), "v2\n");
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		expect((await t.install()).backupDir).toBeUndefined();
		await Bun.write(t.repo("agent/AGENTS.md"), "v3\n");
		const report = await t.install();
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v3\n");
		expect(await t.read(path.join(report.backupDir!, "AGENTS.md"))).toBe("v2\n");
	});

	for (const target of ["run dir", "backups root"] as const) {
		test(`rechecks the backup location before every backup: ${target} swapped for a symlink between two backups`, async () => {
			const t = await setup({ "agent/a.md": "a1\n", "agent/b.md": "b1\n" });
			await t.install();
			await Bun.write(t.agent("a.md"), "a local\n");
			await Bun.write(t.agent("b.md"), "b local\n");
			await Bun.write(t.repo("agent/a.md"), "a2\n");
			await Bun.write(t.repo("agent/b.md"), "b2\n");
			const outside = path.join(path.dirname(t.agentDir), "outside");
			await fs.mkdir(outside, { recursive: true });
			await expect(
				t.install({
					afterStep: async rel => {
						if (rel !== "a.md") return;
						const root = t.agent("backups");
						const [run] = await fs.readdir(root);
						if (target === "run dir") {
							await fs.rename(path.join(root, run), path.join(root, "moved"));
							await fs.symlink(outside, path.join(root, run));
						} else {
							await fs.rename(root, t.agent("backups-moved"));
							await fs.symlink(outside, root);
							await fs.mkdir(path.join(outside, run));
						}
					},
				}),
			).rejects.toThrow(/symlink/);
			const leaked =
				target === "run dir"
					? await fs.readdir(outside)
					: await fs.readdir(path.join(outside, (await fs.readdir(outside))[0]));
			expect(leaked).toEqual([]);
		});
	}
});
