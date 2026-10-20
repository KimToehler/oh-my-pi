---
description: Destructive git commands (reset --hard, checkout --, restore, clean, stash, force push, history rewrite) need explicit user consent; a background lane reports BLOCKED instead
alwaysApply: true
---

# Destructive git commands need explicit consent, every time

`git reset --hard` and its equivalents destroy uncommitted work that git cannot recover. If a
change was never staged, no object exists in the store, and `fsck --lost-found` will not bring it
back. There is no undo.

**A shared checkout almost always holds work that is not yours.** Other agents and the user edit
the same tree concurrently. An uncommitted file you did not touch is somebody's live work, and it
carries no marker saying so.

## THE RULE

Before running any command below, STOP and ask the user, naming the exact paths that will lose
uncommitted changes. Wait for an explicit yes. Never infer consent from an earlier instruction, from
the task being urgent, or from the change looking unimportant.

- `git reset --hard`
- `git checkout -- <path>` / `git restore <path>` (discards working-tree changes)
- `git clean -f` / `-fd` / `-fdx`
- `git stash` without `--include-untracked` awareness, when others' files are dirty
- `git checkout <branch>` / `git switch <branch>` when it would discard or carry over dirty state
- Any `--force` push, and any history rewrite of a shared branch

Asking costs one turn. Being wrong costs work that cannot be recovered.

A background lane or subagent has no user to ask. Its task text is the only consent it has: run one
of the commands above only when the task explicitly asks for that operation and `git status` shows no
changes except its own. In every other case the answer is no: report BLOCKED with the exact state.

## USE THE NON-DESTRUCTIVE FORM INSTEAD

Nearly every reason to reach for `--hard` has a form that leaves the working tree alone:

| Goal | Do NOT | Do |
|---|---|---|
| Undo a local commit, keep the tree | `git reset --hard HEAD~1` | `git reset --soft HEAD~1` |
| Undo a merge that is already pushed | `git reset --hard` | `git revert -m 1 <merge>` |
| Move a branch pointer | `git reset --hard <sha>` | `git branch -f <name> <sha>` from another branch |
| Drop only YOUR file's changes | `git checkout -- .` | `git checkout -- <path>` only when `git diff <path>` is entirely yours |
| Revert your own probe/mutation in a file that also holds others' uncommitted edits | `git checkout -- <path>` | `cp <path> /tmp/<name>.bak` before mutating, `cp` it back after; or undo the exact lines with an edit |
| Get a clean tree to test in | `git clean -fdx` | a fresh `git worktree add` |

**`--soft` was the correct answer both times this rule was written for.** The target was a commit
pointer; the working tree was never the point.

**A path is not an ownership boundary.** `git checkout -- <path>` restores the whole file to HEAD,
so it discards every uncommitted hunk in it, not just yours. A subagent's finished-but-uncommitted
work and your throwaway mutation sit in the same file and look identical to git. Before mutating a
dirty file for a probe (mutation test, RED check), snapshot it; restore from the snapshot, never
from HEAD.

## SCOPE EVERY COMMAND TO YOUR OWN PATHS

Even non-destructive commands take explicit paths. Never `git add -A`, never `git add .`, never
`git checkout -- .`. Name the files you were assigned. A wildcard in a shared checkout is a
decision about somebody else's work made without looking.

## WHEN IT HAS ALREADY HAPPENED

1. Say so immediately, plainly, before any other reporting. Do not bury it in a status summary.
2. Establish the exact damage: which paths, whether the content is recoverable, and how you know.
   `git hash-object <file>` against `git rev-parse HEAD:<file>` tells you whether the file is now
   just the committed version.
3. Try recovery honestly: `git fsck --lost-found` for dangling blobs, `git stash list`, other
   worktrees. Report a failed search as failed. Never present an older or similar file as the
   recovered one.
4. Stop touching the repository until the user decides. Do not "carry on with the real task".
