# F1 att-otherwt

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktrees and weaver main checkout

## Commands and output

Only the second scratch worktree's weaver app runs.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ for p in $(pgrep -f 'eu.weaver.app.shell.MainKt'); do echo "$p $(lsof -a -p $p -d cwd -Fn | tail -1 | sed "s|^n$HOME|~|")"; done
45627 ~/git/weaver/.worktrees/qa-shared-f1b/app/shell
(exit 0)
```

Attach in the first scratch worktree.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls "${TMPDIR:-/tmp}/app-qa/sessions"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach; echo "attach exit $?"
2232988a363f7b96.json
dd69b8d8f71bbc55.json
e7c4acf968d3b37e.json
attach: no eu.weaver.app.shell.MainKt JVM in this worktree (~/git/weaver/.worktrees/qa-shared-f1); start it with ./gradlew :shell:run in app/; other eu.weaver.app.shell.MainKt JVMs: 45627 (in ~/git/weaver/.worktrees/qa-shared-f1b)
attach exit 2
(exit 0)
```

Attach from weaver's main checkout (which holds `.worktrees/`) with `--config` naming the first scratch configuration; the session directory afterwards.

cwd `~/git/weaver`

```
$ git worktree list | sed "s|$HOME|~|g"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach --config ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json; echo "attach exit $?"; ls "${TMPDIR:-/tmp}/app-qa/sessions"
~/git/weaver                               4881e379 [main]
~/git/weaver/.worktrees/follow-up-register ec925103 [plan/follow-up-register]
~/git/weaver/.worktrees/m2-admin-reads     b2690c37 [plan/m2-admin-reads]
~/git/weaver/.worktrees/m2-embeddings      0b9f566e [plan/m2-embeddings]
~/git/weaver/.worktrees/m2-media-estimate  5765a582 [plan/m2-media-estimate]
~/git/weaver/.worktrees/m5-app-navigation  cf77b287 [plan/m5-app-navigation]
~/git/weaver/.worktrees/qa-shared-f1       82b1e755 (detached HEAD)
~/git/weaver/.worktrees/qa-shared-f1b      82b1e755 (detached HEAD)
attach: no eu.weaver.app.shell.MainKt JVM in this worktree (~/git/weaver); start it with ./gradlew :shell:run in app/; other eu.weaver.app.shell.MainKt JVMs: 45627 (in ~/git/weaver/.worktrees/qa-shared-f1b)
attach exit 2
2232988a363f7b96.json
dd69b8d8f71bbc55.json
e7c4acf968d3b37e.json
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `desktop: a linked worktree below the main checkout is another worktree`

## Observation

Only the second scratch worktree's weaver app running (pid 45627). Attach in the first scratch worktree: no JVM in this worktree, weaver's launch hint, and the other pid with its worktree listed, exit 2. Attach from weaver's main checkout (which holds `.worktrees/`) with `--config` naming the first scratch configuration: the same refusal for the main checkout, the JVM in `.worktrees/qa-shared-f1b` below it not taken, exit 2. The session directory lists the same three records (other worktrees') throughout, so no session was recorded.
