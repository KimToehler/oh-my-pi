# lease-simul

Run 2026-11-15T19:20:51+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

Test-only row: two starts on one free slot and two starts in one worktree.

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/lease-simul.md`)

#### Case: two starts on one free slot

Covering test(s), verbatim:
- `lease: simultaneous - two worktrees started together for one free slot give one holder, one build and one clone`

Also related (two worktrees, two slots): lease: parallel; not claimed for this case.

##### Control 1

- Broken line(s):
  - qa.mjs:1581
    - before: `const release = lockTable();\n  try {\n    return fn();`
    - after: `const release = () => {};\n  try {\n    return fn();`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-lease-simul-1/qa.mjs node --test --test-name-pattern='lease: simultaneous' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1084:1
✖ lease: simultaneous - two worktrees started together for one free slot give one holder, one build and one clone (2810.846958ms)
  AssertionError [ERR_ASSERTION]: vm up: ENOENT: no such file or directory, mkdir '$HOST_TMP/T/qa-test-eMYifB/tmp/app-qa/vm/slot-1'
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1092:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: two starts in one worktree

Covering test(s), verbatim:
- `lease: same-worktree - two vm up started together give one slot, one build and one exit 2 naming the owner`

##### Control 1

- Broken line(s):
  - qa.mjs:1773
    - before: `if (lease.holder !== null && alive(lease.holder)) {\n        return { refuse: `vm up: this worktree's lease is ${lease.state}`
    - after: `if (false) {\n        return { refuse: `vm up: this worktree's lease is ${lease.state}`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-lease-simul-2/qa.mjs node --test --test-name-pattern='lease: same-worktree' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1050:1
✖ lease: same-worktree - two vm up started together give one slot, one build and one exit 2 naming the owner (3008.965292ms)
  AssertionError [ERR_ASSERTION]: vm up: the worktree lease is in a state vm status could not resolve
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1057:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:1581
    - before: `const release = lockTable();\n  try {\n    return fn();`
    - after: `const release = () => {};\n  try {\n    return fn();`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-lease-simul-3/qa.mjs node --test --test-name-pattern='lease: same-worktree' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1050:1
✖ lease: same-worktree - two vm up started together give one slot, one build and one exit 2 naming the owner (2291.629167ms)
  AssertionError [ERR_ASSERTION]: vm up: ENOENT: no such file or directory, mkdir '$HOST_TMP/T/qa-test-pwSYXi/tmp/app-qa/vm/slot-1'
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1057:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

## Observation

Both cases are covered by named tests (`lease: simultaneous`, `lease: same-worktree`); each has a broken-copy control that failed, and the tests pass on the real driver.

## Verdict

PASS
