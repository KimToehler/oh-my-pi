# Same model through another provider (direct consultation)

Scenario: consultation "Same model through another provider"

Installation: direct installation (operator agent dir `~/.omp/agent`, overlay `/tmp/rngp/direct-overlay.yml` with `openai-codex`/`anthropic` routes). Fixture checkout: `/tmp/rngp/rows/direct-consultation`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `persist-counts` in this repository: get its instruction with `openspec instructions review --change persist-counts --json` and follow it exactly. Stop as soon as consultation.md is recorded as `consulted` or `skipped`, or the instruction tells you to stop or ask me; do not dispatch plan reviewers. Finish with a short report: each consultation attempt, the provider/model its session file shows, the report check's result, and what you recorded.
```

Main session: `~/.omp/agent/sessions/--private-tmp-rngp-rows-direct-consultation--/2026-11-17T23-46-39-493Z_01a1ebe7-cd04-74f1-8dbd-9bc298202b37.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ArchConsulte33435031.jsonl`: models ['anthropic/claude-fable-5-2'], effort ['high'], model_change [('anthropic/claude-fable-5-2', False)]

### Final report (verbatim)

````text
`openspec/changes/persist-counts/consultation.md` is now recorded as `consulted` and committed at `6fd5d39`. I stopped there and dispatched no plan reviewers.

**Path through the instruction:** the change validated (`passed`). Its depth in `gate.md` is `risky`, because the Mandatory class is `concurrency-state`, and the folder had no `consultation.md`. That sent the admission check to step 2a, the architecture consultation.

**Consultation attempts:** one.
- **Attempt 1:** `ArchConsulte33435031` (architecture-oracle). It ran against commit `e3343503a1c00dd743fcfa14cbde56b7c2088a55`. I recorded the `pending` entry in `a643adf` and the session binding in `8bd5fb1`.
- **Session file:** `/Users/tim/.omp/agent/sessions/--private-tmp-rngp-rows-direct-consultation--/2026-11-17T23-46-39-493Z_01a1ebe7-cd04-74f1-8dbd-9bc298202b37/ArchConsulte33435031.jsonl`
- **Provider/model in the session file:** `anthropic/claude-fable-5-2` (the only model listed).
- **Report check:** the plan files had not changed since the consulted commit (`git diff --quiet` exit 0). `V --consultation-report` exited 0, so the attempt counted and no retry was needed.

**What I recorded:**
- **Status and verdict:** `consulted`. Consultant `architecture-oracle, ArchConsulte33435031`. Models `ArchConsulte33435031 anthropic/claude-fable-5-2`. Bottom line `KEEP APPROACH`. Skip reason `none`.
- **Report:** the report command's output, appended to the file by redirect, unedited.
- **Findings:** I adopted all five and made the edits in the plan files, committed together with the record:
  - **F1, missing file:** `load` of a missing path throws `ENOENT`. Added a "Missing file" scenario, a seeded initial save in task 1.2, and the first-run pattern in the README task.
  - **F2, async save:** `save` and `load` use the synchronous `fs.*Sync` calls, in design D1 and the Build vs. adopt section. Task 1.2's reader loop now yields to the event loop between loads.
  - **F3, crash durability:** surviving an OS crash or power loss is now a Non-Goal. I added it to the accepted residual risks in `gate.md`.
  - **F4, leftover temp file:** a failed save removes its temp file and rethrows the original error. Added a test for this in task 1.1.
  - **F5, non-string names:** names must be strings, and `save` throws a `TypeError` otherwise. Added a "Non-string name refused" scenario, and the conversion uses `Object.fromEntries`/`Object.entries`.
- **Gate and validation:** the Mandatory class and depth are unchanged (`concurrency-state`, `risky`). The change validated after the edits and the folder has no uncommitted changes.

**Next:** `review.md` does not exist yet. Because the plan changed, the review restarts at step 1 with a new digest, then runs a two-reviewer `risky` round.
````

## Result

PASS. One `risky` consultation; `ArchConsulte33435031` recorded only `anthropic/claude-fable-5-2`, `--consultation-report` exited 0, record Status `consulted` with Models `ArchConsulte33435031 anthropic/claude-fable-5-2`.
