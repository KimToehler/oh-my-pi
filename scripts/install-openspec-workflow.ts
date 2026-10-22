#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { installTeamConfig } from "./install-team-config";

const source = path.resolve(import.meta.dir, "..");
const target = process.argv[2];
if (!target || process.argv.length !== 3) {
	process.stderr.write("usage: bun scripts/install-openspec-workflow.ts <project-root>\n");
	process.exitCode = 2;
} else {
	const staging = await fs.mkdtemp(path.join(os.tmpdir(), "omp-openspec-install-"));
	try {
		const managed = path.join(staging, "team-config", "agent");
		const seed = path.join(staging, "team-config", "seed");
		await fs.mkdir(path.join(managed, "openspec", "schemas"), { recursive: true });
		await fs.mkdir(path.join(managed, "scripts"), { recursive: true });
		await fs.mkdir(path.join(seed, "openspec"), { recursive: true });
		await fs.cp(path.join(source, "openspec/schemas/omp-gated"), path.join(managed, "openspec/schemas/omp-gated"), {
			recursive: true,
		});
		await fs.copyFile(
			path.join(source, "scripts/validate-openspec-change.mjs"),
			path.join(managed, "scripts/validate-openspec-change.mjs"),
		);
		await fs.copyFile(path.join(source, "team-config/openspec-config.yaml"), path.join(seed, "openspec/config.yaml"));
		const report = await installTeamConfig({
			repoDir: staging,
			agentDir: path.resolve(target),
			timestamp: `openspec-${Date.now()}-${crypto.randomUUID()}`,
		});
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}
