/**
 * Exclusive cross-process lock built on atomic `mkdir`. Each lock records its owner `{pid, token}`;
 * release is ownership-checked, and an abandoned lock is reclaimed only when its recorded PID is
 * definitely dead on this host. The lock and PID checks assume one host (local jobs dir).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import { EvoHttpError } from "./boundary";

export interface LockOptions {
	/** Longest wait for the lock before failing with 503. */
	waitMs?: number;
	/** A lock whose mtime is older than this becomes a reclaim candidate (owner liveness still decides). */
	staleMs?: number;
	pollMs?: number;
}

const DEFAULT_WAIT_MS = 60_000;
const DEFAULT_STALE_MS = 120_000;
const DEFAULT_POLL_MS = 10;
const OWNER_FILE = "owner.json";

interface Owner {
	pid: number;
	token: string;
}

function errorCode(err: unknown): string | undefined {
	return typeof err === "object" && err !== null && "code" in err ? String(err.code) : undefined;
}

async function readOwner(dir: string): Promise<Owner | null> {
	try {
		const parsed: unknown = JSON.parse(await Bun.file(path.join(dir, OWNER_FILE)).text());
		if (
			isRecord(parsed) &&
			Number.isInteger(parsed.pid) &&
			(parsed.pid as number) > 0 &&
			typeof parsed.token === "string"
		) {
			return { pid: parsed.pid as number, token: parsed.token };
		}
	} catch {
		/* missing or malformed metadata: treated as unknown owner */
	}
	return null;
}

/** True only when the PID definitely does not exist (ESRCH). EPERM or success mean it may be alive. */
function pidDefinitelyDead(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return false;
	} catch (err) {
		return errorCode(err) === "ESRCH";
	}
}

/** Create `dir` exclusively and record ownership; returns null when it already exists. */
async function tryAcquire(dir: string): Promise<Owner | null> {
	try {
		await fs.mkdir(dir);
	} catch (err) {
		if (errorCode(err) === "EEXIST") return null;
		throw err;
	}
	const owner: Owner = { pid: process.pid, token: crypto.randomUUID() };
	try {
		await Bun.write(path.join(dir, OWNER_FILE), JSON.stringify(owner));
	} catch (err) {
		await fs.rm(dir, { recursive: true, force: true });
		throw err;
	}
	return owner;
}

/** Remove `dir` only if it still carries our token. */
async function releaseOwned(dir: string, owner: Owner): Promise<void> {
	if ((await readOwner(dir))?.token === owner.token) await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Reclaim a lock abandoned by a dead process. Breaking is serialized by a separate `<lock>.breaker`
 * directory, and the lock is re-examined while holding it, so a lock re-acquired by a live holder
 * after the first stat is never removed. Missing/invalid metadata or a live/unknown PID is never stolen.
 */
async function breakIfAbandoned(lockDir: string, staleMs: number): Promise<void> {
	const fresh = async (): Promise<boolean> => {
		try {
			return Date.now() - (await fs.stat(lockDir)).mtimeMs <= staleMs;
		} catch {
			return true; // gone: nothing to break
		}
	};
	if (await fresh()) return;
	const breakerDir = `${lockDir}.breaker`;
	const breaker = await tryAcquire(breakerDir);
	if (!breaker) return; // another breaker is working; keep waiting
	try {
		if (await fresh()) return;
		const owner = await readOwner(lockDir);
		if (!owner || !pidDefinitelyDead(owner.pid)) return;
		// The owner is dead and cannot release; no acquirer can replace the dir while it exists.
		await fs.rm(lockDir, { recursive: true, force: true });
	} finally {
		await releaseOwned(breakerDir, breaker);
	}
}

/** Run `fn` while holding `lockDir`; waiters poll up to `waitMs`, then fail with 503. */
export async function withDirLock<T>(lockDir: string, fn: () => Promise<T>, opts: LockOptions = {}): Promise<T> {
	const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
	const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
	const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
	await fs.mkdir(path.dirname(lockDir), { recursive: true });
	const deadline = Date.now() + waitMs;
	let owner: Owner | null;
	for (;;) {
		owner = await tryAcquire(lockDir);
		if (owner) break;
		await breakIfAbandoned(lockDir, staleMs);
		if (Date.now() >= deadline) {
			throw new EvoHttpError(503, `timed out waiting for lock ${path.basename(lockDir)}`);
		}
		await Bun.sleep(pollMs);
	}
	const held = owner;
	const heartbeat = setInterval(
		() => {
			const now = new Date();
			fs.utimes(lockDir, now, now).catch(() => {});
		},
		Math.max(10, Math.floor(staleMs / 4)),
	);
	try {
		return await fn();
	} finally {
		clearInterval(heartbeat);
		await releaseOwned(lockDir, held);
	}
}
