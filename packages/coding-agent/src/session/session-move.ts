import * as path from "node:path";
import type { AsyncJobManager } from "../async/job-manager";
import { AgentRegistry } from "../registry/agent-registry";

/** A model-requested session relocation, recorded by `session_move` and executed after the tool batch. */
export interface SessionMoveRequest {
	/** Absolute, already validated target directory. */
	path: string;
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
	/** Defaults to the process-wide registry. */
	registry?: AgentRegistry;
}

/**
 * Own running async jobs plus running registry subagents whose session file lies inside this
 * session's artifacts directory (design D6). A subagent ref without a session file never counts.
 * Reads the claimed registry status, so a stale `running` entry also counts.
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
	if (scope.sessionFile) {
		const artifactsDir = path.resolve(
			scope.sessionFile.endsWith(".jsonl") ? scope.sessionFile.slice(0, -".jsonl".length) : scope.sessionFile,
		);
		const registry = scope.registry ?? AgentRegistry.global();
		for (const ref of registry.list()) {
			if (ref.kind !== "sub" || ref.status !== "running" || !ref.sessionFile) continue;
			if (ref.id === scope.agentId || covered.has(ref.id)) continue;
			const relative = path.relative(artifactsDir, path.resolve(ref.sessionFile));
			if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) continue;
			agentIds.push(ref.id);
		}
	}
	return { jobIds, agentIds };
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
