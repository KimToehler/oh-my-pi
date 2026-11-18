# Configured override

Scenario: "Configured override"

Installation: router installation `/tmp/rngp/homes/oracle-override` (one change, see setup.md). Fixture checkout: `/tmp/rngp/rows/oracle-override`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `persist-counts` in this repository: get its instruction with `openspec instructions review --change persist-counts --json` and follow it exactly. Stop as soon as consultation.md is recorded as `consulted` or `skipped`, or the instruction tells you to stop or ask me; do not dispatch plan reviewers. Finish with a short report: each consultation attempt, the provider/model its session file shows, the report check's result, and what you recorded.
```

Main session: `/tmp/rngp/homes/oracle-override/.omp/agent/sessions/--private-tmp-rngp-rows-oracle-override--/2026-11-17T23-46-39-559Z_01a1ebe7-cd47-7480-9d70-74d594f62a66.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ArchConsulte33435031.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]
- `ArchConsulte33435032.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]

### Final report (verbatim)

````text
I've stopped where the instruction tells me to ask you. Both consultation attempts failed the report check, so `consultation.md` is still `pending`, not `consulted` or `skipped`. No `review.md` was written and no plan reviewers were dispatched.

**Path taken:** `gate.md` makes the change `risky` and there was no `consultation.md`, so step 3's admission check sent me to the architecture consultation (step 2a). `V` printed `passed`, the change folder was clean, and the digest is `3ddf6c1a…9232`. The consulted commit is `e3343503a1c00dd743fcfa14cbde56b7c2088a55`.

| Attempt | Session file's provider/model | Report check | Recorded |
|---|---|---|---|
| `ArchConsulte33435031` | `onara/cx/gpt-6.1-sol` (every assistant turn) | exit 1: "assistant turn 1 ran on onara/cx/gpt-6.1-sol, expected onara/cc/claude-fable-5-2 from …/agents/architecture-oracle.md" | `(no report)` |
| `ArchConsulte33435032` (retry) | `onara/cx/gpt-6.1-sol` (every assistant turn) | exit 1, same message | `(no report)` |

- **Plan files:** the check that plan files hadn't changed during each attempt exited 0 both times. My first try of that check exited 1, but only because the `/private/tmp` absolute path didn't match git's `/tmp` top level, so `consultation.md` wasn't excluded. Run with relative paths, it showed no plan change.
- **Cause:** `task.agentModelOverrides.architecture-oracle` is set to `onara/cx/gpt-6.1-sol`. That replaces the model in the agent's definition, `onara/cc/claude-fable-5-2:high`, which is the model the report check expects. Both attempts did return a well-formed report saying CHANGE APPROACH, but neither counts, so neither went into the record.
- **What I recorded:** `consultation.md` with Status `pending`, Consulted commit `e3343503…`, Models `ArchConsulte33435031 onara/cx/gpt-6.1-sol (no report); ArchConsulte33435032 onara/cx/gpt-6.1-sol (no report)`, and `none` in every other field. `V` passes on it and the latest commit is `3d16c568`. While `pending`, `--reviewed` refuses the change, so apply stays blocked.

**Decision needed:** with two failed attempts, you choose one of two options:
1. **Skip:** give a reason in your own words. I'll write the `skipped` record with both attempts and the consulted commit, then go on to the plan review.
2. **Stop:** leave the `pending` record as it is and dispatch nothing more.

Fixing the model override is up to you. If you change it and ask me to consult again, that starts a new pair of attempts (3 and 4).
````

## Result

PASS. `architecture-oracle` overridden to `onara/cx/gpt-6.1-sol`; both attempts ran only on it, `--consultation-report` refused both (exit 1 naming the turn and the pin), the record stays `pending` with both attempts `(no report)`, and the user is asked to skip with a reason or stop.
