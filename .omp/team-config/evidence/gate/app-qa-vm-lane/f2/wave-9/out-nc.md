# out-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
(lease and signed-in desktop from the args-shell setup, `args-shell.md`)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop capture home --out /tmp/aqvl/w9/out2/cap1/out)  [13:41:14]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/w9/out2/cap1/out/home.png
capture: /tmp/aqvl/w9/out2/cap1/out/home.json
[exit 0]
$ guest: ps -axo pid=,args= | grep -E 'qa.mjs|maestro|xcodebuild|MainKt' | grep -v grep | cut -c1-100
 3269 sudo launchctl asuser 501 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-l
 3270 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-lane/desktop.pid /Library/J
 3271 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java -Djava.awt.headless=fal
 3311 /Users/lume/tools/spectre/spectre-cli-0.9.0/Spectre.app/Contents/Resources/runtime/bin/java -D
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --out /tmp/aqvl/w9/out2/cap1)  [13:41:23]
flow: --out /tmp/aqvl/w9/out2/cap1 exists; name a directory that does not exist yet
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop capture home --out /tmp/aqvl/w9/out2/cap1/out)  [13:41:24]
capture: home.png or home.json already exists in /tmp/aqvl/w9/out2/cap1/out
[exit 2]
$ guest: ps -axo pid=,args= | grep -E 'qa.mjs|maestro|xcodebuild|MainKt' | grep -v grep | cut -c1-100
 3269 sudo launchctl asuser 501 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-l
 3270 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-lane/desktop.pid /Library/J
 3271 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java -Djava.awt.headless=fal
 3311 /Users/lume/tools/spectre/spectre-cli-0.9.0/Spectre.app/Contents/Resources/runtime/bin/java -D
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop capture home --out /tmp/aqvl/w9/out2/cap2/out)  [13:41:27]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/w9/out2/cap2/out/home.png
capture: /tmp/aqvl/w9/out2/cap2/out/home.json
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs scan /tmp/aqvl/w9/out2/cap2)  [13:41:32]
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
[exit 0]
$ ls out
home.json
home.png
```

Observation: a routed capture of the signed-in home screen into a new folder succeeds (exit 0); then an existing host `--out` for a flow exits 2 (`--out ... exists`) and an existing capture file exits 2 (`home.png or home.json already exists`), both before any guest command (no `lane:` line; guest process lines identical before and after); a capture into a second new folder succeeds and `qa.mjs scan` over it exits 0 with no hit. Capture JSON holding a value, a capture named after one, an unswept flow root, interrupted returns and tar rejection: *test* rows (`route: out`, `route: sweep`, `route: tar`, `route: pack`, `route: interrupt`, `lease: redact`) in `f2/wave-9/qa-test-log.txt`. No row captures a login surface.

Verdict: PASS
