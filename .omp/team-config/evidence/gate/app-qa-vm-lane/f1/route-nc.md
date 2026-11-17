# route-nc

Run 2026-11-15T19:06:40+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios forward=31442 holder=none busy=none last used less than a minute ago
slot 2: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1c clone=app-qa-slot-2 targets=ios forward=11337 holder=none busy=none last used 2 min ago
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: this worktree's lease did not stage desktop; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
```

The lease forward was killed on the host by the `route-lost` row (pid 31442) and not restarted.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
lane: the port forward of app-qa-slot-1 is not running; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
```

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/route-nc.md`)

#### Case: another worktree's lease

Covering test(s), verbatim:
- `route: nolease - with no lease, and with a lease only another worktree holds, desktop attach exits 2 naming vm up desktop and runs nothing on the host`
- `route: other - a worktree never runs in another worktree's clone`

##### Control 1

- Broken line(s):
  - qa.mjs:1753
    - before: `if (slot.lease?.worktree === worktree) return { n, lease: slot.lease };`
    - after: `if (slot.lease) return { n, lease: slot.lease };`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-nc-1/qa.mjs node --test --test-name-pattern='route: (nolease|other) ' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1839:1
✖ route: nolease - with no lease, and with a lease only another worktree holds, desktop attach exits 2 naming vm up desktop and runs nothing on the host (4160.488ms)
  AssertionError [ERR_ASSERTION]: lane: desktop desktop runs in app-qa-slot-1 (slot 1)
  PASS guest check
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1847:10)
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

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1853:1
✖ route: other - a worktree never runs in another worktree's clone (3023.855334ms)
  AssertionError [ERR_ASSERTION]: lane: preflight ios runs in app-qa-slot-1 (slot 1)
  PASS guest check
  
  
  0 !== 2
  
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: a lease not ready

Covering test(s), verbatim:
- `lease: admit - a routed command against a lease that is not ready for its target exits 2 naming vm up and runs no guest command`

##### Control 1

- Broken line(s):
  - qa.mjs:2288
    - before: `if (lease.state !== 'ready') return { refuse: `this worktree's lease is ${lease.state}` };`
    - after: `if (false) return { refuse: `this worktree's lease is ${lease.state}` };`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-route-nc-2/qa.mjs node --test --test-name-pattern='lease: admit - a routed command' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1156:1
✖ lease: admit - a routed command against a lease that is not ready for its target exits 2 naming vm up and runs no guest command (3701.326625ms)
  AssertionError [ERR_ASSERTION]: a closing lease: lane: preflight ios runs in app-qa-slot-1 (slot 1)
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1162:12)
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

`desktop attach` on an ios-only lease exits 2 naming `vm up desktop`; `preflight ios` with the forward killed exits 2 naming `vm up ios`. Another worktree's lease and a lease that is not ready are covered by named tests with failing broken-copy controls; the tests pass on the real driver.

## Verdict

PASS
