# out-nc

Run 2026-11-15T19:50:30+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --out /tmp/aqvl/exists-out
flow: --out /tmp/aqvl/exists-out exists; name a directory that does not exist yet
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/aqvl/td-1794766946
capture: home.png or home.json already exists in /tmp/aqvl/td-1794766946
[exit 2]
```

Guest process count (`ps -axo pid= | wc -l`): before 851, after the flow refusal 851, after the capture refusal 851.

Neither refusal printed a `lane:` line: both were decided on the host before any guest command.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: pid=6066 session=pid-6066
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait sign-in --timeout 60
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=sign-in count=1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap sign-in
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
tap: tag=sign-in
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop wait home --timeout 90
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
wait: tag=home count=1
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/aqvl/onc-1794766990
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
capture: /tmp/aqvl/onc-1794766990/home.png
capture: /tmp/aqvl/onc-1794766990/home.json
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/aqvl/onc-1794766990 --config ~/git/onara/.worktrees/app-qa-vm-f1/.omp/app-qa.json
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
[exit 0]
```

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/out-nc.md`)

#### Case: a capture JSON holding a value

Covering test(s), verbatim:
- `route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line`

Two sweep layers guard this: the host sweep after extraction (control 1) and the guest `vm pack` sweep (control 2). Each alone leaves the test passing (see their results); only breaking both (control 3) fails it.

##### Control 1

- Broken line(s):
  - qa.mjs:2454
    - before: `lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-1/qa.mjs node --test --test-name-pattern='route: sweep - a guest flow root' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 1, fail 0, exit 0 => control DID NOT FAIL (does not count)
- Failing assertion (trimmed):
```
(no failure)
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-2/qa.mjs node --test --test-name-pattern='route: sweep - a guest flow root' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 1, fail 0, exit 0 => control DID NOT FAIL (does not count)
- Failing assertion (trimmed):
```
(no failure)
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 3

