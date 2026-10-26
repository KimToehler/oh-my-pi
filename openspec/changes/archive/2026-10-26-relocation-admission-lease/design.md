# Design

## Context

See proposal.md (Why) and `specs/relocation-admission/spec.md` (requirements). Paths are relative to
`packages/coding-agent/src` unless stated; line numbers are at `main` 822d81bd0c.

- Deferred `session_move` relocation: `AgentSession.#executeSessionMove`
  (`session/agent-session.ts:3316-3379`) waits for idle and other post-prompt tasks, runs the D6
  running-work check (`findRunningSessionWork`, `3331-3336`), calls the host relocator
  (`3344`), closes the session-move fence in `finally` (`3349-3352`) and then sends the
  `session-move-result` continuation.
- Host relocations: TUI `#withSessionMove` (`modes/controllers/command-controller.ts:1764`) wraps
  `/move` (`1674`), `/wt` (`1713`) and the agent relocator `relocateForAgent` (`1787-1800`); its
  body moves the session (`1809`) and applies the cwd (`1820-1837`); rollback is `291-320`.
  Headless `relocateHeadlessSession` (`session/headless-relocation.ts:70-109`) moves, sets the
  process project dir, rescopes and rolls back on failure; ACP (`modes/acp/acp-agent.ts:3231-3233`),
  RPC (`modes/rpc/rpc-mode.ts:1772-1777`) and the builtin `/move` and `/wt`
  (`slash-commands/builtin-lifecycle.ts:71-75`) call it.
- Peer messages have one entry point: `IrcBus.#deliver` (`irc/bus.ts:135-218`). It revives a
  parked, killed or parking recipient through `AgentLifecycleManager.ensureLive` (`163-185`) and
  hands off through `AgentSession.deliverIrcMessage` → `IrcBridge.deliver`
  (`session/irc-bridge.ts:191-260`), which for an idle recipient calls `#wakeForIrc`
  (`agent-session.ts:1535-1629`). Nothing on this path consults a relocation.
- `#wakeForIrc` claims the session synchronously (`#beginInFlight`, `agent-session.ts:1565`, which
  raises `#promptInFlightCount`, so `isStreaming` is true at once, `7019-7021`) but dispatches the
  provider turn only after `whenWorkPoolYieldSettled()` (`1571-1593`). The registry status becomes
  `running` later, from the `agent_start` event (`4628-4635`, `registry/agent-registry.ts:414-419`).
  D6 reads only the registry status (`session/session-move.ts:84-90`), so a wake admitted just
  before the check is invisible to it.
- Revival: `AgentLifecycleManager.ensureLive` (`registry/agent-lifecycle.ts:379-419`) is called by
  `IrcBus`, task resume (`task/executor.ts:3825`, `3858`), RPC subagent focus
  (`modes/rpc/rpc-mode.ts:836`), TUI focus (`modes/controllers/session-focus-controller.ts:73`)
  and collab (`collab/host.ts:1191`, `1213`). None consults a relocation.
- Tree ownership is path-based (D6 of `session-move-tool`): a subagent belongs to a session when its
  `sessionFile` lies inside the session's artifacts directory; `SessionManager.moveTo` rebases the
  descendants' refs to the new directory (`session/session-manager.ts:2650-2655`). Registry
  `parentId` is not reliable for this (persisted roster entries default to `MAIN_AGENT_ID`,
  `registry/persisted-agents.ts:827`, while an ACP session's agent id is `acp:<session-id>`,
  `main.ts:563`).
- The per-session transition flag (`isSessionTransitioning`, `agent-session.ts:6166-6185`) and the
  session-move fence gate the session's own goal continuation and idle yield deliveries; they say
  nothing about the session's subagents.

## Goals / Non-Goals

**Goals:**
- One admission barrier, keyed by agent tree, that every relocation path takes and every
  peer-message and revival path honours.
- The `session_move` running-work check is exact against wakes admitted before the barrier.

**Non-Goals:**
- No change to when `/move` or `/wt` are allowed (they still do not run the D6 check); they only
  hold the barrier.
- No change to the IRC receipt outcomes (`injected`, `woken`, `revived`, `failed`).
- No gating of client prompts typed into the relocating session itself, and no gating of a
  subagent's own background-job completions (see gate.md, Out of scope).
- No relocation of a subagent's own working directory: a subagent woken after the move keeps its
  cwd, exactly as after `session-move-tool`; the barrier orders its turn after the transcript
  rename and ref rebase, it does not move it.

## Decisions

### D1. The barrier lives in the agent registry as a tree lease plus admission tickets

`AgentRegistry` gets a `RelocationAdmission` member (new module
`registry/relocation-admission.ts`), one per registry, so every production caller (the process-wide
registry) and every test registry has its own. Two primitives and two queries:

