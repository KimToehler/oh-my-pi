/**
 * Content hashing of task directories. One walk both identifies the bytes and (when given forwarded credential
 * values) refuses any path component, symlink target or file body that carries one, so a scan can never disagree
 * with the bytes that were hashed.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { EvoHttpError } from "./boundary";
import { redactSecrets, textCarriesSecret } from "./credential-scan";

const decoder = new TextDecoder();

/**
 * sha256 over every entry of a task directory (relative path, kind, exec bit, bytes). Synchronous so the launch
 * path can verify without yielding. Symlinks must stay inside the task: an outward link is mutable outside bytes.
 * With `secrets`, 422 on the first entry whose name or bytes embed a credential value (never echoed).
 */
export function hashTaskTree(taskRoot: string, secrets: readonly string[] = []): string {
	const live = secrets.filter(value => value.length > 0);
	const hasher = new Bun.CryptoHasher("sha256");
	const refuse = (what: string, rel: string): never => {
		throw new EvoHttpError(
			422,
			`task ${what} ${redactSecrets(rel, live)} embeds a host credential value; remove it from the dataset`,
		);
	};
	const walk = (rel: string): void => {
		for (const name of fs.readdirSync(path.join(taskRoot, rel)).sort()) {
			const childRel = rel ? `${rel}/${name}` : name;
			if (live.length > 0 && (textCarriesSecret(name, live) || textCarriesSecret(childRel, live))) {
				refuse("path", childRel);
			}
			const abs = path.join(taskRoot, childRel);
			const st = fs.lstatSync(abs);
			const key = JSON.stringify(childRel);
			if (st.isSymbolicLink()) {
				const target = fs.readlinkSync(abs);
				const resolved = path.resolve(path.dirname(abs), target);
				if (path.isAbsolute(target) || path.relative(taskRoot, resolved).startsWith("..")) {
					throw new EvoHttpError(422, `task symlink escapes its directory: ${childRel}`);
				}
				if (live.length > 0 && textCarriesSecret(target, live)) refuse("symlink", childRel);
				hasher.update(`${key}\0link:${target}\0`);
			} else if (st.isDirectory()) {
				hasher.update(`${key}\0dir\0`);
				walk(childRel);
			} else if (st.isFile()) {
				const bytes = fs.readFileSync(abs);
				if (live.length > 0 && textCarriesSecret(decoder.decode(bytes), live)) refuse("file", childRel);
				const body = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
				hasher.update(`${key}\0file:${st.mode & 0o111 ? "x" : "-"}:${body}\0`);
			} else {
				throw new EvoHttpError(422, `unsupported file type in task: ${childRel}`);
			}
		}
	};
	walk("");
	return hasher.digest("hex");
}

/** Verify a snapshot directory holds exactly the recorded tasks with the recorded bytes; 422 otherwise. */
export function assertTaskSnapshotIntact(dir: string, label: string, hashes: Record<string, string>): void {
	const expected = Object.keys(hashes).sort();
	let present: string[];
	try {
		present = fs.readdirSync(dir).sort();
	} catch {
		throw new EvoHttpError(422, `${label} task snapshot is unreadable; cannot verify its recorded task hashes`);
	}
	if (present.join("\0") !== expected.join("\0")) {
		throw new EvoHttpError(422, `${label} task snapshot no longer holds exactly its registered tasks`);
	}
	for (const task of expected) {
		let actual: string;
		try {
			actual = hashTaskTree(path.join(dir, task));
		} catch (err) {
			if (err instanceof EvoHttpError) throw err;
			throw new EvoHttpError(422, `${label} task '${task}' snapshot is unreadable; cannot verify its hash`);
		}
		if (actual !== hashes[task]) {
			throw new EvoHttpError(422, `${label} task '${task}' snapshot no longer matches its registered task hash`);
		}
	}
}

/** Drop write permission on a copied tree so an accidental write fails; the per-task hash is the real boundary. */
export function lockTree(dir: string): void {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) lockTree(abs);
		else if (entry.isFile()) fs.chmodSync(abs, fs.statSync(abs).mode & ~0o222);
	}
	fs.chmodSync(dir, 0o555);
}

/** Restore owner write on every directory beneath `dir` (synchronously) so the tree can be deleted. */
export function unlockTreeSync(dir: string): void {
	let entries: fs.Dirent[];
	try {
		fs.chmodSync(dir, 0o755);
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) unlockTreeSync(path.join(dir, entry.name));
	}
}
