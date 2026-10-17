/**
 * Task-byte pinning for fixed suites. A suite identity covers the bytes that are evaluated, not just the manifest:
 * local task directories are copied into suite-owned storage at registration, hashed per task, and re-hashed at
 * every launch. Registry datasets are accepted only when pinned to a content digest.
 */
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { isLocalDataset, resolveLocalDataset } from "../launch-args";
import { EvoHttpError } from "./boundary";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir, META_FILE } from "./calibration";
import { unlockTree } from "./config-snapshot";
import { generatedTaskImages } from "./image-pins";
import type { SuiteManifest } from "./suites";
import { assertTaskSnapshotIntact, hashTaskTree, lockTree } from "./task-tree";

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

/** Single identity recorded on each run: the per-task hash set, or the pinned registry reference. */
export function suiteTaskHash(suite: { manifest: SuiteManifest; taskHashes: TaskHashes | null }): string {
	if (suite.taskHashes === null) return suite.manifest.dataset;
	return new Bun.CryptoHasher("sha256").update(canonicalTaskHashes(suite.taskHashes)).digest("hex");
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
		if (
			!record ||
			record.before !== 0 ||
			record.after !== 1 ||
			record.environment?.mode !== "container" ||
			record.environment.verifierNetwork !== "no-network"
		) {
			throw new EvoHttpError(422, `task '${task}' has no successful RED/GREEN calibration; run evo-task verify`);
		}
		if (record.taskHash !== (await hashTaskDir(dir))) {
			throw new EvoHttpError(422, `task '${task}' changed since its calibration; re-run evo-task verify`);
		}
	}
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
export async function pinSuiteTasks(
	jobsDir: string,
	manifest: SuiteManifest,
	secrets: readonly string[] = [],
): Promise<PinnedTasks> {
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
			// One walk hashes and credential-scans the COPY: the scanned bytes are exactly the pinned bytes.
			taskHashes[key] = hashTaskTree(path.join(stage, key), secrets);
		}
		generatedTaskImages(stage, manifest.include.map(taskKey));
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
