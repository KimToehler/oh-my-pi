# F1 type-nc (*test*)

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (119 tests, 119 pass, 0 fail, exit 0).

Tests passing in that log:

- `desktop: type fails with both lengths when the field ends with other text`
- `desktop: type replaces the text and ends with the exact text`

## Observation

The fake field ending `dd a health endpointA` and holding `draftAdd a health endpoint` each make `desktop type` exit 1 with both lengths; exact text exits 0.
