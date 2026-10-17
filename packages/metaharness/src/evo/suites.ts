/** Fixed evaluation suites: strict manifest parsing and an immutable on-disk registry. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import {
	badRequest,
	enumValue,
	EvoHttpError,
	expectObject,
	rejectUnknownKeys,
	requiredString,
	stringArray,
} from "./boundary";
import { assertSuiteTasksIntact, canonicalTaskHashes, pinSuiteTasks, taskKey, type TaskHashes } from "./suite-tasks";

export { taskKey };

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
	/** Decision policy, pre-declared here so it cannot be chosen at read time; see `decision-policy.ts`. */
	minPairedTasks: number;
	minAttemptsPerTask: number;
}

export interface StoredSuite {
	manifest: SuiteManifest;
	/** SHA-256 over the canonical manifest JSON and the per-task content hashes. */
	hash: string;
	/** Bare task name -> content hash of the snapshotted task bytes; null for a digest-pinned registry dataset. */
	taskHashes: TaskHashes | null;
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
	"minPairedTasks",
	"minAttemptsPerTask",
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
	const minPairedTasks = obj.minPairedTasks;
	if (typeof minPairedTasks !== "number" || !Number.isSafeInteger(minPairedTasks) || minPairedTasks < 1) {
		throw badRequest("suite.minPairedTasks must be a positive integer");
	}
	if (minPairedTasks > include.length) {
		throw badRequest("suite.minPairedTasks must not exceed the number of included tasks");
	}
	const minAttemptsPerTask = obj.minAttemptsPerTask;
	if (typeof minAttemptsPerTask !== "number" || !Number.isSafeInteger(minAttemptsPerTask) || minAttemptsPerTask < 1) {
		throw badRequest("suite.minAttemptsPerTask must be a positive integer");
	}
	if (minAttemptsPerTask > attempts) throw badRequest("suite.minAttemptsPerTask must not exceed suite.attempts");
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
		minPairedTasks,
		minAttemptsPerTask,
	};
}

/** Canonical JSON: fixed field order so equal manifests hash equally. */
export function canonicalSuiteJson(manifest: SuiteManifest): string {
	return JSON.stringify(FIELDS.map(key => [key, manifest[key]]));
}

/** Suite identity: the manifest AND the evaluated task bytes, so equal manifests over different bytes differ. */
export function suiteHash(manifest: SuiteManifest, taskHashes: TaskHashes | null): string {
	const tasks = taskHashes === null ? "null" : canonicalTaskHashes(taskHashes);
	return new Bun.CryptoHasher("sha256").update(`${canonicalSuiteJson(manifest)}\0${tasks}`).digest("hex");
}

export class SuiteRegistry {
	readonly dir: string;
	readonly #jobsDir: string;
	readonly #secretValues: () => readonly string[];

	/** `secretValues` yields the forwarded host credential values; every dataset path and byte is scanned against them. */
	constructor(jobsDir: string, secretValues: () => readonly string[] = () => []) {
		this.#jobsDir = jobsDir;
		this.#secretValues = secretValues;
		this.dir = path.join(jobsDir, "_evo", "suites");
	}

	#file(id: string): string {
		return path.join(this.dir, `${id}.json`);
	}

	/** Snapshot a manifest. Idempotent for identical content; a changed manifest under an existing id is a 409. */
	async register(raw: unknown): Promise<{ suite: StoredSuite; created: boolean }> {
		const manifest = parseSuiteManifest(raw);
		// Copy + hash the evaluated bytes first: identity, calibration and every later launch bind to this copy.
		const pinned = await pinSuiteTasks(this.#jobsDir, manifest, this.#secretValues());
		try {
			const hash = suiteHash(manifest, pinned.taskHashes);
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
			// Task data lands before the manifest, so a visible suite always has its snapshot.
			await pinned.publish(hash);
			const suite: StoredSuite = { manifest, hash, taskHashes: pinned.taskHashes, createdAt: Date.now() };
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
		} finally {
			await pinned.discard();
		}
	}

	async get(id: string): Promise<StoredSuite | null> {
		if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) return null;
		try {
			const stored = (await Bun.file(this.#file(id)).json()) as StoredSuite;
			const manifest = parseSuiteManifest(stored.manifest);
			// Suites stored before task pinning have no task identity: refuse, never evaluate unpinned bytes.
			if (stored.taskHashes === undefined) {
				throw new EvoHttpError(422, `suite '${id}' predates task-byte pinning; register it again under a new id`);
			}
			if (suiteHash(manifest, stored.taskHashes) !== stored.hash) {
				throw new Error(`suite '${id}' on disk fails its content hash`);
			}
			const suite: StoredSuite = {
				manifest,
				hash: stored.hash,
				taskHashes: stored.taskHashes,
				createdAt: stored.createdAt,
			};
			assertSuiteTasksIntact(this.#jobsDir, suite);
			return suite;
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
