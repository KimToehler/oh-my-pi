# F1 lock-script

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, Android emulator `emulator-5554`

## Commands and output

The disposable holder (untracked, in the scratch weaver worktree): lines 4-42 are onara `a6807335b` `app_kmp/scripts/maestro-onboarding.sh:60-98` with only the lock path changed (diff checked).

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat qa-f1/lock-holder.sh
#!/usr/bin/env bash
# Disposable F1 lock holder (not committed): take_lock and cleanup copied from onara a6807335b app_kmp/scripts/maestro-onboarding.sh:60-98, lock path set to ${TMPDIR}/app-qa/flow.lock.
set -euo pipefail

qa_tmp=${TMPDIR:-/tmp}
lock_dir="${qa_tmp%/}/app-qa/flow.lock"
lock_held=0
work=""
cleanup() {
  if [ -n "$work" ]; then rm -rf "$work"; fi
  if [ "$lock_held" = 1 ] && [ "$(cat "$lock_dir/pid" 2>/dev/null)" = "$$" ]; then rm -rf "$lock_dir"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

refuse() {
  echo "maestro-onboarding: $1" >&2
  exit 2
}

# The lock is the directory; mkdir is atomic. The holder writes its pid right after creating it.
take_lock() {
  (umask 077 && mkdir -p "${lock_dir%/*}")
  if mkdir "$lock_dir" 2>/dev/null; then
    lock_held=1
    printf '%s\n' "$$" > "$lock_dir/pid"
    return
  fi
  local holder="" _
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    holder=$(cat "$lock_dir/pid" 2>/dev/null || true)
    [ -n "$holder" ] && break
    sleep 0.1
  done
  if [ -n "$holder" ] && ps -p "$holder" >/dev/null 2>&1; then
    refuse "another flow run holds the lock (pid $holder); wait for it to finish"
  fi
  local why="it names no pid"
  [ -z "$holder" ] || why="pid $holder is not running"
  refuse "stale lock $lock_dir ($why); remove it by hand: rm -r '$lock_dir'"
}

take_lock
echo "holder $$ took $lock_dir"
sleep 120
(exit 0)
```

The holder running (pid 58466) and its lock.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls "${TMPDIR:-/tmp}/app-qa/flow.lock"; od -c "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid; ps -o pid=,command= -p $(cat "${TMPDIR:-/tmp}/app-qa/flow.lock"/pid)
pid
0000000    5   8   4   6   6  \n                                        
0000006
58466 bash qa-f1/lock-holder.sh
(exit 0)
```

Weaver flow started while the holder runs.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml; echo "driver exit $?"
flow: another flow run holds the lock (pid 58466); wait for it to finish
driver exit 2
(exit 0)
```

After the holder exited (exit 0): its output, the lock, the same flow again, the lock afterwards.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat /tmp/app-qa-impl/lock-holder.log; ls "${TMPDIR:-/tmp}/app-qa/flow.lock" 2>&1; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/plain.yaml; echo "driver exit $?"; ls "${TMPDIR:-/tmp}/app-qa/flow.lock" 2>&1
holder 58466 took /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa/flow.lock
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/flow.lock: No such file or directory
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-MzmqHl
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-out-BCTVuB
sweep: deleted out/2026-11-08_202502/plain/commands.json
PASS plain 2.3s
driver exit 0
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/flow.lock: No such file or directory
(exit 1)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `lock: a lock written as maestro-onboarding.sh writes it refuses as live, then is taken once its holder removed it`

## Observation

The disposable Bash holder (onara's `take_lock` and `cleanup` with the lock path set to `$TMPDIR/app-qa/flow.lock`) took the lock and wrote only its pid (`od -c`: `58466\n`, no `name` file). A weaver flow started meanwhile exited 2 naming the holder's pid 58466, without a name since the holder writes none. After the holder exited on its own (exit 0 after `sleep 120`), its `cleanup` had removed the lock; the same flow then passed (`PASS plain`, exit 0) and `flow.lock` is gone after it. The driver never removed the holder's lock: the lock was gone only after the owner's `cleanup` ran. The listing's `ls` exits 1 because the lock no longer exists.
