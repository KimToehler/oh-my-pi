# reclaim-crash

Run 2026-11-15T19:50:31+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=13958 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios   # pid 36972; `lume ls` polled every second; SIGKILL 18 s after start, once `app-qa-slot-2` was listed

[killed: -9]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1","app-qa-slot-2"]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) pgrep -fl 'lume (clone|run)' || echo no-lume-child
37256 ~/.local/share/lume/lume.app/Contents/MacOS/lume run --display none --vnc disabled app-qa-slot-2
57014 ~/.local/share/lume/lume.app/Contents/MacOS/lume run --display none --vnc disabled app-qa-slot-1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
lane: sweep: deleted app-qa-slot-2 (starting lease of dead pid 36972)
lane: sweep: freed slot-2
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=13958 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1"]
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) pgrep -fl 'lume run .*app-qa-slot-2' || echo no-slot-2-run
no-slot-2-run
[exit 0]
```

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/reclaim-crash.md`)

#### Case: a stale table lock

Covering test(s), verbatim:
- `lease: stale-lock - a table lock left by a dead pid is taken over by the next vm status`
- `lease: stale-lock - a table lock whose holder never wrote its pid is taken over too`

The broken copy never takes over a lock of a dead holder, so the status command waits for the 60 s lock deadline and then throws.

##### Control 1

- Broken line(s):
  - qa.mjs:1570
    - before: `if (holder === null || !alive(holder)) {\n      takeOverLock(dir, holder);`
    - after: `if (false) {\n      takeOverLock(dir, holder);`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-crash-1/qa.mjs node --test --test-name-pattern='lease: stale-lock' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1100:1
✖ lease: stale-lock - a table lock left by a dead pid is taken over by the next vm status (60944.06075ms)
  AssertionError [ERR_ASSERTION]: vm status: the table lock $HOST_TMP/T/qa-test-ZW3TGa/tmp/app-qa/vm/table.lock stays held by pid 38823
  
  
  2 !== 0
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1105:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 2,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1113:1
✖ lease: stale-lock - a table lock whose holder never wrote its pid is taken over too (61807.551292ms)
  AssertionError [ERR_ASSERTION]: vm status: the table lock $HOST_TMP/T/qa-test-RAmgja/tmp/app-qa/vm/table.lock stays held by pid null
  
  
  2 !== 0
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1117:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: a death between slot creation and its record

Covering test(s), verbatim:
- `lease: publish - a vm up killed after creating slot-N before its record is recovered by one vm status`
- `lease: publish - slot-1 without a record, a dead-pid table lock and a listed clone are recovered by one vm status`

The broken copy writes the closing record for a record-less slot but never queues its teardown, so the slot stays.

##### Control 1

- Broken line(s):
  - qa.mjs:1710
    - before: `torn.push({ n, clone: cloneName(n), forward: null, why: 'a partial slot' });`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-crash-2/qa.mjs node --test --test-name-pattern='lease: publish' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1405:1
✖ lease: publish - a vm up killed after creating slot-N before its record is recovered by one vm status (2196.276625ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
  +   'slot-1'
  + ]
  - []
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1423:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 'slot-1' ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1434:1
✖ lease: publish - slot-1 without a record, a dead-pid table lock and a listed clone are recovered by one vm status (1680.22675ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
  + [
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: an orphan met by two sweeps and a vm up

Covering test(s), verbatim:
- `lease: orphan - with the orphan's delete held a second sweep leaves it alone and vm up never takes slot 2 until it is free`
- `lease: orphan - an orphan app-qa-slot-2 is deleted by the sweep, printed by name`

Control 1: the second sweep takes over a closing lease whose holder (the first sweep) is alive. Control 2: vm up takes a slot whose directory exists (the orphan's reservation). Control 3: the sweep deletes the orphan without reserving it first (test 1 only, 'reserved before the delete').

##### Control 1

- Broken line(s):
  - qa.mjs:1723
    - before: `if (l.holder !== null && alive(l.holder)) continue;\n      const why`
    - after: `if (false) continue;\n      const why`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-crash-3/qa.mjs node --test --test-name-pattern='lease: orphan - with the orphan' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1371:1
✖ lease: orphan - with the orphan's delete held a second sweep leaves it alone and vm up never takes slot 2 until it is free (2868.555208ms)
  AssertionError [ERR_ASSERTION]: the second sweep deleted the orphan the first sweep holds
  
  2 !== 1
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1384:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 2,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:183:1
✖ ~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs (406.854417ms)
  AssertionError [ERR_ASSERTION]: processes of the tests are still alive after teardown
  + actual - expected
  
  + [
  +   41510
  + ]
  - []
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:191:10)
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:1779
    - before: `if (existsSync(slotPath(n))) continue;\n      const listed = lumeList();`
    - after: `if (false) continue;\n      const listed = lumeList();`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-crash-4/qa.mjs node --test --test-name-pattern='lease: orphan - with the orphan' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1371:1
✖ lease: orphan - with the orphan's delete held a second sweep leaves it alone and vm up never takes slot 2 until it is free (10304.449875ms)
  AssertionError [ERR_ASSERTION]: vm up: EEXIST: file already exists, mkdir '$HOST_TMP/T/qa-test-BJbQ2v/tmp/app-qa/vm/slot-1'
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1401:10)
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

##### Control 3

- Broken line(s):
  - qa.mjs:1703
    - before: `mkdirSync(slotPath(n), { mode: 0o700 });\n        writeLease(n, { ...newLease(n, null, 'closing'), lastUsed: Date.now() });\n        torn.push`
    - after: `torn.push`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reclaim-crash-5/qa.mjs node --test --test-name-pattern='lease: orphan - an orphan app-qa-slot-2' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1360:1
✖ lease: orphan - an orphan app-qa-slot-2 is deleted by the sweep, printed by name (1795.692292ms)
  AssertionError [ERR_ASSERTION]: reserved before the delete
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1368:10)
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

A `vm up ios` killed with SIGKILL 18 s after start, once `app-qa-slot-2` was in `lume ls` and its `lume run` was running; the next `vm status` printed `deleted app-qa-slot-2 (starting lease of dead pid 36972)` and `freed slot-2`, showed slot 2 free, `lume ls` no longer lists the clone and its `lume run` ended. Named tests cover the stale table lock, the death before the record and the orphan met by two sweeps and a `vm up`; every broken-copy control failed (the second-sweep control included), and the tests pass on the real driver.

## Verdict

PASS
