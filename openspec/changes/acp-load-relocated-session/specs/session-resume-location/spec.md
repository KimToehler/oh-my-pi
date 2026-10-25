# Spec Delta

## Purpose

Defines which directory a stored session runs in when a host (an ACP client or `omp --resume`)
reopens it from a directory other than the one recorded in the session, and when that reopen is
refused instead.

## ADDED Requirements

### Requirement: An ACP client reopens a session moved within its repository
ACP `session/load` and `session/resume` (v1) and `session/resume` (v2) of a stored session whose recorded directory exists, differs from the request `cwd`, and belongs to the same git repository (primary checkout or a linked worktree) SHALL succeed and open the session in its recorded directory. The transcript SHALL be replayed, and the session file SHALL stay in its current session bucket.

#### Scenario: Reload after a move into a worktree
- **WHEN** a session created in a repository's primary checkout was moved into a linked worktree `.worktrees/a` of that repository, the ACP process restarted, and the client sends `session/load` or `session/resume` with the primary checkout as `cwd`
- **THEN** the response is a success for the same session id, earlier messages are replayed, the session is assembled for and runs in `.worktrees/a` (the ACP session factory receives `.worktrees/a` as `cwd` and the session's working directory is `.worktrees/a`), and the session file is still in the worktree's session bucket

#### Scenario: v2 resume after a move
- **WHEN** the same moved session is resumed over ACP v2 with the primary checkout as `cwd`
- **THEN** the resume succeeds for the same session id and the session runs in `.worktrees/a`

#### Scenario: Negative control
- **WHEN** the stored session's recorded directory is an existing checkout of a different git repository than the request `cwd`
- **THEN** the load MUST fail with an error that names the recorded directory, no session is opened for the id, and the session file is unchanged

### Requirement: An ACP client reopens a session whose worktree was removed
ACP `session/load` and `session/resume` of a stored session whose recorded directory no longer exists and was a worktree of the request `cwd`'s repository (a directory `.worktrees/<slug>` of its primary checkout, or an agent-managed `/wt` worktree) SHALL move the session, artifacts included, into the request `cwd` and open it there.

#### Scenario: Worktree removed after merge
- **WHEN** a session was moved into `.worktrees/a`, the worktree was then removed with `git worktree remove` and pruned, and the client loads the session with the primary checkout as `cwd`
- **THEN** the load succeeds for the same session id, the session runs in the primary checkout, its session file now lies in the primary checkout's session bucket, and no file for the id remains in the removed worktree's bucket

#### Scenario: Deleted directory outside the repository
- **WHEN** the recorded directory no longer exists and lay outside the request repository (for example a deleted unrelated project directory)
- **THEN** the load fails with an error that names the missing directory and says it no longer exists, and the session file stays where it was

#### Scenario: Negative control
- **WHEN** the recorded directory no longer exists and was a plain subdirectory of the primary checkout, not under `.worktrees/` (for example a deleted `pkg/old`)
- **THEN** the load MUST fail with an error that names the missing directory and says it no longer exists, and the session file MUST stay where it was

### Requirement: An already open moved session is returned to a reloading client
A `session/load` or `session/resume` for a session that is already open in the ACP process SHALL return that open session when its live directory is the request `cwd` or a same-repository location of it (after `/move` or `session_move` in that process), without opening a second session for the id.

#### Scenario: Reload in the same process after a live move
- **WHEN** an ACP session moved into `.worktrees/a` with `/move` and the client sends `session/load` for it with the primary checkout as `cwd`, in the same process
- **THEN** the load succeeds, the session keeps running in `.worktrees/a`, and later `session/update` notifications for the id keep reaching the client

#### Scenario: Negative control
- **WHEN** the open session's live directory belongs to a different git repository than the request `cwd`
- **THEN** the load MUST fail with an error naming the session's live directory, and the open session MUST stay unchanged

### Requirement: Forking a moved session runs in the directory a load would use
ACP `unstable_forkSession` of a session (open or stored) whose directory differs from the request `cwd` SHALL apply the same rules as a load: the fork runs in the source's directory when it exists in the same repository, the source moves into the request `cwd` first when its removed worktree belonged to the repository, and every other mismatch fails naming the source's directory.

#### Scenario: Fork of a session moved into a worktree
- **WHEN** the client forks a stored session recorded in `.worktrees/a` with the primary checkout as `cwd`
- **THEN** the fork succeeds with a new session id, contains the source's messages, and runs in `.worktrees/a`

#### Scenario: Fork of a session whose directory no longer exists
- **WHEN** the client forks a stored session whose recorded directory was deleted and lay outside the request repository
- **THEN** the fork fails with an error that names the missing directory and says it no longer exists, no new session is created, and the source's session file is unchanged

#### Scenario: Negative control
- **WHEN** the fork source is recorded in an existing checkout of a different git repository than the request `cwd`
- **THEN** the fork MUST fail with an error naming the source's directory and no new session is created

### Requirement: The CLI moves a session from a removed in-repository worktree without asking
`omp --resume <id>` started in a repository checkout SHALL move a session whose recorded directory no longer exists and lay in that repository's primary checkout under `.worktrees/` (a removed `.worktrees/<slug>`) into the current directory without prompting, as it already does for a removed agent-managed `/wt` worktree.

#### Scenario: Non-interactive resume of a removed `.worktrees` session
- **WHEN** `omp --resume <id>` runs without a TTY in the primary checkout for a session recorded in a removed and pruned `.worktrees/a`
- **THEN** the session is resumed in the primary checkout and its session file now lies in the primary checkout's session bucket

#### Scenario: Deleted directory outside the repository
- **WHEN** the recorded directory no longer exists and lay outside the repository (a deleted unrelated directory) and the resume runs without a TTY
- **THEN** the resume fails with the existing "belongs to a directory that no longer exists" error and the session file stays where it was

#### Scenario: Negative control
- **WHEN** the recorded directory no longer exists and was a plain subdirectory of the primary checkout, not under `.worktrees/`, and the resume runs without a TTY
- **THEN** the resume MUST fail with the existing "belongs to a directory that no longer exists" error and the session file MUST stay where it was
