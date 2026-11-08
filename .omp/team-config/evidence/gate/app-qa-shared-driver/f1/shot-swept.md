# F1 shot-swept (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: screenshot a named screenshot the sweep removes fails the run`
- `flow: screenshot a clash stays a clash when the sweep removed its one file`
- `flow: screenshot two files named home in different folders, one swept, export neither`

## Observation

A single named screenshot holding a configured password is printed as removed by the sweep; a `home` pair written to one file whose surviving bytes hold such a password stays a clash; and two `home` files in different folders, one holding such bytes, stay a clash too: exit 1, no `PASS`, no `home.png` in any of them.
