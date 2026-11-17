# stage-refresh

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ git diff strings.xml (changed lines)
-    <string name="chat_title">Coach chat</string>
+    <string name="chat_title">Coach chat QA9</string>
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [13:14:33]
ssh: settle: load 7.64 below 8 CPUs after 216 s
ssh: ios: 3CF8EC24-B74F-4749-83B9-FA0C44DBD969
vm up: app-qa-slot-1 holds ios
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:22:57]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=53288 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
kmp-sc-f1 running
wv-f1-human stopped
$ guest: grep chat_title ~/work/onara/app_kmp/ui/src/commonMain/composeResources/values/strings.xml
    <string name="chat_title">Coach chat QA9</string>
[exit 0]
$ host: stat artifact Info.plist; date
11:22:57 ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp/iosApp/build/Build/Products/Debug-iphonesimulator/iosApp.app/Info.plist
14:23:07
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out /tmp/aqvl/w9/out2/sr)  [13:23:07]
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 3CF8EC24-B74F-4749-83B9-FA0C44DBD969
root: (not kept)
out: /tmp/aqvl/w9/out2/sr
sweep: deleted out/2026-11-17_052312/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-17_052312/maestro.log
sweep: redacted out/2026-11-17_052312/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-17_052312/f1-signin-home/logs/maestro.log
screenshot: /tmp/aqvl/w9/out2/sr/f1-home.png
PASS f1-signin-home 60.5s
[exit 0]
$ cmp strings backup
string reverted: identical
 M .omp/app-qa.json
 M app_kmp/gradle.properties
?? app_kmp/maestro/f1-signin-home.yaml
?? app_kmp/maestro/f1-signin-wait.yaml

$ host: stat -f '%Sm %N' -t '%FT%T%z' (iosApp.app, after the row)
2026-11-17T14:16:38+0100 iosApp
2026-11-17T14:16:38+0100 .
2026-11-17T14:24:47+0100 ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp/ui/src/commonMain/composeResources/values/strings.xml (the revert)
```

Observation: after the string change (at 13:14:33Z, just before `vm up ios`), `vm up ios` exit 0 created the clone `app-qa-slot-1` and staged; the app binary `iosApp` was rebuilt at 13:16:38Z (14:16:38+0100), after the edit; the guest copy holds `Coach chat QA9`, and the flow screenshot (kept as `stage-refresh-home.png`, viewed: signed-in home screen) shows `Coach chat QA9` as the chat card title. Deviation: the script's `stat` line names `Info.plist`, which Xcode does not rewrite on an incremental build (its mtime is 2026-11-15); the binary's mtime and the screenshot are the evidence of the rebuild, read after the row and shown at the end. The string was reverted after the flow (`cmp` identical); `git status` shows only the pre-existing changes.

Verdict: PASS
