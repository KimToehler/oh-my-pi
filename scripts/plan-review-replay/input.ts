import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import type { Dataset, Source } from "./types";
import { InputError, validateDataset } from "./validate";

export { InputError, validateDataset };

const BLOCKING = "'blocking' | 'below-threshold' | 'unresolved'";

const sourceSchema = type({
	"+": "reject",
	id: "string",
	path: "string | null",
	sha256: "string",
	provided: "boolean",
	provenance: "string",
});
const datasetSchema = type({
	"+": "reject",
	version: "1",
	sources: sourceSchema.array(),
	arms: type({
		"+": "reject",
		id: "string",
		historical: "boolean",
		model: "string",
		effort: "string",
		brief: "string",
		contract: "string",
		rules: "string",
		snapshot: "string",
		triage: "string",
		sampling: "string",
	}).array(),
	items: type({ "+": "reject", id: "string", revision: "string", tree: "string", snapshot: "string" }).array(),
	targets: type({
		"+": "reject",
		id: "string",
		item: "string",
		mechanism: "string",
		blocking: BLOCKING,
		evidence: "string[]",
		reason: "string",
	}).array(),
	attempts: type({
		"+": "reject",
		id: "string",
		item: "string",
		trial: "string | null",
		stage: "'reviewer' | 'verifier' | 'adjudicator'",
		historical: "boolean",
		status: "'completed' | 'excluded' | 'failed'",
		expectedModel: "string",
		expectedEffort: "string",
		actualModels: "string[]",
		actualEfforts: "string[]",
		dispatched: "string | null",
		terminal: "string | null",
		cost: "number | null",
		reason: "string | null",
		provenance: "string",
	}).array(),
	trials: type({
		"+": "reject",
		id: "string",
		arm: "string",
		item: "string",
		repeat: "number",
		status: "'completed' | 'excluded' | 'missing'",
		reviewAttempts: "string[]",
		verifierAttempt: "string | null",
		triage: "'available' | 'empty' | 'unavailable'",
		reason: "string | null",
	}).array(),
	findings: type({ "+": "reject", id: "string", trial: "string", index: "number", description: "string" }).array(),
	adjudications: type({
		"+": "reject",
		finding: "string",
		targets: "string[]",
		mechanism: "string | null",
		validity: "'valid' | 'invalid' | 'pending' | 'annotated'",
		blocking: BLOCKING,
		kind: "'known-target' | 'additional-defect' | 'useful-note' | 'evidence-error' | 'unsupported-consequence' | 'false-claim' | 'severity-error' | 'pending'",
		evidence: "string[]",
		reason: "string",
	}).array(),
	triage: type({
		"+": "reject",
		finding: "string",
		result: "'confirmed' | 'refuted' | 'undecided'",
		blocking: "boolean",
		protected: "boolean",
		consequence: "boolean",
		reason: "string",
	}).array(),
	rounds: type({
		"+": "reject",
		item: "string",
		revision: "string",
		path: "string",
		lastRound: "number",
		workflow: "string | null",
	}).array(),
	targetRepeats: type({
		"+": "reject",
		target: "string",
		round: "string",
		blocking: BLOCKING,
		source: "string",
	}).array(),
});
const manifestSchema = sourceSchema.array();

export function parseDataset(value: unknown): Dataset {
	const result = datasetSchema(value);
	if (result instanceof type.errors) throw new InputError(result.summary.split("\n"));
	return result;
}

function parseManifest(value: unknown): readonly Source[] {
	const result = manifestSchema(value);
	if (result instanceof type.errors)
		throw new InputError(result.summary.split("\n").map(l => `input-manifest.json: ${l}`));
	return result;
}

async function readJson(file: string): Promise<unknown> {
	const text = await Bun.file(file).text();
	try {
		return JSON.parse(text);
	} catch (err) {
		if (err instanceof SyntaxError) throw new InputError([`${file}: invalid JSON: ${err.message}`]);
		throw err;
	}
}

async function digest(file: string): Promise<string | null> {
	try {
		const bytes = await fs.readFile(file);
		return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
	} catch (err) {
		if (err instanceof Error && "code" in err && (err.code === "ENOENT" || err.code === "EISDIR")) return null;
		throw err;
	}
}

function sameSource(a: Source, b: Source): boolean {
	return (
		a.id === b.id &&
		a.path === b.path &&
		a.sha256 === b.sha256 &&
		a.provided === b.provided &&
		a.provenance === b.provenance
	);
}

function checkManifest(sources: readonly Source[], manifest: readonly Source[], issues: string[]): void {
	const byId = new Map(manifest.map(s => [s.id, s]));
	if (byId.size !== manifest.length) issues.push("input-manifest.json: duplicate source ids");
	for (const s of sources) {
		const m = byId.get(s.id);
		if (m === undefined) issues.push(`input-manifest.json: missing source ${s.id}`);
		else if (!sameSource(s, m)) issues.push(`input-manifest.json: source ${s.id} differs from dataset.sources`);
	}
	const ids = new Set(sources.map(s => s.id));
	for (const m of manifest)
		if (!ids.has(m.id)) issues.push(`input-manifest.json: source ${m.id} absent from dataset.sources`);
}

async function checkDigests(dir: string, sources: readonly Source[], raw: boolean, issues: string[]): Promise<void> {
	for (const s of sources) {
		if (s.path === null || (!s.provided && !raw)) continue;
		if (s.provided && (path.isAbsolute(s.path) || path.relative(dir, path.resolve(dir, s.path)).startsWith(".."))) {
			issues.push(`source ${s.id}: provided path ${s.path} must stay inside the dataset directory`);
			continue;
		}
		const actual = await digest(path.resolve(dir, s.path));
		if (actual === null) issues.push(`source ${s.id}: file ${s.path} not found`);
		else if (actual !== s.sha256)
			issues.push(`source ${s.id}: sha256 mismatch for ${s.path} (expected ${s.sha256}, got ${actual})`);
	}
}

export async function loadDataset(file: string, options?: { raw: boolean }): Promise<Dataset> {
	const dir = path.dirname(path.resolve(file));
	const data = parseDataset(await readJson(file));
	validateDataset(data);
	const manifestFile = path.join(dir, "input-manifest.json");
	if ((await digest(manifestFile)) === null) throw new InputError([`input-manifest.json not found next to ${file}`]);
	const manifest = parseManifest(await readJson(manifestFile));
	const issues: string[] = [];
	checkManifest(data.sources, manifest, issues);
	await checkDigests(dir, data.sources, options?.raw ?? false, issues);
	if (issues.length > 0) throw new InputError(issues);
	return data;
}
