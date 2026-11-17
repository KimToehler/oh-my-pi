# reset-reuse

Run 2026-11-15T18:24:51+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
ssh: settle: load 7.48 below 8 CPUs after 210 s
ssh: ios: AEB87CB9-2289-46C5-AED3-E9D637CFC0DD
vm up: app-qa-slot-1 holds ios
[exit 0]
```

vm up took 391 s.

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1b clone=app-qa-slot-1 targets=ios forward=26668 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) ssh -i ~/.omp/agent/app-qa-vm_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 -o UserKnownHostsFile=/tmp/aqvl/inspect_known_hosts -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR lume@192.168.64.24 'ls ~/work; T="${TMPDIR:-/tmp}"; ls -la "${T%/}/app-qa" 2>&1 | head -5'
onara
ls: /var/folders/6p/kj6l582x2874t2vjchfzyntm0000gn/T/app-qa: No such file or directory
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1b) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
lane: flow ios runs in app-qa-slot-1 (slot 1)
credentials: /Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1b/.dev-credentials.env
device: AEB87CB9-2289-46C5-AED3-E9D637CFC0DD
root: (not kept)
out: $HOST_TMP/T/app-qa-out-9960FY
sweep: deleted out/2026-11-15_092313/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_092313/maestro.log
sweep: redacted out/2026-11-15_092313/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_092313/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/T/app-qa-out-9960FY/f1-home.png
PASS f1-signin-home 59.4s
[exit 0]
```

`qa.mjs scan` of the returned folder: exit 0. Screenshot kept as `reset-reuse-home.png`: the signed-in home screen. The first sign-in after `vm up ios` in this worktree passed on its first attempt; the target start had waited 210 s for the fresh clone's load to settle.

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/reset-reuse.md`)

#### Case: the refresh reset

Covering test(s), verbatim:
- `stage: reset - a refresh deletes a planted guest session record, flow lock and output file, and a routed desktop tap asks for desktop attach`

Related, not part of the 'refresh reset' case: 'stage: reset - worktree A's vm down and worktree B's vm up on the same slot clone the image again and B's guest holds none of A's files' (fresh clone per slot reuse); no control was run for it.

##### Control 1

- Broken line(s):
  - qa.mjs:1899
    - before: `const GUEST_RESET = 'T="${TMPDIR:-/tmp}"; rm -rf "${T%/}"/app-qa "${T%/}"/app-qa-lease';`
    - after: `const GUEST_RESET = ':';`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-reset-reuse-1/qa.mjs node --test --test-name-pattern='stage: reset - a refresh deletes' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1717:1
✖ stage: reset - a refresh deletes a planted guest session record, flow lock and output file, and a routed desktop tap asks for desktop attach (16196.180917ms)
  AssertionError [ERR_ASSERTION]: /private$HOST_TMP/T/qa-test-5sVWnf/guest/tmp/app-qa/sessions/stale.json
  
  true !== false
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1730:35)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

## Observation

The second worktree's `vm up ios` takes the freed slot 1 (`vm status` names `app-qa-vm-f1b`); guest `~/work` holds only `onara`, guest `$TMPDIR/app-qa` does not exist (no session record), and the routed sign-in flow passes on its first attempt. The refresh reset is covered by the named test, whose control fails as required.

## Verdict

PASS
