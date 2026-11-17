# stage-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
part 1: compile error appended in f1c (no lease of its own)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [13:25:15]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios) > nc1.out; tail -8

BUILD FAILED in 1m 32s
16 actionable tasks: 6 executed, 10 up-to-date
note: Using codesigning identity override: -
note: Run script build phase 'Compile Kotlin Framework' will be run during every build because the option to run the script phase "Based on dependency analysis" is unchecked. (in target 'iosApp' from project 'iosApp')
** BUILD FAILED **

vm up: ios build exited 65
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [13:27:10]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used 2 min ago
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ cmp Keycloak.kt backup (f1c)
source reverted: identical
config: vm.ios.artifact -> app_kmp/iosApp/build/missing-artifact.app
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios) > nc2.out; tail -3
2026-11-17 14:27:31.403 xcodebuild[88742:45830744] [MT] IDESchemeActionsInvocationRecord: Device <DVTiOSDeviceSimulatorPlaceholder: 0x7b27ccdf40 (Any iOS Simulator Device | undefined_arch)> is missing operatingSystemVersion, operatingSystemVersionWithBuildNumber.
vm up: ios build left no app_kmp/iosApp/build/missing-artifact.app
[exit 2]
$ cmp config backup ~/git/onara/.worktrees/app-qa-vm-f1c/.omp/app-qa.json
identical
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm status)  [13:28:07]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used 3 min ago
slot 2: free
[exit 0]
part 2: the same compile error appended in f1 (staged ios lease)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios) > nc3.out; tail -5
note: Using codesigning identity override: -
note: Run script build phase 'Compile Kotlin Framework' will be run during every build because the option to run the script phase "Based on dependency analysis" is unchecked. (in target 'iosApp' from project 'iosApp')
** BUILD FAILED **

vm up: ios build exited 65
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:28:57]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=53288 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:28:59]
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home)  [13:28:59]
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
$ cmp Keycloak.kt backup (f1)
source reverted: identical
 M .omp/app-qa.json
 M app_kmp/gradle.properties
?? app_kmp/maestro/f1-signin-home.yaml
?? app_kmp/maestro/f1-signin-wait.yaml
```

Observation: Part 1 (f1c, no lease; slot 2 free): a compile error appended to `Keycloak.kt` makes `vm up ios` stop at the host build (`ios build exited 65`, driver exit 2); f1c holds no slot (`vm status`: slot 2 free) and no clone was created; with the source reverted and the artifact path pointed at a missing file, `vm up ios` exits 2 naming the missing artifact. Part 2 (f1, staged ios lease): the same compile error gives exit 2; `vm status` shows the lease with `targets=none`, and the routed `preflight ios` and the sign-in `flow ios` each exit 2 naming `vm up ios`. Sources and configuration reverted (`cmp` identical); `git status` shows only the pre-existing changes. Tests: *test* `stage: snapshot - an artifact rewritten after the snapshot ...`, `stage: redact - a build printing account 1's password prints [redacted] ...` and `stage: refresh-fail ...` in `qa-test-log.txt` (lines 56, 51, 50, passing on this head). Deviation: the `lume ls` taken at 13:27:10 lists `app-qa-slot-1 stopped` although `vm status` reports slot 1 ready; the clone's `lume run` process (pid 52742) started at 13:16:39Z, during the `stage-refresh` `vm up ios`, and was still alive with that start time at 13:30:17Z (`ps -o lstart= -p 52742`: `Tue Nov 17 14:16:39 2026` local), so the clone was not stopped or restarted; the status read coincided with the host near its swap limit (24.9 of 25.6 GB used) while f1c's Gradle and Xcode builds ran. Part 2 used the same clone without a restart.

Verdict: PASS
