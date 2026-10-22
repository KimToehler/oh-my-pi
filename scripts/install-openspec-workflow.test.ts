import { afterEach, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const roots: string[] = [];
const installer = path.join(import.meta.dir, "install-openspec-workflow.ts");
async function project(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "omp-workflow-test-"));
	roots.push(root);
	return root;
}
function install(root: string) {
	return Bun.spawnSync(["bun", installer, root], { stdout: "pipe", stderr: "pipe" });
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

test("installs the project-local workflow into a fresh project", async () => {
	const root = await project();
	const result = install(root);
	expect(result.exitCode).toBe(0);
	expect(await Bun.file(path.join(root, "openspec/config.yaml")).text()).toContain("schema: omp-gated");
	expect(await Bun.file(path.join(root, "openspec/schemas/omp-gated/schema.yaml")).exists()).toBe(true);
	expect(await Bun.file(path.join(root, "scripts/validate-openspec-change.mjs")).exists()).toBe(true);
});

test("preserves existing config and backs up an existing validator", async () => {
	const root = await project();
	await Bun.write(path.join(root, "openspec/config.yaml"), "schema: project-owned\n");
	await Bun.write(path.join(root, "scripts/validate-openspec-change.mjs"), "project-owned\n");
	const result = install(root);
	expect(result.exitCode).toBe(0);
	expect(await Bun.file(path.join(root, "openspec/config.yaml")).text()).toBe("schema: project-owned\n");
	const report = JSON.parse(result.stdout.toString());
	expect(await Bun.file(path.join(report.backupDir, "scripts/validate-openspec-change.mjs")).text()).toBe(
		"project-owned\n",
	);
});

test("updates managed files and backs up local edits on subsequent runs", async () => {
	const root = await project();
	expect(install(root).exitCode).toBe(0);
	const validator = path.join(root, "scripts/validate-openspec-change.mjs");
	await Bun.write(validator, "local edit\n");
	const result = install(root);
	expect(result.exitCode).toBe(0);
	const report = JSON.parse(result.stdout.toString());
	expect(await Bun.file(path.join(report.backupDir, "scripts/validate-openspec-change.mjs")).text()).toBe(
		"local edit\n",
	);
	expect(await Bun.file(validator).text()).toBe(
		await Bun.file(path.join(import.meta.dir, "validate-openspec-change.mjs")).text(),
	);
});
