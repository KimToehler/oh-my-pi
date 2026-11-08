# F1 red-echo (*test*)

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `flow: redact driver output, a password split across two writes included`
- `flow: redact replaces raw and JSON-escaped values`
- `flow: redact a printed credential in the failure message and the report`

## Observation

Both values echoed to stdout and stderr, the password in two writes, reach the caller only redacted.
