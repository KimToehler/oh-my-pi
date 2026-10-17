#!/usr/bin/env bun

/**
 * Private-suite task generator for Evo2 evaluation.
 *
 *   evo-task.ts make   --repo R --base B --fix F --name N --instruction T --test-command C
 *                      --test-glob G [--test-glob G…] --base-image I --output DIR
 *   evo-task.ts verify --task DIR
 *
 * `make` emits a Harbor task (schema 1.3) for the base→fix change: `environment/repo/` holds the
 * base snapshot (copied to /workspace/repo by the Dockerfile), the verifier overlays hidden tests
 * taken from `fix`, and the reference solution overlays the non-test files taken from `fix`.
 * `verify` is the mandatory RED/GREEN calibration: reward 0 before solution, 1 after, measured in the generated
 * Docker image under the verifier's no-network policy (runtime: $EVO_CONTAINER_RUNTIME, default `docker`).
 * `--host-unisolated` runs the same check on the host shell as a diagnostic and never writes calibration.json.
 */
import { fail } from "./evo-task-shared";
import { type MakeOptions, makeTask } from "./evo-task-make";
import { verifyTask } from "./evo-task-verify";

export function parseMakeArgs(argv: string[]): MakeOptions {
	const vals: Record<string, string> = {};
	const testGlobs: string[] = [];
	for (let i = 0; i < argv.length; i += 2) {
		const flag = argv[i];
		const value = argv[i + 1];
		if (!flag.startsWith("--")) fail(`unexpected argument ${flag}`);
		if (value === undefined) fail(`${flag} requires a value`);
		if (flag === "--test-glob") testGlobs.push(value);
		else vals[flag] = value;
	}
	const need = (flag: string): string => vals[flag] ?? fail(`${flag} is required`);
	return {
		repo: need("--repo"),
		base: need("--base"),
		fix: need("--fix"),
		name: need("--name"),
		instruction: need("--instruction"),
		testCommand: need("--test-command"),
		testGlobs,
		baseImage: need("--base-image"),
		output: need("--output"),
	};
}

export async function main(argv: string[]): Promise<void> {
	const [cmd, ...rest] = argv;
	if (cmd === "make") {
		const meta = await makeTask(parseMakeArgs(rest));
		console.log(
			`generated task: ${meta.testFiles.length} hidden test file(s), ${meta.solutionFiles.length} solution file(s), ${meta.deletedFiles.length} deletion(s)`,
		);
		return;
	}
	if (cmd === "verify") {
		const host = rest[2] === "--host-unisolated";
		if (rest.length !== (host ? 3 : 2) || rest[0] !== "--task") {
			fail("usage: evo-task.ts verify --task <dir> [--host-unisolated]");
		}
		const r = await verifyTask(rest[1], { hostUnisolated: host });
		console.log(`verifier reward before solution: ${r.before}\nverifier reward after solution: ${r.after}`);
		return;
	}
	fail("usage: evo-task.ts make|verify (see file header)");
}

if (import.meta.main) {
	main(process.argv.slice(2)).catch(err => {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}
