import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CalibrationEnvironment } from "../src/evo/calibration";
import { fail } from "./evo-task-shared";
import { VERIFIER_NETWORK_MODE } from "./evo-task-templates";

interface Captured {
	code: number;
	out: string;
	err: string;
}

async function exec(cmd: string[]): Promise<Captured> {
	let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
	try {
		proc = Bun.spawn(cmd, { env: process.env, stdout: "pipe", stderr: "pipe" });
	} catch (err) {
		fail(
			`cannot run container runtime '${cmd[0]}': ${err instanceof Error ? err.message : String(err)}. ` +
				"Calibration must run in the task's Docker environment; install Docker or set EVO_CONTAINER_RUNTIME.",
		);
	}
	const [out, err, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
	return { code, out, err };
}

/** Read `[verifier] network_mode` from the generated task.toml; refuse anything but the template's isolation. */
async function verifierNetwork(taskDir: string): Promise<string> {
	const toml = await Bun.file(path.join(taskDir, "task.toml")).text();
	const section = /^\[verifier\]\n((?:(?!\[).*\n?)*)/m.exec(toml)?.[1] ?? "";
	const mode = /^network_mode\s*=\s*"([^"]*)"/m.exec(section)?.[1];
	if (mode !== VERIFIER_NETWORK_MODE) {
		fail(
			`task.toml [verifier] network_mode is ${JSON.stringify(mode)}; calibration requires "${VERIFIER_NETWORK_MODE}"`,
		);
	}
	return "none";
}

export interface ContainerRun {
	/** Run the verifier in a fresh container. When `solve` is set, the reference solution is applied first. */
	verify(solve: boolean): Promise<number>;
	environment: CalibrationEnvironment;
	dispose(): Promise<void>;
}

/**
 * Build the task's generated image and expose Harbor-equivalent runs: repo at `/workspace/repo` baked into the
 * image, hidden `/tests` and `/solution` mounted read-only, rewards under `/logs/verifier`, and the verifier's
 * declared network policy applied to every container (the solution only copies files, so it needs no network).
 */
export async function buildContainerRun(taskDir: string, runtime: string, scratch: string): Promise<ContainerRun> {
	const network = await verifierNetwork(taskDir);
	const tag = `evo-calibration-${path
		.basename(scratch)
		.toLowerCase()
		.replace(/[^a-z0-9_.-]/g, "-")}`;
	const build = await exec([runtime, "build", "-t", tag, path.join(taskDir, "environment")]);
	if (build.code !== 0) fail(`image build failed (${runtime} exit ${build.code}): ${build.err.trim()}`);
	const inspect = await exec([runtime, "image", "inspect", "--format", "{{.Id}}", tag]);
	const image = inspect.out.trim();
	if (inspect.code !== 0 || image.length === 0) fail(`cannot inspect built image ${tag}: ${inspect.err.trim()}`);

	const verify = async (solve: boolean): Promise<number> => {
		const logDir = path.join(scratch, solve ? "logs-green" : "logs-red");
		await fs.rm(logDir, { recursive: true, force: true });
		await fs.mkdir(logDir, { recursive: true });
		const script = solve ? "bash /solution/solve.sh || exit 97; bash /tests/test.sh" : "bash /tests/test.sh";
		const r = await exec([
			runtime,
			"run",
			"--rm",
			"--network",
			network,
			"-v",
			`${path.join(taskDir, "tests")}:/tests:ro`,
			"-v",
			`${path.join(taskDir, "solution")}:/solution:ro`,
			"-v",
			`${logDir}:/logs/verifier`,
			tag,
			"bash",
			"-c",
			script,
		]);
		if (r.code === 97 && solve) fail(`solution/solve.sh failed in container: ${r.err.trim()}`);
		if (r.code !== 0) fail(`verifier container exited ${r.code}: ${r.err.trim()}`);
		const text = (await Bun.file(path.join(logDir, "reward.txt")).text()).trim();
		const reward = Number(text);
		if (text.length === 0 || !Number.isFinite(reward))
			fail(`verifier wrote non-numeric reward ${JSON.stringify(text)}`);
		return reward;
	};
	return {
		verify,
		environment: {
			mode: "container",
			runtime: path.basename(runtime),
			image,
			verifierNetwork: VERIFIER_NETWORK_MODE,
		},
		dispose: async () => {
			await exec([runtime, "image", "rm", "-f", tag]);
		},
	};
}
