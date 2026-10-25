Moves this session (working directory and session file) to another checkout of the same repository, or creates a new worktree and moves there.

Targets:
- The repository's primary checkout, or any worktree registered with the repository (`path` only).
- A new worktree: a missing directory directly inside `{{worktreeDir}}` (the `worktree.repoDir` setting, relative to the primary checkout). `branch` is REQUIRED. A missing branch is created from `base` (default: HEAD of the primary checkout); an existing branch is checked out as is, and then `base` MUST NOT be given. The `post-checkout` hook runs; if it fails, the call errors and the worktree is kept.

Rules:
- Refused while background jobs or subagents of this session still run; the error names them. Wait for or cancel them first.
- Any other target is refused; the user relocates elsewhere with `/move`.
- On success the move happens after the current tool batch finishes: the run ends there, so issue no further tool calls that depend on the new directory. A hidden message then continues the conversation in the new directory; relative paths resolve there from the next turn on.
- One move at a time; a second call while one is pending errors.
