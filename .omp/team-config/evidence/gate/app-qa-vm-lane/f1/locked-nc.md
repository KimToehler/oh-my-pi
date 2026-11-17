# locked-nc

Run 2026-11-15T18:16:10+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.23 'sudo sqlite3 '\''/Library/Application Support/com.apple.TCC/TCC.db'\'' "DELETE FROM access WHERE service='\''kTCCServiceScreenCapture'\''; SELECT changes();"; sudo pkill -x tccd; echo pkill=$?'
3
pkill=0
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
lane: preflight desktop runs in app-qa-slot-1 (slot 1)
PASS driver: spectre 0.9.0
FAIL screen capture: denied -- fix: System Settings > Privacy & Security > Screen Recording: allow it for /Users/lume/Library/Application Support/spectre/helpers/spectre-screencapture/SpectreCaptureHelper.app/Contents/MacOS/spectre-screencapture
PASS screen: unlocked
PASS backend: http://127.0.0.1:8081/actuator/health UP
lane: app-qa-slot-1: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 1]
```

Lane file moved away for the host check.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ioreg -n Root -d1 | grep -o '"CGSSessionScreenIsLocked"=[A-Za-z]*'
"CGSSessionScreenIsLocked"=Yes
[exit 0]
```

The lease is the one `locked-desktop` used minutes before; its guest's Screen Recording rows were in place, as that row's passing preflight shows. Deleting them made the routed preflight report `screen capture: denied`; the host itself reports `screen: locked`. So the lane's guest grant, not the host, is what made the locked rows pass. The clone is deleted by `down-clean` next, so no later lease inherits the removed rows.

## Observation

Host locked. After deleting the guest's `kTCCServiceScreenCapture` rows (3 rows) and restarting `tccd`, the routed preflight desktop prints `FAIL screen capture: denied`, exit 1. With the lane file moved away, the host's preflight desktop prints `FAIL screen: locked`, exit 1.

## Verdict

PASS
