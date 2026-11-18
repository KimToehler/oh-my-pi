# Router consultation unchanged

Scenario: router member unchanged (consultation)

Installation: router installation `$TMPDIR/rngp-home` (seeded config unchanged). Fixture checkout: `/tmp/rngp/rows/router-consultation`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `persist-counts` in this repository: get its instruction with `openspec instructions review --change persist-counts --json` and follow it exactly. Stop as soon as consultation.md is recorded as `consulted` or `skipped`, or the instruction tells you to stop or ask me; do not dispatch plan reviewers. Finish with a short report: each consultation attempt, the provider/model its session file shows, the report check's result, and what you recorded.
```

Main session: `$TMPDIR/rngp-home/.omp/agent/sessions/--private-tmp-rngp-rows-router-consultation--/2026-11-17T23-46-39-733Z_01a1ebe7-cdf5-74e3-9ec1-ad263b97fb08.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ArchConsulte33435031.jsonl`: models ['onara/cc/claude-fable-5-2'], effort ['high'], model_change [('onara/cc/claude-fable-5-2', False)]

### Final report (verbatim)

````text
`consultation.md` for `persist-counts` is recorded as **`consulted`** and committed in `0b9ae65`. I stopped there as you asked: no plan reviewers were dispatched and `review.md` was not written.

**Why the consultation ran.** The change was clean at commit `e334350`, the validator printed `passed`, and the round's digest was `3ddf6c1a…9232`. `gate.md` sets Depth to `risky` and the folder had no `consultation.md`, so the review has to consult before any plan-reviewer dispatch.

**Attempt 1 (`ArchConsulte33435031`), the only attempt:**
- **Before dispatch:** I committed a `pending` record (`9727c45`) with consulted commit `e3343503a1c00dd743fcfa14cbde56b7c2088a55`. The runtime gave the attempt the id I requested. I bound its session file `…/2026-11-17T23-46-39-733Z_01a1ebe7-…/ArchConsulte33435031.jsonl` in `79d9e62`.
- **Model:** the session file shows a single model, `onara/cc/claude-fable-5-2`.
- **Report check:** the plan files had not changed since the consulted commit (the comparison exited 0). `--consultation-report` on that session file exited 0, so the attempt counts. No retry was needed and no question was owed to you.

**What I recorded:**
- **Header:** Status `consulted`, Consultant `architecture-oracle, ArchConsulte33435031`, Models `ArchConsulte33435031 onara/cc/claude-fable-5-2`, Bottom line `KEEP APPROACH`, Skip reason `none`.
- **Report:** the check's output added to the file by redirect, unedited.
- **Findings:** I adopted all five, with the edits committed in the same commit as the record:
  - **F1 (crash durability):** surviving an OS crash or power loss is now a Non-Goal in `design.md` and accepted residual risk (3) in `gate.md`.
  - **F2 (sync or async):** `save` and `load` are synchronous in the spec and in D1 (`fs.writeFileSync`, `fs.renameSync`, `fs.readFileSync`); the async `fs.promises` option is rejected, and the build-vs-adopt lines were updated to match.
  - **F3 (failing proof vs. task order):** tasks are reordered so the concurrent-reader test is committed failing against an in-place save first. A new task 1.3 then switches `save` to the rename, and the README task becomes 1.4.
  - **F4 (temp file cleanup):** D1 now deletes the temp file (best effort) and rethrows when a save fails.
  - **F5 (load checks only the version):** `load` now also rejects counts that are not non-negative integers, with a new scenario "Malformed counts", a test in task 1.1 and a new manual QA evidence file (`f1/malformed-refused.md`) in task 2.1.
- **Depth:** the Mandatory class stays `concurrency-state` and Depth stays `risky`.

My first version of the task edits failed validation because tasks 1.2 and 1.3 did not end with a Verify command in backticks. I fixed them: 1.2 now ends with `` `! node --test test/persistence.test.js` ``, which expects the test run to fail, and 1.3 ends with `` `node --test test/persistence.test.js` ``. Validation then printed `passed`.

These edits changed the plan, so the digest above is out of date. The review restarts at step 1 with a new digest and then a two-reviewer `risky` round; I haven't started it.
````

## Result

PASS. The attempt recorded only `onara/cc/claude-fable-5-2`, `--consultation-report` exited 0, record `consulted`.
