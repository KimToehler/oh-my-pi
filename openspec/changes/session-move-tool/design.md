# Design

## Context

See proposal.md (Why) and `specs/session-relocation/spec.md` (requirements). Paths below are relative
to `packages/coding-agent/src` unless stated.

Current state the design builds on:

- `/move` relocates only when idle: it refuses while `session.isStreaming`
  (`slash-commands/builtin-lifecycle.ts:718`, `modes/controllers/command-controller.ts:1625`).
  Relocation itself is `AgentSession.moveSession` (`session/agent-session.ts:11369`) plus a host
  rescope: TUI `#withSessionMove` (settings flush, BTW gate) and `#relocateSession` with
  `applyCwdChange` and rollback (`command-controller.ts:1763-1801`, `modes/interactive-mode.ts:2938`);
  headless `relocateHeadlessSession` and `rescopeHeadlessToCwd`, module-private and bound to a
  `SlashCommandRuntime` (`builtin-lifecycle.ts:94-133`, `860-871`).
- Tools resolve relative paths from the live `session.cwd` at call start (`tools/read.ts:1013`,
  `tools/bash.ts:1089`). The full system prompt is rebuilt from the session cwd before each
  prompt (`session/session-tools.ts:2152-2169`, `sdk.ts:3948-3999`), so context files and
  `.omp/rules` follow the cwd at the next turn.
- Running work keeps its cwd: background bash and async jobs (`tools/bash.ts:906`, `1604-1614`),
  subagents (`task/executor.ts:4632`, `4739`). Async jobs carry `ownerId`, `type`, `label`, `status`
  (`async/job-manager.ts:78-113`).
- A graceful in-run stop exists: a terminal tool result makes AgentSession call
  `agent.abort(TERMINAL_TOOL_RESULT_ABORT_REASON)` (`agent-session.ts:3965-3972`, `5604-5618`); the
  loop persists the finished batch, runs `onTurnEnd`, and makes no further provider call
  (`packages/agent/src/agent-loop.ts:760-783`, `1307`, `1713`). Today only `yield` qualifies
  (`#isTerminalYieldToolResult`, `agent-session.ts:11761`). It does not go through
  `session.abort()`, so it does not call `GoalRuntime.onTaskAborted` (`agent-session.ts:11034`).
- Host-installed tool handlers have a precedent: `setPlanProposalHandler` on `ToolSession`
  (`tools/index.ts:515`, `sdk.ts:2513`, `agent-session.ts:3221`), installed per host (TUI
  `interactive-mode.ts:5235`, ACP `acp-agent.ts:2565`).
- Worktree creation: `addWorktree` (`cli/worktree-cli.ts:99-168`) creates the branch, calls the
  native `worktreeAdd` with `worktree.clone` and the isolation backend, then `runPostCheckoutHook`;
  it prints to the console and sets `process.exitCode`. `bash` rewrites `git worktree add` to it
  when `worktree.clone` is on (`tools/bash.ts:1072`). `createSessionWorktree` (`/wt`) places
  worktrees under `getWorktreeDir` (`~/.omp/wt` unless the absolute or `~`-relative `worktree.base` or
  `OMP_WORKTREE_DIR` overrides it, `task/settings.ts:197-216`) and has no base-commit parameter
  (`session/session-worktree.ts:116-165`).
  Native API: `primaryRoot()`, `worktrees()`, `refExists`, `createBranch`, `worktreeAdd`
  (`packages/natives/native/index.d.ts:678-780`), `runPostCheckoutHook` (`native/vcs.d.ts:87-91`).
- Goal continuation: goal hosts decide at the terminal `agent_end` and re-check their gates when
  the continuation is admitted; a session transition (`isSessionTransitioning`,
  `agent-session.ts:6005`) or another turn starting drops it (`goals/host-controller.ts:579-638`).

## Goals / Non-Goals

**Goals:**
- One relocation implementation per host, shared by `/move` and `session_move`.
- One worktree-add implementation, shared by `omp worktree add`, the `bash` rewrite and the tool.
- The tool never changes the cwd while its own turn can still make a provider call.

**Non-Goals:**
- No change to `/move`, `/wt`, `worktree.base` or the `~/.omp/wt` layout.
- No ACP protocol addition (no cwd-change notification); IntelliJ's reload-reopens-in-project
  behaviour stays as documented in `opsx-apply.md`.
- No rebinding of LSP servers, MCP servers or eval kernels on move; `/move` does not do it either.
- No subagent relocation and no `task` `cwd` parameter.

