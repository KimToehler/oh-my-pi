# Proposal

## Why

A session relocation (`session_move`, `/move`, `/wt`, and the ACP and RPC relocators) renames the
session's transcript and artifacts and rescopes the host, but nothing stops another agent from
waking a member of that session's agent tree while it runs. A peer message can start a root turn
against the source checkout with half-moved state, or revive or wake a subagent whose transcript
is being renamed under it, splitting or orphaning that transcript. The F2 merge gate of
`session-move-tool` (wave 3) found this in both reviews; Tim froze it on 2026-10-25 as this
follow-up change.

## What Changes

- A relocation admission barrier for one agent tree: the session that relocates and every subagent
  whose transcript lies under its artifacts directory. While the barrier is held, peer-message
  delivery and parked-agent revival for a tree member wait; they continue in arrival order once the
  relocation has settled (moved, failed, or rolled back). Nothing is dropped or rejected.
- Every relocation path holds the barrier from before its final checks until host rescope or
  rollback has finished: the deferred `session_move` relocation, the TUI `/move` and `/wt`
  commands, and the headless (ACP, RPC, builtin `/move` and `/wt`) relocation.
- The final running-work check of `session_move` runs while the barrier is held, after deliveries
  admitted before it have handed off, and counts a subagent whose turn was admitted but is not yet
  reported as running.
- Other agent trees in the same process are not affected.

## Capabilities

### New Capabilities

- `relocation-admission`: which agent-tree activity waits while a session relocates, when it
  continues, and how the barrier relates to the relocation's running-work check.

### Modified Capabilities

None. The `session-relocation` capability of `session-move-tool` is not archived into
`openspec/specs/` yet, and this change adds behaviour beside it without changing its requirements.

## Impact

- `packages/coding-agent/src/registry/` (agent registry, lifecycle manager): the barrier and
  revival admission.
- `packages/coding-agent/src/irc/bus.ts`: peer-message admission.
- `packages/coding-agent/src/session/agent-session.ts`, `session/session-move.ts`: barrier
  acquisition in the deferred relocation and the running-work check.
- `packages/coding-agent/src/modes/controllers/command-controller.ts`,
  `session/headless-relocation.ts`: barrier acquisition in the host relocations.
- `packages/coding-agent/src/task/executor.ts` (task resume and restore), `modes/rpc/rpc-mode.ts`
  (`steer_subagent` to a running subagent), `collab/host.ts` (guest chat) and the TUI
  transcript-viewer chat (`packages/tui/src/overlays/agent-transcript-viewer.ts`,
  `agent-hub-types.ts`): callers that revive and then start a turn hold their admission until the
  turn is submitted or scheduled.
- Observable effect: a `write agent://<id>` to a member of a relocating tree returns only after the
  relocation settles. No wire, CLI or session-file format change.
