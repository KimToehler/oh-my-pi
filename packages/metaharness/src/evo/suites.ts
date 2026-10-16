/** Fixed evaluation suites: strict manifest parsing and an immutable on-disk registry. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { isLocalDataset, resolveLocalDataset } from "../launch-args";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir, META_FILE } from "./calibration";
import {
	badRequest,
	enumValue,
	EvoHttpError,
	expectObject,
	rejectUnknownKeys,
	requiredString,
	stringArray,
} from "./boundary";

export const SUITE_SPLITS = ["search", "heldout"] as const;
export const SUITE_ENVIRONMENTS = ["docker", "apple-container"] as const;

export interface SuiteManifest {
	id: string;
	split: (typeof SUITE_SPLITS)[number];
	benchmark: "harbor";
	dataset: string;
	include: string[];
	attempts: number;
	timeoutMultiplier: number;
	model: string;
	thinking: string;
	environment: (typeof SUITE_ENVIRONMENTS)[number];
}

export interface StoredSuite {
	manifest: SuiteManifest;
	/** SHA-256 of the canonical manifest JSON. */
	hash: string;
	createdAt: number;
}

const FIELDS = [
	"id",
	"split",
	"benchmark",
	"dataset",
	"include",
	"attempts",
	"timeoutMultiplier",
	"model",
	"thinking",
	"environment",
] as const;
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

/** Parse a suite manifest; rejects unknown fields, implicit sampling, empty/duplicate includes. */
export function parseSuiteManifest(raw: unknown): SuiteManifest {
	const obj = expectObject(raw, "suite");
	rejectUnknownKeys(obj, FIELDS, "suite");
	const id = requiredString(obj, "id", "suite");
	if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) throw badRequest("suite.id must match [A-Za-z0-9][A-Za-z0-9_.-]*");
	const split = enumValue(obj, "split", "suite", SUITE_SPLITS);
	if (obj.benchmark !== "harbor") throw badRequest("suite.benchmark must be one of harbor");
	const include = stringArray(obj, "include", "suite", { required: true }) as string[];
	if (include.length === 0) throw badRequest("suite.include must name at least one task");
	if (new Set(include).size !== include.length) throw badRequest("suite.include must not contain duplicate task IDs");
	// Results are matched by bare task name, so `org-a/foo` and `org-b/foo` would be one task.
	if (new Set(include.map(taskKey)).size !== include.length) {
		throw badRequest("suite.include must not contain task IDs that normalize to the same task name");
	}
	const attempts = obj.attempts;
	if (typeof attempts !== "number" || !Number.isSafeInteger(attempts) || attempts < 1) {
		throw badRequest("suite.attempts must be a positive integer");
	}
	const timeoutMultiplier = obj.timeoutMultiplier;
	if (typeof timeoutMultiplier !== "number" || !Number.isFinite(timeoutMultiplier) || timeoutMultiplier <= 0) {
		throw badRequest("suite.timeoutMultiplier must be a positive number");
	}
	const thinking = requiredString(obj, "thinking", "suite");
	if (!THINKING_LEVELS.includes(thinking))
		throw badRequest(`suite.thinking must be one of ${THINKING_LEVELS.join("|")}`);
	return {
		id,
		split,
		benchmark: "harbor",
		dataset: requiredString(obj, "dataset", "suite"),
		include,
		attempts,
		timeoutMultiplier,
		model: requiredString(obj, "model", "suite"),
		thinking,
		environment: enumValue(obj, "environment", "suite", SUITE_ENVIRONMENTS),
	};
}

/** Canonical JSON: fixed field order so equal manifests hash equally. */
export function canonicalSuiteJson(manifest: SuiteManifest): string {
	return JSON.stringify(FIELDS.map(key => [key, manifest[key]]));
}

export function suiteHash(manifest: SuiteManifest): string {
	return new Bun.CryptoHasher("sha256").update(canonicalSuiteJson(manifest)).digest("hex");
}

/** Normalize a task reference to its bare name (`org/task` and `task` match). */
export function taskKey(task: string): string {
	const slash = task.lastIndexOf("/");
	return slash === -1 ? task : task.slice(slash + 1);
}

