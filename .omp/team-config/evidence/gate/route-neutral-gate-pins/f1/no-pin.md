# Installation without the pin

Scenario: "Installation without the pin"

Installation: router installation `/tmp/rngp/homes/no-pin` (one change, see setup.md). Fixture checkout: `/tmp/rngp/rows/no-pin`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `add-reset` in this repository: get its instruction with `openspec instructions review --change add-reset --json` and follow it exactly. Stop once round 1 is recorded (its review.md written and committed) or the instruction tells you to stop or ask me; do not fix blockers and do not start a second round. Finish with a short report: each dispatch, the provider/model its session file shows, whether it counted, and what you recorded.
```

Main session: `/tmp/rngp/homes/no-pin/.omp/agent/sessions/--private-tmp-rngp-rows-no-pin--/2026-11-17T23-46-39-539Z_01a1ebe7-cd33-774b-af9f-59247624c14f.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `PlanReviewAddReset1.jsonl`: models ['onara/cx/gpt-6.1-terra'], effort ['medium'], model_change [('onara/cx/gpt-6.1-terra', False)]

### Final report (verbatim)

````text
Round 1 is not recorded. The instruction made me stop at the model check: this installation has no pin for `plan-reviewer`, and without one I must write no `review.md` and stop. Nothing was committed and the worktree is clean. `review.md` doesn't exist, so `--reviewed` still blocks apply.

**Setup:**
- The validator printed `passed`.
- `gate.md` sets Depth to `standard`, with Mandatory class `none`. Since Depth is `standard` and you didn't ask for a consultation, the architecture consultation didn't apply.
- The change folder was already committed and clean.
- Round digest: `345870c01b9615b5d265da62caa7a66160abfda950a30d2708e122f15273b742`.

**Dispatches:**

| Dispatch | Provider/model in session file | Counted? |
|---|---|---|
| `PlanReviewAddReset1` (`plan-reviewer`, standard brief verbatim with only the two paths filled in; no `model`) | `onara/cx/gpt-6.1-terra` | No: there is no pin to compare it against |

- **Session file:** `~/.omp/agent/sessions/--private-tmp-rngp-rows-no-pin--/2026-11-17T23-46-39-539Z_01a1ebe7-cd33-774b-af9f-59247624c14f/PlanReviewAddReset1.jsonl`
- **What it returned:** a valid REJECT with two blockers:
  - The Verify commands in `tasks.md:6` and `tasks.md:10` can't prove their tasks.
  - `specs/counter/spec.md` has no `## Purpose` section, though `proposal.md:15` declares it a new capability.

  This verdict isn't recorded anywhere, and `blocker-verifier` was not dispatched.

**Why there is no pin:**
- `omp config get task.agentModelOverrides` returns only `{"reviewer":"@review"}`.
- `/tmp/rngp/homes/no-pin/.omp/agent/agents/` has no `plan-reviewer` definition. It only has `architecture-oracle`, `auditor`, `blocker-verifier` and `oracle`.

**What you need to do:** add `task.agentModelOverrides.plan-reviewer` to the agent configuration, naming the model `plan-reviewer` should run on. Then re-run the review artifact. Round 1 will start again from step 1 with a fresh reviewer, because this dispatch can't count.
````

## Result

PASS. No `plan-reviewer` override and no definition pin; the one dispatch (`onara/cx/gpt-6.1-terra` at `medium`, the task role) did not count, no review.md was written, and the user was told to add `task.agentModelOverrides.plan-reviewer`.
