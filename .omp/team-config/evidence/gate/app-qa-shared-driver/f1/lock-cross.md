# F1 lock-cross

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree (iOS simulator `onara-f1`) and scratch weaver worktree (Android emulator `emulator-5554`)

## Commands and output

A weaver driver run of the long scratch flow (`flow android qa-f1/long.yaml` in the scratch weaver worktree, pid 68315) holds the lock.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cat "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid "${TMPDIR:-/tmp}/app-qa/flow.lock"/name; ps -o pid=,command= -p $(cat "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid) | cut -c1-160
68315
weaver
68315 node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/long.yaml
(exit 0)
```

Onara flow ios started meanwhile.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/signin.yaml; echo "driver exit $?"
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
flow: another flow run holds the lock (pid 68315, weaver); wait for it to finish
driver exit 2
(exit 0)
```

The weaver run's output after it finished, and the lock afterwards.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat /tmp/app-qa-impl/lock-cross-weaver.log; ls "${TMPDIR:-/tmp}/app-qa/flow.lock" 2>&1
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-CxUd0w
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-out-Wdc1LG
sweep: deleted out/2026-11-08_162513/long/commands.json
PASS long 61.9s
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/flow.lock: No such file or directory
(exit 1)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `lock: a run from another repository holds it and refuses this one naming its pid and name`

## Observation

A weaver driver run of the long scratch flow holds `flow.lock` (`pid` 68315, `name` weaver; that pid is the weaver driver). An onara `flow ios` started meanwhile exits 2 naming the holder's pid and name (`pid 68315, weaver`) before any Maestro process of its own. The weaver run then finished (`PASS long`) and the lock is gone.
