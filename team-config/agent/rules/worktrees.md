---
description: Worktree discipline - implementation happens in a task-owned worktree under .worktrees/, every edit and git command targets that worktree's own path, and staging names explicit files
globs:
  - "**/*"
---

# Worktree Discipline (NON-NEGOTIABLE)

**Never implement, refactor, or do multi-file work on the main checkout or its default
branch (`main`/`master`/`dev`).** Work in a task-owned worktree so parallel sessions cannot
step on each other:

```bash
git worktree add .worktrees/<task-slug> -b <task-slug>
```

Run every edit, build, test, and QA from inside it. When a workflow offers a `--worktree`
flag, pass it; for omp `task` subagents that edit concurrently, use `isolated: true`.

Exceptions: a trivial single-file fix the user asks to apply in place, read-only
investigation, or an urgent hotfix the user explicitly wants on the current branch.

## Every path points into the worktree

- A file under `.worktrees/<slug>/` and the same relative path in the main checkout are two
  independent copies. Plan checkboxes, edits, `git add`, and `git commit` target the
  worktree's absolute path. After any "nothing to commit" surprise, run `git status` in both.
- IDE tools (`idea_*`) act on the IDE's open project, which is the main checkout. In a
  worktree, use them only for read-only queries; never `idea_reformat_file` or
  `idea_rename_refactoring`. Format with the worktree's own toolchain.

## Commit hygiene

- Never `git add -A` or `git add .`. Stage the files you changed, by explicit path.
- Commit before you return or yield. If you cannot commit, report BLOCKED with the exact
  dirty state instead of leaving edits behind.
- Before a merge, run `git status --short` in the main checkout. Uncommitted changes to
  branch files that nobody made on purpose are someone's stray write: trace them, do not
  discard them.
