#!/usr/bin/env bun
/**
 * Deterministic plan-review replay scorer. Makes no model calls.
 *
 * Usage:
 *   bun scripts/score-plan-review-replay.ts check <run-dir>
 *   bun scripts/score-plan-review-replay.ts report <dataset.json> --format json|md
 *
 * `check` loads <run-dir>/dataset.json and <run-dir>/input-manifest.json and hash-verifies
 * provided and local raw sources. `report` hash-verifies provided sources only.
 */
import * as path from "node:path";
import { loadDataset } from "./plan-review-replay/input";
import { formatMarkdown, scoreDataset } from "./plan-review-replay/report";

export interface CliResult {
	readonly code: number;
	readonly stdout: string;
	readonly stderr: string;
}

const USAGE =
	"usage: bun scripts/score-plan-review-replay.ts check <run-dir> | report <dataset.json> --format json|md\n";

function usage(): CliResult {
	return { code: 2, stdout: "", stderr: USAGE };
}

function withNewline(text: string): string {
	return `${text.trimEnd()}\n`;
}

async function check(dir: string): Promise<CliResult> {
	const data = await loadDataset(path.join(dir, "dataset.json"), { raw: true });
	const out = `ok: ${data.sources.length} sources, ${data.items.length} items, ${data.trials.length} trials, ${data.attempts.length} attempts, ${data.findings.length} findings\n`;
	return { code: 0, stdout: out, stderr: "" };
}

async function report(file: string, format: string): Promise<CliResult> {
	const data = await loadDataset(file);
	const summary = scoreDataset(data);
	const text = format === "json" ? JSON.stringify(summary, null, 2) : formatMarkdown(summary);
	return { code: 0, stdout: withNewline(text), stderr: "" };
}

export async function run(argv: readonly string[]): Promise<CliResult> {
	const [command, target, ...rest] = argv;
	try {
		if (command === "check" && target !== undefined && rest.length === 0) return await check(target);
		if (command === "report" && target !== undefined) {
			const flag = rest.length === 0 ? ["--format", "json"] : rest;
			const [name, format, ...extra] = flag;
			if (name === "--format" && (format === "json" || format === "md") && extra.length === 0) {
				return await report(target, format);
			}
		}
		return usage();
	} catch (err) {
		if (err instanceof Error) return { code: 1, stdout: "", stderr: withNewline(`error: ${err.message}`) };
		throw err;
	}
}

if (import.meta.main) {
	const result = await run(process.argv.slice(2));
	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	process.exitCode = result.code;
}
