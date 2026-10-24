# Spec Delta

## Purpose

Defines how a running session changes its working directory: which directories the agent may move it
to with the `session_move` tool, how a missing worktree is created, when the move takes effect, when
it is refused, and what the continued run sees afterwards.

## ADDED Requirements

### Requirement: Agent move targets stay inside the repository
`session_move` SHALL accept only a target inside the session's git repository: its main checkout, a registered worktree of it, or a missing directory directly inside the worktree directory (`worktree.repoDir`, default `.worktrees`, repository-relative). Paths are compared after resolving symlinks, at call time. A creating call under an invalid `worktree.repoDir` SHALL fail naming the setting. Any other target SHALL be rejected with an error that names `/move`, and the session stays where it is.

#### Scenario: Registered worktree
- **WHEN** the session runs in the main checkout and calls `session_move` with the path of a registered worktree of the same repository
- **THEN** the call succeeds and schedules the move to that worktree

#### Scenario: Back to the main checkout
- **WHEN** the session runs in a worktree and calls `session_move` with the main checkout's path
- **THEN** the call succeeds and schedules the move to the main checkout

#### Scenario: Symlink to a registered worktree
- **WHEN** the target is a symlink (for example `repo/.worktrees/link`) whose resolved destination is a registered worktree of the same repository, even one outside the main checkout
- **THEN** the call succeeds and schedules the move to the worktree's resolved path

#### Scenario: Session outside a git repository
- **WHEN** the session's directory is not inside a git repository
- **THEN** `session_move` returns an error and nothing changes

