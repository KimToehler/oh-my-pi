# Proposal

## Why

An ACP client cannot reopen a session that `/move` or `session_move` moved into a worktree. The
client keeps the project directory it started the chat in and sends that directory as `cwd` on
`session/load` / `session/resume`. omp finds the stored file by id, creates the session at the
request `cwd` and switches to the file. The switch refuses the recorded worktree `cwd`, and the
client gets `Internal error: ACP session load was cancelled: <id>`. IntelliJ then silently replaces
the chat's session with a fresh one ("a fresh agent session replaced the stored one, so the agent
lost the earlier conversation"). On 2026-10-25 this lost three chats at once after an IDE restart
(sessions `01a16acd…`, `01a16e97…`, `01a16d6b…`; reproduced with `omp acp` over stdio).

The documented belief (`team-config/README.md`, `team-config/agent/commands/opsx-apply.md`) is
that a reloaded chat "reopens in its project directory, so run `/move` again". That is false: the
chat does not reopen at all.

## What Changes

Decided by Tim on 2026-10-25 (choices: reopen in the stored worktree; same git repository only;
a vanished worktree moves into the client `cwd`):

- ACP `session/load` and `session/resume` (v1, and v2 `session/resume`) of a stored session whose
  recorded directory differs from the request `cwd` open the session in its recorded directory when
  that directory exists and belongs to the same git repository as the request `cwd` (primary
  checkout or any linked worktree). The session file stays where it is. Transcript replay on the
  wire stays as each method defines it today. A recorded directory spelled differently from the
  request `cwd` (symlink, `/tmp` vs `/private/tmp`) no longer fails as "cancelled".
- A stored session whose recorded directory no longer exists and was a worktree of the request
  `cwd`'s repository (a removed `.worktrees/<slug>` of the primary checkout, or a removed
  `/wt` worktree) is moved into the request `cwd`, artifacts included, and opened there, as
  `omp --resume` does for removed `/wt` worktrees. A deleted plain subdirectory of the checkout,
  or a deleted directory inside a worktree that still exists, is not a removed worktree and stays
  refused.
- A `session/load` / `session/resume` for a session already open in the ACP process whose live
  directory is a same-repository relocation of the request `cwd` returns that open session instead
  of failing with "already loaded for <dir>, not <cwd>".
- `unstable_forkSession` of such a session forks in the same directory a load would open it in.
- Every other directory mismatch fails with an error that names the session's recorded directory
  (and says when it no longer exists), not "load was cancelled". "Cancelled" remains only for a
  `session_before_switch` extension cancel.
- `omp --resume` (CLI), the startup session picker and the in-session resume selector: a session
  recorded in a removed worktree under the repository's primary checkout (`.worktrees/<slug>`,
  its root gone) now moves into the current checkout without asking, like a removed `/wt`
  worktree already does. Today the CLI asks, or fails when not interactive; the two pickers take
  their non-relocating path for such a session.
- Documentation: the README and `opsx-apply` command text describe the new reload behaviour; the
  stale comment on the ACP by-id fallback is corrected.

## Capabilities

### New Capabilities
- `session-resume-location`: which directory a stored session runs in when a host (ACP client or
  `omp --resume`) reopens it from a different directory than the one it was recorded in, and when
  the reopen is refused.

### Modified Capabilities

## Impact

- `packages/coding-agent/src/modes/acp/acp-agent.ts`: `#loadManagedSession`,
  `#resumeManagedSession`, `#openStoredSession`, `#forkManagedSession`,
  `#resolveForkSourceSessionPath`, `#assertMatchingCwd`, the `#findStoredSession` comment.
- `packages/coding-agent/src/session/`: one shared resolver for "where does this stored session
  reopen from this request directory" next to `SessionManager.isFromRemovedWorktree` /
  `openRelocated`; `isFromRemovedWorktree` also recognizes a removed worktree inside the primary
  checkout. The CLI's `moveMissingCwdSessionIfNeeded` (`main.ts`) inherits that.
- ACP wire: no new fields or methods. Responses change from an error to success for the cases
  above; the response still carries no `cwd`.
- Docs: `team-config/README.md`, `team-config/agent/commands/opsx-apply.md`,
  `packages/coding-agent/CHANGELOG.md`.
- Existing chats that IntelliJ already rebound to fresh sessions are not restored; their old
  sessions stay on disk and can be resumed with `omp -r <id>`.
