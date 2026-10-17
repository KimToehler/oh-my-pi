import { DIGEST_PINNED_IMAGE } from "../src/evo/image-pins";
import { fail } from "./evo-task-shared";

async function capture(cmd: string[]): Promise<{ code: number; out: string; err: string }> {
	let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
	try {
		proc = Bun.spawn(cmd, { env: process.env, stdout: "pipe", stderr: "pipe" });
	} catch (err) {
		fail(`cannot run container runtime '${cmd[0]}': ${err instanceof Error ? err.message : String(err)}`);
	}
	const [out, err, code] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
	return { code, out, err };
}

/**
 * Pin a `--base-image` to the content digest it names right now. A digest-pinned reference is used as-is; a mutable
 * tag is pulled and resolved ONCE through the container runtime, and the generated Dockerfile carries that digest,
 * so the task hash binds the exact image and a moved tag can never change what identical task bytes build.
 */
export async function resolveBaseImage(baseImage: string, runtime: string): Promise<string> {
	if (DIGEST_PINNED_IMAGE.test(baseImage)) return baseImage;
	const pull = await capture([runtime, "pull", baseImage]);
	if (pull.code !== 0) fail(`cannot pull base image ${baseImage} to resolve its digest: ${pull.err.trim()}`);
	const inspect = await capture([runtime, "image", "inspect", "--format", "{{index .RepoDigests 0}}", baseImage]);
	const resolved = inspect.out.trim();
	if (inspect.code !== 0 || !DIGEST_PINNED_IMAGE.test(resolved)) {
		fail(`cannot resolve ${baseImage} to a sha256 digest (got ${JSON.stringify(resolved)}): ${inspect.err.trim()}`);
	}
	return resolved;
}