## Decisions

### D1. Defer the move to the end of the tool batch with a stop-after-batch tool result

The existing terminal-tool path cannot be reused: AgentSession aborts the run with
`TERMINAL_TOOL_RESULT_ABORT_REASON` as soon as the terminal result settles
(`agent-session.ts:3969-3970`), and the loop hands that signal to still-running sibling tools
(`packages/agent/src/agent-loop.ts:3309-3312`), which check it (`tools/read.ts:591`, `2845`). A
sibling `read` still scanning when `session_move` returns would be aborted.

Instead `packages/agent` gets a non-aborting stop: `AgentToolResult` gains `stopAfterBatch?:
boolean`. The loop never touches the run signal for it. After `executeToolCalls` has settled every
started call and their results are recorded, the loop checks the batch (next to the
`TERMINAL_TOOL_RESULT_ABORT_REASON` check, `agent-loop.ts:1711-1715`): if any non-error result
carries the flag, `hasMoreToolCalls` becomes false, and the steering, aside and follow-up drains
of that iteration and of the yield point (`agent-loop.ts:1787-1799`, `1819-1826`) are skipped so
queued user input stays in its queues for the run after the relocation, exactly as the external
abort path leaves them. `onTurnEnd` runs with the live signal, `agent_end` follows. A successful
`session_move` returns `stopAfterBatch: true`; a failed one does not, so the model sees the error
and continues in the same run.

Alternatives: (a) reuse the terminal yield abort: rejected, it aborts in-flight siblings (above);
(b) relocate inside the tool call, like ACP plan approval: rejected, sibling calls in the batch
would mix cwds, `process.chdir` would run mid-turn, and the BTW/goal fences are skipped;
(c) relocate in `onTurnEnd`, like `rewind`: rejected, the host-specific rescope (TUI UI, ACP
plugin reload) cannot run inside the agent loop and the run would continue with a stale system
prompt; (d) `session.abort()` then re-prompt, like TUI plan approval: rejected, it kills sibling
tool calls and pauses an active goal (`onTaskAborted({reason:"interrupted"})`).

### D2. AgentSession owns the pending move; hosts install a relocator

`ToolSession` gets `requestSessionMove(request)` (records the pending move, returns whether a
relocator is installed) and AgentSession gets `setSessionRelocator(relocator | null)`, following
`setPlanProposalHandler`. The relocator is `(targetPath) => Promise<{ ok: true } | { ok: false;
reason: string }>`; each host implements it with its existing `/move` path:

- TUI: a public `relocateForAgent(path)` on the command controller that runs `#withSessionMove` and
  `#relocateSession` (settings flush, BTW gate, `applyCwdChange`, rollback, todo reload). The
  `/move` handler keeps calling the same private methods.
- ACP and RPC: `relocateHeadlessSession` and `rescopeHeadlessToCwd` are exported from a small
  module (`session/headless-relocation.ts`) taking an explicit dependency object (settings,
  sessionManager, session, refreshCommands, reloadPlugins, notifyConfigChanged,
  notifyTitleChanged) instead of `SlashCommandRuntime`; the `/move` and `/wt` builtins call it with
  their runtime, ACP and RPC call it with their session record. Behaviour of `/move` is unchanged.

A second `session_move` while a move is pending (same batch or same run) is refused with an error;
AgentSession exposes whether a move is pending so the tool can check it at admission.

The tool is offered only when the host declared at session creation that it installs a relocator
(`createAgentSession` option `sessionRelocation`, ignored for subagents; the host installs the
relocator before the first prompt), the session has a persisted session file and `taskDepth === 0`
(spec: only relocatable top-level sessions). Hosts build the tool set before they can call
`setSessionRelocator`, so the declaration, not the installed relocator, gates the tool set; a call
that finds no relocator installed fails. Print mode, SDK sessions and subagents do not declare it,
so the tool is absent, not erroring. The advisor is a `kind: "sub"` agent at depth 0 whose
ToolSession spreads the primary's (`sdk.ts:4688-4705`), so it would pass these checks:
`advisorToolSession` sets `requestSessionMove: undefined` and `sessionRelocation: false`, and the
factory builds the tool only when both are present.

### D3. Relocation runs as a post-prompt task inside a session transition

