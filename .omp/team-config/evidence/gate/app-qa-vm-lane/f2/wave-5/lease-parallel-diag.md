# lease-parallel-diag (parent, not the row's evidence)

Run 2026-11-16T16:04:03Z on head `71072693cc0f650f4ff974c31f164907f4b89d70` (deployed). Home paths are written as `~`. Purpose: a second simultaneous attempt after `lease-parallel` FAILed (f1b's sign-in timed out waiting for "Username or email"), with guest and host one/five/fifteen-minute load sampled every 10 s during the flows (`sysctl -n vm.loadavg` on the host and over ssh in each clone; samples where the guest ssh did not answer within 5 s have no guest value) and failure roots kept. Script: `/tmp/aqvl/w5-pdiag.sh`.

```
lock: "CGSSessionScreenIsLocked"=Yes
slot 1: free
slot 2: free
== vm up f1
start 16:04:03
ssh: settle: load 7.85 below 8 CPUs after 261 s
ssh: ios: 0D3FBFE3-4350-4DEA-805F-5423E78C7CA0
vm up: app-qa-slot-1 holds ios
[exit 0] end 16:11:51
== vm up f1b
start 16:04:03
ssh: settle: load 7.56 below 8 CPUs after 281 s
ssh: ios: 4B9F2D6C-35EA-4F02-A897-9E124204AB57
vm up: app-qa-slot-2 holds ios
[exit 0] end 16:11:34
slot 1: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=56793 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-2 targets=ios forward=56693 holder=none busy=none last used less than a minute ago
app-qa-slot-1 running 192.168.64.88
app-qa-slot-2 running 192.168.64.87
== flow f1
start 16:12:07
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 0D3FBFE3-4350-4DEA-805F-5423E78C7CA0
root: (not kept)
out: /tmp/aqvl/w5pd/out-f1
screenshot: /tmp/aqvl/w5pd/out-f1/f1-home.png
PASS f1-signin-home 68.4s
[exit 0] end 16:13:56
== flow f1b
start 16:12:07
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 4B9F2D6C-35EA-4F02-A897-9E124204AB57
root: (not kept)
out: /tmp/aqvl/w5pd/out-f1b
screenshot: /tmp/aqvl/w5pd/out-f1b/f1-home.png
PASS f1-signin-home 66.4s
[exit 0] end 16:13:51
== load
lock: "CGSSessionScreenIsLocked"=Yes
```

Observation: both `vm up ios` exited 0 at once (7 min 48 s and 7 min 31 s); both flows PASS (68.4 s, 66.4 s) while the host load was 28-42 on 18 cores and the guest load of slot 1 rose from 8 to 20 on 8 vCPUs. The `lease-parallel` failure did not recur: it is intermittent under load (the same SSO wait failed in F1's first parallel pair; waves 2 and 4 passed). This attempt does not change the row's verdict.

Verdict: PASS (diagnostic attempt; `lease-parallel` stays FAIL)
