# F1 a — TUI move continues in the worktree with the descendant transcript moved

Head: `df2a0e6917f3ff2a2319b6fced268536bf238d59` (merged `main` at `9c075012392644690a351983316004a70b90c5f6`; later evidence/task commits do not change runtime code).
Surface: real TUI from the worktree source build, driven through `xd://tui` session `ral-a6` at 140x40.
Fixture: `/tmp/ral-f1/qa-a5`, a one-commit git repository with registered worktree `.worktrees/a`.
Launch: `bash -c 'cd /tmp/ral-f1/qa-a5 && exec bun /Users/tim/git/oh-my-pi/.worktrees/relocation-admission-lease/packages/coding-agent/src/cli.ts'`.

Prompt: spawn one synchronous subagent named Helper that replies `ready`; after it finishes, call `write xd://session_move` with `{"path":".worktrees/a"}`; after the move run `pwd` and answer with its output.

Observed TUI and persisted entries:

```text
Helper done · 1.4s
Session move to /private/tmp/ral-f1/qa-a5/.worktrees/a is scheduled.
session-move-result: working directory is now /private/tmp/ral-f1/qa-a5/.worktrees/a
$ pwd
/private/tmp/ral-f1/qa-a5/.worktrees/a
```

The relocated root transcript is:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-a5-.worktrees-a--/2026-10-26T16-06-00-025Z_01a178f6-2659-76fd-8d35-43867b65b98d.jsonl`

Helper's transcript moved inside that root's artifacts directory:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-a5-.worktrees-a--/2026-10-26T16-06-00-025Z_01a178f6-2659-76fd-8d35-43867b65b98d/Helper.jsonl`

It contains Helper's pre-move `ready` response. The old root artifacts directory was absent after the move.

RESULT a moved continued