At `agent_end` of a run that recorded a pending move, AgentSession opens its session-transition
fence synchronously (so `isSessionTransitioning` is true before any goal continuation is admitted),
then, as a post-prompt task after idle: re-checks own running async jobs (a sibling `async: true`
call may have started one), calls the relocator, closes the fence, and submits exactly one hidden
continuation message (`customType: "session-move-result"`, outcome and new cwd) that triggers a
turn. The goal host does not decide at the move-requesting run's `agent_end`: that run ends inside
the same prompt bracket as the post-prompt relocation and continuation, and AgentSession coalesces
its `agent_end` with the continuation's into one published event (`#emitSessionEvent`, the same
contract as the other post-prompt continuations), so hosts and the goal controller see one terminal
`agent_end`, after the continuation turn, and the goal decides there. The fence covers the window
in between for `GoalRuntime` and idle deliveries.

The interactive TUI's own goal continuation timer is checked against the same fence; if it does not
consult `isSessionTransitioning`, it is made to (task 4.3). Alternative: suppress goal continuation
via a dedicated flag: rejected, the transition fence already expresses "session identity is
changing" and the goal host and collab already honour it (`goals/host-controller.ts:609`,
`collab/host.ts:660`).

### D4. Target validation is path- and registry-based

Existing paths are realpath'd. Allowed targets: `primaryRoot()` of the session's repository, any
entry of `worktrees()`, or a missing directory directly inside the worktree directory. The worktree
directory is never realpath'd as a whole, because it need not exist yet (a fresh repository has no
`.worktrees`): containment is anchored on realpath(`primaryRoot()`) plus the literal components of
`worktree.repoDir`. Each component is `lstat`ed in order; an existing component must be a plain
directory (a symlink or a file is rejected), the first missing one ends the walk. The target's own
final segment must be a single plain name and `lstat` must report it missing (a symlink there is
rejected). Missing worktree-directory components are created with non-recursive `mkdir` only after
all checks passed and the branch argument is present, immediately before `addRepoWorktree`. An
existing directory that is not a registered worktree is rejected (it may be a stray copy).
`worktree.repoDir` is a new string setting (default `.worktrees`), validated on its own and not
like `worktree.base` (which requires an absolute or `~`-relative path, `task/settings.ts:205-215`): the value is
split on `/`; it is invalid when it is empty, starts with `/` or `~`, has a drive prefix (`C:`),
contains `\` or a NUL, or has a component that is empty, `.` or `..`. With an invalid value
`session_move` refuses every call that would create a worktree, with an error naming the setting
and its value, and creates no branch or directory; moves to existing registered targets are
unaffected. The component walk above is the second line: even a value that passed validation
cannot leave realpath(`primaryRoot()`) through an existing symlinked component.

Containment is checked at call time. A concurrent writer that replaces a checked component with a
symlink between the `lstat` walk and `mkdir`/`worktreeAdd` (which take path strings,
`packages/natives/native/index.d.ts:723`) is not defended against; gate.md accepts this residual
risk.

### D5. One shared worktree-add helper

`addWorktree`'s core moves into `addRepoWorktree({ repository, path, checkout, settings })` (in
`session/session-worktree.ts`), returning `{ path, ref, createdBranch, detached, commit,
clonedWith, cloneError, hook: { exitCode, stdout, stderr } }` without console output. `checkout`
is a resolved mode, so every current CLI mode has a representation:

- `{ kind: "new-branch", name, from, force }`: `createBranch(name, from, force)`, then check it out
  (CLI `-b` with `force: false`, `-B` with `force: true`, the derived-name default when the branch
  is missing);
- `{ kind: "ref", ref, detach }`: check out an existing branch (`detach: false`) or a commit
  detached (CLI `-d`, a commit argument that is not a branch, the derived-name default when the
  branch exists).

The helper keeps the non-empty-target refusal. `addWorktree` keeps option normalization (the `-b`
plus `-B` refusal, `commit ?? "HEAD"` resolved in the invoking checkout, the derived branch name),
maps the options to a `checkout`, prints from the result and keeps its exit-code behaviour. The tool
maps its own arguments: a missing branch → `new-branch` from `base` (default: `headSha` of the
repository at `primaryRoot()`), `force: false`; an existing branch → `ref` without detach, and a
given `base` is then an error (the call would silently ignore it otherwise). A non-zero hook exit is
reported as an error and no move is scheduled; the worktree stays.

### D6. Background-work check covers the session's own jobs and subagents

Running work is one helper, used at call admission and again before relocation (D3): async jobs
with `ownerId === session agent id` and `status === "running"` (bash, task, eval), plus running
registry subagents of this session that no such job covers. The registry is process-wide
(`sdk.ts:2317`) and `runningAgentsOutsideJobs` (`async/job-control.ts:97-99`) has no ownership
filter, so in an ACP process with several sessions (each with its own agent id `acp:<session-id>`,
`main.ts:549`) it also reports other sessions' subagents. Ownership is therefore decided
by transcript location. The tool exists only for sessions with a persisted session file (spec:
Only relocatable top-level sessions get the tool), and such a session's subagents always get a
session file under its artifacts directory, the session file without `.jsonl`
(`task/structured-subagent.ts:548-557`, `task/executor.ts:4308-4309`, `task/workpool.ts:413`); a
nested subagent's lies under its parent's. Every descendant of this session therefore has a
`sessionFile` inside this session's artifacts directory, and a running `kind === "sub"` ref counts
exactly when it does. A ref without a `sessionFile` belongs to some session without a session file
(temporary artifacts, `task/structured-subagent.ts:558-563`), never to this one, and does not block.
This covers subagents running without an `AsyncJobManager` entry
(peer-message wakes, idle-park revival, `async/job-control.ts:62-69`). Like
`runningAgentsOutsideJobs`, it reads the claimed status, so a stale `running` entry also blocks and
is named, which tells the model to cancel it. The error names every job id and agent id. The check
runs at the start of the call, before validation side effects. Synchronous sibling calls need no
check: the batch completes before the relocation.

### D7. Approval decided per call

`approval` is a function of the arguments: `exec` when the resolved target does not exist (the call
runs the `post-checkout` hook), `write` otherwise. An invalid target resolves to `write` and fails in
`execute`, so a rejection never asks first.

### D8. Scope: one change across tool, session and hosts

The tool, the AgentSession pending-move/relocator contract and the three host relocators cannot ship
separately: without a relocator the tool is absent, and a relocator without the tool has no caller.
The worktree helper extraction is the shared contract that keeps the tool from adding a second
`git worktree add`. All parts live in `packages/coding-agent` except the `stopAfterBatch` tool
result field and its loop handling (D1), which live in `packages/agent`; that field has no other
consumer and cannot ship usefully without the tool.

## Risks / Trade-offs

- [ACP hosts several sessions in one process; `setProjectDir` calls `process.chdir`] → Same exposure
  as `/move` today; not widened here (tools read `session.cwd`, not `process.cwd()`). Recorded as an
  accepted residual risk in gate.md.
- [ACP prompt turn ends at the batch stop; the continuation is an agent-origin turn] → In ACP v1 the
  client's prompt stays unsettled while the session streams, has an admitted submission or has
  post-prompt work (`modes/acp/acp-foreground.ts:130-146`), and agent-initiated turns are parked
  only after it settles (`modes/acp/acp-surface-v1.ts:292-294`). The relocation runs as post-prompt
  work and submits the continuation inside it (D3), so the continuation streams in the client's
  open prompt; v2 streams agent-origin turns as their own work. Upstream also holds idle deliveries
  while `isSessionTransitioning` (`session/agent-session.ts:2381`), so no queued yield result
  starts a turn during the relocation. Task 6.2 verifies the continuation's updates reach the client
  in the same session.
- [Cloning the main checkout into `<main>/.worktrees/<name>` may copy other in-tree worktrees and
  local state (see `task/worktree.ts:86-90`)] → Task 2.3 measured APFS: the native clone of a
  target inside the source fails (`clonefile … Invalid argument`) and falls back to a plain
  checkout, so nothing is copied; reflink, overlay and rcopy backends were not measurable here.
  `addRepoWorktree` therefore uses a plain checkout for every target inside the source checkout and
  records that in `cloneError`. Tim approved the fallback on 2026-10-24 (plan review round 3) and
  keeping it unconditionally on 2026-10-24 (apply).
- [LSP, MCP and eval kernels keep the old workspace after a move] → Same as `/move`; out of scope.
- [The model keeps planning in old paths after the move] → The continuation message names the new
  cwd; the rebuilt system prompt carries the new workstation/cwd block.
- [A stray existing directory under `.worktrees/` that is not registered] → Rejected (D4); the agent
  must remove or register it, which keeps the tool from adopting unknown trees.

## Migration Plan

Additive. New setting default `.worktrees`; no data migration. Rollback is reverting the change; no
persisted state depends on the tool (session files gain hidden `session-move-result` custom
messages, the same entry kind as the existing hidden goal continuation).

## Open Questions

None.
