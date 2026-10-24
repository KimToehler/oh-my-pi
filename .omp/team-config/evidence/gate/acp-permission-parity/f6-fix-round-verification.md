# F2 fix wave 1 verification, head c9c49c65ba69aa7388677e80229e3ce006009480

Rows 6.1 (`5106074b67`) and 6.2 (`c9c49c65ba`); delta review of `412a84bca55a..c9c49c65ba69`: OKAY (`GC delta --lane F2 --row 6.1 --row 6.2`).

## RED on pre-fix source

- 6.1: with `src/modes/acp/acp-event-mapper-v2.ts` and `acp-surface-v2.ts` stashed, `bun test test/acp-event-mapper-v2.test.ts test/acp-v2.test.ts -t "keeps a cancellation|cancelled permission answer"` → `0 pass`, `2 fail`; the v2 call reported `Tool call denied by user: bash`.
- 6.2: with the factory and `Setting.hostDefault` reverted to the runtime override, the new settings and ACP re-scope tests → `11 pass`, `6 fail` (the re-scope test read `write` where the project set `always-ask`).

## Row verifies

- 6.1: `bun test test/acp-event-mapper-v2.test.ts test/acp-v2.test.ts test/agent-session-acp-permission.test.ts` → `94 pass`, `0 fail`.
- 6.2: `bun test test/config test/acp-mcp-isolation.test.ts test/tools` → `3091 pass`, `1 fail` (the Chromium submit-name test that fails on a clean checkout, see `f5.1-verification.md`); `bun run check:ts` → exit 0.

## Full coding-agent suite (once per fix round)

`bun test` → `19208 pass`, `8 fail`, `Ran 19581 tests across 1814 files`. The eight failures are the set recorded before the fix round (update-cli npm `ENOENT`, queued-steer interrupt, #11709 disabled provider, two browser executable selection timeouts, Chromium submit-name, `handleSkillList`, `/plugins` npm toggle); none touches the changed modules.

## F1 re-run

`bun f1-acp-qa.ts --run && bun f1-acp-qa.ts --check f1-frames.jsonl` at `c9c49c65ba` → exit 0, PASS a-e (`f1-qa.md`, `f1-frames.jsonl`).
