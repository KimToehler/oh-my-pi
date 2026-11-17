# route-lost

Run 2026-11-15T19:06:39+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

`vm status` before: `slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=31442 holder=none busy=none last used less than a minute ago`

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home   # started; 20 s later on the host: kill 31442 (the lease forward)
lane: flow ios runs in app-qa-slot-1 (slot 1)
lane: infrastructure lost during the run (forward); this is not an app result, run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
guest (not an app result): credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/.dev-credentials.env
guest (not an app result): device: 6482C5CB-EDCF-4CE8-9E22-465BF30EABA5
guest (not an app result): root: $HOST_TMP/T/app-qa-root-4UwhIL
guest (not an app result): out: $HOST_TMP/T/app-qa-out-W2M0ly
guest (not an app result): sweep: deleted out/2026-11-15_100539/f1-signin-home/commands.json
guest (not an app result): FAIL f1-signin-home 31.9s: Assertion is false: "Username or email" is visible
guest (not an app result): root kept: $HOST_TMP/T/app-qa-root-4UwhIL
[exit 2]
```

killed forward pid 31442 at 19:05:53

`qa.mjs scan $HOST_TMP/app-qa-out-W2M0ly`: exit 0

`qa.mjs scan $HOST_TMP/app-qa-root-4UwhIL`: exit 0

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/route-lost.md`)

#### Case: stopped clone

Covering test(s), verbatim:
- `route: stopped - a clone that is not running exits 2 naming vm up and leaves no busy marker`
- `route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix`

First test: clone stopped before the routed command. Second test: LOSSES entry 'clone stopped' (clone stopped while the guest driver pauses).

##### Control 1

- Broken line(s):
  - qa.mjs:2496
    - before: `if (!ip) {\n      say(`lane: ${lease.clone} is not running; ${restart}`);`
    - after: `if (false) {\n      say(`lane: ${lease.clone} is not running; ${restart}`);`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-lost-1/qa.mjs node --test --test-name-pattern='route: stopped' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1873:1
✖ route: stopped - a clone that is not running exits 2 naming vm up and leaves no busy marker (2739.044625ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  1 !== 0
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1880:10)
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

##### Control 2

- Broken line(s):
  - qa.mjs:2520
    - before: `if (!ipAfter) lost = 'clone';`
    - after: `if (false) lost = 'clone';`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-lost-2/qa.mjs node --test --test-name-pattern='route: lost - a dependency lost' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1946:1
✖ route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix (6755.518041ms)
  AssertionError [ERR_ASSERTION]: clone stopped: lane: preflight ios runs in app-qa-slot-1 (slot 1)
  PASS guest check
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1955:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 2,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: dropped connection

The controls of this case come from `s-route-lost-b.json`; they replace the 2 control(s) of `s-route-lost.json` for this case, of which one left the test passing on this head as well (`/tmp/aqvl/controls-head/route-lost-b.md` and the base run).

Covering test(s), verbatim:
- `route: unreachable - ssh exiting 255 before the guest command exits 2 naming vm up and leaves no busy marker`
- `route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix`

First test: ssh exits 255 before the guest command. Second test: its last block, ssh exit 255 after the guest command (L.setSsh({ exit255: 'after' })); the forward-probe 255 branch is a second route to lost=connection but the test's setup uses the exit status. Control 2 disables the 255 branch together with the forward-probe branch, because the probe's own 255 answer also yields lost=connection (disabling only the status===255 line left the test passing: tests 1, pass 1, fail 0).

##### Control 1

- Broken line(s):
  - qa.mjs:2506
    - before: `if (result.head.length < 3) {`
    - after: `if (false) {`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-lost-b-1/qa.mjs node --test --test-name-pattern='route: unreachable' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1905:1
✖ route: unreachable - ssh exiting 255 before the guest command exits 2 naming vm up and leaves no busy marker (2880.173ms)
  AssertionError [ERR_ASSERTION]: lane: preflight ios runs in app-qa-slot-1 (slot 1)
  file:///private$HOST_TMP/T/qa-test-jc03MT/driver/scripts/qa.mjs:2515
      const guestTmp = result.head[2].replace(/\/+$/, '');
                                      ^
  
  TypeError: Cannot read properties of undefined (reading 'replace')
      at cmdRouted (file:///private$HOST_TMP/T/qa-test-jc03MT/driver/scripts/qa.mjs:2515:37)
      at async file:///private$HOST_TMP/T/qa-test-jc03MT/driver/scripts/qa.mjs:2601:82
  
  Node.js v26.13.0
  
  
  1 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1910:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 2,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:2521
    - before: `else if (result.status === 255) lost = 'connection';\n    else if (lease.forward) {`
    - after: `else if (false) {`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-lost-b-2/qa.mjs node --test --test-name-pattern='route: lost - a dependency lost' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1946:1
✖ route: lost - a dependency lost during the guest run gives exit 2, the infrastructure line first after the lane line, and the guest PASS only behind its prefix (5384.725334ms)
  AssertionError [ERR_ASSERTION]: forward killed: lane: preflight ios runs in app-qa-slot-1 (slot 1)
  PASS guest check
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1955:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 2,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

## Observation

Killing the lease forward 20 s into a routed sign-in flow gives exit 2 with the infrastructure line naming the forward as the first line after the lane line, no line starting with `PASS`, the guest lines only behind `guest (not an app result):`, and the returned folders printed (both scans exit 0). The stopped-clone and dropped-connection cases are covered by named tests; each has a broken-copy control that failed, and the tests pass on the real driver.

## Verdict

PASS
