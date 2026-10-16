/**
 * Config genome snapshots: whitelist a harness agent dir, dereference safe symlinks, hash the
 * content, and materialize it immutably.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { createTwoFilesPatch } from "diff";

export interface ConfigFile {
	/** POSIX path relative to the config root. */
	rel: string;
	bytes: Uint8Array;
	executable: boolean;
}

/** Conservative caps on one snapshot; enforced before bytes are read. */
export const MAX_CONFIG_FILES = 2000;
export const MAX_CONFIG_FILE_BYTES = 1024 * 1024;
export const MAX_CONFIG_TOTAL_BYTES = 16 * 1024 * 1024;

export interface ConfigLimits {
	maxFiles: number;
	maxFileBytes: number;
	maxTotalBytes: number;
}

const DEFAULT_LIMITS: ConfigLimits = {
	maxFiles: MAX_CONFIG_FILES,
	maxFileBytes: MAX_CONFIG_FILE_BYTES,
	maxTotalBytes: MAX_CONFIG_TOTAL_BYTES,
};

const WHITELIST_FILES = ["AGENTS.md", "config.yml"] as const;
const WHITELIST_DIRS = ["rules", "skills", "agents", "extensions"] as const;

const SECRET_NAMES = [
	/^\.env(\..*)?$/i,
	/^models\.ya?ml$/i,
	/^auth\.json$/i,
	/^id_(rsa|ed25519|ecdsa)(\.pub)?$/i,
	/\.(pem|key|p12|pfx)$/i,
];
const STATE_NAMES = [
	/\.(db|sqlite3?|db-wal|db-shm|sqlite-wal|sqlite-shm|wal|shm)$/i,
	/\.(log|lock|lockb|bak|backup|orig|swp)$/i,
	/~$/,
	/^(bun\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.DS_Store)$/,
	/^(sessions|cache|\.cache|backups|logs|predictions|node_modules|\.git)$/i,
	/(^|[-_.])predictions?([-_.]|$)/i,
];

function within(child: string, root: string): boolean {
	return child === root || child.startsWith(`${root}${path.sep}`);
}

/**
 * A symlink must not smuggle a forbidden file into the snapshot under an innocuous alias. Inspect every
 * root-relative segment of the resolved target (so a symlinked directory is judged by where it lands,
 * and nested children are re-judged by the walk). Messages name the logical path, never target bytes.
 */
function assertTargetAllowed(root: string, real: string, rel: string): void {
	for (const segment of path.relative(root, real).split(path.sep)) {
		if (SECRET_NAMES.some(re => re.test(segment))) throw new Error(`symlink target is secret-bearing: ${rel}`);
		if (STATE_NAMES.some(re => re.test(segment))) throw new Error(`symlink target is excluded state: ${rel}`);
	}
}

interface WalkContext {
	root: string;
	out: ConfigFile[];
	active: Set<string>;
	limits: ConfigLimits;
	totalBytes: number;
}

function readLeaf(ctx: WalkContext, abs: string, rel: string): void {
	const size = fs.statSync(abs).size;
	if (ctx.out.length + 1 > ctx.limits.maxFiles) throw new Error(`config exceeds ${ctx.limits.maxFiles} files`);
	if (size > ctx.limits.maxFileBytes) throw new Error(`file ${rel} exceeds ${ctx.limits.maxFileBytes} bytes`);
	if (ctx.totalBytes + size > ctx.limits.maxTotalBytes) {
		throw new Error(`config exceeds ${ctx.limits.maxTotalBytes} total bytes`);
	}
	ctx.totalBytes += size;
	let bytes: Uint8Array;
	try {
		bytes = fs.readFileSync(abs);
	} catch (err) {
		throw new Error(`unreadable file ${rel}: ${err instanceof Error ? err.message : String(err)}`);
	}
	const stat = fs.statSync(abs);
	ctx.out.push({ rel, bytes, executable: (stat.mode & 0o111) !== 0 });
}

function walk(ctx: WalkContext, abs: string, rel: string): void {
	const link = fs.lstatSync(abs);
	let real = abs;
	if (link.isSymbolicLink()) {
		try {
			real = fs.realpathSync(abs);
		} catch {
			throw new Error(`broken symlink: ${rel}`);
		}
		if (!within(real, ctx.root)) throw new Error(`symlink escapes source root: ${rel}`);
		assertTargetAllowed(ctx.root, real, rel);
	}
	const stat = fs.statSync(real);
	if (stat.isFile()) return readLeaf(ctx, real, rel);
	if (!stat.isDirectory()) throw new Error(`unsupported file type (not a regular file or directory): ${rel}`);
	const key = fs.realpathSync(real);
	if (ctx.active.has(key)) throw new Error(`symlink cycle at ${rel}`);
	ctx.active.add(key);
	for (const name of fs.readdirSync(real).sort()) {
		const child = `${rel}/${name}`;
		if (SECRET_NAMES.some(re => re.test(name))) throw new Error(`secret-bearing path not allowed: ${child}`);
		if (STATE_NAMES.some(re => re.test(name))) continue;
		walk(ctx, path.join(real, name), child);
	}
	ctx.active.delete(key);
}

