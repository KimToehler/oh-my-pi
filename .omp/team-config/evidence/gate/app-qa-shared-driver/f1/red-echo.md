# F1 red-echo (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: redact driver output, a password split across two writes included`
- `flow: redact replaces raw and JSON-escaped values`
- `flow: redact a printed credential in the failure message and the report`

## Observation

Both values echoed to stdout and stderr, the password in two writes, reach the caller only redacted.
