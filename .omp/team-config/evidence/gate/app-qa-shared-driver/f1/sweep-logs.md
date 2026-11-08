# F1 sweep-logs

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, iOS simulator `onara-f1`

## Commands and output

The same run as `red-nc` (root `app-qa-flow-app-qa-flow-EKSQFk`): its output above printed the deleted command record and the redacted logs. Every kept file scanned, against the run's credentials and against the configured credentials file.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$TMPDIR"/app-qa-flow-EKSQFk --credentials /tmp/app-qa-impl/creds-wrong.env; echo "scan root (run credentials) exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$TMPDIR"/app-qa-flow-EKSQFk; echo "scan root (configured file) exit $?"
scan root (run credentials) exit 0
scan root (configured file) exit 0
credentials: /tmp/app-qa-impl/creds-wrong.env
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 0)
```

`[redacted]` markers in each file the sweep reported as redacted, and the deleted command record.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cd "$TMPDIR"/app-qa-flow-EKSQFk && for f in debug/.maestro/tests/*/maestro.log out/*/signin/logs/maestro.log out/*/signin/logs/device-simulator.log; do echo "$(grep -o "\[redacted\]" "$f" | wc -l | tr -d " ") $f"; done; ls out/*/signin/commands.json 2>&1
5 debug/.maestro/tests/2026-11-08_163453/maestro.log
2 out/2026-11-08_163453/signin/logs/maestro.log
697 out/2026-11-08_163453/signin/logs/device-simulator.log
ls: out/*/signin/commands.json: No such file or directory
(exit 1)
```

## Test part

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: sweep redacts an XML-escaped password in the report`

## Observation

The wrong-password run of `red-nc`: the driver printed the deleted command record (`commands.json`, absent afterwards) and the three logs it redacted (both `maestro.log` files and `device-simulator.log`); those files hold 5, 2 and 697 `[redacted]` markers. Every kept file scans clean (exit 0) against the run's credentials and against the configured credentials file.
