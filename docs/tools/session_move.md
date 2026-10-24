# session_move

> Move the running session into another checkout of the same repository, creating a worktree when needed; the move takes effect after the current tool batch.

## Source
- Entry: `packages/coding-agent/src/tools/session-move.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/session-move.md`
- Key collaborators:
  - `packages/coding-agent/src/session/agent-session.ts` — records the pending move (`requestSessionMove`), opens the session-transition fence at `agent_end`, runs the host relocator as post-prompt work and sends the continuation.
  - `packages/coding-agent/src/session/session-move.ts` — relocator types and the running-work check (`findRunningSessionWork`).
  - `packages/coding-agent/src/session/session-worktree.ts` — `addRepoWorktree`, shared with `omp worktree add` and the `bash` `git worktree add` rewrite.
  - `packages/coding-agent/src/session/headless-relocation.ts` — ACP and RPC relocation, shared with the `/move` and `/wt` builtins.
  - `packages/coding-agent/src/modes/controllers/command-controller.ts` — TUI relocation (`relocateForAgent`), shared with `/move`.
  - `packages/agent/src/agent-loop.ts` — the `shouldStopAfterBatch` hook (installed by AgentSession while a move is pending) ends the run after the batch without aborting sibling calls, for every call path including `write xd://session_move`.

## Registration / Visibility
- Tool metadata: `strict = true`, `loadMode = "discoverable"`; `approval` is decided per call (see Approval).
- Built only when all hold:
  - the host declared `sessionRelocation: true` to `createAgentSession` and installs a relocator (`AgentSession.setSessionRelocator`); the interactive TUI, ACP and RPC hosts do, print mode and plain SDK sessions do not;
  - the session has a persisted session file (absent under `--no-session`);
  - the session is top-level (`taskDepth === 0`); `task` subagents and the advisor never get it, even when their configured tools list it.

## Inputs

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | Yes | Target directory, absolute or relative to the session cwd. |
| `branch` | `string` | For a missing target | Branch for a new worktree. An existing branch is checked out as is; a missing one is created. |
| `base` | `string` | No | Start point for a new branch. Default: HEAD of the main checkout, not the HEAD of the session. An error when `branch` already exists. |

## Allowed targets
Paths are compared after resolving symlinks, at call time:
- the repository's main checkout (`primaryRoot()`);
- any worktree registered with the repository (`worktrees()`);
- a missing directory directly inside the worktree directory, `<main checkout>/<worktree.repoDir>/<name>`.

`worktree.repoDir` (default `.worktrees`) is relative to the main checkout. A value that is empty, starts with `/` or `~`, has a drive prefix, contains `\` or NUL, or has an empty, `.` or `..` component is invalid: every creating call fails with an error naming `worktree.repoDir`, while moves to existing targets still work. Each existing component of the worktree directory is `lstat`ed from the real main checkout on; a symlink or a file there is refused, so the directory cannot point outside the repository.

Anything else is refused with an error that points to `/move`: a path outside the repository, another repository, a nested path such as `.worktrees/a/b`, a symlink whose destination is not a registered worktree, or an existing directory that is not a registered worktree. A symlink that resolves to a registered worktree moves the session to the real path of that worktree. A session outside a git repository cannot use the tool.

## Flow
1. Background-work check, before any side effect: async jobs owned by this session that are `running` (background `bash`, `task`, `eval`) and running subagents whose session file lies under this session's artifacts directory, including subagents running without a job (peer-message wakes, idle revival). The error names every job id and agent id. Subagents of other sessions in the same process do not count.
2. A second `session_move` while a move is pending is refused.
3. Target validation (Allowed targets).
4. Missing target: a branch name is required; the missing worktree-directory components are created, then `addRepoWorktree` adds the worktree the way `omp worktree add` does (`worktree.clone`, plain checkout for targets inside the source checkout, `post-checkout` hook). If adding the worktree fails, the directories the call created are removed again. When the hook exits non-zero the call fails with the hook output, the worktree stays, and no move is scheduled.
5. `requestSessionMove` records the move; once every call of the batch has settled, the agent loop asks AgentSession's `shouldStopAfterBatch` hook, which returns true while a move is pending: the other calls of the same batch finish normally and still resolve against the old directory, then the run ends without another model request. Queued steering and follow-up messages stay queued.
6. At `agent_end` AgentSession opens the session-transition fence. As post-prompt work, once the session is idle, it checks running work again (a sibling `async` call may have started a job), calls the host relocator — the same path as `/move`, including settings flush, BTW gate, rollback, and plugin, command and rule reload — and closes the fence.
7. One hidden `session-move-result` message starts exactly one continuation turn. It names the new directory, or the failure and its reason. On failure the cwd and the session file are unchanged.

## Approval
- Approval tier write when the target exists (main checkout or registered worktree), and for invalid targets, which fail in `execute` without a prompt.
- Approval tier exec when the call creates a worktree, because it runs the post-checkout hook of the repository. Under `tools.approvalMode: write` such a call asks first, or is denied without an interactive surface.

## Side Effects
- Session state: the session file and its artifacts move into the target's session bucket (as after `/move`); `omp --resume` in the target lists the session. Within one repository the main checkout's picker may still list it through the worktree aggregation, as after `/wt`.
- The continuation turn's system prompt is rebuilt from the target's context files and `.omp/rules`; relative tool paths resolve against the target.
- Filesystem/git: a new worktree, its branch and missing worktree-directory components when the target did not exist.
- ACP v1: the continuation streams inside the client's still-open prompt; v2 shows the move and the continuation inside one running/idle span. RPC `get_state` reports the new `cwd`.

## Errors
- Running background work: `Cannot move the session: still running: … Wait for them or cancel them, then call session_move again.`
- Pending move: `A session move is already pending for this run; …`
- Not in a git repository, refused target, or broken link: the message names `/move`.
- Invalid `worktree.repoDir` on a creating call: `Invalid worktree.repoDir <value>: <reason>. session_move cannot create a worktree.`
- Missing `branch`, an existing branch with `base`, a `base` that does not resolve, or git refusing the worktree (for example the branch is checked out elsewhere).
- Non-zero `post-checkout` hook: the worktree is kept and its path named; the session did not move.
- No relocator installed at call time: `… Ask the user to run /move instead.`

## Limits
- Running subagents keep their old cwd; LSP servers, MCP servers and eval kernels keep the old workspace, as after `/move`.
- Containment is checked at call time; a concurrent writer swapping a checked component for a symlink before creation is not defended against.
