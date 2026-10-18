/**
 * Run-owned, read-only copy of a source worktree. The container mounts this tree instead of the live
 * checkout. It is built from the canonical execution manifest (`execution-manifest.ts`): each inventory path is read
 * once, scanned and written from that read, and the staged manifest hash is the same value `sourceIdentity` reports
 * as `dirtyHash` for the same bytes (the runner enforces equality with the registered identity). Ignored files are scanned for credentials like any other candidate,
 * so an ignored `.env` holding a forwarded value refuses the launch (422 at the manager, refusal in the runner).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { EvoHttpError } from "./boundary";
import { redactSecrets, textCarriesSecret } from "./credential-scan";
import { type ManifestEntry, type ManifestRead, readExecutionManifest, toManifestEntry } from "./execution-manifest";
import { NATIVE_ADDON_DIR, parseRegisteredIdentity } from "./source-identity";

export interface StagedSource {
	/** Staged tree root (read-only). */
	dir: string;
	/** Staged entries (sorted), built from the same read that was written; same format as the identity manifest. */
	manifest: ManifestEntry[];
	/** Hash of `manifest`; equals the `dirtyHash` of the identity for the same bytes. */
	manifestHash: string;
	/** Repo-relative mount points that exist as empty dirs; the only entries besides manifest files. */
	mountDirs: string[];
}

/** Remove a previously staged tree, restoring write permission on its read-only dirs first. */
export async function removeStagedSource(dir: string): Promise<void> {
	const walk = async (current: string): Promise<void> => {
		const stat = await fs.lstat(current).catch(() => null);
		if (!stat?.isDirectory()) return;
		await fs.chmod(current, 0o755);
		for (const entry of await fs.readdir(current)) await walk(path.join(current, entry));
	};
	await walk(dir);
	await fs.rm(dir, { recursive: true, force: true });
}

/** Linux addon the container loads for `arch`; staging refuses the launch when it is absent. */
function assertContainerAddon(ignored: string[], arch: string, root: string): void {
	const prefix = `${NATIVE_ADDON_DIR}/pi_natives.linux-${arch}`;
	if (ignored.some(rel => rel.startsWith(prefix) && rel.endsWith(".node"))) return;
	throw new Error(`native addon ${prefix}*.node is missing from ${root}; build it before launching a source run`);
}

/** Throw 422 when a candidate's path, file body or symlink target carries a value. Never echoes the value. */
function assertCandidateClean(rel: string, body: Uint8Array | string | null, values: readonly string[]): void {
	if (values.length === 0) return;
	if (textCarriesSecret(rel, values) || rel.split("/").some(part => textCarriesSecret(part, values))) {
		throw new EvoHttpError(
			422,
			`source path ${redactSecrets(rel, values)} embeds a host credential value; rename it (the value must not appear in a filename)`,
		);
	}
	const text = body === null ? null : typeof body === "string" ? body : new TextDecoder().decode(body);
	if (text !== null && textCarriesSecret(text, values)) {
		throw new EvoHttpError(
			422,
			`source file ${rel} embeds a host credential value; remove it or move it outside the source root before launching (ignored files are staged too)`,
		);
	}
}

const bodyOf = (read: ManifestRead): Uint8Array | string => (read.kind === "link" ? read.target : read.bytes);

/**
 * Manager-side preflight: throw 422 when any inventory path component, file body or symlink target carries a host
 * credential value, and return the manifest hash of exactly the bytes scanned (the caller binds it to the registered
 * identity). `stageSource` repeats the check on the exact bytes it writes. Iterates the same inventory as identity and
 * staging. With no secrets the manifest is still read: the hash is returned regardless.
 */
export async function assertSourceClean(root: string, secrets: readonly string[]): Promise<string> {
	const values = secrets.filter(value => value.length > 0);
	const real = await fs.realpath(root);
	const manifest = await readExecutionManifest(real, vcs.requireGit(real), {
		secrets: values,
		visit: (rel, read) => assertCandidateClean(rel, bodyOf(read), values),
	});
	return manifest.manifestHash;
}

/** Write one already-read, already-scanned entry into the staged tree. */
async function writeEntry(dest: string, rel: string, read: ManifestRead): Promise<void> {
	const out = path.join(dest, rel);
	await fs.mkdir(path.dirname(out), { recursive: true });
	if (read.kind === "link") {
		await fs.symlink(read.target, out);
		return;
	}
	await Bun.write(out, read.bytes);
	await fs.chmod(out, read.mode & 0o111 ? 0o555 : 0o444);
}

export interface StageOptions {
	/** Git worktree root to copy from. */
	root: string;
	/** Destination dir; replaced when it exists. */
	dest: string;
	/** Container architecture; its `pi_natives.linux-<arch>*.node` addon must exist. */
	arch: "arm64" | "x64";
	/** Repo-relative dirs that must exist as mount points (shadowed `node_modules`). */
	mountDirs: string[];
	/** Host credential values the staged tree must not carry; a hit refuses staging before any byte is written. */
	secrets: readonly string[];
}

