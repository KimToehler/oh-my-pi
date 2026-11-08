# F1 lock-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree (iOS simulators) and scratch weaver worktree (Android emulator `emulator-5554`)

## Commands and output

Two simulators booted, onara flow ios without `--device`.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ xcrun simctl list devices booted | grep -c Booted; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/signin.yaml; echo "driver exit $?"; pgrep -fl 'maestro.cli.AppKt test' || echo 'no maestro test process'
2
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
flow: 2 booted devices (612AB788-087A-408B-ACE1-34BCD68C235D (iPhone 17 Pro), 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A (onara-f1)); pass --device ID
driver exit 2
no maestro test process
(exit 0)
```

Stale lock: `flow.lock` created by hand holding the pid of a shell that has exited, weaver flow android started.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ dead=$(sh -c 'echo $$'); mkdir "${TMPDIR:-/tmp}/app-qa/flow.lock" && printf '%s\n' "$dead" > "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid; ps -p "$dead" >/dev/null || echo "pid $dead not running"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml; echo "driver exit $?"; ls "${TMPDIR:-/tmp}/app-qa/flow.lock"; cat "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid
pid 60400 not running
flow: stale lock /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa/flow.lock (pid 60400 is not running); remove it by hand: rm -r '/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa/flow.lock'
driver exit 2
pid
60400
(exit 0)
```

An unlocked `maestro test qa-f1/long.yaml` started directly (pid 60492, outside the driver, no lock), weaver flow android started while it runs.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls "${TMPDIR:-/tmp}/app-qa/flow.lock" 2>&1; pgrep -f 'maestro.cli.AppKt test' | wc -l; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml; echo "driver exit $?" 
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/flow.lock: No such file or directory
       1
flow: a Maestro test run without the lock is running (pid 60490, 60492); wait for it or stop it
driver exit 2
(exit 0)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `lock: a dead holder lock and an ownerless lock are refused as stale and left in place`
- `lock: a live holder is refused with its pid and name`

## Observation

Two simulators booted (`onara-f1` and a second iPhone 17 Pro), onara `flow ios` without `--device`: both device ids listed with `pass --device ID`, exit 2, no Maestro process; the second simulator was shut down afterwards. A stale `flow.lock` holding the pid of an exited shell: the weaver flow exits 2 naming the lock, the dead pid and the `rm -r` command, and the lock is left in place (`pid` still `60400` afterwards); removed by hand as printed. A `maestro test` started directly, outside the driver and without the lock: the weaver flow exits 2 naming its pid; that Maestro run was stopped afterwards. The unlocked Maestro run showed as two processes (60490, 60492), both named.
