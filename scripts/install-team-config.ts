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

async function listFiles(root: string): Promise<string[]> {
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
	try {
		await walk(root, "");
	} catch (err) {
		if (!isEnoent(err)) throw err;
	}
	return out.sort();
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

/** Copy `src` over `dst` atomically, keeping the source's permission bits (skill scripts are executable). */
async function replaceFile(src: string, dst: string): Promise<void> {
	await fs.mkdir(path.dirname(dst), { recursive: true });
	const tmp = `${dst}.team-config-tmp`;
	await fs.copyFile(src, tmp);
	await fs.chmod(tmp, (await fs.stat(src)).mode & 0o777);
	await fs.rename(tmp, dst);
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

export async function installTeamConfig(options: InstallOptions): Promise<InstallReport> {
	const { agentDir } = options;
	const managedRoot = path.join(options.repoDir, "team-config", "agent");
	const seedRoot = path.join(options.repoDir, "team-config", "seed");
	const manifestPath = path.join(agentDir, MANIFEST_NAME);
	const backupDir = path.join(agentDir, "backups", `team-config-${options.timestamp}`);
	const previous = await readManifest(manifestPath);
	const next: Manifest = { version: 1, files: {} };
	const report: InstallReport = { added: [], updated: [], removed: [], backedUp: [], seeded: [] };

	const backup = async (rel: string, mode: "copy" | "move"): Promise<void> => {
		const dst = path.join(backupDir, rel);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		const src = path.join(agentDir, rel);
		if (mode === "move") await fs.rename(src, dst);
		else await fs.copyFile(src, dst);
		report.backedUp.push(rel);
		report.backupDir = backupDir;
	};

	for (const rel of await listFiles(managedRoot)) {
		const src = path.join(managedRoot, rel);
		const dst = path.join(agentDir, rel);
		const wanted = (await hashFile(src))!;
		const current = await hashFile(dst);
		next.files[rel] = wanted;
		if (current === wanted) continue;
		if (current !== undefined && current !== previous.files[rel]) await backup(rel, "copy");
		await replaceFile(src, dst);
		(current === undefined ? report.added : report.updated).push(rel);
	}

	for (const rel of Object.keys(previous.files).sort()) {
		if (rel in next.files) continue;
		const dst = path.join(agentDir, rel);
		const current = await hashFile(dst);
		if (current === undefined) continue;
		if (current === previous.files[rel]) await fs.rm(dst);
		else await backup(rel, "move");
		report.removed.push(rel);
		await pruneEmptyDirs(path.dirname(dst), agentDir);
	}

	for (const rel of await listFiles(seedRoot)) {
		const dst = path.join(agentDir, rel);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		try {
			await fs.copyFile(path.join(seedRoot, rel), dst, fs.constants.COPYFILE_EXCL);
			report.seeded.push(rel);
		} catch (err) {
			if (!isEexist(err)) throw err;
		}
	}

	const tmpManifest = `${manifestPath}.tmp`;
	await Bun.write(tmpManifest, `${JSON.stringify(next, null, "\t")}\n`);
	await fs.rename(tmpManifest, manifestPath);
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
