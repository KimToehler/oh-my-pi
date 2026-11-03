import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { TempDir } from "@oh-my-pi/pi-utils";
import { loadDataset } from "./plan-review-replay/input";
import type { Dataset, Source } from "./plan-review-replay/types";
import { run } from "./score-plan-review-replay";
import { attempt, base } from "./plan-review-replay-input-fixtures";
import "./score-plan-review-replay-report.test";
import "./plan-review-replay-validation-cases";
import "./plan-review-replay-publish-cases";

const dirs: TempDir[] = [];
afterEach(async () => {
	await Promise.all(dirs.splice(0).map(dir => dir.remove()));
});

function sha(text: string): string {
	return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

async function setup(data: Dataset, files: Record<string, string> = {}, sources: readonly Source[] = data.sources) {
	const tmp = await TempDir.create("@plan-replay-");
	dirs.push(tmp);
	const dir = tmp.path();
	for (const [name, content] of Object.entries(files)) await Bun.write(path.join(dir, name), content);
	await Bun.write(path.join(dir, "dataset.json"), JSON.stringify(data));
	await Bun.write(path.join(dir, "input-manifest.json"), JSON.stringify(sources));
	return dir;
}

function source(over: Partial<Source> & Pick<Source, "id">, content: string): Source {
	return { path: `${over.id}.txt`, sha256: sha(content), provided: true, provenance: "frozen", ...over };
}

describe("loadDataset digests", () => {
	test("verifies provided sources and ignores local raw paths unless raw", async () => {
		const sources = [
			source({ id: "norm" }, "payload"),
			source({ id: "raw", provided: false, path: "raw.txt" }, "secret"),
		];
		const dir = await setup({ ...base(), sources }, { "norm.txt": "payload" });
		expect((await loadDataset(path.join(dir, "dataset.json"))).sources).toHaveLength(2);
		await expect(loadDataset(path.join(dir, "dataset.json"), { raw: true })).rejects.toThrow("not found");
		await Bun.write(path.join(dir, "raw.txt"), "secret");
		await loadDataset(path.join(dir, "dataset.json"), { raw: true });
		await Bun.write(path.join(dir, "raw.txt"), "tampered");
		await expect(loadDataset(path.join(dir, "dataset.json"), { raw: true })).rejects.toThrow("sha256 mismatch");
	});

	test("digest mismatch fails", async () => {
		const dir = await setup({ ...base(), sources: [source({ id: "norm" }, "payload")] }, { "norm.txt": "changed" });
		await expect(loadDataset(path.join(dir, "dataset.json"))).rejects.toThrow("sha256 mismatch");
	});

	test("manifest must match dataset.sources and exist", async () => {
		const s = source({ id: "norm" }, "payload");
		const dir = await setup({ ...base(), sources: [s] }, { "norm.txt": "payload" }, [{ ...s, sha256: sha("other") }]);
		await expect(loadDataset(path.join(dir, "dataset.json"))).rejects.toThrow("differs from dataset.sources");
		await fs.rm(path.join(dir, "input-manifest.json"));
		await expect(loadDataset(path.join(dir, "dataset.json"))).rejects.toThrow("input-manifest.json not found");
	});

	test("provided paths cannot escape the dataset directory", async () => {
		const dir = await setup({ ...base(), sources: [source({ id: "x", path: "../x.txt" }, "p")] });
		await expect(loadDataset(path.join(dir, "dataset.json"))).rejects.toThrow("inside the dataset directory");
	});
});

describe("CLI", () => {
	test("check passes on a valid run and fails nonzero on a mutated input", async () => {
		const s = source({ id: "norm" }, "payload");
		const dir = await setup({ ...base(), sources: [s] }, { "norm.txt": "payload" });
		const ok = await run(["check", dir]);
		expect(ok.code).toBe(0);
		expect(ok.stdout).toStartWith("ok:");
		await Bun.write(path.join(dir, "norm.txt"), "mutated");
		const bad = await run(["check", dir]);
		expect(bad.code).toBe(1);
		expect(bad.stdout).toBe("");
		expect(bad.stderr).toContain("sha256 mismatch");
	});

	test("check surfaces malformed data as nonzero", async () => {
		const d = base();
		const dir = await setup({ ...d, findings: [...d.findings, d.findings[0]] });
		const result = await run(["check", dir]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("duplicate id f1");
	});

	test("retains an excluded verifier alongside its completed replacement", async () => {
		const data = base();
		const excluded = attempt({
			id: "old-verifier",
			stage: "verifier",
			status: "excluded",
			expectedEffort: "medium",
			actualEfforts: ["medium"],
			actualModels: ["terra"],
			reason: "runtime substituted another model",
			cost: 0.7,
		});
		const dir = await setup({ ...data, attempts: [...data.attempts, excluded] });
		const result = await run(["report", path.join(dir, "dataset.json"), "--format", "json"]);
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			costs: { verifier: { amount: 1.2 }, unsuccessful: { amount: 0.7 }, total: { amount: 1.7 } },
		});
	});

	test("report emits stable newline-terminated json and markdown", async () => {
		const dir = await setup(base());
		const file = path.join(dir, "dataset.json");
		const json = await run(["report", file, "--format", "json"]);
		expect(json.code).toBe(0);
		expect(json.stdout.endsWith("\n")).toBe(true);
		expect(json.stdout.endsWith("\n\n")).toBe(false);
		expect(JSON.parse(json.stdout)).toMatchObject({
			targets: { total: 1 },
			arms: expect.arrayContaining([
				expect.objectContaining({ arm: "S", microPre: { numerator: 1, denominator: 1, value: 1, reason: null } }),
			]),
		});
		expect((await run(["report", file, "--format", "json"])).stdout).toBe(json.stdout);
		const md = await run(["report", file, "--format", "md"]);
		expect(md.code).toBe(0);
		expect(md.stdout.endsWith("\n")).toBe(true);
		expect(md.stdout.endsWith("\n\n")).toBe(false);
	});

	test("usage errors and unreadable data exit nonzero", async () => {
		expect((await run([])).code).toBe(2);
		expect((await run(["report", "x.json", "--format", "csv"])).code).toBe(2);
		expect((await run(["check"])).code).toBe(2);
		const missing = await run(["check", "/nonexistent-plan-review-run"]);
		expect(missing.code).toBe(1);
	});
});
