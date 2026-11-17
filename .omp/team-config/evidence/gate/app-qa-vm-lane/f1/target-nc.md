# target-nc

Run 2026-11-15T19:07:32+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
ssh: settle: load 1.74 below 8 CPUs after 0 s
ssh: desktop: pid 4555
vm up: app-qa-slot-1 holds desktop
[exit 0]
```

vm up took 37 s (stages desktop and restarts the forward).

```
$ (cwd .worktrees/app-qa-vm-f1) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.26 'pkill -f '\''^/Library/Java/JavaVirtualMachines/.*/bin/java .*eu.onara.app.MainKt'\''; sleep 2; ps -axo pid=,args= | awk '\''$2 ~ /\/bin\/java$/ && $NF == "eu.onara.app.MainKt" {print $1}'\'' | wc -l'
       0
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
lane: desktop desktop runs in app-qa-slot-1 (slot 1)
attach: no eu.onara.app.MainKt JVM in this worktree (/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1); start it with ./gradlew :desktopApp:run in app_kmp/
lane: app-qa-slot-1: the guest command exited 2; to restart the app, simulator or forward run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up desktop
[exit 2]
```

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/target-nc.md`)

#### Case: a cfg without a main class

Covering test(s), verbatim:
- `target: desktop - a launcher cfg without app.mainclass is refused by the host with exit 2 before any clone`

The test harness (qa.test.mjs:473) copies vm/ for the HOST driver from the real scripts folder, not from QA_UNDER_TEST's folder, so a break inside vm/start-target.mjs is not seen by the host (verified: the test passed). The break is therefore the host call in qa.mjs that applies the cfg reader to the snapshot.

##### Control 1

- Broken line(s):
  - qa.mjs:1970
    - before: `(await import('./vm/start-target.mjs')).readLauncherCfg(dest);`
    - after: `(line removed)`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-target-nc-1/qa.mjs node --test --test-name-pattern='target: desktop - a launcher cfg' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2428:1
✖ target: desktop - a launcher cfg without app.mainclass is refused by the host with exit 2 before any clone (5544.317917ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /app\.mainclass/. Input:
  
  'vm up: starting desktop in the guest failed\n'
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:2433:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'vm up: starting desktop in the guest failed\n',
    expected: /app\.mainclass/,
    operator: 'match',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

## Observation

With the guest JVM killed (java-only count 0), routed `desktop attach` exits 2 with the launch hint and the line naming `vm up desktop`. The launcher cfg without a main class is covered by a named test with a failing broken-copy control; the test passes on the real driver.

## Verdict

PASS