/**
 * Stage the execution manifest: every inventory path is read once, scanned for credentials and written from that same
 * read, and the returned manifest is built from that read by the same entry builder `sourceIdentity` uses.
 */
export async function stageSource(opts: StageOptions): Promise<StagedSource> {
	const root = await fs.realpath(opts.root);
	const values = opts.secrets.filter(value => value.length > 0);
	await removeStagedSource(opts.dest);
	try {
		await fs.mkdir(opts.dest, { recursive: true });
		const { entries, manifestHash } = await readExecutionManifest(root, vcs.requireGit(root), {
			secrets: values,
			inspectIgnored: ignored => assertContainerAddon(ignored, opts.arch, root),
			visit: async (rel, read) => {
				assertCandidateClean(rel, bodyOf(read), values);
				await writeEntry(opts.dest, rel, read);
			},
		});
		for (const rel of opts.mountDirs) await fs.mkdir(path.join(opts.dest, rel), { recursive: true });
		// Read-only: deepest dirs first so every chmod still has a searchable parent.
		const dirs = new Set<string>([opts.dest, ...opts.mountDirs.map(rel => path.join(opts.dest, rel))]);
		for (const entry of entries) {
			for (let dir = path.dirname(path.join(opts.dest, entry.path)); dir !== opts.dest; dir = path.dirname(dir))
				dirs.add(dir);
		}
		for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await fs.chmod(dir, 0o555);
		return { dir: opts.dest, manifest: entries, manifestHash, mountDirs: [...opts.mountDirs] };
	} catch (err) {
		await removeStagedSource(opts.dest);
		throw err;
	}
}

/**
 * Bind staged bytes to the registered identity directly: the staged manifest hash must equal the registered
 * `dirtyHash`, and the registered `ref` must be the current HEAD of the source root. A bare-ref (older scheme)
 * registration is refused. A file mutated during the copy and restored afterwards stages bytes the registration
 * never saw, so its hash differs and the launch is refused.
 */
export async function assertStagedMatchesRegistered(
	staged: StagedSource,
	registeredIdentity: string,
	sourceRoot: string,
): Promise<void> {
	const registered = parseRegisteredIdentity(registeredIdentity);
	const head = await vcs.requireGit(await fs.realpath(sourceRoot)).headSha();
	if (head !== registered.ref) {
		throw new Error(
			`source HEAD for ${sourceRoot} is ${head}, registered ${registered.ref}; re-register the variant`,
		);
	}
	if (staged.manifestHash !== registered.dirtyHash) {
		throw new Error(
			`staged source bytes differ from the registered identity for ${sourceRoot} (staged ${staged.manifestHash}, registered ${registered.dirtyHash})`,
		);
	}
}

/** Repo-relative ancestors of `rel` (excluding `rel` itself and the root). */
function ancestors(rel: string): string[] {
	const out: string[] = [];
	for (let dir = path.dirname(rel); dir !== "." && dir !== "/"; dir = path.dirname(dir)) out.push(dir);
	return out;
}

/**
 * Compare the staged tree with its manifest exactly: same path set, same bytes, same exec bit. Only the declared
 * mount dirs (empty) and the directories leading to manifest entries or mount dirs may exist besides the files.
 * Returns the offending paths: changed, vanished, added files/symlinks, unexpected or non-empty dirs.
 */
export async function verifyStagedSource(staged: StagedSource): Promise<string[]> {
	const bad = new Set<string>();
	const known = new Set(staged.manifest.map(entry => entry.path));
	for (const expected of staged.manifest) {
		const file = path.join(staged.dir, expected.path);
		const stat = await fs.lstat(file).catch(() => null);
		let actual: ManifestEntry | null = null;
		if (stat?.isSymbolicLink())
			actual = toManifestEntry(expected.path, { kind: "link", target: await fs.readlink(file) });
		else if (stat?.isFile())
			actual = toManifestEntry(expected.path, { kind: "file", bytes: await fs.readFile(file), mode: stat.mode });
		if (JSON.stringify(actual) !== JSON.stringify(expected)) bad.add(expected.path);
	}
	const mounts = staged.mountDirs.map(dir => path.normalize(dir));
	const expectedDirs = new Set<string>();
	for (const rel of [...known, ...mounts]) for (const dir of ancestors(rel)) expectedDirs.add(dir);
	for (const dir of mounts) expectedDirs.add(dir);
	const walk = async (rel: string): Promise<void> => {
		for (const entry of await fs.readdir(path.join(staged.dir, rel), { withFileTypes: true })) {
			const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				if (expectedDirs.has(child)) await walk(child);
				else bad.add(child);
			} else if (!known.has(child)) {
				bad.add(child);
			}
		}
	};
	await walk("").catch(() => bad.add("."));
	return [...bad];
}
