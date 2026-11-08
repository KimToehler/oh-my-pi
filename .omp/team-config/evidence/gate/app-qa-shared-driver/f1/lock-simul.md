# F1 lock-simul (*test*)

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `lock: simultaneous starts launch one driver`

## Observation

Two runs started together: exactly one starts the fake Maestro, the other exits 2 naming the winner's pid.
