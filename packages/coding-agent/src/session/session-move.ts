import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import type { AsyncJobManager } from "../async/job-manager";
import { type AgentRef, AgentRegistry } from "../registry/agent-registry";

/** A model-requested session relocation, recorded by `session_move` and executed after the tool batch. */
export interface SessionMoveRequest {
	/** Absolute, already validated target directory. */
	path: string;
}

/**
 * An atomic claim on the session's single move slot, taken before a `session_move` call does any work.
 * Exactly one of `commit` / `release` takes effect; the other, and repeats, are no-ops.
 */
export interface SessionMoveReservation {
	/** Record the move so the run stops after its batch. @returns false when no relocator is installed any more. */
	commit(request: SessionMoveRequest): boolean;
	/** Give the slot back (every failure path). */
	release(): void;
}

/** A recorded, not yet executed move owned by AgentSession. */
export interface PendingSessionMove extends SessionMoveRequest {
	/** True once the post-prompt relocation task is scheduled; a later `agent_end` never schedules a second. */
	scheduled: boolean;
	/** Session-transition fence held from `agent_end` until the relocation settles. */
	fence?: Disposable;
}

export type SessionRelocationResult = { ok: true } | { ok: false; reason: string };

/**
 * Host-supplied relocation of the whole session (cwd, session file, host state) to `targetPath`.
 * Resolves `{ ok: false }` and leaves cwd and session file unchanged when it cannot move.
 */
export type SessionRelocator = (targetPath: string) => Promise<SessionRelocationResult>;

/** Background work of one session that a relocation would leave behind in the old directory. */
export interface RunningSessionWork {
	/** Own running async jobs (bash, task, eval). */
	jobIds: string[];
	/** Running subagents of this session that no listed job covers. */
	agentIds: string[];
}

export interface RunningSessionWorkScope {
	asyncJobManager: AsyncJobManager | undefined;
	/** The session's agent id; jobs are filtered to this owner. Absent: every job of the manager. */
	agentId: string | null | undefined;
	/** The session's persisted file; its artifacts directory is the file path without `.jsonl`. */
	sessionFile: string | null | undefined;
	/** Further artifacts directories of the same session tree (a move's source or target). */
	extraArtifactsDirs?: readonly string[];
	/** Defaults to the process-wide registry. */
	registry?: AgentRegistry;
}

/** A session's agent tree: its own agent and the subagents whose transcripts lie under its artifacts directories. */
export interface SessionTree {
	rootId: string | null | undefined;
	/** Absolute artifacts directories (session file paths without `.jsonl`). */
	artifactsDirs: readonly string[];
}

/** The artifacts directory of a session file: its path without the `.jsonl` suffix. */
export function artifactsDirOf(sessionFile: string | null | undefined): string | null {
	if (!sessionFile) return null;
	return path.resolve(sessionFile.endsWith(".jsonl") ? sessionFile.slice(0, -".jsonl".length) : sessionFile);
}

/**
 * How `ref` belongs to `tree` (design D6 of session-move-tool): `"root"` for the session's own
 * agent; `"descendant"` for a `sub` ref whose session file lies inside one of the tree's artifacts
 * directories; otherwise `undefined` (no session file, an advisor or another kind, or a path
 * outside every directory).
 */
export function sessionTreeMembership(
	tree: SessionTree,
	ref: Pick<AgentRef, "id" | "kind" | "sessionFile">,
): "root" | "descendant" | undefined {
	if (tree.rootId && ref.id === tree.rootId) return "root";
	if (ref.kind !== "sub" || !ref.sessionFile) return undefined;
	const file = path.resolve(ref.sessionFile);
	for (const dir of tree.artifactsDirs) {
		const relative = path.relative(dir, file);
		if (relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)) return "descendant";
	}
	return undefined;
}

