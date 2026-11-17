# lease-parallel-rootcause (fix round 5, parent; not a row's evidence)

Purpose: B1 of the wave-5 strategic-risk review (`lease-parallel` FAIL: f1b's sign-in timed out at `Assertion is false: "Username or email" is visible` after 39.1 s while f1 passed). Four rounds, each: `vm up ios` in app-qa-vm-f1 and app-qa-vm-f1b at the same moment (fresh clones), then both sign-in flows (`f1-signin-home.yaml`) at the same moment, host and guest load sampled every 10 s during the flows (`sysctl -n vm.loadavg`). Driver: the deployed wave-5 driver (71072693cc0f650f4ff974c31f164907f4b89d70), the B2 fix not deployed. Script `/tmp/aqvl/r5/b1-diag.sh`; host-load sample lines are left out below, summarized in Load. Home paths are written as `~`.

## Result

4 of 4 rounds, 8 of 8 flows PASS (46-71 s), host screen locked throughout, no root kept, both clones deleted afterwards. The wave-5 failure did not reproduce. Its kept root (`app-qa-root-uyvgzj`) no longer exists on the host, so the failing guest's Maestro log and screenshot cannot be read: the cause stays unattributed.

The wait that failed is the onara flow's own: `extendedWaitUntil visible "Username or email" timeout: 30000` (`app_kmp/maestro/signin-ios.yaml:30-32`), the external Keycloak page (`sso.quati.de`) in the guest simulator's web authentication sheet. Host load during the passing flows was 1.1-2.3 times the host's CPUs; the failing attempt had no load sampling.

## Load (1-minute load average during the flows)

```
b1/load-1.txt host1m 25.0-41.2 guest1m max 27.4 n=12
b1/load-2.txt host1m 21.1-31.4 guest1m max 4.6 n=8
b1/load-3.txt host1m 20.6-26.8 guest1m max 6.8 n=8
b1/load-4.txt host1m 19.7-26.3 guest1m max 10.2 n=8
w5pd/load.txt host1m 28.0-42.2 guest1m max 19.7 n=12
host cpus: 18
```

## Log

```
lock: "CGSSessionScreenIsLocked"=Yes
slot 1: free
slot 2: free
=== round 1
-- vm up f1
start 16:59:58
ssh: settle: load 7.99 below 8 CPUs after 261 s
ssh: ios: CA0CDE32-5180-494C-8E6B-A98E3821F6A4
vm up: app-qa-slot-2 holds ios
[exit 0] end 17:07:25
-- vm up f1b
start 16:59:58
ssh: settle: load 7.67 below 8 CPUs after 271 s
ssh: ios: A01496E7-8604-43BF-B8A8-9E476A4D5A75
vm up: app-qa-slot-1 holds ios
[exit 0] end 17:07:58
-- flow f1
start 17:08:13
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: CA0CDE32-5180-494C-8E6B-A98E3821F6A4
root: (not kept)
out: /tmp/aqvl/r5/b1/out-1-f1
screenshot: /tmp/aqvl/r5/b1/out-1-f1/f1-home.png
PASS f1-signin-home 70.6s
[exit 0] end 17:10:03
-- flow f1b
start 17:08:13
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: A01496E7-8604-43BF-B8A8-9E476A4D5A75
root: (not kept)
out: /tmp/aqvl/r5/b1/out-1-f1b
screenshot: /tmp/aqvl/r5/b1/out-1-f1b/f1-home.png
PASS f1-signin-home 69.7s
[exit 0] end 17:09:59
-- load
=== round 2
-- vm up f1
start 17:10:09
ssh: settle: load 7.92 below 8 CPUs after 215 s
ssh: ios: 1225CB79-3A6F-4199-B2F2-2268FE063F1F
vm up: app-qa-slot-2 holds ios
[exit 0] end 17:16:00
-- vm up f1b
start 17:10:09
ssh: settle: load 7.51 below 8 CPUs after 210 s
ssh: ios: 983F3827-56EA-4940-878F-DA9A224FD3BD
vm up: app-qa-slot-1 holds ios
[exit 0] end 17:15:07
-- flow f1
start 17:16:14
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 1225CB79-3A6F-4199-B2F2-2268FE063F1F
root: (not kept)
out: /tmp/aqvl/r5/b1/out-2-f1
screenshot: /tmp/aqvl/r5/b1/out-2-f1/f1-home.png
PASS f1-signin-home 49.1s
[exit 0] end 17:17:18
-- flow f1b
start 17:16:14
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: 983F3827-56EA-4940-878F-DA9A224FD3BD
root: (not kept)
out: /tmp/aqvl/r5/b1/out-2-f1b
screenshot: /tmp/aqvl/r5/b1/out-2-f1b/f1-home.png
PASS f1-signin-home 48s
[exit 0] end 17:17:18
-- load
=== round 3
-- vm up f1
start 17:17:25
ssh: settle: load 7.92 below 8 CPUs after 180 s
ssh: ios: C6CF6D44-DDC8-46DB-8E05-67F7CE5C4CBF
vm up: app-qa-slot-2 holds ios
[exit 0] end 17:21:33
-- vm up f1b
start 17:17:25
ssh: settle: load 7.72 below 8 CPUs after 175 s
ssh: ios: ACE4E163-478F-4B37-83AD-632635A63EFB
vm up: app-qa-slot-1 holds ios
[exit 0] end 17:22:29
-- flow f1
start 17:22:42
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: C6CF6D44-DDC8-46DB-8E05-67F7CE5C4CBF
root: (not kept)
out: /tmp/aqvl/r5/b1/out-3-f1
screenshot: /tmp/aqvl/r5/b1/out-3-f1/f1-home.png
PASS f1-signin-home 46s
[exit 0] end 17:23:43
-- flow f1b
start 17:22:42
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: ACE4E163-478F-4B37-83AD-632635A63EFB
root: (not kept)
out: /tmp/aqvl/r5/b1/out-3-f1b
screenshot: /tmp/aqvl/r5/b1/out-3-f1b/f1-home.png
PASS f1-signin-home 46.8s
[exit 0] end 17:23:43
-- load
=== round 4
-- vm up f1
start 17:23:53
ssh: settle: load 7.68 below 8 CPUs after 200 s
ssh: ios: C11F4612-D72B-4C83-9EAF-895805F64552
vm up: app-qa-slot-2 holds ios
[exit 0] end 17:28:20
-- vm up f1b
start 17:23:53
ssh: settle: load 7.53 below 8 CPUs after 215 s
ssh: ios: DCF63D08-CFAE-474F-B2CC-FD4F4C27A5A9
vm up: app-qa-slot-1 holds ios
[exit 0] end 17:29:10
-- flow f1
start 17:29:23
lane: flow ios runs in app-qa-slot-2 (slot 2)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: C11F4612-D72B-4C83-9EAF-895805F64552
root: (not kept)
out: /tmp/aqvl/r5/b1/out-4-f1
screenshot: /tmp/aqvl/r5/b1/out-4-f1/f1-home.png
PASS f1-signin-home 47.9s
[exit 0] end 17:30:26
-- flow f1b
start 17:29:23
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: DCF63D08-CFAE-474F-B2CC-FD4F4C27A5A9
root: (not kept)
out: /tmp/aqvl/r5/b1/out-4-f1b
screenshot: /tmp/aqvl/r5/b1/out-4-f1b/f1-home.png
PASS f1-signin-home 49.6s
[exit 0] end 17:30:27
-- load
vm down: deleted app-qa-slot-2, slot 2 is free
vm down: deleted app-qa-slot-1, slot 1 is free
slot 1: free
slot 2: free
lume slots left: 0
== kept roots
lock: "CGSSessionScreenIsLocked"=Yes
```
