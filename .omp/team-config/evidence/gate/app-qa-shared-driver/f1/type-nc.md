# F1 type-nc (*test*)

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309`.

Command: `node --test --test-reporter=spec team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs` on the head; full output in `f1/qa-test-log.txt` (121 tests, 121 pass, 0 fail, exit 0).

Tests passing in that log:

- `desktop: type fails with both lengths when the field ends with other text`
- `desktop: type replaces the text and ends with the exact text`

## Observation

The fake field ending `dd a health endpointA` and holding `draftAdd a health endpoint` each make `desktop type` exit 1 with both lengths; exact text exits 0.
