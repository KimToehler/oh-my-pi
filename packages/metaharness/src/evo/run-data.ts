/**
 * Run-owned task bytes. The suite snapshot is shared and its path is mutable by its owner, so a path validated at
 * launch can hold different bytes when Harbor opens it. Each run therefore gets its own copy: the snapshot is copied,
 * the COPY is hashed against the registered task hashes, then locked and handed to Harbor. The run's recorded
 * `dataset` names that copy; resume and experiment arms re-verify it with the same walk.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { EvoHttpError } from "./boundary";
import { unlockTree } from "./config-snapshot";
import { assertTaskSnapshotIntact, lockTree, unlockTreeSync } from "./task-tree";
import { suiteDataDir, type TaskHashes } from "./suite-tasks";
import type { SuiteManifest } from "./suites";

interface RunSuite {
	hash: string;
	manifest: SuiteManifest;
	taskHashes: TaskHashes | null;
}

export function runDataDir(jobsDir: string, jobName: string): string {
	return path.resolve(jobsDir, "_evo", "run-data", jobName);
}

/**
 * Dataset a run launches from. Registry suites keep their pinned reference. Local suites are copied into
 * `_evo/run-data/<job>` and verified AFTER the copy; an existing copy is reused only when it still verifies.
 * `secrets` are the current forwarded credential values: the verify walk over the copy also scans for them, because
 * a value set or rotated after registration was never scanned for. A hit removes the copy (422, value redacted).
 * Two concurrent stagings for one job race only on the final rename: the loser re-verifies the winner's copy, so the
 * caller's own duplicate-job check reports the conflict instead of a misleading unreadable-snapshot error.
 */
export async function stageRunData(
	jobsDir: string,
	suite: RunSuite,
	jobName: string,
	secrets: readonly string[],
): Promise<string> {
	if (suite.taskHashes === null) return suite.manifest.dataset;
	const label = `suite '${suite.manifest.id}'`;
	const final = runDataDir(jobsDir, jobName);
	if (fs.existsSync(final)) {
		await assertTaskSnapshotIntact(final, `${label} run data`, suite.taskHashes, secrets);
		return final;
	}
	const stage = `${final}.tmp-${crypto.randomUUID()}`;
	let published = false;
	try {
		await fs.promises.mkdir(path.dirname(stage), { recursive: true });
		await fs.promises.cp(suiteDataDir(jobsDir, suite.hash), stage, { recursive: true, verbatimSymlinks: true });
		await assertTaskSnapshotIntact(stage, `${label} task`, suite.taskHashes, secrets);
		await lockTree(stage);
		try {
			await fs.promises.rename(stage, final);
			published = true;
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== "EEXIST" && code !== "ENOTEMPTY") throw err;
		}
	} catch (err) {
		await unlockTree(stage);
		await fs.promises.rm(stage, { recursive: true, force: true });
		if (err instanceof EvoHttpError) throw err;
		throw new EvoHttpError(422, `${label} task snapshot is unreadable; cannot stage run data`);
	}
	if (!published) {
		await unlockTree(stage);
		await fs.promises.rm(stage, { recursive: true, force: true });
		await assertTaskSnapshotIntact(final, `${label} run data`, suite.taskHashes, secrets);
	}
	return final;
}

/** Registered suite record by id, validated to carry a task identity; 422 otherwise. */
function readRecordedSuite(jobsDir: string, suiteId: string): RunSuite {
	let stored: { hash?: string; manifest?: SuiteManifest; taskHashes?: TaskHashes | null };
	try {
		stored = JSON.parse(fs.readFileSync(path.join(jobsDir, "_evo", "suites", `${suiteId}.json`), "utf8"));
	} catch {
		throw new EvoHttpError(422, `suite '${suiteId}' is unreadable; cannot verify its task snapshot`);
	}
	if (!stored.hash || !stored.manifest || stored.taskHashes === undefined) {
		throw new EvoHttpError(422, `suite '${suiteId}' record has no task identity`);
	}
	return { hash: stored.hash, manifest: stored.manifest, taskHashes: stored.taskHashes };
}

/** Experiment arms: stage (and verify) a fresh run-owned copy of the registered suite for the new job. */
export function stageRecordedRunData(
	jobsDir: string,
	suiteId: string,
	jobName: string,
	secrets: readonly string[],
): Promise<string> {
	return stageRunData(jobsDir, readRecordedSuite(jobsDir, suiteId), jobName, secrets);
}

/**
 * Re-verify the dataset a recorded run will (re)open against its registered suite. Accepts only a run-data copy or
 * the suite's own snapshot (runs recorded before staging existed); anything else is not a path we pinned.
 */
export async function verifyRunData(jobsDir: string, suiteId: string, dataset: string | undefined): Promise<void> {
	const suite = readRecordedSuite(jobsDir, suiteId);
	if (suite.taskHashes === null) return;
	const owned = path.resolve(jobsDir, "_evo", "run-data") + path.sep;
	const snapshot = suiteDataDir(jobsDir, suite.hash);
	const target = dataset === undefined ? snapshot : path.resolve(dataset);
	if (target !== snapshot && !target.startsWith(owned)) {
		throw new EvoHttpError(422, `run dataset '${String(dataset)}' is not owned data of suite '${suiteId}'`);
	}
	await assertTaskSnapshotIntact(target, `suite '${suiteId}' run data`, suite.taskHashes);
}

/** Drop a run's staged copy (run deletion). Missing is fine. */
export function removeRunData(jobsDir: string, jobName: string): void {
	const dir = runDataDir(jobsDir, jobName);
	unlockTreeSync(dir);
	fs.rmSync(dir, { recursive: true, force: true });
}
