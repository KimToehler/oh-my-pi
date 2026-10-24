import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import type {
	AgentTool,
	AgentToolContext,
	AgentToolResult,
	AgentToolUpdateCallback,
	ToolApprovalDecision,
} from "@oh-my-pi/pi-agent-core";
import type { VcsGitRepo } from "@oh-my-pi/pi-natives";
import * as vcs from "@oh-my-pi/pi-natives/vcs";
import { prompt } from "@oh-my-pi/pi-utils";
import { ToolError } from "@oh-my-pi/pi-tui/tools/tool-errors";
import sessionMoveDescription from "../prompts/tools/session-move.md" with { type: "text" };
import { type AddRepoWorktreeResult, addRepoWorktree } from "../session/session-worktree";
import { describeRunningSessionWork, findRunningSessionWork, hasRunningSessionWork } from "../session/session-move";
import { cfgWorktreeRepoDir, resolveRepoWorktreeDir } from "../task/settings";
import type { ToolSession } from ".";
import { resolveToCwd } from "./path-utils";

const sessionMoveSchema = type({
	path: type("string").describe(
		"target directory: the repository root, a registered worktree, or a new directory inside the worktree directory",
	),
	"branch?": type("string").describe("branch for a new worktree (required when the target does not exist)"),
	"base?": type("string").describe(
		"commit-ish a new branch starts from (default: HEAD of the primary checkout); not allowed with an existing branch",
	),
});

type SessionMoveParams = typeof sessionMoveSchema.infer;

export interface SessionMoveToolDetails {
	path: string;
	/** A worktree was created for this call. */
	created: boolean;
	branch?: string;
}

/** Outcome of validating `path` without side effects. */
type TargetPlan =
	| { kind: "existing"; target: string; repo: VcsGitRepo; primary: string; worktreeDir: string }
	| { kind: "create"; target: string; primary: string; missingDirs: string[]; worktreeDir: string }
	| { kind: "invalid"; error: string };

function isMissing(error: unknown): boolean {
	const code = (error as NodeJS.ErrnoException | undefined)?.code;
	return code === "ENOENT" || code === "ENOTDIR";
}

function lstatOrUndefined(target: string): fs.Stats | undefined {
	try {
		return fs.lstatSync(target);
	} catch (error) {
		if (isMissing(error)) return undefined;
		throw error;
	}
}

/** Resolve through the nearest existing ancestor, appending the missing tail literally. */
function realpathOfPlannedPath(target: string): string {
	const tail: string[] = [];
	let current = path.resolve(target);
	for (;;) {
		try {
			return path.join(fs.realpathSync(current), ...tail.reverse());
		} catch (error) {
			if (!isMissing(error)) throw error;
			const parent = path.dirname(current);
			if (parent === current) return path.resolve(target);
			tail.push(path.basename(current));
			current = parent;
		}
	}
}

function reject(reason: string, worktreeDir: string): TargetPlan {
	return {
		kind: "invalid",
		error: `${reason}. session_move only moves to the repository root, a registered worktree, or a new directory directly inside ${worktreeDir}; use /move for any other directory.`,
	};
}

export class SessionMoveTool implements AgentTool<typeof sessionMoveSchema, SessionMoveToolDetails> {
	readonly name = "session_move";
	readonly label = "Session Move";
	readonly summary = "Move this session into another worktree of the repository, creating one when needed";
	readonly description: string;
	readonly parameters = sessionMoveSchema;
	readonly strict = true;
	/** Admission, worktree creation and the pending-move claim must not interleave with a sibling call in the batch. */
	readonly concurrency = "exclusive";
	readonly loadMode = "discoverable";
	readonly intent = (args: Partial<SessionMoveParams>) =>
		args.path ? `moving session to ${args.path}` : "moving session";

	/**
	 * `exec` when the call can create a worktree (runs the post-checkout hook): `branch`/`base` is given, or the
	 * target lies directly inside the worktree directory. `write` otherwise, and for anything unresolvable (it
	 * fails in `execute`). Decided from arguments, settings and repository location only, never from whether the
	 * target exists, so the tier cannot change between approval and execution.
	 */
	readonly approval = (args: unknown): ToolApprovalDecision => {
		const params = args as Partial<SessionMoveParams> | undefined;
		const rawPath = params?.path;
		if (typeof rawPath !== "string" || rawPath.length === 0) return "write";
		try {
			if (params?.branch !== undefined || params?.base !== undefined) {
				// Creation needs a git repository and a usable worktree directory; otherwise `execute` rejects.
				return vcs.git(this.session.cwd) && resolveRepoWorktreeDir(cfgWorktreeRepoDir.get(this.session.settings)).ok
					? "exec"
					: "write";
			}
			return this.#isDirectlyInWorktreeDir(rawPath) ? "exec" : "write";
		} catch {
			return "write";
		}
	};

