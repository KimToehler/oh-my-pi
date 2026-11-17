# locked-ios

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
### stage-first / route-preflight / args-flow / out-noout / locked-ios
$ host: xcrun simctl list devices booted
== Devices ==
-- iOS 26.4 --
    iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D) (Booted) 
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [12:34:41]
ssh: settle: load 7.53 below 8 CPUs after 190 s
ssh: ios: 034F9F15-BE87-45B6-BA24-5C2C5737D5D7
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:40:36]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=52626 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
host files 8718, guest files 8721; guest-only: ['.dev-credentials.env', '.omp/team-config/evidence/gate/kmp-onboarding/f1/ob-nutrition-options-02-Aktivitätsniveau.png', '.omp/team-config/evidence/gate/kmp-onboarding/f1/ob-nutrition-options-02-Ernährungsweise.png']; host-only: [] (0); sha differs: [] (0)
$ guest: stat -f "%Lp %N" ~/work/onara/.dev-credentials.env
600 /Users/lume/work/onara/.dev-credentials.env
[exit 0]
$ guest: curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/actuator/health
200
[exit 0]
lock: "CGSSessionScreenIsLocked"=Yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [12:40:50]
lane: preflight ios runs in app-qa-slot-1 (slot 1)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: 034F9F15-BE87-45B6-BA24-5C2C5737D5D7
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
$ host: xcrun simctl list devices booted
== Devices ==
-- iOS 26.4 --
    iPhone 17 Pro (612AB788-087A-408B-ACE1-34BCD68C235D) (Booted) 
lock: "CGSSessionScreenIsLocked"=Yes
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs flow ios maestro/f1-signin-home.yaml --account 1 --expect home)  [12:40:57]
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 034F9F15-BE87-45B6-BA24-5C2C5737D5D7
root: (not kept)
out: $HOST_TMP/app-qa-out-C6vptH
sweep: deleted out/2026-11-17_044100/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_044100/maestro.log
sweep: redacted out/2026-11-17_044100/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-17_044100/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/app-qa-out-C6vptH/f1-home.png
PASS f1-signin-home 59.4s
[exit 0]
lock: "CGSSessionScreenIsLocked"=Yes
```

Observation: host locked before and after (`=Yes` at every check); both slots free first (after `hostkey-nc`'s `vm down`); fresh `vm up ios` exit 0, routed iOS sign-in flow `PASS f1-signin-home 59.4s`, exit 0; screenshot viewed (signed-in home, no login surface), kept as `locked-ios-home.png`. The slot was released by `down-clean`'s `vm down` (exit 0) at the end of the script.

Verdict: PASS