- `hold(tree): RelocationLease` marks a tree leased synchronously, then `lease.ready` resolves once
  every admission ticket already open for a member of that tree has closed. `tree` is
  `{ rootId, isMember(ref) }`. Holds are counted per `rootId`: a nested hold of an already-leased
  tree (the host relocator inside `session_move`) increments the count and is ready at once.
  Disposing the last hold releases the tree.
- `admit(agentId): Promise<AdmissionTicket>` resolves immediately when no leased tree claims the
  ref, and otherwise waits for that tree's release. Waiters of one tree are kept in a FIFO list and
  resumed in order; each resumed waiter re-evaluates (a new lease taken in between makes it wait
  again, at the front). The ticket is a `Disposable`; it records the agent id so `hold` can find the
  open tickets of its tree.
- `isLeased(agentId): boolean` and `whenReleased(agentId): Promise<void>` report and await the
  release of the leased tree that claims the ref (D2's dispatch-point deferral). Release first runs
  the `whenReleased` continuations of that tree in registration order, then resumes its waiting
  admits.

Tree membership has one definition, used by the lease and by the running-work check (D4):
`sessionTreeMembership(tree, ref)` in `session/session-move.ts` returns `"root"`, `"descendant"`
or `undefined` for `tree = { rootId, artifactsDirs }`. `"root"` is `ref.id === rootId`;
`"descendant"` is a `kind === "sub"` ref, other than the root, whose `sessionFile` lies inside one
of `artifactsDirs` (the D6 rule of `session-move-tool`, today inlined in `findRunningSessionWork`,
`session/session-move.ts:84-89`); a ref without a session file, an advisor ref or any other kind is
`undefined`. `AgentSession` builds both trees from the same helper,
`#sessionTree(extraDirs)`: `rootId` is its agent id and `artifactsDirs` are the artifacts
directory of its current session file plus `extraDirs`.

The lease's `isMember` must hold through the whole move and rollback, but `moveTo` rebases each
descendant ref to the destination (awaiting an `lstat` per ref, `session/session-move.ts:118-125`)
before it publishes the destination as its own session file (`session/session-manager.ts:2653-2663`),
so a membership built from "hold-time directory plus current directory" loses a rebased ref in
that window. Two rules close it:

- Snapshot: at hold time the lease records the ids of every ref whose membership is
  `"root"` or `"descendant"`; a snapshot id stays a member until release, whatever its
  `sessionFile` reads in between. Rebasing changes paths, never ids.
- Move target: `SessionManager` exposes `getMoveTargetSessionFile()`, set by `moveTo` (and so by
  `rollbackMove`, which calls it, `session-manager.ts:2302-2310`) to the destination session file
  as soon as it has computed it (`2578`), before the artifacts rename and the ref rebase, and
  cleared when `moveTo` returns or throws. `isMember` evaluates `sessionTreeMembership` with the
  hold-time directory, the current directory and, while set, the move target's directory, so a ref
  registered during the window (a roster scan of either directory) is a member too.

`relocation-admission.ts` sees only the opaque `{ rootId, isMember }` and does not import the
session module.

Alternatives: (a) reuse `isSessionTransitioning`: rejected, it is per session and the subagents
are separate sessions; (b) queue in `IrcBridge`: rejected, it runs after `ensureLive` has already
revived the recipient and only covers live sessions; (c) return a new `queued` receipt and deliver
later: rejected, it changes the IRC receipt contract the `irc` tool and task executor read, and
needs a second delivery loop; waiting in the sender's call keeps one code path.

### D2. Admission points: `IrcBus.#deliver` and `AgentLifecycleManager.ensureLive`

`IrcBus.#deliver` takes `admit(message.to)` after resolving the ref and the advisor refusal, before
the lifecycle gate, and holds the ticket until the hand-off returns (`deliverIrcMessage`, or the
waiter hand-off). At that point an idle recipient's wake has claimed the session (`#beginInFlight`
is synchronous inside `IrcBridge.deliver`). The ticket is passed to `ensureLive` so it does not
take a second one.

A claimed wake is not yet a running turn: `#wakeForIrc` dispatches the provider turn later, in its
synchronous ownership check after `whenWorkPoolYieldSettled()` (`agent-session.ts:1571-1593`). A
wake claimed just before a hold would otherwise dispatch inside the held window, including a wake
of the relocating root, which the running-work check (D4) never counts. So the ownership check
gains one branch, atomic with the dispatch like the existing pooled-turn branch: when
`admission.isLeased(agentId)` reports the session's own agent id inside a leased tree, the records
go to `#irc.queueDeferredWake` and the session registers once for that tree's release
(`admission.whenReleased(agentId)`), which calls `#resumeStrandedIrcAsides` (`1453-1497`; it
drains deferred wakes first). Release runs these callbacks before it resumes waiting admits, so
a wake claimed before the hold still precedes messages that arrived during it. In
`#executeSessionMove` the idle-wait loop exits synchronously into the hold (no `await` between its
last `agent.state.isStreaming` check and `hold`), so every root wake is either dispatched before
the loop's last check (the loop waits for it) or reaches its ownership check under the lease
(deferred).

