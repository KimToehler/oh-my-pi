# F1 sweep-name

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, iOS simulator `onara-f1`

## Commands and output

A scratch flow (untracked) whose only step is `takeScreenshot: sign-in-${MAESTRO_DEV_USER}`, run with account 1; the console output kept in a file for the scan below.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cat qa-f1/name.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/name.yaml --account 1 --out /tmp/app-qa-impl/f1out/sweep-name > /tmp/app-qa-impl/sweep-name-console.txt 2>&1; echo "driver exit $?"; cat /tmp/app-qa-impl/sweep-name-console.txt
appId: eu.onara.app.kmp
---
- takeScreenshot: sign-in-${MAESTRO_DEV_USER}
driver exit 1
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-mPk6cp
out: /tmp/app-qa-impl/f1out/sweep-name
sweep: deleted out/2026-11-08_203132/name/commands.json
sweep: deleted out/2026-11-08_203132/name/takeScreenshot/sign-in-[redacted].png
sweep: redacted debug/.maestro/tests/2026-11-08_203132/maestro.log
sweep: redacted out/2026-11-08_203132/name/logs/device-simulator.log
flow: screenshot sign-in-[redacted].png removed by the sweep
FAIL name 4.5s: named screenshots not exported
(exit 0)
```

`--out` afterwards and the console output scanned.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ find /tmp/app-qa-impl/f1out/sweep-name | sort; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/sweep-name-console.txt; echo "scan console exit $?"
/tmp/app-qa-impl/f1out/sweep-name
scan console exit 0
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

The run root afterwards.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls -d "$TMPDIR"/app-qa-flow-mPk6cp 2>&1
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa-flow-mPk6cp: No such file or directory
(exit 1)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: sweep removes files and folders whose names hold a credential, failing and passing`
- `flow: screenshot a named screenshot the sweep removes fails the run`

## Observation

Onara, iOS, the flow's only step a screenshot named `sign-in-` plus account 1's username (Maestro fills the value in, probe `f1/maestro-name-probe.md`): the driver printed the screenshot as deleted by the sweep and as `removed by the sweep` with `[redacted]` in place of the username, then `FAIL name ...: named screenshots not exported`, exit 1, no `PASS`. `--out` exists and is empty (no `sign-in-` file). The console output scans clean (exit 0).
