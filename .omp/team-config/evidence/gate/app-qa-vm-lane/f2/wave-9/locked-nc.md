# locked-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
lock before: "CGSSessionScreenIsLocked"=Yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up desktop)  [13:57:58]
ssh: settle: load 7.83 below 8 CPUs after 70 s
ssh: desktop: pid 950
vm up: app-qa-slot-1 holds desktop
[exit 0]
$ guest: sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' "SELECT count(*) FROM access WHERE service='kTCCServiceScreenCapture';"
3
[exit 0]
$ guest: sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' "DELETE FROM access WHERE service='kTCCServiceScreenCapture';"; sudo pkill tccd; sleep 2
[exit 0]
$ guest: sudo sqlite3 '/Library/Application Support/com.apple.TCC/TCC.db' "SELECT count(*) FROM access WHERE service='kTCCServiceScreenCapture';"
0
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs preflight desktop --port 8081)  [14:00:26]
lane: preflight desktop runs in app-qa-slot-1 (slot 1)
PASS driver: spectre 0.9.0
FAIL screen capture: denied -- fix: System Settings > Privacy & Security > Screen Recording: allow it for /Users/lume/Library/Application Support/spectre/helpers/spectre-screencapture/SpectreCaptureHelper.app/Contents/MacOS/spectre-screencapture
PASS screen: unlocked
PASS backend: http://127.0.0.1:8081/actuator/health UP
lane: app-qa-slot-1: the guest command exited 1; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 1]
lane file moved away
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs preflight desktop --port 8081)  [14:00:32]
PASS driver: spectre 0.9.0
PASS screen capture: granted
FAIL screen: locked -- fix: unlock the screen
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 1]
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
lock after: "CGSSessionScreenIsLocked"=Yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [14:00:34]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [14:00:40]
slot 1: free
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
$ host: ssh -R processes
94662 ssh -f -N -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes
(end)
lock after: "CGSSessionScreenIsLocked"=Yes
```

Observation: host locked before and after. In a fresh lease (`vm up desktop` exit 0), with the guest's 3 `kTCCServiceScreenCapture` rows deleted (0 left; the guest ssh used the pinned key) and tccd killed, the routed `preflight desktop` prints `FAIL screen capture: denied`, exit 1. With the lane file moved away, the host `preflight desktop` prints `FAIL screen: locked`, exit 1. Lane file restored (`cmp` identical). Lease deleted with `vm down`; both slots free and no `app-qa-slot-*` afterwards. The one `ssh -R` process listed (pid 94662, `-R 127.0.0.1:8082:...` to `192.168.64.124`) belongs to another session's VM `kmp-sc-f1` (address checked with `lume ls`), not to the lane.

Verdict: PASS
