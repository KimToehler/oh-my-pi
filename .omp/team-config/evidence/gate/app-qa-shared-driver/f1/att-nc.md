# F1 att-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktrees (two `:shell` JVMs in the first, one in the second)

## Commands and output

Any earlier session of this worktree ended first.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach; echo "detach exit $?"
detach: no attached session for this worktree; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
detach exit 2
(exit 0)
```

Weaver `:shell` JVMs with their working directories: two in the first scratch worktree (one started for this row), one in the second.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ for p in $(pgrep -f 'eu.weaver.app.shell.MainKt'); do echo "$p $(lsof -a -p $p -d cwd -Fn | tail -1 | sed "s|^n$HOME|~|")"; done
45627 ~/git/weaver/.worktrees/qa-shared-f1b/app/shell
46324 ~/git/weaver/.worktrees/qa-shared-f1/app/shell
48308 ~/git/weaver/.worktrees/qa-shared-f1/app/shell
(exit 0)
```

Attach in the first scratch worktree, the session directory listed before and after.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls "${TMPDIR:-/tmp}/app-qa/sessions"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach; echo "attach exit $?"; ls "${TMPDIR:-/tmp}/app-qa/sessions"
2232988a363f7b96.json
dd69b8d8f71bbc55.json
attach: 2 eu.weaver.app.shell.MainKt JVMs in this worktree (pids 46324, 48308); pass --pid N or stop all but one
attach exit 2
2232988a363f7b96.json
dd69b8d8f71bbc55.json
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `desktop: only another repository app of the same main class running is refused with its pid listed`

## Observation

Two weaver `:shell` JVMs running in the first scratch worktree (pids 46324 and 48308; a third in the second scratch worktree is not in this worktree): attach printed both pids with `pass --pid N or stop all but one`, exit 2. The session directory lists the same records before and after (the two existing records belong to other worktrees), so no session was recorded.
