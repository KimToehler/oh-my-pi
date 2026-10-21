#!/usr/bin/env bun
/**
 * Sync the team config shipped in this repo into the omp agent dir (default ~/.omp/agent).
 *
 * - `team-config/agent/**` is managed: every file is mirrored into the agent dir and recorded in
 *   `<agentDir>/.team-config-manifest.json`. A file that left the repo is removed on the next run.
 * - `team-config/seed/*` is copied only when the target does not exist yet (config.yml, models.yml).
 * - Files outside the manifest are never touched. Before a file is overwritten or removed, any
 *   content this installer did not write itself (a local edit, or a same-named file that predates
 *   the manifest) is moved to a fresh `<agentDir>/backups/team-config-<timestamp>-<random>/`.
 *
 * Usage: bun scripts/install-team-config.ts   (scripts/deploy-local.sh runs it after installing omp)
 */
import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getAgentDir, isEexist, isEnoent } from "@oh-my-pi/pi-utils";

const MANIFEST_NAME = ".team-config-manifest.json";
const SKIPPED_NAMES: Record<string, true> = { ".DS_Store": true, __pycache__: true, ".pytest_cache": true };

interface Manifest {
	version: 1;
	/** Agent-dir-relative path (always `/`-separated) → sha256 of the content this installer wrote. */
	files: Record<string, string>;
}

export interface InstallOptions {
	/** Repo checkout containing `team-config/`. */
	repoDir: string;
	agentDir: string;
	/** Names the backup directory of this run. */
	timestamp: string;
	/** Test hook: awaited once after planning and before the first mutation. Lets tests change the filesystem in that window. */
	beforeApply?: () => Promise<void>;
}

export interface InstallReport {
	added: string[];
	updated: string[];
	removed: string[];
	backedUp: string[];
	seeded: string[];
	/** Set only when this run backed something up. */
	backupDir?: string;
}

/** Sorted relative file paths under `root`. Any readdir failure throws; a missing root only passes when `optional`. */
async function listFiles(root: string, optional = false): Promise<string[]> {
	const out: string[] = [];
	async function walk(dir: string, rel: string): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (SKIPPED_NAMES[entry.name]) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(path.join(dir, entry.name), childRel);
			else if (entry.isFile()) out.push(childRel);
		}
	}
	if (optional && (await fs.lstat(root).then(() => false, isEnoent))) return [];
	await walk(root, "");
	return out.sort();
}

/** Stands in for the content hash of a symlink: never equals a sha256, never read through. */
const LINK = "symlink";

/** State of `file` in the agent dir: undefined (absent), LINK (symlink, not followed) or its sha256. */
async function inspect(file: string): Promise<string | undefined> {
	try {
		if ((await fs.lstat(file)).isSymbolicLink()) return LINK;
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}
	return hashFile(file);
}

/** Throw if any directory component strictly between `root` and `target` is a symlink (or not a directory). */
async function assertContained(root: string, target: string): Promise<void> {
	const rel = path.relative(root, target);
	if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
		throw new Error(`Refusing path outside the agent dir: ${target}`);
	}
	const parts = rel.split(path.sep).slice(0, -1);
	let current = root;
	for (const part of parts) {
		current = path.join(current, part);
		let stat: Stats;
		try {
			stat = await fs.lstat(current);
		} catch (err) {
			if (isEnoent(err)) return;
			throw err;
		}
		if (stat.isSymbolicLink()) throw new Error(`Refusing to install through symlink: ${current}`);
		if (!stat.isDirectory()) throw new Error(`Expected a directory but found a file: ${current}`);
	}
}

function hashBytes(bytes: Uint8Array): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(bytes);
	return hasher.digest("hex");
}

async function hashFile(file: string): Promise<string | undefined> {
	try {
		return hashBytes(await Bun.file(file).bytes());
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}
}

async function readManifest(file: string): Promise<Manifest> {
	try {
		const manifest = (await Bun.file(file).json()) as Manifest;
		if (manifest.version === 1 && typeof manifest.files === "object") return manifest;
		throw new Error(`Unsupported team config manifest ${file}`);
	} catch (err) {
		if (isEnoent(err)) return { version: 1, files: {} };
		throw err;
	}
}

