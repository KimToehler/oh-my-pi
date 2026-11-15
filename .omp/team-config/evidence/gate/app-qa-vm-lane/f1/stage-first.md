# stage-first

Run 2026-11-15T18:03:39+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
ssh: settle: load 7.88 below 8 CPUs after 231 s
ssh: ios: 69D74232-E8D2-48CD-A535-08C79FD75552
vm up: app-qa-slot-1 holds ios
[exit 0]
```

vm up took 417 s

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=65861 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) { git ls-files -z --cached --others --exclude-standard; find app_kmp/iosApp/build/Build/Products/Debug-iphonesimulator/iosApp.app -type f -print0; } | sort -zu | xargs -0 shasum -a 256 2>/dev/null | sort -k2 > /tmp/aqvl/host-sha.txt; wc -l < /tmp/aqvl/host-sha.txt
    8720
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.23 'cd ~/work/onara && find . -type f ! -path ./.dev-credentials.env -print0 | xargs -0 shasum -a 256 | sed '\''s| \./| |'\'' | sort -k2' > /tmp/aqvl/guest-sha.txt; wc -l < /tmp/aqvl/guest-sha.txt
    8738
[exit 0]
```

Comparison of the two sha lists after NFC-normalizing paths (the guest lists `ä` decomposed) and leaving out the guest's `.git/` (18 files of an empty repository the guest copy holds: HEAD, config, description, hooks samples, no objects): equal = True, 8720 entries each.

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.23 'stat -f "%Lp %N" ~/work/onara/.dev-credentials.env; curl -s -m 5 http://127.0.0.1:8081/actuator/health; echo'
600 /Users/lume/work/onara/.dev-credentials.env
{"groups":["liveness","readiness"],"status":"UP"}
[exit 0]
```

## Observation

The guest file list with sha256 equals the host's `git ls-files --cached --others --exclude-standard` plus the iOS artifact's files (8720 entries). The guest credentials file has mode 600. The guest reaches `http://127.0.0.1:8081/actuator/health` through the forward: status UP. `vm up` printed the settle line: the fresh clone's load fell below its 8 CPUs after 231 s, before the WebKit warm.

## Verdict

PASS