	constructor(private readonly session: ToolSession) {
		this.description = prompt.render(sessionMoveDescription, {
			worktreeDir: cfgWorktreeRepoDir.get(session.settings),
		});
	}

	static createIf(session: ToolSession): SessionMoveTool | null {
		if (!session.reserveSessionMove || session.sessionRelocation !== true) return null;
		if (!session.getSessionFile() || (session.taskDepth ?? 0) !== 0) return null;
		return new SessionMoveTool(session);
	}

	/**
	 * Walk the worktree directory below the primary root without following links. Reads only the directory
	 * chain, never the target, so it backs both the approval tier and the plan.
	 */
	#locateWorktreeDir(
		primary: string,
		repoDirSetting: string,
	): { ok: true; parent: string; missingDirs: string[] } | { ok: false; plan: TargetPlan } {
		const resolvedDir = resolveRepoWorktreeDir(repoDirSetting);
		if (!resolvedDir.ok) {
			return {
				ok: false,
				plan: { kind: "invalid", error: `${resolvedDir.error}. session_move cannot create a worktree.` },
			};
		}
		const missingDirs: string[] = [];
		let current = primary;
		for (const component of resolvedDir.dir.split("/")) {
			current = path.join(current, component);
			if (missingDirs.length > 0) {
				missingDirs.push(current);
				continue;
			}
			const stat = lstatOrUndefined(current);
			if (!stat) {
				missingDirs.push(current);
			} else if (stat.isSymbolicLink() || !stat.isDirectory()) {
				return {
					ok: false,
					plan: reject(
						`${path.relative(primary, current)} is a ${stat.isSymbolicLink() ? "symlink" : "file"}, not a directory`,
						repoDirSetting,
					),
				};
			}
		}
		return { ok: true, parent: current, missingDirs };
	}

	/** Whether `rawPath` lies directly inside the worktree directory. Never reads the target itself. */
	#isDirectlyInWorktreeDir(rawPath: string): boolean {
		const repo = vcs.git(this.session.cwd);
		if (!repo) return false;
		const located = this.#locateWorktreeDir(
			fs.realpathSync(repo.primaryRoot()),
			cfgWorktreeRepoDir.get(this.session.settings),
		);
		if (!located.ok) return false;
		return realpathOfPlannedPath(path.dirname(resolveToCwd(rawPath, this.session.cwd))) === located.parent;
	}

	#plan(rawPath: string): TargetPlan {
		const session = this.session;
		const repoDirSetting = cfgWorktreeRepoDir.get(session.settings);
		const repo = vcs.git(session.cwd);
		if (!repo) {
			return {
				kind: "invalid",
				error: "The session is not inside a git repository; session_move cannot relocate it. Use /move.",
			};
		}
		const primary = fs.realpathSync(repo.primaryRoot());
		const resolved = resolveToCwd(rawPath, session.cwd);
		if (lstatOrUndefined(resolved)) {
			try {
				return { kind: "existing", target: fs.realpathSync(resolved), repo, primary, worktreeDir: repoDirSetting };
			} catch {
				return reject(`"${rawPath}" is a broken link`, repoDirSetting);
			}
		}
		const located = this.#locateWorktreeDir(primary, repoDirSetting);
		if (!located.ok) return located.plan;
		const { parent: worktreeParent, missingDirs } = located;
		if (realpathOfPlannedPath(path.dirname(resolved)) !== worktreeParent) {
			return reject(
				`"${rawPath}" is not a registered worktree or a direct child of ${repoDirSetting}`,
				repoDirSetting,
			);
		}
		return {
			kind: "create",
			target: path.join(worktreeParent, path.basename(resolved)),
			primary,
			missingDirs,
			worktreeDir: repoDirSetting,
		};
	}

	async execute(
		_toolCallId: string,
		params: SessionMoveParams,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<SessionMoveToolDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<SessionMoveToolDetails>> {
		const session = this.session;
		const work = findRunningSessionWork({
			asyncJobManager: session.asyncJobManager,
			agentId: session.getAgentId?.(),
			sessionFile: session.getSessionFile(),
			registry: session.agentRegistry,
		});
		if (hasRunningSessionWork(work)) {
			throw new ToolError(
				`Cannot move the session: ${describeRunningSessionWork(work)}. Wait for them or cancel them, then call session_move again.`,
			);
		}
		// Claim the move slot before the first await: the eval and Cursor bridges call `execute` directly,
		// so the loop scheduler's `exclusive` concurrency does not serialise those calls.
		const reservation = session.reserveSessionMove?.();
		if (!reservation) {
			throw new ToolError(
				session.hasPendingSessionMove?.()
					? "A session move is already pending for this run; wait for it to finish before requesting another."
					: "This session has no relocator installed, so it cannot move. Ask the user to run /move instead.",
			);
		}
		try {
			const plan = this.#plan(params.path);
			if (plan.kind === "invalid") throw new ToolError(plan.error);

			let details: SessionMoveToolDetails;
			if (plan.kind === "existing") {
				const registered = new Set<string>([plan.primary]);
				for (const entry of await plan.repo.worktrees()) {
					try {
						registered.add(fs.realpathSync(entry.path));
					} catch {
						// A registered worktree whose directory vanished cannot be a move target.
					}
				}
				if (!registered.has(plan.target)) {
					const rejected = reject(`"${params.path}" exists but is not a registered worktree`, plan.worktreeDir);
					throw new ToolError(rejected.kind === "invalid" ? rejected.error : "");
				}
				details = { path: plan.target, created: false };
			} else {
				details = await this.#createWorktree(plan, params);
			}

			if (!reservation.commit({ path: details.path })) {
				throw new ToolError(
					"This session has no relocator installed, so it cannot move. Ask the user to run /move instead.",
				);
			}
			return {
				content: [
					{
						type: "text",
						text: `Session move to ${details.path} is scheduled. It runs after this tool batch ends the turn; the conversation then continues from that directory.`,
					},
				],
				details,
			};
		} finally {
			// A no-op after a successful commit; frees the slot on every failure path.
			reservation.release();
		}
	}

	async #createWorktree(
		plan: Extract<TargetPlan, { kind: "create" }>,
		params: SessionMoveParams,
	): Promise<SessionMoveToolDetails> {
		const branch = params.branch?.trim();
		if (!branch) {
			throw new ToolError(
				`"${params.path}" does not exist; pass \`branch\` to create a worktree there (an existing branch is checked out, a new one starts at \`base\` or the primary HEAD).`,
			);
		}
		if (branch.startsWith("-")) throw new ToolError(`Invalid branch name "${branch}".`);
		const primaryRepo = vcs.requireGit(plan.primary);
		const branchExists = await primaryRepo.refExists(`refs/heads/${branch}`);
		let checkout: Parameters<typeof addRepoWorktree>[0]["checkout"];
		if (branchExists) {
			if (params.base !== undefined) {
				throw new ToolError(
					`Branch "${branch}" already exists, so \`base\` (${params.base}) would be ignored. Omit \`base\`, or pick a new branch name.`,
				);
			}
			checkout = { kind: "ref", ref: branch, detach: false };
		} else {
			let from: string | null | undefined;
			if (params.base !== undefined) {
				from = await primaryRepo.resolveRef(params.base);
				if (!from)
					throw new ToolError(`\`base\` "${params.base}" does not resolve to a commit in this repository.`);
			} else {
				from = await primaryRepo.headSha();
				if (!from)
					throw new ToolError("The primary checkout has no commit to start the new branch from; pass `base`.");
			}
			checkout = { kind: "new-branch", name: branch, from, force: false };
		}

		const created: string[] = [];
		// Remove only what this call created, children first; a non-empty directory is left alone.
		const rollback = (): void => {
			for (const dir of [plan.target, ...created.reverse()]) {
				try {
					fs.rmdirSync(dir);
				} catch {
					// Missing or not empty: nothing of ours to remove.
				}
			}
		};
		try {
			for (const dir of plan.missingDirs) {
				fs.mkdirSync(dir);
				created.push(dir);
			}
		} catch (error) {
			rollback();
			throw new ToolError(`Could not create the worktree directory: ${(error as Error).message}`);
		}
		let result: AddRepoWorktreeResult;
		try {
			result = await addRepoWorktree({
				repository: primaryRepo,
				path: plan.target,
				checkout,
				settings: this.session.settings,
			});
		} catch (error) {
			rollback();
			throw new ToolError(`Could not create the worktree at ${plan.target}: ${(error as Error).message}`);
		}
		if (result.hook.exitCode !== 0) {
			const output = `${result.hook.stderr}${result.hook.stdout}`.trim();
			throw new ToolError(
				`Worktree created at ${result.path} (branch ${result.ref}) but its post-checkout hook exited ${result.hook.exitCode}${output ? `:\n${output}` : ""}\nThe worktree was kept and the session did not move. Fix the hook, then call session_move with that path.`,
			);
		}
		return { path: result.path, created: true, branch: result.ref };
	}
}
