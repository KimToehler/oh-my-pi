# args-shell

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
(shared setup of the args-shell, args-nc, out-nc and target-nc rows: one lease with ios and desktop staged in f1, desktop signed in)
### args-shell / args-nc / out-nc / target-nc (lease with ios and desktop)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios desktop)  [13:32:40]
ssh: settle: load 7.92 below 8 CPUs after 190 s
ssh: ios: EBDAF2E0-F05F-4319-B526-439E39BAEA2D
ssh: settle: load 7.45 below 8 CPUs after 0 s
ssh: desktop: pid 3271
vm up: app-qa-slot-1 holds ios, desktop
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [13:40:13]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=68849 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop attach)  [13:40:16]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: pid=3271 session=pid-3271
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop wait sign-in --timeout 60)  [13:40:29]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=sign-in count=1
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop tap sign-in)  [13:40:34]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tap: tag=sign-in
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs desktop wait home --timeout 60)  [13:40:41]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=home count=1
[exit 0]
--- args-shell
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs desktop type chat-input a "b" $HOME; c)  [13:40:46]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
type: tag=chat-input textLength=14
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1/app_kmp && qa.mjs desktop find chat-input --equals a "b" $HOME; c)  [13:40:52]
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tag=chat-input count=1 enabled=true focused=true textLength=14 equals=true
[exit 0]
```

Observation: after `vm up ios desktop` (exit 0) and the routed desktop sign-in (attach, wait `sign-in`, tap, wait `home`, each exit 0), the routed `desktop type chat-input 'a "b" $HOME; c'` from `app_kmp/` typed 14 characters (the text's length, verbatim) and `find chat-input --equals` with the same text reports `equals=true`.

Verdict: PASS
