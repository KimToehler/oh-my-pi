# Proposal

## Why

Only a human can move a session into a git worktree today (`/move`, `/wt`), so an agent that follows
the `.worktrees/<name>` workflow (`/opsx-apply` step 4) stops and waits for the user before every
implementation. That blocks autonomous goal runs and adds a manual `git worktree add` + `/move` step
to ordinary work; a tool lets the agent enter the change's worktree, and its rules and `AGENTS.md`,
on its own.

## What Changes

- New agent-callable tool `session_move`: moves the current session into the main checkout or a
  registered worktree of the same repository. When the named target under the repository's
  worktree directory does not exist yet, the tool first creates it on a given branch from a given
  base (default: the main checkout's `HEAD`), then moves.
- Targets are restricted to the current repository: the main checkout, a registered worktree, or a
  new worktree directly under `<main checkout>/<worktree dir>/`. Any other target is rejected with a
  pointer to `/move`. The worktree directory is a new setting, default `.worktrees`.
- The move is deferred to a safe boundary: the tool validates, optionally creates the worktree,
  records the pending move and ends the turn; the host then relocates through the same path `/move`
  uses and continues the run in the new directory with a synthetic continuation, so the next turn
  sees the destination's tools cwd, system prompt, context files and rules.
- The tool refuses while the session's own async jobs or subagents are running and names them.
- Approval: moving to an existing target is `write`; creating a worktree is `exec` (it runs the
  repository's `post-checkout` hook).
- Worktree creation reuses the existing `omp worktree add` behaviour (copy-on-write clone per
  `worktree.clone`, plain-checkout fallback, `post-checkout` hook) through one shared helper instead
  of a second implementation.
- Hosts: interactive TUI, ACP and RPC each install the relocation handler; print mode, SDK sessions
  without a handler and subagents do not get the tool. ACP clients get no new protocol message (same
  visibility as `/move` today).

## Capabilities

### New Capabilities
- `session-relocation`: how a session changes its working directory at runtime, by the user
  (`/move`) or by the agent (`session_move`): allowed targets, worktree creation, the safe move
  boundary, refusal conditions, and what the continued run sees afterwards.

### Modified Capabilities
<!-- none: no existing spec covers session relocation (openspec/specs has gate-workspace-layout,
     merge-gate-record, team-config-install only) -->

## Impact

- `packages/coding-agent/src/tools/`: new `session_move` tool, its prompt in `src/prompts/tools/`,
  registry entry, approval decision per call.
- `packages/agent`: a `shouldStopAfterBatch` loop hook, a non-aborting stop that ends the run after the
  current tool batch has settled (loop handling and `CHANGELOG.md`).
- `packages/coding-agent/src/session/agent-session.ts`: pending-move state, turn end after a
  successful `session_move` through the `shouldStopAfterBatch` hook, host handler on `ToolSession` (pattern of
  `setPlanProposalHandler`).
- Hosts: `modes/interactive-mode.ts` + `modes/controllers/command-controller.ts` (TUI relocation),
  `modes/acp/acp-agent.ts`, `modes/rpc/` (headless relocation shared with the `/move` builtin in
  `slash-commands/builtin-lifecycle.ts`).
- `cli/worktree-cli.ts` / `session/session-worktree.ts`: shared worktree-add helper with explicit
  path, branch and base.
- Settings: new worktree-directory setting (`task/settings.ts`).
- Docs and `packages/coding-agent/CHANGELOG.md`.
- RPC `get_state` gains an additive optional `cwd` field (the session's working directory), so RPC
  clients can observe a move; decided by Tim on 2026-10-24 (apply).
- No change to the ACP wire protocol, the session file format, or `/move` / `/wt` behaviour.
