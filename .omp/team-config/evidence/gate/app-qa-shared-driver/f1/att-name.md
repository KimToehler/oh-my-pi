# F1 att-name

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: two scratch weaver worktrees, desktop

## Commands and output

Both scratch weaver worktrees run their app (`./gradlew :shell:run` in each `app/`); both configurations are named `weaver`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ for p in $(ps -axo pid,command | grep '[e]u.weaver.app.shell.MainKt' | awk '{print $1}'); do echo $p $(lsof -a -p $p -d cwd -Fn | tail -1 | sed "s|^n$HOME|~|"); done; grep name .omp/app-qa.json ../qa-shared-f1b/.omp/app-qa.json
45627 ~/git/weaver/.worktrees/qa-shared-f1b/app/shell
46324 ~/git/weaver/.worktrees/qa-shared-f1/app/shell
.omp/app-qa.json:  "name": "weaver",
../qa-shared-f1b/.omp/app-qa.json:  "name": "weaver",
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
attach: pid=46324 session=pid-46324
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1b`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
attach: pid=45627 session=pid-45627
(exit 0)
```

Capture folder removed first (`rm -rf /tmp/app-qa-impl/f1caps/att-name`). Tap and detach in the first.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture first-before --out /tmp/app-qa-impl/f1caps/att-name && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap shell-session-list && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
capture: /tmp/app-qa-impl/f1caps/att-name/first-before.png
capture: /tmp/app-qa-impl/f1caps/att-name/first-before.json
tap: tag=shell-session-list
detach: session=pid-46324
(exit 0)
```

Later tap in the second.

cwd `~/git/weaver/.worktrees/qa-shared-f1b`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture second-before --out /tmp/app-qa-impl/f1caps/att-name && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap session-runner-chip
capture: /tmp/app-qa-impl/f1caps/att-name/second-before.png
capture: /tmp/app-qa-impl/f1caps/att-name/second-before.json
tap: tag=session-runner-chip
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1b`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture second-after --out /tmp/app-qa-impl/f1caps/att-name
capture: /tmp/app-qa-impl/f1caps/att-name/second-after.png
capture: /tmp/app-qa-impl/f1caps/att-name/second-after.json
(exit 0)
```

Re-attach the first to capture it.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach && node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture first-after --out /tmp/app-qa-impl/f1caps/att-name
attach: pid=46324 session=pid-46324
capture: /tmp/app-qa-impl/f1caps/att-name/first-after.png
capture: /tmp/app-qa-impl/f1caps/att-name/first-after.json
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cd /tmp/app-qa-impl/f1caps/att-name; for n in first second; do echo "$n: $(diff <(jq -S "del(.capturedAt, .meta)" $n-before.json) <(jq -S "del(.capturedAt, .meta)" $n-after.json) | grep -c "^[<>]") differing lines"; done
first: 972 differing lines
second: 491 differing lines
(exit 0)
```

Scan of the capture folder.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1caps/att-name; echo "scan exit $?"
scan exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

## Observation

Two scratch weaver worktrees, both configurations named `weaver`, both apps `eu.weaver.app.shell.MainKt` (pid 46324 in `qa-shared-f1`, 45627 in `qa-shared-f1b`). Attach in each named its own worktree's pid. The tap on `shell-session-list` and the detach in the first, then a later tap on `session-runner-chip` in the second: the second app opened the runner detail page (`second-after.png`, viewed by the QA lane: tims-mbp runner, Kind local, Remove runner), the first app shows a session selected in its list and no runner page (`first-after.png`: "Travel expense policy for contractors"). Each app's tree changed only after its own tap. The capture folder scans clean. Captures in `/tmp/app-qa-impl/f1caps/att-name/`.
