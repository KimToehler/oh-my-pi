/**
 * Registry task bytes for the generated-task image gate. A digest-pinned registry reference fixes the task bytes, but
 * a generated task's Dockerfile `FROM image:tag` still resolves freely at Harbor build time. Registration therefore
 * resolves the pinned dataset through Harbor itself (`harbor datasets download`, export layout) into a private dir so
 * the same Dockerfile gate as local datasets can run on the exact bytes Harbor will execute. Fail closed: when the
 * bytes cannot be resolved the suite is refused, never registered unchecked.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { EvoHttpError } from "./boundary";
import { hashTaskTree } from "./task-tree";

/** Populate `dest` with the dataset's tasks; Harbor export layout is `<dest>/<dataset-name>/<task-name>/`. */
export type RegistryTaskFetcher = (dataset: string, dest: string) => Promise<void>;

const harborFetcher: RegistryTaskFetcher = async (dataset, dest) => {
	const bin = Bun.which("harbor");
	if (!bin) throw new Error("harbor not found on PATH (install with: uv tool install harbor)");
	const proc = Bun.spawn([bin, "datasets", "download", dataset, "--export", "--output-dir", dest], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
	if (code !== 0) throw new Error(`harbor datasets download exited ${code}: ${err.trim().slice(-400)}`);
};

let fetcher: RegistryTaskFetcher = harborFetcher;

/** Replace the resolver (tests, alternative registries); returns a restore function. */
export function setRegistryTaskFetcher(next: RegistryTaskFetcher): () => void {
	const previous = fetcher;
	fetcher = next;
	return () => {
		fetcher = previous;
	};
}

/** Find `<root>/**\/<key>` holding a task.toml, at most three levels deep (`<dataset-name>/<task-name>`). */
function findTaskDir(root: string, key: string, depth = 0): string | null {
	if (depth > 3) return null;
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(root, entry.name);
		if (entry.name === key && fs.existsSync(path.join(dir, "task.toml"))) return dir;
		const nested = findTaskDir(dir, key, depth + 1);
		if (nested) return nested;
	}
	return null;
}

/**
 * Resolve the included tasks of a digest-pinned registry dataset into `dest/<key>`; 422 when unresolvable. Each task
 * is walked once by the same scan local suites use (`hashTaskTree`) BEFORE it is copied, so a path or body carrying a
 * forwarded credential value is refused before it lands anywhere outside the downloader's private dir.
 */
export async function resolveRegistryTasks(
	dataset: string,
	keys: readonly string[],
	dest: string,
	secrets: readonly string[] = [],
): Promise<void> {
	const raw = path.join(dest, ".download");
	fs.mkdirSync(raw, { recursive: true });
	try {
		await fetcher(dataset, raw);
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		throw new EvoHttpError(
			422,
			`registry dataset '${dataset}' could not be resolved to check generated-task base images (${reason}); the suite is refused rather than registered unchecked`,
		);
	}
	for (const key of keys) {
		const src = findTaskDir(raw, key);
		if (!src) throw new EvoHttpError(422, `task '${key}' was not found in registry dataset '${dataset}'`);
		await hashTaskTree(src, secrets);
		await fs.promises.cp(src, path.join(dest, key), { recursive: true, verbatimSymlinks: true });
	}
	await fs.promises.rm(raw, { recursive: true, force: true });
}
