# lane-nc

Run 2026-11-17T13:14:16Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -r`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Run by the parent. Wave 9 re-runs every lane row after fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`); this row ran in `/tmp/aqvl/w9/rows2.sh` (quoted in `rows-script.md`), whose guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `HostKeyAlias=app-qa-golden`, the lane's `knownHosts` file).

## Commands and output

```
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
kmp-sc-f1 running
wv-f1-human stopped
sub-case 1: slots renamed slotz
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:14:28]
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: slotz: unknown key
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: slots: missing
[exit 2]
sub-case 2: image removed
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs preflight ios)  [13:14:29]
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: image: missing
[exit 2]
sub-case 3: image app-qa-slot-golden
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [13:14:29]
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: image: "app-qa-slot-golden" lies in app-qa-slot-, the namespace of the lane's clones
[exit 2]
sub-case 4: knownHosts removed
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [13:14:29]
lane: /Users/[redacted]/.omp/agent/app-qa-vm.json: knownHosts: missing
[exit 2]
$ cmp lane-file backup ~/.omp/agent/app-qa-vm.json
identical
lume ls unchanged
```

Observation: lane file variants of the wave's pinned lane file: `slots` misspelled `slotz` (exit 2: unknown key plus `slots: missing`), `image` removed (exit 2), `image` `app-qa-slot-golden` (exit 2 naming the clone namespace) and, new with fix 7.12, `knownHosts` removed (exit 2: `knownHosts: missing`) are each refused before any lume or ssh call; `lume ls` is unchanged and the lane file restored (`cmp` identical).

Verdict: PASS
