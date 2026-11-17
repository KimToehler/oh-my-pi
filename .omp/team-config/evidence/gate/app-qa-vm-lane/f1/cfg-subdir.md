# cfg-subdir

Run 2026-11-15T18:03:56+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1/app_kmp) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 69D74232-E8D2-48CD-A535-08C79FD75552
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
```

## Observation

Run from `app_kmp/`, the preflight is routed (`lane:` line) and uses the worktree root configuration `app-qa/2` with its `vm` section; guest checks pass.

## Verdict

PASS