#### Scenario: Invalid worktree directory setting
- **WHEN** `worktree.repoDir` is absolute, `~`-relative, drive-prefixed, contains `\`, or has an empty, `.` or `..` component, and the call targets a missing directory
- **THEN** the call returns an error naming `worktree.repoDir` and creates nothing; a concurrent writer changing a checked path component after the check is outside this requirement (gate.md, Accepted residual risks)

#### Scenario: Negative control
- **WHEN** the main checkout is `repo` and the target is `/tmp/elsewhere`, a checkout of another repository, the nested path `repo/.worktrees/a/b`, `repo/.worktrees/link` where `link` is a symlink to a directory outside the repository that is not a registered worktree of it, or `repo/.worktrees/b` where `repo/.worktrees` itself is a symlink to a directory outside the repository; or `worktree.repoDir` is `/tmp/wt`, `~/wt`, `../wt` or `a/../../wt` and the call would create a worktree
- **THEN** accepting any of them MUST fail the requirement: each call returns an error (naming `/move` for a rejected target, naming `worktree.repoDir` for an invalid setting), no directory or branch is created inside or outside the repository, and the session's directory and session file are unchanged

### Requirement: Missing worktree is created before the move
When the target is a not-yet-existing directory under the worktree directory, `session_move` SHALL require a branch name, create that branch from the given base (default: the main checkout's `HEAD`) unless it already exists, add a worktree for it at the target the way `omp worktree add` does (clone setting and `post-checkout` hook included), and then schedule the move.

#### Scenario: New worktree from the main checkout's HEAD
- **WHEN** the main checkout is `repo`, the session runs in worktree A, whose `HEAD` differs from the main checkout's, and calls `session_move` for `repo/.worktrees/b` with branch `plan/b` and no base
- **THEN** `repo/.worktrees/b` is a registered worktree on `plan/b`, whose commit equals the main checkout's `HEAD`, and the move is scheduled

#### Scenario: Branch missing
- **WHEN** the target does not exist and no branch is given
- **THEN** the call returns an error and no directory or branch is created

#### Scenario: Worktree directory does not exist yet
- **WHEN** the main checkout is `repo`, `repo/.worktrees` does not exist, and the session calls `session_move` for `repo/.worktrees/b` with branch `plan/b`
- **THEN** `repo/.worktrees` is created as a plain directory, `repo/.worktrees/b` is a registered worktree on `plan/b`, and the move is scheduled

#### Scenario: Branch checked out elsewhere
- **WHEN** the given branch already exists and is checked out in another worktree
- **THEN** the call returns git's refusal as an error and no directory is created

#### Scenario: Post-checkout hook fails
- **WHEN** the worktree is added but the repository's `post-checkout` hook exits non-zero
- **THEN** the call returns an error containing the hook's output, the worktree stays in place, and no move is scheduled

#### Scenario: Negative control
- **WHEN** the session runs in worktree A (`HEAD` = commit X) while the main checkout `repo` is at commit Y, and creates `repo/.worktrees/b` without a base
- **THEN** basing the new branch on the session's own `HEAD` MUST fail the requirement: the new worktree's commit is Y, and X is a defect

### Requirement: The move takes effect after the current tool batch
After a successful `session_move`, the session SHALL make no further model request in the old directory: the tool calls already running in the same batch finish, the turn ends, the session relocates the way `/move` does, and only then does the run continue. Relocation failure SHALL leave the session in its old directory.

#### Scenario: Relocation after the batch
- **WHEN** one assistant message calls `session_move` together with a `read` of a relative path
- **THEN** that `read` resolves against the old directory, and the relocation starts only after both results are recorded

#### Scenario: Relocation fails
- **WHEN** the relocation fails (for example the destination's session bucket refuses the move)
- **THEN** the session's directory and session file are those from before the call, and the continuation message reports the failure and its reason

#### Scenario: Negative control
- **WHEN** a scripted model answers the `session_move` result with another tool call in the same turn
- **THEN** a model request issued after the `session_move` result and before the relocation MUST fail the requirement: the provider receives no such request, and one reaching it is a defect

### Requirement: Exactly one continuation after the move
After the relocation attempt, the session SHALL continue the run with exactly one continuation turn whose message names the outcome (new directory, or the failure). This holds with and without an active goal.

#### Scenario: Without goal mode
- **WHEN** `session_move` succeeds in an interactive session without a goal
- **THEN** one continuation turn starts by itself in the new directory, without user input

#### Scenario: Negative control
- **WHEN** `session_move` succeeds while a goal is active and goal continuation is enabled for the host
- **THEN** starting two turns after the relocation (a move continuation and a goal continuation) MUST fail the requirement: exactly one turn starts, and a second one is a defect

### Requirement: The continued run works in the new directory
The first turn after a successful move SHALL resolve relative tool paths against the new directory, and its system prompt SHALL be built from the new directory's context files and project rules. As after `/move`, the session file SHALL move into the new directory's session bucket, where `omp --resume` started in the new directory lists it.

#### Scenario: Relative paths and resume
- **WHEN** the session runs in a repository's main checkout, moves into a registered worktree of it, the continued turn reads `README.md`, and the user later runs `omp --resume` from the worktree
- **THEN** the read returns the worktree's `README.md`, the session is listed for resume there, its session file lies in the worktree's session bucket, and the main checkout's own session bucket no longer holds it; `omp --resume` in the main checkout may still list it through the repository's worktree aggregation, as after `/wt`

#### Scenario: Negative control
- **WHEN** a project rule file exists only in the destination worktree's `.omp/rules/` (it is absent from the source checkout)
- **THEN** a continued turn whose system prompt lacks that rule MUST fail the requirement: the rule is present in the first system prompt after the move, and its absence is a defect

### Requirement: Running background work blocks the move
`session_move` SHALL refuse while the session's own async jobs or subagents are running, including subagents that run without an async job (woken by a peer message or revived from idle). The error SHALL name each running job or agent, and the check SHALL happen before any worktree is created.

#### Scenario: Idle session
- **WHEN** no async job or subagent of the session is running
- **THEN** the call proceeds to validation and the move

#### Scenario: Another session's subagent
- **WHEN** two top-level sessions A and B run in one process, only a subagent spawned by B is running, and A calls `session_move`
- **THEN** A's call proceeds to validation and the move; B's subagent does not block it

#### Scenario: Negative control
- **WHEN** a background `bash` job, an async subagent of the session, or a subagent running without an async job is still running and `session_move` targets a missing worktree
- **THEN** proceeding MUST fail the requirement: the call returns an error naming the running job or agent, no worktree or branch is created, and no move is scheduled

### Requirement: Approval follows what the call does
A `session_move` call to an existing target SHALL require `write` approval; a call that creates a worktree SHALL require `exec` approval, because it runs the repository's `post-checkout` hook.

#### Scenario: Existing target under write mode
- **WHEN** `tools.approvalMode` is `write` and the target is a registered worktree
- **THEN** the call runs without an approval prompt

#### Scenario: Negative control
- **WHEN** `tools.approvalMode` is `write` and the target is a missing directory under the worktree directory
- **THEN** creating the worktree without approval MUST fail the requirement: the call asks for approval (or is denied without an interactive surface), and an unprompted creation is a defect

### Requirement: Only relocatable top-level sessions get the tool
`session_move` SHALL be offered only to a top-level session with a persisted session file in the interactive TUI, ACP or RPC host. Subagents (including the advisor), sessions without a session file (`--no-session`) and hosts that cannot relocate (print mode, SDK sessions without a relocation handler) SHALL NOT have it in their tool set.

#### Scenario: Interactive session
- **WHEN** an interactive TUI session starts in a git repository
- **THEN** `session_move` is in its tool set

#### Scenario: Negative control
- **WHEN** a `task` subagent is spawned, `omp -p` runs in print mode, an interactive session starts with `--no-session`, or an advisor whose configured tools include `session_move` runs beside a primary session that has the tool
- **THEN** offering the tool MUST fail the requirement: `session_move` is absent from that tool set, and its presence is a defect
