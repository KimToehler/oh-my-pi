/**
 * Task-byte pinning for fixed suites. A suite identity covers the bytes that are evaluated, not just the manifest:
 * local task directories are copied into suite-owned storage at registration, hashed per task, and re-hashed at
 * every launch. Registry datasets are accepted only when pinned to a content digest.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { isLocalDataset, resolveLocalDataset } from "../launch-args";
import { EvoHttpError } from "./boundary";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir, META_FILE } from "./calibration";
import { unlockTree } from "./config-snapshot";
import type { SuiteManifest } from "./suites";

/** Bare task name -> sha256 of that task directory's bytes. */
export type TaskHashes = Record<string, string>;

/** Harbor `org/name@sha256:<digest>` content-addressed references are immutable; tags and revisions are not. */
const PINNED_REGISTRY_DATASET = /^[^@\s]+@sha256:[0-9a-f]{64}$/;

/** Normalize a task reference to its bare name (`org/task` and `task` match). */
export function taskKey(task: string): string {
	const slash = task.lastIndexOf("/");
	return slash === -1 ? task : task.slice(slash + 1);
}

/** Order-stable text form of a per-task hash map; the unit compared across run records. */
export function canonicalTaskHashes(hashes: TaskHashes): string {
	return JSON.stringify(Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function suiteDataDir(jobsDir: string, suiteHash: string): string {
	return path.resolve(jobsDir, "_evo", "suite-data", suiteHash);
}

/** Directory a suite launches from: its immutable snapshot for local datasets, else the pinned registry reference. */
export function suiteDataset(
	jobsDir: string,
	suite: { hash: string; manifest: SuiteManifest; taskHashes: TaskHashes | null },
): string {
	return suite.taskHashes === null ? suite.manifest.dataset : suiteDataDir(jobsDir, suite.hash);
}

/**
 * sha256 over every entry of a task directory (relative path, kind, exec bit, bytes). Synchronous so the launch
 * path can verify without yielding. Symlinks must stay inside the task: an outward link is mutable outside bytes.
 */
export function hashTaskTree(taskRoot: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	const walk = (rel: string): void => {
		for (const name of fs.readdirSync(path.join(taskRoot, rel)).sort()) {
			const childRel = rel ? `${rel}/${name}` : name;
			const abs = path.join(taskRoot, childRel);
			const st = fs.lstatSync(abs);
			const key = JSON.stringify(childRel);
			if (st.isSymbolicLink()) {
				const target = fs.readlinkSync(abs);
				const resolved = path.resolve(path.dirname(abs), target);
				if (path.isAbsolute(target) || path.relative(taskRoot, resolved).startsWith("..")) {
					throw new EvoHttpError(422, `task symlink escapes its directory: ${childRel}`);
				}
				hasher.update(`${key}\0link:${target}\0`);
			} else if (st.isDirectory()) {
				hasher.update(`${key}\0dir\0`);
				walk(childRel);
			} else if (st.isFile()) {
				const body = new Bun.CryptoHasher("sha256").update(fs.readFileSync(abs)).digest("hex");
				hasher.update(`${key}\0file:${st.mode & 0o111 ? "x" : "-"}:${body}\0`);
			} else {
				throw new EvoHttpError(422, `unsupported file type in task: ${childRel}`);
			}
		}
	};
	walk("");
	return hasher.digest("hex");
}

/** Verify a snapshot directory holds exactly the recorded tasks with the recorded bytes; 422 otherwise. */
export function assertTaskSnapshotIntact(dir: string, label: string, hashes: TaskHashes): void {
	const expected = Object.keys(hashes).sort();
	let present: string[];
	try {
		present = fs.readdirSync(dir).sort();
	} catch {
		throw new EvoHttpError(422, `${label} task snapshot is unreadable; cannot verify its recorded task hashes`);
	}
	if (present.join("\0") !== expected.join("\0")) {
		throw new EvoHttpError(422, `${label} task snapshot no longer holds exactly its registered tasks`);
	}
	for (const task of expected) {
		let actual: string;
		try {
			actual = hashTaskTree(path.join(dir, task));
		} catch (err) {
			if (err instanceof EvoHttpError) throw err;
			throw new EvoHttpError(422, `${label} task '${task}' snapshot is unreadable; cannot verify its hash`);
		}
		if (actual !== hashes[task]) {
			throw new EvoHttpError(422, `${label} task '${task}' snapshot no longer matches its registered task hash`);
		}
	}
}

/** Single identity recorded on each run: the per-task hash set, or the pinned registry reference. */
export function suiteTaskHash(suite: { manifest: SuiteManifest; taskHashes: TaskHashes | null }): string {
	if (suite.taskHashes === null) return suite.manifest.dataset;
	return new Bun.CryptoHasher("sha256").update(canonicalTaskHashes(suite.taskHashes)).digest("hex");
}

/** Sync re-verification of a registered suite's snapshot by id, for launch paths that cannot await (arms). */
export function assertRecordedSuiteIntact(jobsDir: string, suiteId: string): void {
	let stored: { hash?: string; manifest?: SuiteManifest; taskHashes?: TaskHashes | null };
	try {
		stored = JSON.parse(fs.readFileSync(path.join(jobsDir, "_evo", "suites", `${suiteId}.json`), "utf8"));
	} catch {
		throw new EvoHttpError(422, `suite '${suiteId}' is unreadable; cannot verify its task snapshot`);
	}
	if (!stored.hash || !stored.manifest || stored.taskHashes === undefined) {
		throw new EvoHttpError(422, `suite '${suiteId}' record has no task identity`);
	}
	assertSuiteTasksIntact(jobsDir, { hash: stored.hash, manifest: stored.manifest, taskHashes: stored.taskHashes });
}

export function assertSuiteTasksIntact(
	jobsDir: string,
	suite: { hash: string; manifest: SuiteManifest; taskHashes: TaskHashes | null },
): void {
	if (suite.taskHashes === null) return;
	assertTaskSnapshotIntact(suiteDataDir(jobsDir, suite.hash), `suite '${suite.manifest.id}'`, suite.taskHashes);
}

/**
 * Generated tasks (entries holding evo-task.json) must carry a calibration.json whose hash still matches the task
 * bytes and whose GREEN reward is 1. Checked against the private copy, so the validated bytes are the pinned bytes.
 */
async function requireCalibratedTasks(root: string, include: readonly string[]): Promise<void> {
	for (const task of include) {
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

/** Drop write permission on a copied tree so an accidental write fails; the per-task hash is the real boundary. */
function lockTree(dir: string): void {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) lockTree(abs);
		else if (entry.isFile()) fs.chmodSync(abs, fs.statSync(abs).mode & ~0o222);
	}
	fs.chmodSync(dir, 0o555);
}

export interface PinnedTasks {
	/** Per-task content hashes; null for a digest-pinned registry dataset. */
	taskHashes: TaskHashes | null;
	/** Move the private copy to its content-addressed home; a no-op for registry datasets. */
	publish(suiteHash: string): Promise<void>;
	/** Remove any private copy not yet published. */
	discard(): Promise<void>;
}

/**
 * Pin the bytes a manifest will evaluate. Local datasets: copy every included task into a private dir, hash the
 * COPY, and enforce calibration on the copy. Registry datasets: require a `@sha256:` digest, else 422.
 */
export async function pinSuiteTasks(jobsDir: string, manifest: SuiteManifest): Promise<PinnedTasks> {
	if (!isLocalDataset(manifest.dataset)) {
		if (!PINNED_REGISTRY_DATASET.test(manifest.dataset)) {
			throw new EvoHttpError(
				422,
				`registry dataset '${manifest.dataset}' is not pinned to an immutable revision; use '<name>@sha256:<digest>' or a local dataset directory`,
			);
		}
		return { taskHashes: null, publish: async () => {}, discard: async () => {} };
	}
	let root: string;
	try {
		root = resolveLocalDataset(manifest.dataset);
	} catch (err) {
		throw new EvoHttpError(422, err instanceof Error ? err.message : String(err));
	}
	const stage = path.resolve(jobsDir, "_evo", "suite-data", `.tmp-${crypto.randomUUID()}`);
	const discard = async (): Promise<void> => {
		await unlockTree(stage);
		await fsp.rm(stage, { recursive: true, force: true });
	};
	try {
		await fsp.mkdir(stage, { recursive: true });
		const taskHashes: TaskHashes = {};
		for (const task of manifest.include) {
			const key = taskKey(task);
			const src = path.join(root, key);
			if (
				!(await fsp.stat(src).then(
					st => st.isDirectory(),
					() => false,
				))
			) {
				throw new EvoHttpError(422, `task '${task}' is not a directory in local dataset ${root}`);
			}
			await fsp.cp(src, path.join(stage, key), { recursive: true, verbatimSymlinks: true });
			taskHashes[key] = hashTaskTree(path.join(stage, key));
		}
		await requireCalibratedTasks(stage, manifest.include);
		return {
			taskHashes,
			discard,
			publish: async (suiteHash: string): Promise<void> => {
				const final = suiteDataDir(jobsDir, suiteHash);
				lockTree(stage);
				try {
					await fsp.rename(stage, final);
				} catch (err) {
					// Identical content already published (crashed earlier attempt): keep it, but only if it is intact.
					const code = typeof err === "object" && err !== null && "code" in err ? err.code : null;
					if (code !== "EEXIST" && code !== "ENOTEMPTY") throw err;
					assertTaskSnapshotIntact(final, `suite '${manifest.id}'`, taskHashes);
				}
			},
		};
	} catch (err) {
		await discard();
		throw err;
	}
}
