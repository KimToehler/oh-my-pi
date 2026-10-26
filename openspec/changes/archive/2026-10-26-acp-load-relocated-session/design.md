# Design

## Context

See proposal.md (Why). Current code, all in `packages/coding-agent/src/`:

- `modes/acp/acp-agent.ts`: `loadSession` (:847) and `resumeSession` (:873), and the v2 host
  callback `resumeSession` (:931-942), all reach `#loadManagedSession` (:1811) or
  `#resumeManagedSession` (:1826). Both return an already open record after `#assertMatchingCwd`
  (:2050-2056, throws `ACP session <id> is already loaded for <actual>, not <expected>`), otherwise
  `#findStoredSession` (:3007, falls back to a global by-id scan) and `#openStoredSession` (:1864).
- `#openStoredSession` creates the session at the request `cwd` through `#createSession`
  (the factory `createAcpSessionFactory`, `main.ts:555-603`, clones settings for that `cwd`,
  creates `SessionManager.create(cwd)`, discovers the title prompt and loads trusted extensions
  for it), then calls `session.switchSession(path)` without `onCwdChange`. `switchSession`
  throws `SESSION_CWD_CHANGE_REJECTED` when the recorded `cwd` differs
  (`session/agent-session.ts:13028`) and returns `false`; ACP turns that into
  `ACP session load was cancelled` (:1878).
- `#forkManagedSession` (:1841) creates at `params.cwd` and switches to the source file the same
  way (`ACP session fork was cancelled`); `#resolveForkSourceSessionPath` (:2058) returns the open
  record's file or a stored file by id.
- `session/session-manager.ts`: `isFromRemovedWorktree` (:4269) is true only when the session's
  bucket is one of `worktreeSessionDirs(cwd)` (`session/session-paths.ts:238-255`: every worktree
  git still lists plus agent-managed `/wt` worktrees matched by name). A removed and pruned
  `.worktrees/<slug>` is neither, so it returns `false` (probed 2026-10-25 against the real
  `.worktrees/review-trailer-repair` session: `false`). `openRelocated` (:4286) opens a session
  anchored at its missing recorded `cwd` and `moveTo`s it into `cwd`, throwing
  `SessionMoveRefusedError` when another live process writes it.
- CLI: `moveMissingCwdSessionIfNeeded` (`main.ts:919-944`, called from `createSessionManager`,
  `main.ts:1247`) moves silently when `isFromRemovedWorktree`, else asks; without a TTY it throws
  `belongs to a directory that no longer exists`.
- ACP mode never calls `setProjectDir`/`process.chdir` itself; only the relocation helper
  (`session/headless-relocation.ts`) does. Tools and the ACP MCP manager read the session's `cwd`
  (`acp-agent.ts:3255`).

## Goals / Non-Goals

**Goals:**
- One definition of "where does stored session S reopen when a host asks from directory R", used
  by every ACP reopen path (load, resume, fork, already open).
- A removed in-repository worktree counts as a removed worktree everywhere `isFromRemovedWorktree`
  is asked, so ACP and `omp --resume` agree.

**Non-Goals:**
- No ACP wire change: responses carry no `cwd`; no cwd-change notification.
- No change to `session/list` scoping (`SessionManager.list(cwd)` stays bucket-local) or to the
  TUI picker's worktree aggregation.
- No change to `/move`, `/wt`, `session_move`, or the TUI resume selector's `onCwdChange` flow.
- No restore of chats a client already rebound to a fresh session.

## Decisions

### D1. A shared reopen-location resolver in `session/`

New module `session/session-resume-location.ts` exporting
`resolveResumeLocation(session: { path: string; cwd: string }, requestCwd: string, sessionDir?: string)`
returning one of:

- `{ kind: "open", cwd }`: open at `cwd`. `cwd` is `requestCwd` only when the recorded `cwd` is
  empty (old sessions). Otherwise it is `path.resolve(recorded)`, the recorded spelling, when that
  directory is enterable and either realpaths to `requestCwd` or has
  `vcs.git(recorded).primaryRoot()` equal to `vcs.git(requestCwd).primaryRoot()` (both through
  `fs.realpath`, so `/var` vs `/private/var` and symlinked checkouts compare equal). The recorded
  spelling is required: `AgentSession.switchSession` compares the recorded and the live `cwd`
  lexically (`agent-session.ts:13024-13035`) and rejects any other spelling with
  `SESSION_CWD_CHANGE_REJECTED`, which ACP reports as "load was cancelled". `switchSession` stays
  unchanged.
- `{ kind: "relocate", from: recorded, to: requestCwd }`: the recorded `cwd` is missing and
  `SessionManager.isFromRemovedWorktree(session, requestCwd, sessionDir)` is true.
- `{ kind: "refuse", recordedCwd, missing: boolean }`: everything else (other repository, no
  repository on either side, missing directory outside the repository).

Same-repository is decided by primary root, not by session bucket: a bucket test misses sessions
that were started in a worktree under a custom layout and depends on `--session-dir`. Alternative
rejected: accept any existing directory (Tim, 2026-10-25: same repository only), and
"inside the request `cwd`" (misses `/wt` worktrees under `~/.omp/wt`).