/**
 * Own running async jobs plus busy registry subagents of this session's tree (design D6,
 * {@link sessionTreeMembership}). A subagent ref without a session file never counts.
 * A descendant counts when its claimed registry status is `running` (a stale entry also
 * counts) or its live session already owns a turn the status does not show yet: it is
 * streaming (including a claimed wake), holds an admitted prompt submission, or has
 * scheduled post-prompt work such as a restored turn's continuation (relocation-admission-lease
 * design D4).
 */
export function findRunningSessionWork(scope: RunningSessionWorkScope): RunningSessionWork {
	const jobIds: string[] = [];
	const covered = new Set<string>();
	if (scope.asyncJobManager) {
		const filter = scope.agentId ? { ownerId: scope.agentId } : undefined;
		for (const job of scope.asyncJobManager.getRunningJobs(filter)) {
			jobIds.push(job.id);
			covered.add(job.id);
			if (job.agentId) covered.add(job.agentId);
		}
	}
	const agentIds: string[] = [];
	const artifactsDir = artifactsDirOf(scope.sessionFile);
	if (artifactsDir) {
		const tree: SessionTree = {
			rootId: scope.agentId,
			artifactsDirs: [artifactsDir, ...(scope.extraArtifactsDirs ?? [])],
		};
		const registry = scope.registry ?? AgentRegistry.global();
		for (const ref of registry.list()) {
			if (covered.has(ref.id)) continue;
			const session = ref.session;
			const busy =
				ref.status === "running" ||
				(session !== null && (session.isStreaming || session.hasAdmittedSubmission || session.hasPostPromptWork));
			if (!busy) continue;
			if (sessionTreeMembership(tree, ref) !== "descendant") continue;
			agentIds.push(ref.id);
		}
	}
	return { jobIds, agentIds };
}

/**
 * Repoint the registry refs of descendants whose session file moved with the session's artifacts
 * directory (design D6). `SessionManager.moveTo` renames that directory, so a ref that kept the
 * old path points at a file that is no longer there and, worse, escapes the ownership check of
 * every later move: the session would relocate again while that descendant runs. Only the
 * recorded path changes; nothing relocates a subagent's own working directory.
 *
 * A move into a bucket the session lived in before merges into the existing directory and leaves
 * each colliding child at the source, so a ref is repointed only once its old file is gone:
 * a file still sitting at the source belongs to the descendant that kept writing there, and
 * pointing its ref at the destination copy would adopt a foreign transcript. Any error other
 * than ENOENT leaves the ref alone, because the source cannot be ruled out.
 */
export async function rebaseDescendantSessionFiles(
	oldSessionFile: string | null | undefined,
	newSessionFile: string | null | undefined,
	registry?: AgentRegistry,
): Promise<string[]> {
	const oldDir = artifactsDirOf(oldSessionFile);
	const newDir = artifactsDirOf(newSessionFile);
	if (!oldDir || !newDir || oldDir === newDir) return [];
	const target = registry ?? AgentRegistry.global();
	const rebased: string[] = [];
	for (const ref of target.list()) {
		if (!ref.sessionFile) continue;
		const source = path.resolve(ref.sessionFile);
		const relative = path.relative(oldDir, source);
		if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) continue;
		if (await stillOnDisk(source)) continue;
		if (target.rebaseSessionFile(ref.id, path.join(newDir, relative))) rebased.push(ref.id);
	}
	return rebased;
}

async function stillOnDisk(file: string): Promise<boolean> {
	try {
		await fs.lstat(file);
		return true;
	} catch (err) {
		return !isEnoent(err);
	}
}

export function hasRunningSessionWork(work: RunningSessionWork): boolean {
	return work.jobIds.length > 0 || work.agentIds.length > 0;
}

/** Names every blocking job and agent id so the model can wait for or cancel them. */
export function describeRunningSessionWork(work: RunningSessionWork): string {
	const parts: string[] = [];
	if (work.jobIds.length > 0) parts.push(`background jobs ${work.jobIds.join(", ")}`);
	if (work.agentIds.length > 0) parts.push(`subagents ${work.agentIds.join(", ")}`);
	return `still running: ${parts.join("; ")}`;
}
