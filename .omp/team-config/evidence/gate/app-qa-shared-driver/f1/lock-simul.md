# F1 lock-simul (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `lock: simultaneous starts launch one driver`

## Observation

Two runs started together: exactly one starts the fake Maestro, the other exits 2 naming the winner's pid.