function validateConfigYaml(bytes: Uint8Array): void {
	let parsed: unknown;
	try {
		parsed = Bun.YAML.parse(new TextDecoder().decode(bytes));
	} catch (err) {
		throw new Error(`config.yml is malformed YAML: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (parsed !== null && !isRecord(parsed)) throw new Error("config.yml must be a YAML mapping");
}

/**
 * Collect whitelisted files from an agent dir, sorted by relative path. Synchronous so the launch
 * path (which must not yield between verification and spawn) can re-verify a registered snapshot.
 */
export function collectConfigSync(srcDir: string, limits: ConfigLimits = DEFAULT_LIMITS): ConfigFile[] {
	let root: string;
	try {
		root = fs.realpathSync(srcDir);
		if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
	} catch {
		throw new Error(`config directory not found: ${srcDir}`);
	}
	const exists = (abs: string): fs.Stats | null => fs.lstatSync(abs, { throwIfNoEntry: false }) ?? null;
	const ctx: WalkContext = { root, out: [], active: new Set(), limits, totalBytes: 0 };
	for (const name of WHITELIST_FILES) {
		const abs = path.join(root, name);
		if (!exists(abs)) continue;
		const before = ctx.out.length;
		walk(ctx, abs, name);
		if (ctx.out.length === before) throw new Error(`${name} must be a file`);
	}
	for (const name of WHITELIST_DIRS) {
		const abs = path.join(root, name);
		if (!exists(abs)) continue;
		const target = fs.statSync(abs, { throwIfNoEntry: false });
		if (!target?.isDirectory()) throw new Error(`${name} must be a directory`);
		walk(ctx, abs, name);
	}
	const config = ctx.out.find(file => file.rel === "config.yml");
	if (config) validateConfigYaml(config.bytes);
	return ctx.out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** Async form of {@link collectConfigSync}. */
export async function collectConfig(srcDir: string, limits: ConfigLimits = DEFAULT_LIMITS): Promise<ConfigFile[]> {
	return collectConfigSync(srcDir, limits);
}

/** SHA-256 over sorted relative paths, executable bit, and bytes. */
export function hashConfig(files: readonly ConfigFile[]): string {
	const hasher = new Bun.CryptoHasher("sha256");
	for (const file of files) {
		hasher.update(`${file.rel}\0${file.executable ? "x" : "-"}\0${file.bytes.length}\0`);
		hasher.update(file.bytes);
		hasher.update("\0");
	}
	return hasher.digest("hex");
}

/** Write files under `dest` (created); regular files only, made read-only. */
export async function materializeConfig(files: readonly ConfigFile[], dest: string): Promise<void> {
	await fsp.mkdir(dest, { recursive: true });
	for (const file of files) {
		const target = path.join(dest, file.rel);
		await Bun.write(target, file.bytes);
		await fsp.chmod(target, file.executable ? 0o555 : 0o444);
	}
	// Defence in depth only: a read-only directory stops accidental writes and casual unlink/replace, but its
	// owner can chmod it back. `assertVariantSnapshotIntact` (rehash at launch) is what actually closes tampering.
	await lockDirs(dest);
}

/** Restore owner write on `dir` and every directory beneath it so the tree can be deleted. Missing path is fine. */
export async function unlockTree(dir: string): Promise<void> {
	let entries: fs.Dirent[];
	try {
		await fsp.chmod(dir, 0o755);
		entries = await fsp.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) await unlockTree(path.join(dir, entry.name));
	}
}

/** Remove write permission from `dir` and every directory beneath it, deepest first. */
async function lockDirs(dir: string): Promise<void> {
	for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) await lockDirs(path.join(dir, entry.name));
	}
	await fsp.chmod(dir, 0o555);
}

export interface ConfigDiff {
	patch: string;
	changedFiles: string[];
}

/** Unified diff from `parent` to `child` plus the sorted list of added/removed/modified paths. */
export function diffConfigs(parent: readonly ConfigFile[], child: readonly ConfigFile[]): ConfigDiff {
	const decoder = new TextDecoder();
	const before = new Map(parent.map(file => [file.rel, file]));
	const after = new Map(child.map(file => [file.rel, file]));
	const changed: string[] = [];
	const patches: string[] = [];
	for (const rel of [...new Set([...before.keys(), ...after.keys()])].sort()) {
		const old = before.get(rel);
		const next = after.get(rel);
		if (old && next && old.executable === next.executable && Buffer.compare(old.bytes, next.bytes) === 0) continue;
		changed.push(rel);
		if (old && next && Buffer.compare(old.bytes, next.bytes) === 0) {
			patches.push(
				`diff --mode a/${rel} b/${rel}\nold mode ${old.executable ? "755" : "644"}\nnew mode ${next.executable ? "755" : "644"}\n`,
			);
			continue;
		}
		patches.push(
			createTwoFilesPatch(
				old ? `a/${rel}` : "/dev/null",
				next ? `b/${rel}` : "/dev/null",
				old ? decoder.decode(old.bytes) : "",
				next ? decoder.decode(next.bytes) : "",
			),
		);
	}
	return { patch: patches.join(""), changedFiles: changed };
}
