# F1 min-happy

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, desktop

## Commands and output

Weaver, first scratch worktree: preflight, attach, then find on each of the three ShellTags tags to pick one that is shown.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop; echo "preflight exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach; echo "attach exit $?"; for t in shell-rail shell-bottom-bar shell-session-list; do node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find $t; echo "find $t exit $?"; done
PASS driver: spectre 0.9.0
PASS screen capture: granted
PASS screen: unlocked
preflight exit 0
attach: pid=46324 session=pid-46324
attach exit 0
tag=shell-rail count=1 enabled=true focused=false textLength=0
find shell-rail exit 0
find: tag=shell-bottom-bar count=0
find shell-bottom-bar exit 1
tag=shell-session-list count=1 enabled=true focused=false textLength=0
find shell-session-list exit 0
(exit 0)
```

The rail is shown (wide window); the bottom bar is not. Wait, find, capture into a new folder, detach.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait shell-rail --timeout 5; echo "wait exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop find shell-rail; echo "find exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture shell --out /tmp/app-qa-impl/f1caps/min-happy; echo "capture exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach; echo "detach exit $?"
wait: tag=shell-rail count=1
wait exit 0
tag=shell-rail count=1 enabled=true focused=false textLength=0
find exit 0
capture: /tmp/app-qa-impl/f1caps/min-happy/shell.png
capture: /tmp/app-qa-impl/f1caps/min-happy/shell.json
capture exit 0
detach: session=pid-46324
detach exit 0
(exit 0)
```

Scan of the capture folder.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/f1caps/min-happy; echo "scan exit $?"
scan exit 0
(exit 0)
```

## Observation

Weaver: preflight, attach (pid 46324, this worktree), wait and find on `shell-rail` (count 1, enabled), capture `shell` into a new folder, detach: each exit 0; the scan of the capture folder is clean. The capture shows the weaver shell with the rail and the session list. The probe find on `shell-bottom-bar` exited 1 with count 0: the window is wide, so the shell shows the rail instead of the bottom bar.
