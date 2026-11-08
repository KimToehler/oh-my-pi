# F1 att-two

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara and weaver worktrees, desktop

## Commands and output

Setup: the onara app already shows its login entry (signed out by the run before this row); the driver's wait confirms it.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait sign-in --timeout 20
wait: tag=sign-in count=1
(exit 0)
```

Setup: the onara desktop app reads `.dev-credentials.env` from the worktree root (`desktopApp/build.gradle.kts:51`), so the scratch worktree holds a symlink to the main checkout's gitignored file (contents never read here).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls -l .dev-credentials.env | sed "s/.*\.dev-credentials\.env/.dev-credentials.env/"
.dev-credentials.env
(exit 0)
```

Onara app (scratch onara worktree, `./gradlew :desktopApp:run -Ponara.devBackendPort=8081`) and weaver app (scratch weaver worktree, `./gradlew :shell:run` in `app/`) both running.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
attach: pid=24595 session=pid-24595
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
attach: pid=92882 session=pid-92882
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ rm -rf /tmp/app-qa-impl/f1caps/att-two; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture onara-before --out /tmp/app-qa-impl/f1caps/att-two
capture: /tmp/app-qa-impl/f1caps/att-two/onara-before.png
capture: /tmp/app-qa-impl/f1caps/att-two/onara-before.json
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture weaver-before --out /tmp/app-qa-impl/f1caps/att-two
capture: /tmp/app-qa-impl/f1caps/att-two/weaver-before.png
capture: /tmp/app-qa-impl/f1caps/att-two/weaver-before.json
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-in
tap: tag=sign-in
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait home --timeout 45
wait: tag=home count=1
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture onara-after --out /tmp/app-qa-impl/f1caps/att-two
capture: /tmp/app-qa-impl/f1caps/att-two/onara-after.png
capture: /tmp/app-qa-impl/f1caps/att-two/onara-after.json
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture weaver-after --out /tmp/app-qa-impl/f1caps/att-two
capture: /tmp/app-qa-impl/f1caps/att-two/weaver-after.png
capture: /tmp/app-qa-impl/f1caps/att-two/weaver-after.json
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cd /tmp/app-qa-impl/f1caps/att-two && ls -l && cmp weaver-before.png weaver-after.png; jq -c "[.. | objects | .testTag? // empty]" weaver-before.json | md5; jq -c "[.. | objects | .testTag? // empty]" weaver-after.json | md5; jq -c "[.. | objects | .testTag? // empty] | unique" onara-before.json onara-after.json
total 1744
-rw-r--r--@ 1 [redacted]  staff    8659 Nov  8 20:17 onara-after.json
-rw-r--r--@ 1 [redacted]  staff   52909 Nov  8 20:17 onara-after.png
-rw-r--r--@ 1 [redacted]  staff    3694 Nov  8 20:17 onara-before.json
-rw-r--r--@ 1 [redacted]  staff   17534 Nov  8 20:17 onara-before.png
-rw-r--r--@ 1 [redacted]  staff   49264 Nov  8 20:17 weaver-after.json
-rw-r--r--@ 1 [redacted]  staff  344618 Nov  8 20:17 weaver-after.png
-rw-r--r--@ 1 [redacted]  staff   49264 Nov  8 20:17 weaver-before.json
-rw-r--r--@ 1 [redacted]  staff  344555 Nov  8 20:17 weaver-before.png
weaver-before.png weaver-after.png differ: char 117942, line 463
defcfce6cb211d352536207b469aa1c2
defcfce6cb211d352536207b469aa1c2
["login","sign-in","snackbar"]
["chat","chat-input","chat-send","display-name","home","jobs","jobs-empty","jobs-refresh","sign-out","snackbar"]
(exit 0)
```

Weaver node trees before and after the onara tap, and a scan of the capture folder.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ diff <(jq -S "del(.capturedAt, .meta)" /tmp/app-qa-impl/f1caps/att-two/weaver-before.json) <(jq -S "del(.capturedAt, .meta)" /tmp/app-qa-impl/f1caps/att-two/weaver-after.json); node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1caps/att-two; echo "scan exit $?"
2322c2322
<     "captureDurationMs": 15,
---
>     "captureDurationMs": 14,
scan exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

## Observation

Both apps attached at once, each to its own pid (onara 24595, weaver 92882). The tap on `sign-in` in the onara session signed the onara app in: `wait home` count=1, and the onara capture's tags went from the login screen's to the home screen's (the tag lists are in the output above); `onara-after.png`, viewed by the QA lane, shows "Signed in as" with Running generations, the coach chat and Logout. Weaver's capture before and after the tap has the same node tree (the `jq -S` diff differs only in `captureDurationMs`; the tag lists hash equal; the PNG bytes differ, as two captures of a live window do), so weaver's screen is unchanged. The onara app was already showing its login entry from the run before this row, so no setup scroll or sign-out was needed. The capture folder scanned clean before any image was viewed.
