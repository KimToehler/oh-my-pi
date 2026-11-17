# args-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
(lease and signed-in desktop from the args-shell setup, `args-shell.md`)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop type chat-input $(id))  [13:40:57]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
type: tag=chat-input textLength=5
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop find chat-input --equals $(id))  [13:41:04]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tag=chat-input count=1 enabled=true focused=true textLength=5 equals=true
[exit 0]
$ guest: ps -axo pid=,args= | grep -E 'qa.mjs|maestro|xcodebuild|MainKt' | grep -v grep | cut -c1-100
 3269 sudo launchctl asuser 501 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-l
 3270 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-lane/desktop.pid /Library/J
 3271 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java -Djava.awt.headless=fal
 3311 /Users/lume/tools/spectre/spectre-cli-0.9.0/Spectre.app/Contents/Resources/runtime/bin/java -D
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --credentials /tmp/x)  [13:41:11]
lane: --credentials names a host file; run the command with --host to use it on the host
[exit 2]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs flow ios /tmp/w6-h/outsidedir/outside.yaml)  [13:41:12]
flow: /tmp/w6-h/outsidedir/outside.yaml is outside the worktree /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1; the guest holds only the worktree
[exit 2]
$ guest: ps -axo pid=,args= | grep -E 'qa.mjs|maestro|xcodebuild|MainKt' | grep -v grep | cut -c1-100
 3269 sudo launchctl asuser 501 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-l
 3270 sudo -u lume sh -c echo $$ > "$0" && exec "$@" /Users/lume/.app-qa-lane/desktop.pid /Library/J
 3271 /Library/Java/JavaVirtualMachines/app-qa-jdk-21/Contents/Home/bin/java -Djava.awt.headless=fal
 3311 /Users/lume/tools/spectre/spectre-cli-0.9.0/Spectre.app/Contents/Resources/runtime/bin/java -D
[exit 0]
```

Observation: `desktop type chat-input '$(id)'` then `find --equals '$(id)'` gives `equals=true` with `textLength=5` (the literal text was typed, not evaluated); `--credentials /tmp/x` exits 2 (`names a host file`) and a flow file outside the worktree exits 2 (`outside the worktree`), each before any guest command: the guest driver/Maestro/xcodebuild/MainKt process lines are identical before and after.

Verdict: PASS
