# hostkey-nc

Run 2026-11-17T12:33:50Z on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed: the installed `~/.omp/agent/skills/app-qa-drivers` is `diff -rq`-identical to the head's `team-config/agent/skills/app-qa-drivers`; `f2/wave-9/deployed-rev.txt`). Home paths are written as `~`, the host's `$TMPDIR` as `$HOST_TMP`. Host screen locked (`"CGSSessionScreenIsLocked"=Yes`) before and after; run by the parent. Wave 9 is the closing wave of fix 7.12 (the lane authenticates every guest by the host key pinned in the lane file's `knownHosts`): one script (`/tmp/aqvl/w9/rows.sh`, quoted in `rows-script.md`) ran `hostkey-nc` and then every row that exercises a lane ssh consumer, in order; its own guest inspections use the same pinned key (`StrictHostKeyChecking=yes`, `UserKnownHostsFile` = the pin, `HostKeyAlias=app-qa-golden`).

## Commands and output

```
### hostkey-nc
lane file knownHosts -> /tmp/aqvl/w9/out/foreign_known_hosts (holds an unrelated ed25519 key under app-qa-golden)
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:33:50]
slot 1: free
slot 2: free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm up ios)  [12:33:51]
vm up: app-qa-slot-1 at 192.168.64.125 does not present the host key pinned for app-qa-golden in /tmp/aqvl/w9/out/foreign_known_hosts; nothing was copied (vm-image.md, step "Pin the host key")
[exit 2]
lane file restored: knownHosts -> ~/.omp/agent/app-qa-vm_known_hosts
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:34:20]
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=none holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
$ lume ls (name, status)
app-qa-build stopped
app-qa-golden stopped
app-qa-slot-1 running
kmp-sc-f1 running
wv-f1-human stopped
$ guest: ls -la ~/work 2>&1; find ~ -name ".dev-credentials.env" 2>/dev/null; echo "credentials files found: $(find ~ -name .dev-credentials.env 2>/dev/null | wc -l | tr -d " ")"
total 0
drwxr-xr-x   2 lume  staff   64 Nov 15 01:47 .
drwxr-xr-x@ 16 lume  staff  512 Nov 15 02:19 ..
credentials files found: 0
[exit 0]
$ guest: xcrun simctl list devices booted; pgrep -fl "eu.onara.app.MainKt" || echo "no desktop app"
== Devices ==
-- iOS 26.4 --
no desktop app
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm down)  [12:34:31]
vm down: deleted app-qa-slot-1, slot 1 is free
[exit 0]
$ (cd ~/git/onara/.worktrees/app-qa-vm-f1 && qa.mjs vm status)  [12:34:39]
slot 1: free
slot 2: free
[exit 0]
```

Observation: with the lane file's `knownHosts` pointing at a file that pins an unrelated ed25519 key under `app-qa-golden`, `vm up ios` cloned and booted `app-qa-slot-1` and then exited 2 naming the pinned file (`does not present the host key pinned for app-qa-golden in .../foreign_known_hosts; nothing was copied`). With the real pin restored, an inspection over ssh that authenticates the clone by that pin found `~/work` empty and no `.dev-credentials.env` anywhere in the guest home (0 files), no booted simulator and no desktop app: neither the credentials file, a staged target nor a routed command reached the clone. The slot kept the clone with `targets=none`; `vm down` deleted it (exit 0) and both slots were free.

Verdict: PASS
