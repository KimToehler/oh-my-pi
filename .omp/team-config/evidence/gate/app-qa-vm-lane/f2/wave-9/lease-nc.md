# lease-nc

Run 2026-11-17T14:20:00Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `rows3.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
--- state from lease-parallel just before (both slots recorded: f1 ready with ios in slot 1; f1b's slot-2 start failed and left its lease `ready` with targets=none, clone app-qa-slot-2 stopped):
after both starts at 2026-11-17T14:27:52Z:
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [14:27:55]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=75382 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=none forward=none holder=none busy=none last used less than a minute ago
[exit 0]

--- lease-nc:
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 stopped
app-qa-slot-2 stopped
kmp-sc-f1 running
wv-f1-human stopped
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1c && qa.mjs vm up ios)  [14:29:40]
vm up: no free slot; every slot is held or used within 30 min:
  slot 1: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 (ready, last used less than a minute ago)
  slot 2: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b (ready, last used 2 min ago)
[exit 2]
4c4
< app-qa-slot-1 stopped
---
> app-qa-slot-1 running
```

Observation: With slot 1 held by f1 and slot 2 recorded for f1b (both used within the 30 min idle limit), `vm up ios` in a third worktree (f1c) exits 2 with `vm up: no free slot; every slot is held or used within 30 min:` and one line per slot naming its worktree, state and last use; it starts nothing: `lume ls` before and after differs only in `app-qa-slot-1`'s listed status (`stopped` vs `running`, lume's unreliable status for a `--vnc disabled` run, design D5), and no new `app-qa-slot-*` appears. Deviation: f1b's slot-2 clone never ran (its `lume run` was refused by Apple's two-macOS-guest limit, because another session's macOS VM `kmp-sc-f1` was running; `~/Library/Logs/lume/app-qa-slot-2.log`, see `lease-parallel.md`), so slot 2 was held by a recorded lease rather than a running clone; admission reads the records, so the refusal is the one this row checks.

Verdict: PASS
