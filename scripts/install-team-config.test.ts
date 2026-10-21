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
		expect(manifest.files["AGENTS.md"]).toBe(new Bun.CryptoHasher("sha256").update("v1\n").digest("hex"));
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
		await expect(
			t.install({ beforeApply: () => Bun.write(t.agent(".team-config-manifest.json"), changed).then(() => {}) }),
		).rejects.toThrow("manifest was not updated");
		expect(await t.read(t.agent("AGENTS.md"))).toBe("v2\n");
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(changed);
	});

	test("surfaces a failed partial manifest write together with the apply error", async () => {
		const t = await setup({ "agent/AGENTS.md": "v1\n" });
		await t.install();
		await Bun.write(t.repo("agent/AGENTS.md"), "v2\n");
		const changed = '{"version":1,"files":{}}\n';
		// The edit aborts the apply; the manifest change makes the partial write's recheck fail too.
		const failure = await t
			.install({
				beforeApply: async () => {
					await Bun.write(t.agent("AGENTS.md"), "edited\n");
					await Bun.write(t.agent(".team-config-manifest.json"), changed);
				},
			})
			.then(
				() => undefined,
				err => err as unknown,
			);
		expect(failure).toBeInstanceOf(AggregateError);
		const [original, writeErr] = (failure as AggregateError).errors as Error[];
		expect(original.message).toContain(t.agent("AGENTS.md"));
		expect(writeErr.message).toContain(t.agent(".team-config-manifest.json"));
		expect((failure as Error).message.startsWith(original.message)).toBe(true);
		expect(await t.read(t.agent(".team-config-manifest.json"))).toBe(changed);
	});

});
