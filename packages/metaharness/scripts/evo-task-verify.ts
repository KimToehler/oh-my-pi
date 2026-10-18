import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir } from "../src/evo/calibration";
import { buildContainerRun } from "./evo-task-container";
import { fail, run, type VerifyResult } from "./evo-task-shared";

export interface VerifyOptions {
	/** Run on the host shell instead of the task container. Diagnostic only: never writes calibration.json. */
	hostUnisolated?: boolean;
}

async function readReward(logDir: string): Promise<number> {
	const text = (await Bun.file(path.join(logDir, "reward.txt")).text()).trim();
	const reward = Number(text);
	if (text.length === 0 || !Number.isFinite(reward)) fail(`verifier wrote non-numeric reward ${JSON.stringify(text)}`);
	return reward;
}

async function runHostVerifier(taskDir: string, repoDir: string, logDir: string): Promise<number> {
	await fs.rm(logDir, { recursive: true, force: true });
	const r = await run(["bash", path.join(taskDir, "tests", "test.sh")], {
		REPO_DIR: repoDir,
		TESTS_DIR: path.join(taskDir, "tests"),
		LOG_DIR: logDir,
	});
	if (r.code !== 0) fail(`verifier exited ${r.code}: ${r.err.trim()}`);
	return readReward(logDir);
}

async function verifyOnHost(taskDir: string, scratch: string): Promise<VerifyResult> {
	const snapshot = path.join(taskDir, "environment", "repo");
	const repoDir = path.join(scratch, "repo");
	const logDir = path.join(scratch, "logs");
	await fs.cp(snapshot, repoDir, { recursive: true, verbatimSymlinks: true });
	const before = await runHostVerifier(taskDir, repoDir, logDir);
	if (before !== 0) fail(`RED check failed: verifier reward ${before} before solution (expected 0)`);
	const solve = await run(["bash", path.join(taskDir, "solution", "solve.sh")], {
		REPO_DIR: repoDir,
		SOLUTION_DIR: path.join(taskDir, "solution"),
	});
	if (solve.code !== 0) fail(`solution/solve.sh exited ${solve.code}: ${solve.err.trim()}`);
	const after = await runHostVerifier(taskDir, repoDir, logDir);
	if (after !== 1) fail(`GREEN check failed: verifier reward ${after} after solution (expected 1)`);
	return { before, after };
}

/**
 * RED/GREEN calibration inside the Harbor-equivalent environment: the generated image (repo at /workspace/repo),
 * hidden tests mounted read-only, and the verifier's `no-network` policy. Only that run writes calibration.json,
 * and the record names the environment it ran in. `hostUnisolated` is a no-record diagnostic on the host shell.
 */
export async function verifyTask(taskDirArg: string, options: VerifyOptions = {}): Promise<VerifyResult> {
	const taskDir = path.resolve(taskDirArg);
	const snapshot = path.join(taskDir, "environment", "repo");
	if (!(await fs.stat(snapshot).catch(() => null))?.isDirectory()) fail(`missing ${snapshot}`);
	const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "evo-task-verify-"));
	try {
		if (options.hostUnisolated) return await verifyOnHost(taskDir, scratch);
		const container = await buildContainerRun(taskDir, process.env.EVO_CONTAINER_RUNTIME ?? "docker", scratch);
		try {
			const before = await container.verify(false);
			if (before !== 0) fail(`RED check failed: verifier reward ${before} before solution (expected 0)`);
			const after = await container.verify(true);
			if (after !== 1) fail(`GREEN check failed: verifier reward ${after} after solution (expected 1)`);
			const record: CalibrationRecord = {
				before,
				after,
				environment: container.environment,
				taskHash: await hashTaskDir(taskDir),
				verifiedAt: new Date().toISOString(),
			};
			await Bun.write(path.join(taskDir, CALIBRATION_FILE), `${JSON.stringify(record, null, "\t")}\n`);
			return { before, after };
		} finally {
			await container.dispose();
		}
	} finally {
		await fs.rm(scratch, { recursive: true, force: true });
	}
}
