# F1 att-config

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, desktop

## Commands and output

Onara attached (session pid-81605), home screen.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls "$TMPDIR/app-qa/sessions"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find home
2232988a363f7b96.json
dd69b8d8f71bbc55.json
e7c4acf968d3b37e.json
tag=home count=1 enabled=true focused=false textLength=0
(exit 0)
```

A tap with `--config` naming the weaver configuration.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-out --config ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json
tap: attached with ~/git/onara/.worktrees/qa-shared-f1/.omp/app-qa.json for eu.onara.app.MainKt; attach again
(exit 2)
```

`desktop.mainClass` edited in the attached configuration (backup kept), then detach.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cp .omp/app-qa.json /tmp/app-qa-impl/onara-cfg.bak && sed -i "" "s/eu.onara.app.MainKt/eu.onara.app.OtherKt/" .omp/app-qa.json && grep mainClass .omp/app-qa.json; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
  "desktop": { "mainClass": "eu.onara.app.OtherKt", "launchHint": "./gradlew :desktopApp:run in app_kmp/" },
detach: attached with /Users/[redacted]/git/onara/.worktrees/qa-shared-f1/.omp/app-qa.json for eu.onara.app.MainKt; attach again
(exit 2)
```

Configuration restored from the backup: the session record and the app are unchanged (still signed in).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cp /tmp/app-qa-impl/onara-cfg.bak .omp/app-qa.json && git status --porcelain -- .omp/app-qa.json; grep mainClass .omp/app-qa.json; ls "$TMPDIR/app-qa/sessions"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find home; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find sign-out
?? .omp/app-qa.json
  "desktop": { "mainClass": "eu.onara.app.MainKt", "launchHint": "./gradlew :desktopApp:run in app_kmp/" },
2232988a363f7b96.json
dd69b8d8f71bbc55.json
e7c4acf968d3b37e.json
tag=home count=1 enabled=true focused=false textLength=0
tag=sign-out count=1 enabled=true focused=false textLength=6
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `desktop: a command with another configuration or main class than the attached one is refused`

## Observation

With onara attached (home screen), `desktop tap sign-out --config <weaver configuration>` exited 2, naming the configuration and main class the session was attached with and asking for a new attach; it did not tap: `sign-out` and `home` are still found afterwards, so the app stayed signed in. With `desktop.mainClass` edited in the attached configuration, `desktop detach` exited 2 the same way. After restoring the configuration from its backup (it is untracked in the scratch worktree, hence `??`), the session record `2232988a363f7b96.json` still exists and the app is unchanged. The no-Spectre-call part is the *test* named below, in `f1/qa-test-log.txt`. (`[redacted]` in the second message: the driver redacts a configured onara account value equal to the macOS user name; the first message's home path is written as `~` here.)