`ensureLive(id, options?: { admission?: AdmissionTicket })` takes its own ticket when none is
passed and holds it until it returns. It is the only revival route: the reviver runs only from
its private `#resolveAndRevive` and `#reopenKilled`, and a parked or killed ref has no session to
use otherwise. So every revival waits for the relocation and reads the transcript at its rebased
path. A kept live session (park cancelled) also passes through the ticket, which costs nothing
when no lease is held.

**Hand-off point.** A ticket is a promise to `lease.ready` that the admitted activity becomes
visible to the running-work check (D4) or ends. For a revival whose caller then starts a turn,
`ensureLive` returning is too early: the turn would be submitted after the ticket closed, after
`ready` and possibly after the check. So a caller that revives and then starts a turn holds one
ticket from before `ensureLive` (passed in) until that turn is visible, or until it gives up. A
prompt is visible once its submission is admitted, which `AgentSession.prompt` records
synchronously at the call (`hasAdmittedSubmission`, `agent-session.ts:1237-1241`, `3671-3674`;
the client-prompt bracket is claimed before any dispatch await, `1216-1219`). A restored turn
(`restore: true`, `task/restore.ts:89-94`, which takes the `restoreInterruptedTurn()` branch of
`driveSessionToResult` instead of a prompt, `task/executor.ts:2639-2641`) is visible once
`restoreInterruptedTurn()` returns: when it returns `true`, `retry()` has scheduled the
continuation through `#scheduleAgentContinue` (`turn-recovery.ts:3262`), whose post-prompt task
is tracked synchronously at scheduling (`agent-session.ts:5423-5449`) and stays tracked until the
continuation's turn, which claims `#beginInFlight` inside it (`5613`), has ended; so
`hasPostPromptWork` (`7503-7505`) reports it from the hand-off until `isStreaming` does. When it
returns `false`, no turn follows. `driveSessionToResult` therefore gains one `onHandOff` hook,
called once: after the initial prompt's submission is admitted, after `restoreInterruptedTurn()`
returns, or when the call fails before either. D4 counts both signals.

**No ticket across another turn.** A ticket holder must never wait for something a lease can
block, or `ready` and that wait deadlock (a running subagent's `irc` call to a tree member waits
for the lease, which waits for the ticket). The only such wait on these paths is the task-resume
ownership wait for a subagent that is still streaming (`task/executor.ts:3833-3848`): the
follow-up path disposes its ticket before that wait and takes a new `admit(id)` after it, before
its install and submission. A subagent that is streaming is counted by D4 anyway.

Revival entry paths, their hand-off points and controls (tasks 3.1, 3.2):

| Caller | Ticket held until | Control |
|---|---|---|
| peer message (`IrcBus.#deliver`, `irc/bus.ts:172`, `203`) | `deliverIrcMessage` returns (wake claimed) | 3.1 |
| task resume and task restore (`runSubagentFollowUpTurn`, `task/executor.ts:3821-3926`; restore through `task/restore.ts:89-94`) | `driveSessionToResult` calls its new `onHandOff` hook (prompt submission admitted, `restoreInterruptedTurn()` returned, or the call failed) | 3.2, 4.2 |
| RPC `steer_subagent` to a running subagent (`modes/rpc/rpc-mode.ts:826-850`; not a revival route: a parked subagent is refused before `ensureLive`, `815-833`) | `session.prompt` is called | 3.2 |
| collab guest `chat` (`collab/host.ts:1189-1196`) and TUI transcript-viewer chat (`packages/tui/src/overlays/agent-transcript-viewer.ts:622-624`) | `session.prompt` is called or `beforePrompt` rejects, through `AgentLifecycleManager.promptLive(id, text, options, beforePrompt?)`, exposed on `AgentLifecycleLike` (`packages/tui/src/overlays/agent-hub-types.ts:73-76`) | 3.2 (`promptLive`, collab guard) |
| TUI agent-hub focus and revive (`session-focus-controller.ts:73`, `packages/tui/src/overlays/agent-hub.ts:2543`), collab `revive` (`collab/host.ts:1213`) | `ensureLive` returns (no turn follows) | 3.1, 3.2 |

