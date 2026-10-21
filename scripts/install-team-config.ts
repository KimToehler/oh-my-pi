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
const SKIPPED_NAMES = new Set([".DS_Store", "__pycache__", ".pytest_cache"]);

interface ManifestEntry {
	/** sha256 of the content the installer last knew this file to hold. */
	hash: string;
	/** The file was already byte-identical when first seen, so the installer never wrote it. Backed up on first replace/remove. */
	adopted?: true;
}

interface Manifest {
	version: 2;
	/** Agent-dir-relative path (always `/`-separated) → entry. */
	files: Record<string, ManifestEntry>;
}

export interface InstallOptions {
	/** Repo checkout containing `team-config/`. */
	repoDir: string;
	agentDir: string;
	/** Names the backup directory of this run. */
	timestamp: string;
	/** Test hook: awaited once after planning and before the first mutation. Lets tests change the filesystem in that window. */
	beforeApply?: () => Promise<void>;
	/** Test hook: awaited after each planned step completes, with that step's relative path. Lets tests change the filesystem between steps. */
	afterStep?: (rel: string) => Promise<void>;
	/** Test hook: awaited right before each manifest write (`intent`, `partial`, `final`); throw to simulate that write failing. */
	writeManifestHook?: (kind: "intent" | "partial" | "final") => Promise<void>;
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

function entryKind(e: {
	isSymbolicLink(): boolean;
	isFile(): boolean;
	isDirectory(): boolean;
	isFIFO(): boolean;
	isSocket(): boolean;
	isCharacterDevice(): boolean;
	isBlockDevice(): boolean;
}): string {
	if (e.isSymbolicLink()) return "symlink";
	if (e.isFile()) return "file";
	if (e.isDirectory()) return "directory";
	if (e.isFIFO()) return "fifo";
	if (e.isSocket()) return "socket";
	if (e.isCharacterDevice()) return "character device";
	if (e.isBlockDevice()) return "block device";
	return "unknown";
}

/** Sorted relative file paths under `root`. Any readdir failure throws; a missing root only passes when `optional`. */
async function listFiles(root: string, optional = false): Promise<string[]> {
	const out: string[] = [];
	async function walk(dir: string, rel: string): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (SKIPPED_NAMES.has(entry.name)) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full, childRel);
			else if (entry.isFile()) out.push(childRel);
			else throw new Error(`Unsupported entry in team config source (${entryKind(entry)}): ${full}`);
		}
	}
	const rootStat = await fs.lstat(root).catch(err => {
		if (optional && isEnoent(err)) return undefined;
		throw err;
	});
	if (!rootStat) return [];
	if (!rootStat.isDirectory()) {
		throw new Error(`Unsupported entry in team config source (${entryKind(rootStat)}): ${root}`);
	}
	await walk(root, "");
	return out.sort();
}

/** What a destination path holds: a regular file (content hash + permission bits), a symlink (never followed; its target) or nothing. */
type DestState = { kind: "file"; hash: string; mode: number } | { kind: "link"; target: string } | undefined;

/** Comparable form of a state. A link never equals a file: its key carries no sha256. */
function stateKey(state: DestState): string | undefined {
	if (!state) return undefined;
	return state.kind === "link" ? `link:${state.target}` : `file:${state.hash}:${state.mode.toString(8)}`;
}

