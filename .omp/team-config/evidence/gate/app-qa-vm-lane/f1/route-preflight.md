# route-preflight

Run 2026-11-15T18:03:56+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) xcrun simctl list devices booted | grep -E '\(Booted\)' || echo none-booted
    iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D) (Booted) 
    iPhone 17 (EB37BA50-3B78-4396-B068-DC23997BF895) (Booted)
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 69D74232-E8D2-48CD-A535-08C79FD75552
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) xcrun simctl list devices booted | grep -E '\(Booted\)' || echo none-booted
    iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D) (Booted) 
    iPhone 17 (EB37BA50-3B78-4396-B068-DC23997BF895) (Booted)
[exit 0]
```

## Observation

With a lease staged for ios, `preflight ios` prints the `lane:` line naming slot 1 and `app-qa-slot-1`, its device is the guest simulator, and the host's booted-device list is the same before and after.

## Verdict

PASS
