import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const roots: string[] = [];

/** Runs the installed-layout script through a symlinked directory, as the instructions run it from a linked agent dir. */
async function run(...args: string[]): Promise<{ exitCode: number; stdout: string }> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "model-name-"));
	roots.push(root);
	const link = path.join(root, "linked-scripts");
	await fs.symlink(import.meta.dir, link);
	const result = Bun.spawnSync(["node", path.join(link, "model-name.mjs"), ...args]);
	return { exitCode: result.exitCode, stdout: result.stdout.toString() };
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("model-name", () => {
	it("prints one model name per selector, ignoring provider, effort and case", async () => {
		const result = await run("router/cx/gpt-6.1-sol", "openai-codex/GPT-6.1-Sol", "gpt-6.1-sol:high", "router/cc/claude-fable-5-2");
		expect(result).toEqual({ exitCode: 0, stdout: "gpt-6.1-sol\ngpt-6.1-sol\ngpt-6.1-sol\nclaude-fable-5-2\n" });
	});

	it("exits 2 without a selector, so an empty session list never matches a pin", async () => {
		const result = await run();
		expect(result).toEqual({ exitCode: 2, stdout: "" });
	});
});
