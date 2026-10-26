# F1 a — TUI move continues in the worktree with the descendant transcript moved

Head: `b3c022805c41bab805d6d2fd6f6fbc65e63e10e5`.
Surface: real TUI from the worktree source build, driven through `xd://tui` session `qa-a4` at 140x40.
Fixture: `/tmp/ral-f1/qa-a4`, a one-commit git repository with registered worktree `.worktrees/a`.
Launch: `bash -c 'cd /tmp/ral-f1/qa-a4 && exec bun /Users/tim/git/oh-my-pi/.worktrees/relocation-admission-lease/packages/coding-agent/src/cli.ts'`.

Prompt: spawn one synchronous subagent named Helper that replies `ready`; after it finishes, call `write xd://session_move` with `{"path":".worktrees/a"}`; after the move run `pwd` and answer with its output.

Observed TUI and persisted entries:

```text
Helper done · 1.6s
Session move to /private/tmp/ral-f1/qa-a4/.worktrees/a is scheduled.
session-move-result: working directory is now /private/tmp/ral-f1/qa-a4/.worktrees/a
$ pwd
/private/tmp/ral-f1/qa-a4/.worktrees/a
```

The relocated root transcript is:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-a4-.worktrees-a--/2026-10-26T15-05-19-009Z_01a178be-97a1-750d-b62d-cc47dc14a52b.jsonl`

Helper's transcript moved inside that root's artifacts directory:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-a4-.worktrees-a--/2026-10-26T15-05-19-009Z_01a178be-97a1-750d-b62d-cc47dc14a52b/Helper.jsonl`

It contains Helper's pre-move `ready` response. The old root artifacts directory was absent after the move.

RESULT a moved continued