/** Write `bytes` to `dst` atomically via an exclusively created, run-unique temp; sets `mode`. */
async function replaceFile(bytes: Uint8Array, dst: string, mode: number): Promise<void> {
	await fs.mkdir(path.dirname(dst), { recursive: true });
	const tmp = `${dst}.${process.pid}-${crypto.randomUUID().slice(0, 8)}.team-config-tmp`;
	try {
		await fs.writeFile(tmp, bytes, { flag: "wx" });
	} catch (err) {
		if (!isEexist(err)) await fs.rm(tmp, { force: true });
		throw err;
	}
	try {
		await fs.chmod(tmp, mode);
		await fs.rename(tmp, dst);
	} catch (err) {
		await fs.rm(tmp, { force: true });
		throw err;
	}
}

async function writeManifest(manifestPath: string, manifest: Manifest): Promise<void> {
	const tmp = `${manifestPath}.${process.pid}-${crypto.randomUUID().slice(0, 8)}.tmp`;
	try {
		await fs.writeFile(tmp, `${JSON.stringify(manifest, null, "\t")}\n`, { flag: "wx" });
		await fs.rename(tmp, manifestPath);
	} catch (err) {
		if (!isEexist(err)) await fs.rm(tmp, { force: true });
		throw err;
	}
}

/** Remove now-empty directories from `dir` up to, not including, `stopAt`. */
async function pruneEmptyDirs(dir: string, stopAt: string): Promise<void> {
	let current = dir;
	while (current !== stopAt && current.startsWith(stopAt + path.sep)) {
		try {
			await fs.rmdir(current);
		} catch {
			return;
		}
		current = path.dirname(current);
	}
}

interface WriteStep {
	kind: "write";
	rel: string;
	/** The exact bytes hashed in phase 1; written as-is, never re-read from the source path. */
	bytes: Uint8Array;
	hash: string;
	mode: number;
	/** How the existing target is preserved first; absent when nothing needs preserving. */
	backup?: "copy" | "move";
	existed: boolean;
	/** State of the destination phase 1 planned on; phase 2 aborts if it differs. */
	planned: string | undefined;
}

/** Bytes already match; only the permission bits differ. */
interface ChmodStep {
	kind: "chmod";
	rel: string;
	mode: number;
	planned: string | undefined;
}

interface RemoveStep {
	kind: "remove";
	rel: string;
	backup?: "move";
	planned: string | undefined;
}

/** Throw if `<agentDir>/backups` exists as anything but a real directory. */
async function assertBackupsRoot(backupsRoot: string): Promise<void> {
	let stat: Stats;
	try {
		stat = await fs.lstat(backupsRoot);
	} catch (err) {
		if (isEnoent(err)) return;
		throw err;
	}
	if (stat.isSymbolicLink()) throw new Error(`Refusing to back up through symlink: ${backupsRoot}`);
	if (!stat.isDirectory()) throw new Error(`Expected a directory but found a file: ${backupsRoot}`);
}