- Broken line(s):
  - qa.mjs:2454
    - before: `lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));`
    - after: `(line removed)`
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-3/qa.mjs node --test --test-name-pattern='route: sweep - a guest flow root' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2101:1
✖ route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line (8238.857875ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'typed Synthetic-Pw-One-7f3a\n'
  - 'typed [redacted]\n'
           ^
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2122:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'typed Synthetic-Pw-One-7f3a\n',
    expected: 'typed [redacted]\n',
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: a capture named after a value

Covering test(s), verbatim:
- `route: sweep - a capture named after account 1's username returns neither file, prints a sweep line with the name redacted and leaves no host path holding it`
- `route: pack - vm pack sanitizes the whole folder before it writes the tar, so no member name holds a value`

Same two sweep layers; 'route: pack' runs the guest layer directly, so breaking it alone fails 'route: pack'.

##### Control 1

- Broken line(s):
  - qa.mjs:2454
    - before: `lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-4/qa.mjs node --test --test-name-pattern='route: sweep - a capture named after' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 1, fail 0, exit 0 => control DID NOT FAIL (does not count)
- Failing assertion (trimmed):
```
(no failure)
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-5/qa.mjs node --test --test-name-pattern='route: (sweep - a capture named after|pack)' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 1, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2213:1
✖ route: pack - vm pack sanitizes the whole folder before it writes the tar, so no member name holds a value (1743.541541ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(!names.includes(USER1))
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2225:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

##### Control 3

- Broken line(s):
  - qa.mjs:2454
    - before: `lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));`
    - after: `(line removed)`
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-6/qa.mjs node --test --test-name-pattern='route: (sweep - a capture named after|pack)' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2150:1
✖ route: sweep - a capture named after account 1's username returns neither file, prints a sweep line with the name redacted and leaves no host path holding it (3967.2235ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
    [
      'keep.json',
  +   'qa-user-one@example.test.json',
  +   'qa-user-one@example.test.png'
    ]
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2165:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 'keep.json', 'qa-user-one@example.test.json', 'qa-user-one@example.test.png' ],
    expected: [ 'keep.json' ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2213:1
✖ route: pack - vm pack sanitizes the whole folder before it writes the tar, so no member name holds a value (783.355334ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(!names.includes(USER1))
  
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: an unswept flow root

Covering test(s), verbatim:
- `route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line`
- `route: root - a failing flow's kept root returns to a new 0700 host folder whose path replaces the guest path`

The kept flow root (tmp/app-qa-flow-*) holds note.log with the password in the first test; control 1 breaks both sweep layers, control 2 drops the copy of the kept root.

##### Control 1

- Broken line(s):
  - qa.mjs:2454
    - before: `lines.push(...sweepCredentials(root, redactValues).map((l) => redact(l, redactValues)));`
    - after: `(line removed)`
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-7/qa.mjs node --test --test-name-pattern='route: sweep - a guest flow root' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2101:1
✖ route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line (4464.509708ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'typed Synthetic-Pw-One-7f3a\n'
  - 'typed [redacted]\n'
           ^
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2122:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'typed Synthetic-Pw-One-7f3a\n',
    expected: 'typed [redacted]\n',
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:2464
    - before: `copyInto(join(root, 'tmp', e), kept);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-8/qa.mjs node --test --test-name-pattern='route: (sweep - a guest flow root|root)' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2101:1
✖ route: sweep - a guest flow root and a guest capture JSON holding values return redacted, with host paths and the vm up line (3752.581291ms)
  Error: ENOENT: no such file or directory, open '$HOST_TMP/T/qa-test-c8PW94/tmp/app-qa-root-9yOUzd/note.log'
      at readFileSync (node:fs:624:20)
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2122:16)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: '$HOST_TMP/T/qa-test-c8PW94/tmp/app-qa-root-9yOUzd/note.log'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2294:1
✖ route: root - a failing flow's kept root returns to a new 0700 host folder whose path replaces the guest path (3893.540166ms)
  Error: ENOENT: no such file or directory, open '$HOST_TMP/T/qa-test-tl2tj5/tmp/app-qa-root-nRzdJf/console.log'
      at readFileSync (node:fs:624:20)
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2307:16)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: '$HOST_TMP/T/qa-test-tl2tj5/tmp/app-qa-root-nRzdJf/console.log'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: interrupted returns

Covering test(s), verbatim:
- `route: interrupt - a host killed before the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID`
- `route: interrupt - a host killed after the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID`

##### Control 1

- Broken line(s):
  - qa.mjs:2238
    - before: `for (const line of sweepCredentials(dir, redactValues)) complain(line);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-9/qa.mjs node --test --test-name-pattern='route: interrupt' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2248:3
✖ route: interrupt - a host killed before the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID (3664.33375ms)
  AssertionError [ERR_ASSERTION]: ./
  ./out/
  ./tmp/
  ./out/note.txt
  ./out/qa-user-one@example.test.png
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2255:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2248:3
✖ route: interrupt - a host killed after the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID (3883.6375ms)
  AssertionError [ERR_ASSERTION]: ./
  ./out/
  ./tmp/
  ./out/note.txt
  ./out/qa-user-one@example.test.png
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2255:12)
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:1688
    - before: `if (m && !alive(Number(m[1]))) rmSync(`
    - after: `if (false) rmSync(`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-10/qa.mjs node --test --test-name-pattern='route: interrupt' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 0, fail 2, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2248:3
✖ route: interrupt - a host killed before the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID (4540.699917ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2263:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2248:3
✖ route: interrupt - a host killed after the extraction leaves no value anywhere on the host, and the next vm status deletes return-PID (4140.646958ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2263:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

#### Case: tar rejection

Covering test(s), verbatim:
- `route: tar - a guest archive with .., an absolute path, a symlink or a FIFO is refused whole with nothing extracted`

##### Control 1

- Broken line(s):
  - qa.mjs:2448
    - before: `if (name.startsWith('/') || name.split('/').includes('..')) return fail(`
    - after: `if (false) return fail(`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-11/qa.mjs node --test --test-name-pattern='route: tar' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 1, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2275:1
✖ route: tar - a guest archive with .., an absolute path, a symlink or a FIFO is refused whole with nothing extracted (9016.146916ms)
  AssertionError [ERR_ASSERTION]: an absolute path: lane: desktop desktop runs in app-qa-slot-1 (slot 1)
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2285:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 2,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

##### Control 2

- Broken line(s):
  - qa.mjs:2449
    - before: `if (!['-', 'd'].includes(typeList[i][0])) return fail(`
    - after: `if (false) return fail(`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-out-nc-12/qa.mjs node --test --test-name-pattern='route: tar' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 2, pass 1, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2275:1
✖ route: tar - a guest archive with .., an absolute path, a symlink or a FIFO is refused whole with nothing extracted (11042.78875ms)
  AssertionError [ERR_ASSERTION]: a symlink: lane: desktop desktop runs in app-qa-slot-1 (slot 1)
  
  
  0 !== 2
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2285:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 2,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 2, pass 2, fail 0, exit 0

## Observation

An existing `--out` for a flow and an existing capture name each exit 2 on the host before any guest command (no `lane:` line, guest process count 851 throughout); after the driver's desktop sign-in, a capture of the home screen into a new folder works and `qa.mjs scan` of it exits 0. Capture JSON holding a value, a capture named after a value, an unswept flow root, interrupted returns and tar rejection are covered by named tests; each case has at least one broken-copy control that failed (three controls that left their test passing are recorded and do not count), and the tests pass on the real driver.

## Verdict

PASS
