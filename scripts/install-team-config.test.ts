import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TempDir } from "@oh-my-pi/pi-utils";
import { installTeamConfig } from "./install-team-config";

const dirs: TempDir[] = [];
afterEach(async () => {
	await Promise.all(dirs.splice(0).map(dir => dir.remove()));
});

async function setup(files: Record<string, string>) {
	const tmp = await TempDir.create("@team-config-");
	dirs.push(tmp);
	const repoDir = path.join(tmp.path(), "repo");
	const agentDir = path.join(tmp.path(), "agent");
	for (const [rel, content] of Object.entries(files)) await Bun.write(path.join(repoDir, "team-config", rel), content);
	let run = 0;
	const install = () => installTeamConfig({ repoDir, agentDir, timestamp: `t${++run}` });
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
});
