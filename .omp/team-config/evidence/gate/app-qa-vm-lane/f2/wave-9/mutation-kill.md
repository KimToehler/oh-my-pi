# mutation-kill

Run 2026-11-17T15:35:12Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `mk2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
--- first attempt (rows3.sh): its poll (ps|grep every 0.1 s) never saw the clone child; vm up completed (`vm up: app-qa-slot-1 holds ios`, driver output `$O/mk.out`), so its kill hit an exited driver. Its output, for completeness:
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:03:25]
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 8 min ago
[exit 0]
clone process seen: 
/tmp/aqvl/w9/rows3.sh: line 108: kill: (41423) - No such process
killed driver pid 41423 (SIGKILL) at 2026-11-17T15:18:30Z
driver output: ssh: settle: load 7.95 below 8 CPUs after 291 s
ssh: ios: FDCB2877-FAE9-4765-9EF4-26E00D8C88D8
vm up: app-qa-slot-1 holds ios (end)
--- right after the kill:
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:18:33]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=42337 holder=none busy=none last used 6 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 23 min ago
[exit 0]
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:18:40]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=42337 holder=none busy=none last used 6 min ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 24 min ago
[exit 0]
--- 60 s later, 15:19:43:
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped


--- re-run (mk2.sh, pgrep every 10 ms):
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [15:35:12]
vm down: this worktree holds no lease
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:35:14]
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 40 min ago
[exit 0]
--- attempt 1
clone process seen: 67087 ~/.local/share/lume/lume.app/Contents/MacOS/lume clone app-qa-golden app-qa-slot-1
killed driver pid 66507 (SIGKILL) at 2026-11-17T15:35:42Z
driver output:  (end)
--- right after the kill:
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:35:44]
lane: sweep: deleted app-qa-slot-1 (starting lease of dead pid 66507)
lane: sweep: freed slot-1
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 41 min ago
[exit 0]
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:35:49]
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 41 min ago
[exit 0]
--- 60 s later, 15:36:50:
(end of lume mutation processes)
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [15:36:51]
slot 1: free
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used 42 min ago
[exit 0]
```

Observation: Row 7.5, re-run: from a free slot 1, the driver of `vm up ios` (pid 66507) was killed with SIGKILL as soon as its child `lume clone app-qa-golden app-qa-slot-1` (pid 67087) was seen; the driver printed nothing. The next `vm status` printed `lane: sweep: deleted app-qa-slot-1 (starting lease of dead pid 66507)` and `lane: sweep: freed slot-1`; afterwards no `lume clone|stop|delete` process for a slot runs, `lume ls` lists no `app-qa-slot-1`, slot 1 is free, and 60 s later (15:36:50Z) no clone of that name reappeared. Deviation: unlike wave 6, the clone child had already ended by the first `ps` after the kill (an APFS clone takes well under a second), so this run does not show the sweep waiting for a live child; that ordering is covered by the *test* rows `lease: mutation - a starting slot of a dead driver is freed only after the lume clone it left has ended` and `... closing slot ... lume delete ...` (lines 36-37 of `qa-test-log.txt`, passing on this head). The stale slot-2 record of f1c (`ready`, targets=none) is the leftover of reclaim-nc's refused start (see `lease-parallel.md`).

Verdict: PASS