`promptLive(id, text, options, beforePrompt?: (session) => boolean)` admits, revives with the
ticket, then calls the synchronous `beforePrompt` and prompts only when it returns `true` (or is
absent); in every case it disposes the ticket before returning. The collab `chat` handler passes
its existing post-revival guard (`#guestTrafficAllowed() && #guestActionsReady()`,
`collab/host.ts:1193`, `683-686`), so an ending room or replaced session still suppresses the
prompt after a revival that waited for a relocation.

Deadlock rule for lease holders: a lease holder never awaits an admission for its own tree. The
relocation bodies (`moveTo`, rescope, rollback, plugin reload) do not deliver messages or call
`ensureLive`; the host controls of task 5.1 assert that each held relocation completes with a peer
message pending.

### D3. Acquisition points

`AgentSession.holdRelocationAdmission(): RelocationLease` wraps D1 for the session's tree.
There are three acquisition sites, and every relocation entry path reaches exactly one of them:

| Entry path | Acquisition site | Control |
|---|---|---|
| agent `session_move` | `#executeSessionMove` (outer hold) + the host site below (nested) | 4.1 |
| TUI `/move` (`command-controller.ts:1674`) | `#withSessionMove` | 5.1 |
| TUI `/wt` (`command-controller.ts:1713`) | `#withSessionMove` | 5.1 |
| TUI agent relocator `relocateForAgent` (`command-controller.ts:1787`) | `#withSessionMove` | 5.1 |
| headless `/move` and `/wt` builtins (`relocateWithRuntime`, `slash-commands/builtin-lifecycle.ts:68-72`) | `relocateHeadlessSession` | 5.1 |
| ACP agent relocator (`modes/acp/acp-agent.ts:3232`) | `relocateHeadlessSession` | 5.1 |
| RPC agent relocator (`modes/rpc/rpc-mode.ts:1773`) | `relocateHeadlessSession` | 5.1 |

- `#executeSessionMove` takes it after the idle wait and before `findRunningSessionWork`, awaits
  `lease.ready`, runs the check, calls the relocator, and disposes it in the `finally` that closes
  the session-move fence, before the continuation is sent. Held wakes for the root then run beside
  the continuation in the new directory; holding through the continuation turn would block the
  tree for a whole model turn.
- TUI `#withSessionMove` and `relocateHeadlessSession` take it around their whole body (session
  move, cwd application, rescope, rollback); inside `session_move` this is the nested hold of D1.

### D4. The running-work check counts claimed sessions

`findRunningSessionWork` iterates refs whose `sessionTreeMembership` (D1) is `"descendant"` for the
tree of the session's current artifacts directory, and counts one as running when its status is
`running`, or its live session reports `isStreaming` (which includes the synchronous in-flight
claim of a wake), `hasAdmittedSubmission` (a revive-then-prompt caller's admitted submission,
D2) or `hasPostPromptWork` (a scheduled continuation, such as a restored turn, D2). With D3 the
check runs after every ticket opened before the lease has closed, and each such ticket closes
only at its caller's hand-off point (D2), so an activity admitted before the barrier has either
claimed or scheduled its session's turn (counted, the move is refused and names it), ended
without a turn, or not been admitted yet (it waits).

### D5. Scope: one change across registry, IRC, lifecycle, session and hosts

The lease (D1) is the shared contract: admission points without an acquirer never wait, and an
acquirer without admission points blocks nothing. The parts are independently testable, but none
ships a behaviour on its own, so they land together. All of them live in `packages/coding-agent`,
except the one-method extension of the hub's `AgentLifecycleLike` interface and its transcript-
viewer caller in `packages/tui` (D2), which exists only to route that chat through `promptLive`.

## Risks / Trade-offs

- [The sender of a peer message to a relocating tree waits in its `irc` call] → Bounded by the
  relocation (rename, rescope; seconds when ACP reloads plugins). Accepted residual risk in gate.md.
- [A revival that hangs keeps `lease.ready` pending and stalls the relocation] → A revival either
  completes or throws today; the relocation waits, it does not run against a half-revived
  subagent. The stall is visible as a pending move, not as wrong-directory work.
- [`isMember` misses a subagent whose session file lies outside the artifacts directory] → Same
  ownership rule as D6 of `session-move-tool`; such refs are not counted there either.
- [A held wake runs after the continuation was decided] → It runs in the new directory, which is
  the requirement; the IRC bridge turns it into an aside if the continuation turn is streaming.
- [`hasPostPromptWork` also reports post-turn work of an idle descendant that starts no new turn]
  → The move is refused naming that subagent, the same outcome as for a running one; post-prompt
  work is short-lived, and the root's own idle wait (`agent-session.ts:3322-3326`) already waits
  for it. A spurious refusal is retried by the agent; a missed scheduled turn would run in the
  source checkout.

## Migration Plan

Additive, no persisted state. Rollback is reverting the change.