export async function installTeamConfig(options: InstallOptions): Promise<InstallReport> {
	const managedRoot = path.join(options.repoDir, "team-config", "agent");
	const seedRoot = path.join(options.repoDir, "team-config", "seed");

	// Phase 1: enumerate and read every source exactly once, then plan every mutation. Nothing is written here.
	// The in-memory bytes are what gets hashed AND what phase 2 writes, so the manifest always describes installed content.
	const managedFiles = await listFiles(managedRoot);
	const seedFiles = await listFiles(seedRoot, true);
	const sources = new Map<string, { bytes: Uint8Array; hash: string; mode: number }>();
	for (const rel of managedFiles) {
		const src = path.join(managedRoot, rel);
		const bytes = await Bun.file(src).bytes();
		sources.set(rel, { bytes, hash: hashBytes(bytes), mode: (await fs.stat(src)).mode & 0o777 });
	}

	await fs.mkdir(options.agentDir, { recursive: true });
	const agentDir = await fs.realpath(options.agentDir);
	const manifestPath = path.join(agentDir, MANIFEST_NAME);
	const backupsRoot = path.join(agentDir, "backups");
	await assertBackupsRoot(backupsRoot);
	const previous = await readManifest(manifestPath);
	const next: Manifest = { version: 1, files: {} };
	const report: InstallReport = { added: [], updated: [], removed: [], backedUp: [], seeded: [] };
	const steps: Array<WriteStep | ChmodStep | RemoveStep> = [];
	const seeds: Array<{ rel: string; planned: string | undefined }> = [];
	// Manifest to persist if phase 2 aborts midway. Rule: the previous manifest, plus the new hash for every file whose
	// bytes now equal the source (written this run, or already identical), minus files removed this run. Planned-but-
	// unapplied writes keep their previous entry (or stay absent if never installed), so the next run classifies each
	// file by what is really on disk instead of trusting a plan that never completed.
	const applied: Record<string, string> = { ...previous.files };

	for (const rel of managedFiles) {
		const { bytes, hash: wanted, mode } = sources.get(rel)!;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		next.files[rel] = wanted;
		if (current === wanted) {
			applied[rel] = wanted;
			if (((await fs.stat(dst)).mode & 0o777) !== mode) steps.push({ kind: "chmod", rel, mode, planned: current });
			continue;
		}
		let backup: WriteStep["backup"];
		if (current === LINK) backup = "move";
		else if (current !== undefined && current !== previous.files[rel]) backup = "copy";
		steps.push({
			kind: "write",
			rel,
			bytes,
			hash: wanted,
			mode,
			backup,
			existed: current !== undefined,
			planned: current,
		});
	}

	for (const rel of Object.keys(previous.files).sort()) {
		if (rel in next.files) continue;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		if (current === undefined) continue;
		const backup = current === previous.files[rel] ? undefined : "move";

		steps.push({ kind: "remove", rel, backup, planned: current });
	}

	for (const rel of seedFiles) {
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		seeds.push({ rel, planned: await inspect(dst) });
	}

	await options.beforeApply?.();

	/** Abort unless `rel` is still contained and in exactly the state phase 1 planned on. */
	const verify = async (rel: string, planned: string | undefined): Promise<void> => {
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		if ((await inspect(dst)) !== planned) throw new Error(`Refusing to touch ${dst}: it changed after planning`);
	};

	// Phase 2: apply. The backup dir is created lazily and exclusively, so no destination inside it pre-exists.
	let backupDir: string | undefined;
	const backup = async (rel: string, mode: "copy" | "move"): Promise<void> => {
		if (!backupDir) {
			await assertContained(agentDir, path.join(backupsRoot, "x"));
			await fs.mkdir(backupsRoot, { recursive: true });
			await assertBackupsRoot(backupsRoot);
			backupDir = await fs.mkdtemp(path.join(backupsRoot, `team-config-${options.timestamp}-`));
		}
		const dst = path.join(backupDir, rel);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		const src = path.join(agentDir, rel);
		if (mode === "move") await fs.rename(src, dst);
		else await fs.copyFile(src, dst, fs.constants.COPYFILE_EXCL);
		report.backedUp.push(rel);
		report.backupDir = backupDir;
	};

	try {
		for (const step of steps) {
			const dst = path.join(agentDir, step.rel);
			await verify(step.rel, step.planned);
			if (step.kind === "chmod") {
				await fs.chmod(dst, step.mode);
				report.updated.push(step.rel);
				continue;
			}
			if (step.backup) await backup(step.rel, step.backup);
			if (step.kind === "write") {
				await replaceFile(step.bytes, dst, step.mode);
				applied[step.rel] = step.hash;
				(step.existed ? report.updated : report.added).push(step.rel);
			} else {
				if (!step.backup) await fs.rm(dst);
				delete applied[step.rel];
				report.removed.push(step.rel);
				await pruneEmptyDirs(path.dirname(dst), agentDir);
			}
		}

		for (const { rel, planned } of seeds) {
			const dst = path.join(agentDir, rel);
			await verify(rel, planned);
			await fs.mkdir(path.dirname(dst), { recursive: true });
			try {
				await fs.copyFile(path.join(seedRoot, rel), dst, fs.constants.COPYFILE_EXCL);
				report.seeded.push(rel);
			} catch (err) {
				if (!isEexist(err)) throw err;
			}
		}
	} catch (err) {
		// Persist what was actually applied; a failure here must not mask the original error.
		await writeManifest(manifestPath, { version: 1, files: applied }).catch(() => {});
		throw err;
	}

	await writeManifest(manifestPath, next);
	return report;
}

if (import.meta.main) {
	const agentDir = getAgentDir();
	const report = await installTeamConfig({
		repoDir: path.resolve(import.meta.dir, ".."),
		agentDir,
		timestamp: new Date().toISOString().replace(/[:.]/g, "-"),
	});
	const list = (label: string, items: string[]) => {
		if (items.length > 0) console.log(`  ${label} (${items.length}): ${items.join(", ")}`);
	};
	console.log(`Team config → ${agentDir}`);
	list("added", report.added);
	list("updated", report.updated);
	list("removed", report.removed);
	list("seeded", report.seeded);
	if (report.backupDir)
		console.log(`  previous content of ${report.backedUp.length} file(s) saved in ${report.backupDir}`);
	if (report.seeded.includes("models.yml")) {
		console.log(`  next: put ONARA_ROUTER_KEY=<your key> into ${path.join(agentDir, ".env")}`);
	}
}
