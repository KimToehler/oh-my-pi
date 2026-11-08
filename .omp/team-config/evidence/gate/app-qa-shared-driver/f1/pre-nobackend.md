# F1 pre-nobackend

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, desktop

## Commands and output

Weaver configuration has no backend section.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop; echo "preflight exit $?"
PASS driver: spectre 0.9.0
PASS screen capture: granted
PASS screen: unlocked
preflight exit 0
(exit 0)
```

## Observation

Weaver desktop preflight: three PASS lines (driver, screen capture, screen), no backend line, exit 0.
