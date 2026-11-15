# reclaim-nc

Run 2026-11-15T19:05:10+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
ssh: settle: load 7.57 below 8 CPUs after 205 s
ssh: ios: 6482C5CB-EDCF-4CE8-9E22-465BF30EABA5
vm up: app-qa-slot-1 holds ios
[exit 0]
```

vm up took 285 s.

Lane file `idleMinutes` set to 1 for this row (restored to 30 afterwards).

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status   # 75 s into the flow
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=31442 holder=none busy=33365 last used 1 min ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=ios forward=11337 holder=none busy=none last used 6 min ago
```

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.26 'xcrun simctl spawn booted launchctl list | grep '\''UIKitApplication:eu.onara.app.kmp'\'' | awk '\''{print $1}'\'''
3976
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
lane: preflight ios runs in app-qa-slot-2 (slot 2)
PASS driver: maestro 2.12.1
PASS tools: xcrun simctl
PASS device: D9D073C6-0F91-4707-8955-5E2B54542BF3
PASS backend: http://127.0.0.1:8081/actuator/health UP
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
vm up: no free slot; every slot is held or used within 1 min:
  slot 1: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1 (ready, last used 1 min ago)
  slot 2: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c (ready, last used less than a minute ago)
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
vm up: a routed command of this worktree's lease runs (pid 33365); wait for it to finish
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: a routed command of this worktree's lease runs (pid 33365); wait for it to finish
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-wait.yaml --account 1 --expect home   # started 19:02:03 in the background, ended 19:05:05
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
device: 6482C5CB-EDCF-4CE8-9E22-465BF30EABA5
root: (not kept)
out: $HOST_TMP/T/app-qa-out-kNY1WD
sweep: deleted out/2026-11-15_100207/f1-signin-wait/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_100207/maestro.log
sweep: redacted out/2026-11-15_100207/f1-signin-wait/logs/device-simulator.log
sweep: redacted out/2026-11-15_100207/f1-signin-wait/logs/maestro.log
PASS f1-signin-wait 163.5s
[exit 0]
```

Guest app pid (launchctl in the simulator) and forward pid before the refusals: 3976, 31442; after: 3976, 31442. Busy marker pid 33365 in `vm status`.

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/reclaim-nc.md`)

#### Case: a sweep during another worktree's start

Covering test(s), verbatim:
- `lease: starting - vm status during another worktree's starting vm up deletes nothing and leaves its lease`

##### Control 1

- Broken line(s):
  - qa.mjs:1723
    - before: `if (l.holder !== null && alive(l.holder)) continue;\n      const why`
    - after: `if (false) continue;\n      const why`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-nc-1/qa.mjs node --test --test-name-pattern='lease: starting' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1270:1
✖ lease: starting - vm status during another worktree's starting vm up deletes nothing and leaves its lease (1298.719084ms)
  Error: ENOENT: no such file or directory, open '$HOST_TMP/T/qa-test-HXgi6m/tmp/app-qa/vm/slot-1/lease.json'
      at readFileSync (node:fs:624:20)
      at readJson (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:637:36)
      at L.lease (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:749:20)
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1278:18)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: '$HOST_TMP/T/qa-test-HXgi6m/tmp/app-qa/vm/slot-1/lease.json'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: a routed command during a reclaim

The controls of this case come from `s-reclaim-nc-b.json`; they replace the 1 control(s) of `s-reclaim-nc.json` for this case, of which one left the test passing on this head as well (`/tmp/aqvl/controls-head/reclaim-nc-b.md` and the base run).

Covering test(s), verbatim:
- `lease: admit - during a reclaim whose delete is held a routed command of the reclaimed worktree exits 2 and runs no guest command`

Three guards refuse the routed command during the reclaim: the lease state check (admitRouted), the not-running clone check (the reclaim already stopped the clone) and the dead-forward check (finishTeardown already killed the forward). Breaking the state check alone, and the state plus clone checks, left the test passing; the control breaks all three.

##### Control 1

- Broken line(s):
  - qa.mjs:2288
    - before: `if (lease.state !== 'ready') return { refuse: `this worktree's lease is ${lease.state}` };`
    - after: `if (false) return {};`
  - qa.mjs:2496
    - before: `if (!ip) {\n      say(`lane: ${lease.clone} is not running; ${restart}`);`
    - after: `if (false) {\n      say(`lane: ${lease.clone} is not running; ${restart}`);`
  - qa.mjs:2500
    - before: `if (lease.forward && !alive(lease.forward.pid)) {\n      say(`lane: the port forward of ${lease.clone} is not running; ${restart}`);`
    - after: `if (false) {\n      say(`lane: the port forward of ${lease.clone} is not running; ${restart}`);`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-nc-b-1/qa.mjs node --test --test-name-pattern='lease: admit - during a reclaim' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1216:1
✖ lease: admit - during a reclaim whose delete is held a routed command of the reclaimed worktree exits 2 and runs no guest command (3876.145667ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  1 !== 0
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1228:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: a killed teardown

Covering test(s), verbatim:
- `lease: closing - a vm down killed before stop is completed by the next vm status`
- `lease: closing - a vm down killed between stop and delete is completed by the next vm status`
- `lease: closing - a vm down killed after delete before the slot removal is completed by the next vm status`

The broken copy never queues the teardown of a closing lease whose holder died.

##### Control 1

- Broken line(s):
  - qa.mjs:1726
    - before: `torn.push({ n, clone: l.clone, forward: l.forward, why });`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-nc-3/qa.mjs node --test --test-name-pattern='lease: closing - a vm down killed' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 3, pass 0, fail 3, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1307:3
✖ lease: closing - a vm down killed before stop is completed by the next vm status (2011.459084ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
  +   'app-qa-slot-1'
  + ]
  - []
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1321:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 'app-qa-slot-1' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1307:3
✖ lease: closing - a vm down killed between stop and delete is completed by the next vm status (1486.065ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
  +   'app-qa-slot-1'
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 3, pass 3, fail 0, exit 0

## Observation

With `idleMinutes: 1`, 75 s into a routed 3-minute flow: a third `vm up ios` (from `app-qa-vm-f1b`, which holds no lease) is refused because slot 1 is busy and slot 2 was used less than a minute before; the flow's own worktree gets exit 2 for `vm up ios` and `vm down`, each naming the busy pid 33365; guest app pid (3976) and forward pid (31442) are unchanged; the flow finishes PASS. Each named test case has a broken-copy control that failed and passes on the real driver.

## Verdict

PASS
