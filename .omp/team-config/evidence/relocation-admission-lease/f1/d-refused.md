# F1 d — TUI session_move is refused while a descendant runs

Head: `b3c022805c41bab805d6d2fd6f6fbc65e63e10e5`.
Surface: real TUI from the worktree source build, driven through `xd://tui` session `qa-d4` at 140x40.
Fixture: `/tmp/ral-f1/qa-d4`, a one-commit git repository with registered worktree `.worktrees/a`.
Launch: `bash -c 'cd /tmp/ral-f1/qa-d4 && exec bun /Users/tim/git/oh-my-pi/.worktrees/relocation-admission-lease/packages/coding-agent/src/cli.ts'`.

Prompt: start one background subagent named Sleeper whose task runs `sleep 90`, then immediately call `write xd://session_move` once with `{"path":".worktrees/a"}` without waiting, retrying or cancelling.

Observed TUI and root transcript:

```text
Sleeper running
Session Move path=".worktrees/a"
Cannot move the session: still running: background jobs Sleeper. Wait for them or cancel them, then call session_move again.
```

The session stayed at `/tmp/ral-f1/qa-d4`; no destination session bucket was created. The TUI process was stopped after capturing the refusal, which terminated the disposable Sleeper fixture.

RESULT d refused
