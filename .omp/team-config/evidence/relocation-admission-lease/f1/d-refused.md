# F1 d — TUI session_move is refused while a descendant runs

Head: `df2a0e6917f3ff2a2319b6fced268536bf238d59` (merged `main` at `9c075012392644690a351983316004a70b90c5f6`; later evidence/task commits do not change runtime code).
Surface: real TUI from the worktree source build, driven through `xd://tui` session `ral-d5` at 140x40.
Fixture: `/tmp/ral-f1/qa-d5`, a one-commit git repository with registered worktree `.worktrees/a`.
Launch: `bash -c 'cd /tmp/ral-f1/qa-d5 && exec bun /Users/tim/git/oh-my-pi/.worktrees/relocation-admission-lease/packages/coding-agent/src/cli.ts'`.

Prompt: start one background subagent named Sleeper whose task runs `sleep 90`, then immediately call `write xd://session_move` once with `{"path":".worktrees/a"}` without waiting, retrying or cancelling.

Observed TUI and root transcript:

```text
Sleeper running
Session Move path=".worktrees/a"
Cannot move the session: still running: background jobs Sleeper. Wait for them or cancel them, then call session_move again.
```

The session stayed at `/tmp/ral-f1/qa-d5`; no destination session bucket was created. The TUI process was stopped after capturing the refusal, which terminated the disposable Sleeper fixture.

RESULT d refused
