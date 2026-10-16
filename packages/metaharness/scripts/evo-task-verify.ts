import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir } from "../src/evo/calibration";
import { fail, run, type VerifyResult } from "./evo-task-shared";

async function runVerifier(taskDir: string, repoDir: string, logDir: string): Promise<number> {
	await fs.rm(logDir, { recursive: true, force: true });
	const r = await run(["bash", path.join(taskDir, "tests", "test.sh")], {
		REPO_DIR: repoDir,
		TESTS_DIR: path.join(taskDir, "tests"),
		LOG_DIR: logDir,
	});
	if (r.code !== 0) fail(`verifier exited ${r.code}: ${r.err.trim()}`);
	const text = (await Bun.file(path.join(logDir, "reward.txt")).text()).trim();
	const reward = Number(text);
	if (text.length === 0 || !Number.isFinite(reward)) fail(`verifier wrote non-numeric reward ${JSON.stringify(text)}`);
	return reward;
}

/**
 * Host-side RED/GREEN calibration. Copies the task's own `environment/repo` snapshot into a scratch
 * directory and runs the generated verifier/solution scripts with container paths remapped there.
 */
export async function verifyTask(taskDirArg: string): Promise<VerifyResult> {
	const taskDir = path.resolve(taskDirArg);
	const snapshot = path.join(taskDir, "environment", "repo");
	if (!(await fs.stat(snapshot).catch(() => null))?.isDirectory()) fail(`missing ${snapshot}`);
	const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "evo-task-verify-"));
	try {
		const repoDir = path.join(scratch, "repo");
		const logDir = path.join(scratch, "logs");
		await fs.cp(snapshot, repoDir, { recursive: true, verbatimSymlinks: true });

		const before = await runVerifier(taskDir, repoDir, logDir);
		if (before !== 0) fail(`RED check failed: verifier reward ${before} before solution (expected 0)`);
		const solve = await run(["bash", path.join(taskDir, "solution", "solve.sh")], {
			REPO_DIR: repoDir,
			SOLUTION_DIR: path.join(taskDir, "solution"),
		});
		if (solve.code !== 0) fail(`solution/solve.sh exited ${solve.code}: ${solve.err.trim()}`);
		const after = await runVerifier(taskDir, repoDir, logDir);
		if (after !== 1) fail(`GREEN check failed: verifier reward ${after} after solution (expected 1)`);
		const record: CalibrationRecord = {
			before,
			after,
			taskHash: await hashTaskDir(taskDir),
			verifiedAt: new Date().toISOString(),
		};
		await Bun.write(path.join(taskDir, CALIBRATION_FILE), `${JSON.stringify(record, null, "\t")}\n`);
		return { before, after };
	} finally {
		await fs.rm(scratch, { recursive: true, force: true });
	}
}
