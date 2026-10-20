#!/usr/bin/env bun
/**
 * Sync the team config shipped in this repo into the omp agent dir (default ~/.omp/agent).
 *
 * - `team-config/agent/**` is managed: every file is mirrored into the agent dir and recorded in
 *   `<agentDir>/.team-config-manifest.json`. A file that left the repo is removed on the next run.
 * - `team-config/seed/*` is copied only when the target does not exist yet (config.yml, models.yml).
 * - Files outside the manifest are never touched. Before a file is overwritten or removed, any
 *   content this installer did not write itself (a local edit, or a same-named file that predates
 *   the manifest) is moved to `<agentDir>/backups/team-config-<timestamp>/`.
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

async function hashFile(file: string): Promise<string | undefined> {
	try {
		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(await Bun.file(file).bytes());
		return hasher.digest("hex");
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

/** Copy `src` over `dst` atomically via an exclusively created, run-unique temp; keeps the source's permission bits. */
async function replaceFile(src: string, dst: string, mode: number): Promise<void> {
	await fs.mkdir(path.dirname(dst), { recursive: true });
	const tmp = `${dst}.${process.pid}-${crypto.randomUUID().slice(0, 8)}.team-config-tmp`;
	try {
		await fs.copyFile(src, tmp, fs.constants.COPYFILE_EXCL);
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
	src: string;
	mode: number;
	/** How the existing target is preserved first; absent when nothing needs preserving. */
	backup?: "copy" | "move";
	existed: boolean;
}

interface RemoveStep {
	kind: "remove";
	rel: string;
	backup?: "move";
}

export async function installTeamConfig(options: InstallOptions): Promise<InstallReport> {
	const managedRoot = path.join(options.repoDir, "team-config", "agent");
	const seedRoot = path.join(options.repoDir, "team-config", "seed");

	// Phase 1: enumerate and hash every source, then plan every mutation. Nothing is written here.
	const managedFiles = await listFiles(managedRoot);
	const seedFiles = await listFiles(seedRoot, true);
	const sources = new Map<string, { hash: string; mode: number }>();
	for (const rel of managedFiles) {
		const src = path.join(managedRoot, rel);
		sources.set(rel, { hash: (await hashFile(src))!, mode: (await fs.stat(src)).mode & 0o777 });
	}

	await fs.mkdir(options.agentDir, { recursive: true });
	const agentDir = await fs.realpath(options.agentDir);
	const manifestPath = path.join(agentDir, MANIFEST_NAME);
	const backupDir = path.join(agentDir, "backups", `team-config-${options.timestamp}`);
	const previous = await readManifest(manifestPath);
	const next: Manifest = { version: 1, files: {} };
	const report: InstallReport = { added: [], updated: [], removed: [], backedUp: [], seeded: [] };
	const steps: Array<WriteStep | RemoveStep> = [];
	const seeds: string[] = [];

	for (const rel of managedFiles) {
		const { hash: wanted, mode } = sources.get(rel)!;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		next.files[rel] = wanted;
		if (current === wanted) continue;
		let backup: WriteStep["backup"];
		if (current === LINK) backup = "move";
		else if (current !== undefined && current !== previous.files[rel]) backup = "copy";
		if (backup) await assertContained(agentDir, path.join(backupDir, rel));
		steps.push({
			kind: "write",
			rel,
			src: path.join(managedRoot, rel),
			mode,
			backup,
			existed: current !== undefined,
		});
	}

	for (const rel of Object.keys(previous.files).sort()) {
		if (rel in next.files) continue;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		if (current === undefined) continue;
		const backup = current === previous.files[rel] ? undefined : "move";
		if (backup) await assertContained(agentDir, path.join(backupDir, rel));
		steps.push({ kind: "remove", rel, backup });
	}

	for (const rel of seedFiles) {
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		seeds.push(rel);
	}

	// Phase 2: apply.
	const backup = async (rel: string, mode: "copy" | "move"): Promise<void> => {
		const dst = path.join(backupDir, rel);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		const src = path.join(agentDir, rel);
		if (mode === "move") await fs.rename(src, dst);
		else await fs.copyFile(src, dst);
		report.backedUp.push(rel);
		report.backupDir = backupDir;
	};

	for (const step of steps) {
		const dst = path.join(agentDir, step.rel);
		if (step.backup) await backup(step.rel, step.backup);
		if (step.kind === "write") {
			await replaceFile(step.src, dst, step.mode);
			(step.existed ? report.updated : report.added).push(step.rel);
		} else {
			if (!step.backup) await fs.rm(dst);
			report.removed.push(step.rel);
			await pruneEmptyDirs(path.dirname(dst), agentDir);
		}
	}

	for (const rel of seeds) {
		const dst = path.join(agentDir, rel);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		try {
			await fs.copyFile(path.join(seedRoot, rel), dst, fs.constants.COPYFILE_EXCL);
			report.seeded.push(rel);
		} catch (err) {
			if (!isEexist(err)) throw err;
		}
	}

	const tmpManifest = `${manifestPath}.${process.pid}-${crypto.randomUUID().slice(0, 8)}.tmp`;
	try {
		await fs.writeFile(tmpManifest, `${JSON.stringify(next, null, "\t")}\n`, { flag: "wx" });
		await fs.rename(tmpManifest, manifestPath);
	} catch (err) {
		if (!isEexist(err)) await fs.rm(tmpManifest, { force: true });
		throw err;
	}
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