async function inspect(file: string): Promise<DestState> {
	let stat: Stats;
	try {
		stat = await fs.lstat(file);
		if (stat.isSymbolicLink()) return { kind: "link", target: await fs.readlink(file) };
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}
	const hash = await hashFile(file);
	return hash === undefined ? undefined : { kind: "file", hash, mode: stat.mode & 0o777 };
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

/** Bytes of the manifest file; undefined when absent. Throws, naming the path, unless it is a regular file. */
async function readManifestBytes(file: string): Promise<Uint8Array | undefined> {
	let stat: Stats;
	try {
		stat = await fs.lstat(file);
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}
	if (!stat.isFile()) throw new Error(`Refusing to use manifest that is not a regular file: ${file}`);
	try {
		return await Bun.file(file).bytes();
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}
}

/** Manifest `files` dictionary without a prototype, so every relative path is a plain own key. */
function newFiles(): Record<string, ManifestEntry> {
	return Object.create(null) as Record<string, ManifestEntry>;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Path of the first duplicated object member in syntactically valid JSON `text`, or undefined.
 * `JSON.parse` silently keeps the last duplicate, so this walks the text itself. Keys are decoded
 * before comparison, so `"a"` and `"\u0061"` collide.
 */
function findDuplicateMember(text: string): string | undefined {
	let i = 0;
	const skipWs = (): void => {
		while (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r") i++;
	};
	const readString = (): string => {
		const start = i++;
		while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
		i++;
		return JSON.parse(text.slice(start, i)) as string;
	};
	const walk = (at: string): string | undefined => {
		skipWs();
		const ch = text[i];
		if (ch === "{") {
			i++;
			const seen = new Set<string>();
			for (skipWs(); text[i] !== "}"; skipWs()) {
				const key = readString();
				const here = at === "" ? key : `${at}.${key}`;
				if (seen.has(key)) return here;
				seen.add(key);
				skipWs();
				i++; // ':'
				const dup = walk(here);
				if (dup !== undefined) return dup;
				skipWs();
				if (text[i] === ",") i++;
			}
			i++;
		} else if (ch === "[") {
			i++;
			for (let n = 0; skipWs(), text[i] !== "]"; n++) {
				const dup = walk(`${at}[${n}]`);
				if (dup !== undefined) return dup;
				skipWs();
				if (text[i] === ",") i++;
			}
			i++;
		} else if (ch === '"') {
			readString();
		} else {
			while (i < text.length && !",]} \t\n\r".includes(text[i]!)) i++;
		}
		return undefined;
	};
	return walk("");
}

/** Parse the manifest strictly: exactly the v1 or v2 shape, nothing else. Throws naming `file`; never rewrites it. */
function parseManifest(file: string, bytes: Uint8Array | undefined): Manifest {
	if (bytes === undefined) return { version: 2, files: newFiles() };
	const invalid = (why: string): Error => new Error(`Invalid team config manifest ${file}: ${why}`);
	let manifest: unknown;
	try {
		const text = new TextDecoder().decode(bytes);
		manifest = JSON.parse(text);
		const dup = findDuplicateMember(text);
		if (dup !== undefined) throw new Error(`duplicate member "${dup}"`);
	} catch (err) {
		throw invalid(err instanceof Error ? err.message : String(err));
	}
	if (!isPlainObject(manifest)) throw invalid("not a JSON object");
	const version = manifest.version;
	if (version !== 1 && version !== 2) throw invalid("unsupported version");
	for (const key of Object.keys(manifest)) {
		if (key !== "version" && key !== "files") throw invalid(`unexpected top-level key "${key}"`);
	}
	if (!isPlainObject(manifest.files)) throw invalid('"files" is not an object');
	// Null-prototype dict: `__proto__`/`constructor` are ordinary file names here.
	const files = newFiles();
	for (const [rel, entry] of Object.entries(manifest.files)) {
		if (version === 1) {
			if (typeof entry !== "string" || !SHA256_HEX.test(entry)) throw invalid(`"${rel}" has a non-sha256 hash`);
			// Version 1 cannot tell written from adopted files; treat all as adopted so the first replace backs up.
			files[rel] = { hash: entry, adopted: true };
			continue;
		}
		if (!isPlainObject(entry)) throw invalid(`"${rel}" is not an object`);
		for (const key of Object.keys(entry)) {
			if (key !== "hash" && key !== "adopted") throw invalid(`"${rel}" has unexpected key "${key}"`);
		}
		if (typeof entry.hash !== "string" || !SHA256_HEX.test(entry.hash))
			throw invalid(`"${rel}" has a non-sha256 hash`);
		if ("adopted" in entry && entry.adopted !== true) throw invalid(`"${rel}" has a non-true "adopted"`);
		files[rel] = entry.adopted === true ? { hash: entry.hash, adopted: true } : { hash: entry.hash };
	}
	return { version: 2, files };
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

/** Serialized manifest, exactly as written to disk. */
function manifestBytesOf(manifest: Manifest): Uint8Array {
	return Buffer.from(`${JSON.stringify(manifest, null, "\t")}\n`);
}

/** Replace the manifest, but only while it is still exactly what the caller last knew (`expected`; undefined = absent). */
async function writeManifest(
	manifestPath: string,
	manifest: Manifest,
	expected: Uint8Array | undefined,
): Promise<void> {
	const now = await readManifestBytes(manifestPath);
	if (now === undefined ? expected !== undefined : expected === undefined || !Buffer.from(now).equals(expected)) {
		throw new Error(`Refusing to replace manifest ${manifestPath}: it changed after planning`);
	}
	const tmp = `${manifestPath}.${process.pid}-${crypto.randomUUID().slice(0, 8)}.tmp`;
	try {
		await fs.writeFile(tmp, manifestBytesOf(manifest), { flag: "wx" });
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
	planned: DestState;
}

/** Bytes already match; only the permission bits differ. */
interface ChmodStep {
	kind: "chmod";
	rel: string;
	mode: number;
	planned: DestState;
}

interface RemoveStep {
	kind: "remove";
	rel: string;
	backup?: "move";
	planned: DestState;
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
	const manifestBytes = await readManifestBytes(manifestPath);
	const previous = parseManifest(manifestPath, manifestBytes);
	const next: Manifest = { version: 2, files: newFiles() };
	const report: InstallReport = { added: [], updated: [], removed: [], backedUp: [], seeded: [] };
	const steps: Array<WriteStep | ChmodStep | RemoveStep> = [];
	const seeds: Array<{ rel: string; planned: DestState }> = [];
	// Manifest to persist if phase 2 aborts midway. Rule: the previous manifest, plus the new hash for every file whose
	// bytes now equal the source (written this run, or already identical); removed files keep their adopted intent entry. Planned-but-
	// unapplied writes keep their previous entry (or stay absent if never installed), so the next run classifies each
	// file by what is really on disk instead of trusting a plan that never completed.
	const applied = newFiles();
	for (const [rel, entry] of Object.entries(previous.files)) applied[rel] = entry;

	for (const rel of managedFiles) {
		const { bytes, hash: wanted, mode } = sources.get(rel)!;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		const prior = Object.hasOwn(previous.files, rel) ? previous.files[rel] : undefined;
		if (current?.kind === "file" && current.hash === wanted) {
			// Already identical: the installer did not write it. Only a previously owned entry whose hash still equals the
			// current bytes stays owned; anything else (adopted, unknown, or edited to match the source) is adopted.
			const owned = prior !== undefined && !prior.adopted && prior.hash === current.hash;
			const entry: ManifestEntry = owned ? { hash: wanted } : { hash: wanted, adopted: true };
			next.files[rel] = entry;
			applied[rel] = entry;
			if (current.mode !== mode) steps.push({ kind: "chmod", rel, mode, planned: current });
			continue;
		}
		let backup: WriteStep["backup"];
		if (current?.kind === "link") backup = "move";
		else if (current && (current.hash !== prior?.hash || prior.adopted)) backup = "copy";
		next.files[rel] = { hash: wanted };
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
		if (Object.hasOwn(next.files, rel)) continue;
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		const current = await inspect(dst);
		if (current === undefined) continue;
		const prior = previous.files[rel];
		const backup = current.kind === "file" && current.hash === prior?.hash && !prior.adopted ? undefined : "move";
		steps.push({ kind: "remove", rel, backup, planned: current });
	}

	for (const rel of seedFiles) {
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		seeds.push({ rel, planned: await inspect(dst) });
	}

	await options.beforeApply?.();

	/** Abort unless `rel` is still contained and in exactly the state phase 1 planned on. */
	const verify = async (rel: string, planned: DestState): Promise<void> => {
		const dst = path.join(agentDir, rel);
		await assertContained(agentDir, dst);
		if (stateKey(await inspect(dst)) !== stateKey(planned))
			throw new Error(`Refusing to touch ${dst}: it changed after planning`);
	};

	// Every manifest write after planning is checked against the bytes this run last wrote (initially what phase 1 read).
	let expectedManifest = manifestBytes;
	const persist = async (kind: "intent" | "partial" | "final", manifest: Manifest): Promise<void> => {
		await options.writeManifestHook?.(kind);
		await writeManifest(manifestPath, manifest, expectedManifest);
		expectedManifest = manifestBytesOf(manifest);
	};

	// Intent manifest: before the first mutation, every path phase 2 will write, chmod or remove is recorded as adopted.
	// If the run is interrupted anywhere after this, including a failed partial or final manifest write, the next run backs
	// those paths up before replacing or removing them, instead of trusting a stale "owned" entry that a user edit could
	// have matched again. Seed-only paths are never in the manifest and need no intent.
	if (steps.length > 0) {
		// Changes made after planning are detected here, before the manifest is touched, so such an abort leaves it as it was.
		for (const step of steps) await verify(step.rel, step.planned);
		for (const { rel, planned } of seeds) await verify(rel, planned);
		const intent: Manifest = { version: 2, files: newFiles() };
		for (const [rel, entry] of Object.entries(previous.files)) intent.files[rel] = entry;
		for (const step of steps) {
			// Keep the last hash the installer knew; a path it never knew gets the hash it is about to write.
			const hash = previous.files[step.rel]?.hash ?? next.files[step.rel]?.hash ?? "";
			intent.files[step.rel] = { hash, adopted: true };
		}
		await persist("intent", intent);
		// Until a step completes, a partial manifest keeps its path adopted too.
		for (const step of steps) applied[step.rel] = intent.files[step.rel];
	}

	// Phase 2: apply. The backup dir is created lazily and exclusively, so no destination inside it pre-exists.
	let backupDir: string | undefined;
	// True once any step changed the agent dir; gates the partial manifest.
	let changed = false;
	const backup = async (rel: string, mode: "copy" | "move"): Promise<void> => {
		// Every backup re-validates its whole destination chain right before touching it: the run dir may have been
		// swapped for a symlink since the previous backup.
		await assertContained(agentDir, path.join(backupsRoot, "x"));
		if (!backupDir) {
			await fs.mkdir(backupsRoot, { recursive: true });
			await assertBackupsRoot(backupsRoot);
			backupDir = await fs.mkdtemp(path.join(backupsRoot, `team-config-${options.timestamp}-`));
		}
		await assertBackupsRoot(backupsRoot);
		const runStat = await fs.lstat(backupDir);
		if (runStat.isSymbolicLink()) throw new Error(`Refusing to back up through symlink: ${backupDir}`);
		if (!runStat.isDirectory()) throw new Error(`Expected a directory but found a file: ${backupDir}`);
		const dst = path.join(backupDir, rel);
		await assertContained(agentDir, dst);
		await fs.mkdir(path.dirname(dst), { recursive: true });
		await assertContained(agentDir, dst);
		const src = path.join(agentDir, rel);
		if (mode === "move") {
			await fs.rename(src, dst);
			changed = true;
		} else await fs.copyFile(src, dst, fs.constants.COPYFILE_EXCL);
		report.backedUp.push(rel);
		report.backupDir = backupDir;
	};

	try {
		for (const step of steps) {
			const dst = path.join(agentDir, step.rel);
			await verify(step.rel, step.planned);
			if (step.kind === "chmod") {
				await fs.chmod(dst, step.mode);
				changed = true;
				report.updated.push(step.rel);
				await options.afterStep?.(step.rel);
				continue;
			}
			if (step.backup) await backup(step.rel, step.backup);
			if (step.kind === "write") {
				await replaceFile(step.bytes, dst, step.mode);
				changed = true;
				// Only the successful final manifest converts a written path to owned; a partial one keeps it adopted.
				applied[step.rel] = { hash: step.hash, adopted: true };
				(step.existed ? report.updated : report.added).push(step.rel);
			} else {
				if (!step.backup) await fs.rm(dst);
				changed = true;
				// The intent entry (adopted) stays in a partial manifest; only the final manifest drops removed paths.
				report.removed.push(step.rel);
				await pruneEmptyDirs(path.dirname(dst), agentDir);
			}
			await options.afterStep?.(step.rel);
		}

		for (const { rel, planned } of seeds) {
			const dst = path.join(agentDir, rel);
			await verify(rel, planned);
			await fs.mkdir(path.dirname(dst), { recursive: true });
			try {
				await fs.copyFile(path.join(seedRoot, rel), dst, fs.constants.COPYFILE_EXCL);
				changed = true;
				report.seeded.push(rel);
			} catch (err) {
				if (!isEexist(err)) throw err;
			}
		}
	} catch (err) {
		// Nothing changed the agent dir: leave the manifest path exactly as it was.
		if (!changed) throw err;
		// Persist what was actually applied; if that fails too, the original error stays first and the write error rides along.
		try {
			await persist("partial", { version: 2, files: applied });
		} catch (writeErr) {
			const message = err instanceof Error ? err.message : String(err);
			throw new AggregateError([err, writeErr], `${message} (and the partial manifest could not be written)`);
		}
		throw err;
	}

	try {
		await persist("final", next);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Team config files were applied but the manifest was not updated: ${message}`, { cause: err });
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