### D2. `isFromRemovedWorktree` also recognizes a removed `.worktrees/<slug>` of the primary checkout

Add one clause: the recorded `cwd` is missing, equals or lies below
`realpath(primaryRoot(requestCwd))/.worktrees/<slug>` for some single path segment `<slug>`
(the recorded path resolved through its nearest existing ancestor, so `/var` vs `/private/var`
compare equal), and the worktree root `.worktrees/<slug>` itself is missing. This covers
`.worktrees/<slug>` after `git worktree remove` + prune, the layout the `/move` workflow and the
repository's worktree rule use; git keeps no record of a pruned linked worktree, so the path
layout is the only remaining evidence, as the name match is for agent-managed `/wt` worktrees.
A missing subdirectory of a live worktree (`.worktrees/a/pkg/old` while `.worktrees/a` exists)
and a missing plain subdirectory of the primary checkout (not under `.worktrees/`) do not
qualify and stay refused (spec scenarios). Changing the shared helper rather than adding an
ACP-only rule keeps one definition (AGENTS.md: two implementations is a bug). Its callers all
inherit the clause: CLI `--resume <id>` (`main.ts:931`), the startup picker resume
(`main.ts:2232`) and the in-session resume selector (`selector-controller.ts:2023`). All three
then move such a session into the current checkout instead of asking or failing; the CLI path
carries the specified scenarios, the two picker paths share the same branch and get no
separate witness.

### D3. ACP opens the session where the resolver says, assembled for that directory

`#openStoredSession(stored, requestCwd, …)`:

- `open`: `#createSession(resolved.cwd)` then `switchSession(stored.path)`; recorded and session
  `cwd` now match, so the switch is not rejected. The factory assembles settings, title prompt,
  trusted extensions and the session manager for the worktree, as `session/new` there would.
  Alternative rejected: create at `requestCwd` and pass `onCwdChange: () => true`; the session
  would run with the request directory's settings, extensions and title prompt while recording
  the worktree (scout fact: `main.ts:555-603`), and would need a full headless rescope that
  `process.chdir`s a multi-session process.
- `relocate`: `SessionManager.openRelocated(stored.path, from, to)` then `close()`, then open the
  moved file as `open` at `to`. `SessionMoveRefusedError` surfaces as the ACP error with its
  message.
- `refuse`: throw `ACP session <id> belongs to <recordedCwd>, which is not in the git repository
  of <requestCwd>` or `… belongs to <recordedCwd>, which no longer exists`. No session is created.
- A `false` from `switchSession` can now only be a `session_before_switch` cancel; the
  "was cancelled" text stays for it.
- Wire replay is untouched: after the session is open, each method keeps today's behaviour
  (v1 `session/load` replays via `#surface.replay`, v1 `session/resume` does not, v2 resume
  replays only for `replayFrom: {type: "start"}` and otherwise sends the state snapshot).

### D4. Already open sessions and forks use the same resolver

- Already open: `#assertMatchingCwd` is replaced by a check that resolves the record's live `cwd`
  (`session.sessionManager.getCwd()`) against the request `cwd` with D1; `open` returns the
  record unchanged; `refuse` throws `ACP session <id> is already loaded for <live>, which is not in
  the git repository of <requestCwd>`. `relocate` cannot occur for a live directory; if it does,
  it is refused.
- Fork: `#resolveForkSourceSessionPath` also returns the source's recorded or live `cwd`;
  `#forkManagedSession` resolves it with D1 and creates the fork at the resolved `cwd`
  (`relocate` moves the stored source first, as a load would).

### D5. Scope: two subsystems, one contract

The change touches the ACP host (`modes/acp`) and the session store helpers (`session/`). The CLI
change is not separate work: it is the consequence of D2 in the shared helper and cannot ship
apart from it without two definitions of "removed worktree".

## Risks / Trade-offs

- [The client keeps showing its project directory while the session runs in the worktree] →
  same as after a live `/move` today (accepted in `session-move-tool`); ACP v1/v2 have no field to
  report it. Recorded in gate.md.
- [Relocate closes and reopens the moved file; another process could open it in between] → the
  reopen goes through the normal single-writer lock (`Session moved to a new file`,
  `open-elsewhere`), the same outcome as two processes resuming one session today.
- [Primary-root comparison costs two `vcs.git` opens per reopen of a moved session] → only on the
  mismatch path; same-directory loads skip it.
- [D2 changes resume of sessions from removed in-repository worktrees in the CLI, the startup
  picker and the in-session resume selector] → intended; the session moves into the checkout
  instead of a prompt or a non-TTY failure. A missing subdirectory of a live worktree stays
  refused, so no live worktree's session is moved silently.

## Migration Plan

No data migration. Session files are not rewritten except by the `relocate` path, which is the
existing `openRelocated` move. Rollback is a revert; sessions relocated meanwhile stay valid in
their new bucket.
