# Installation without the model entry; User skips

Scenario: "Installation without the model entry" and "User skips"

Installation: router installation `/tmp/rngp/homes/no-fable` (one change, see setup.md). Fixture checkout: `/tmp/rngp/rows/no-fable`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `persist-counts` in this repository: get its instruction with `openspec instructions review --change persist-counts --json` and follow it exactly. Stop as soon as consultation.md is recorded as `consulted` or `skipped`, or the instruction tells you to stop or ask me; do not dispatch plan reviewers. Finish with a short report: each consultation attempt, the provider/model its session file shows, the report check's result, and what you recorded.
```

Main session: `/tmp/rngp/homes/no-fable/.omp/agent/sessions/--private-tmp-rngp-rows-no-fable--/2026-11-17T23-46-39-482Z_01a1ebe7-ccfa-73dc-b525-03cc9aadf778.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ArchConsulte33435031.jsonl`: models none (no assistant turn), effort ['high'], model_change []
- `ArchConsulte33435032.jsonl`: models none (no assistant turn), effort ['high'], model_change []

### Final report (verbatim)

````text
The consultation for `persist-counts` couldn't run: both attempts failed before reaching a model. `consultation.md` is still `pending`, so I've stopped, as the instruction requires after two failures. You need to choose between skipping the consultation and stopping.

**Before dispatch:** the change validated (`passed`), the change folder had no uncommitted changes, and gate.md marks it `risky` (class `concurrency-state`). That makes the consultation mandatory before any plan reviewer runs. The change's digest is `3ddf6c1a…9232` and the consulted commit is `e3343503a1c00dd743fcfa14cbde56b7c2088a55`.

**Attempts:**

| Attempt | Subagent id | Provider/model in session file | Report check |
|---|---|---|---|
| 1 | `ArchConsulte33435031` | none | exit 1 |
| 2 | `ArchConsulte33435032` | none | exit 1 |

- **Why both failed:** each died at once with `Error: No model selected. Use /login, set an API key environment variable, or create /tmp/rngp/homes/no-fable/.omp/agent/agent.db`. Neither session file has any assistant turns, so no provider or model appears in either.
- **Report check output (both attempts):** `consultation report: the brief does not name the change directory /private/tmp/rngp/rows/no-fable/openspec/changes/persist-counts (it names none)`. The prompt never reached the agent, so the check had nothing to read.
- **Plan files:** unchanged since the consulted commit during both attempts.
- **Ordering slip on attempt 1:** I ran its check before committing the session-file record. The record was committed straight after, and the result doesn't depend on that order.

**What I recorded:** `consultation.md` has Status `pending`, Consulted commit `e3343503a1c00dd743fcfa14cbde56b7c2088a55`, and Models `ArchConsulte33435031 none (no report); ArchConsulte33435032 none (no report)`. Everything else is `none`. The last commit is `48d7f9c`. No plan reviewer was dispatched and no `review.md` was written.

**Decision needed:**
- **Skip:** give me your reason in your own words. I'll record the consultation as `skipped` with both attempts and the consulted commit, then go on to the review round.
- **Stop:** the `pending` record stays and nothing more is dispatched. The review can't be completed, so apply stays blocked.

The cause is that this installation has no model selected or no provider login. Fixing that is up to you, and a new pair of attempts only starts if you ask to consult again.
````

## Run 2

### Prompt

```text
Skip. My reason: the Fable model is not installed on this machine and this change must not wait for it.
```

Main session: `/tmp/rngp/homes/no-fable/.omp/agent/sessions/--private-tmp-rngp-rows-no-fable--/2026-11-17T23-46-39-482Z_01a1ebe7-ccfa-73dc-b525-03cc9aadf778.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ArchConsulte33435031.jsonl`: models none (no assistant turn), effort ['high'], model_change []
- `ArchConsulte33435032.jsonl`: models none (no assistant turn), effort ['high'], model_change []

### Final report (verbatim)

````text
I've recorded the consultation for `persist-counts` as `skipped`, using your reason, and stopped there. No plan reviewer was dispatched and no `review.md` exists yet, so apply stays blocked until the review round runs.

**Attempts:**

| Attempt | Subagent id | Provider/model in session file | Report check |
|---|---|---|---|
| 1 | `ArchConsulte33435031` | none (no assistant turns) | exit 1 |
| 2 | `ArchConsulte33435032` | none (no assistant turns) | exit 1 |

- **Why both failed:** each stopped at once with `No model selected`, so the architecture agent never received the prompt.
- **Report check output (both attempts):** `the brief does not name the change directory … (it names none)`. There was nothing in the session for it to read.

**What `consultation.md` now records:**
- Status: `skipped`.
- Consulted commit: `e3343503a1c00dd743fcfa14cbde56b7c2088a55`.
- Models: `ArchConsulte33435031 none (no report); ArchConsulte33435032 none (no report)`.
- Skip reason, in your words: "the Fable model is not installed on this machine and this change must not wait for it."
- Everything else is `none`.

The change validated (`passed`) and is committed as `b1da3cd`, with nothing left uncommitted in the change folder.

The next step is the first review round. The change is `risky`, so that means two plan reviewers.
````

## Result

PASS. Without `cc/claude-fable-5-2` in `models.yml` both attempts stopped with `No model selected` (no assistant turn, so their models are `none`), the report check refused both, and the ask offered skip or stop quoting both attempts. The resumed session (run 2) answered skip with a reason; consultation.md is `skipped`, the reason verbatim, both attempts under Models, consulted commit kept. Same shape as the archived F1 5.4 row of plan-architecture-consultation on `main` (`missing-model.md`: Models `none (no report)`).