/**
 * Generated tasks (local dataset dir entries holding evo-task.json) must carry a calibration.json whose hash
 * still matches the task bytes and whose GREEN reward is 1. Other include entries are left alone.
 */
async function requireCalibratedTasks(manifest: SuiteManifest): Promise<void> {
	if (!isLocalDataset(manifest.dataset)) return;
	const root = resolveLocalDataset(manifest.dataset);
	for (const task of manifest.include) {
		const dir = path.join(root, taskKey(task));
		if (!(await Bun.file(path.join(dir, META_FILE)).exists())) continue;
		let record: Partial<CalibrationRecord> | null = null;
		try {
			record = (await Bun.file(path.join(dir, CALIBRATION_FILE)).json()) as Partial<CalibrationRecord>;
		} catch (err) {
			if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
		}
		if (!record || record.before !== 0 || record.after !== 1) {
			throw new EvoHttpError(422, `task '${task}' has no successful RED/GREEN calibration; run evo-task verify`);
		}
		if (record.taskHash !== (await hashTaskDir(dir))) {
			throw new EvoHttpError(422, `task '${task}' changed since its calibration; re-run evo-task verify`);
		}
	}
}

export class SuiteRegistry {
	readonly dir: string;

	constructor(jobsDir: string) {
		this.dir = path.join(jobsDir, "_evo", "suites");
	}

	#file(id: string): string {
		return path.join(this.dir, `${id}.json`);
	}

	/** Snapshot a manifest. Idempotent for identical content; a changed manifest under an existing id is a 409. */
	async register(raw: unknown): Promise<{ suite: StoredSuite; created: boolean }> {
		const manifest = parseSuiteManifest(raw);
		await requireCalibratedTasks(manifest);
		const hash = suiteHash(manifest);
		const existing = await this.get(manifest.id);
		if (existing) {
			if (existing.hash !== hash) {
				throw new EvoHttpError(409, `suite '${manifest.id}' already exists with different content`, {
					existingHash: existing.hash,
					submittedHash: hash,
				});
			}
			return { suite: existing, created: false };
		}
		const suite: StoredSuite = { manifest, hash, createdAt: Date.now() };
		// Write complete bytes privately, then hard-link into place: link(2) fails with EEXIST instead of
		// replacing, so exactly one creator wins and no reader ever sees partial JSON.
		const temp = path.join(this.dir, `.tmp-${crypto.randomUUID()}`);
		await Bun.write(temp, JSON.stringify(suite, null, "\t"), { createPath: true });
		try {
			await fs.chmod(temp, 0o444);
			await fs.link(temp, this.#file(manifest.id));
			return { suite, created: true };
		} catch (err) {
			if (!(typeof err === "object" && err !== null && "code" in err && err.code === "EEXIST")) throw err;
		} finally {
			await fs.rm(temp, { force: true });
		}
		const winner = await this.get(manifest.id);
		if (!winner) throw new Error(`suite '${manifest.id}' vanished during registration`);
		if (winner.hash !== hash) {
			throw new EvoHttpError(409, `suite '${manifest.id}' already exists with different content`, {
				existingHash: winner.hash,
				submittedHash: hash,
			});
		}
		return { suite: winner, created: false };
	}

	async get(id: string): Promise<StoredSuite | null> {
		if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) return null;
		try {
			const stored = (await Bun.file(this.#file(id)).json()) as StoredSuite;
			const manifest = parseSuiteManifest(stored.manifest);
			if (suiteHash(manifest) !== stored.hash) throw new Error(`suite '${id}' on disk fails its content hash`);
			return { manifest, hash: stored.hash, createdAt: stored.createdAt };
		} catch (err) {
			if (isEnoent(err)) return null;
			throw err;
		}
	}

	async list(): Promise<StoredSuite[]> {
		let names: string[];
		try {
			names = await fs.readdir(this.dir);
		} catch (err) {
			if (isEnoent(err)) return [];
			throw err;
		}
		const out: StoredSuite[] = [];
		for (const name of names.sort()) {
			if (!name.endsWith(".json")) continue;
			const suite = await this.get(name.slice(0, -".json".length));
			if (suite) out.push(suite);
		}
		return out;
	}
}
