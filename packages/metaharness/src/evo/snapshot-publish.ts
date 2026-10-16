/** Atomic publication of a variant snapshot: materialize privately, then rename into place. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type ConfigFile, materializeConfig, unlockTree } from "./config-snapshot";

export interface PublishOptions {
	/** Final `<variants>/<id>` directory; must not belong to a registered variant. */
	finalDir: string;
	/** Scratch parent on the same filesystem as `finalDir`. */
	tmpRoot: string;
	files: readonly ConfigFile[];
	diffText: string;
	/** Fault-injection seam: runs once snapshot files are on disk in the private temp dir. */
	afterMaterialize?: (tempDir: string) => Promise<void>;
}

/**
 * Build `config/` + `diff.patch` in a unique temp dir and rename it to `finalDir`. Readers therefore
 * only ever see a complete snapshot or none. Callers hold the per-id lock and have verified there is
 * no registered variant, so a pre-existing `finalDir` is unreferenced debris from a crashed attempt.
 */
export async function publishSnapshot(opts: PublishOptions): Promise<{ diffPath: string }> {
	const temp = path.join(opts.tmpRoot, `${path.basename(opts.finalDir)}-${crypto.randomUUID()}`);
	try {
		await materializeConfig(opts.files, path.join(temp, "config"));
		await opts.afterMaterialize?.(temp);
		const diffTmp = path.join(temp, "diff.patch");
		await Bun.write(diffTmp, opts.diffText);
		await fs.chmod(diffTmp, 0o444);
		await fs.mkdir(path.dirname(opts.finalDir), { recursive: true });
		await unlockTree(opts.finalDir);
		await fs.rm(opts.finalDir, { recursive: true, force: true });
		await fs.rename(temp, opts.finalDir);
		// Defence in depth only (the owner can chmod back): the registry rehashes the snapshot at launch.
		// Locked after the rename because moving a directory across parents needs write on it.
		await fs.chmod(opts.finalDir, 0o555);
	} catch (err) {
		await unlockTree(temp);
		await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
		throw err;
	}
	return { diffPath: path.join(opts.finalDir, "diff.patch") };
}
