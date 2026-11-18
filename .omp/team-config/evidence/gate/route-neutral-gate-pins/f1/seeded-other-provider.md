# Pinned model through another provider (seeded, second half)

Scenario: plan review "Pinned model through another provider"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/other-provider/PlanReviewAddReset.jsonl`: models ['openai-codex/gpt-6.1-sol'], effort ['high'], model_change [('openai-codex/gpt-6.1-sol', False)]

## Prompt

```text
Do not dispatch any agent and do not write or commit anything. Get the review instruction of the OpenSpec change `add-reset` with `openspec instructions review --change add-reset --json` and read it whole. Its dispatches for this round have already finished; their session files are listed below and stand in for the path `read history://<subagent id>` would print. The round is `standard`: one plan-reviewer item, `PlanReviewAddReset`, which returned OKAY.

- PlanReviewAddReset: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/other-provider/PlanReviewAddReset.jsonl

Apply the instruction exactly as written, running its commands (the jq list, `model-name.mjs`, the pin lookup in this installation's configuration and agent definitions). Report: for each dispatch the jq output, both `model-name.mjs` outputs and the pin with its source, and whether it counts; the action the instruction prescribes next; and the review.md fields the instruction requires for this round as it stands (Verdict, Reviewer, Verifier, Models, Awaiting, and the marker each blocker carries under `## Blockers`), each with the instruction sentence it follows.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (superseded by a later head)
- run 3: deployed head `4f92bdb783` (final, report below)

## Final report (run 3, verbatim)

````text
The dispatch counts, so the round is OKAY. Following the instruction, the next step is to write and commit review.md, then run `V --reviewed`. I did neither, since you said not to write or commit.

I read the whole review instruction for `add-reset` (443 lines, schema `omp-gated`). The JSON shows no `review.md` exists yet (`existingOutputPaths: []`).

## Dispatch: PlanReviewAddReset (plan-reviewer)

| Check | Output |
|---|---|
| jq list over the session file | `openai-codex/gpt-6.1-sol` (all three assistant turns) |
| list piped into `xargs node …/model-name.mjs \| sort -u` | `gpt-6.1-sol` |
| pin | `onara/cx/gpt-6.1-sol:high`, from `omp config get task.agentModelOverrides` → `"plan-reviewer":"onara/cx/gpt-6.1-sol:high"` |
| `node …/model-name.mjs onara/cx/gpt-6.1-sol:high` | `gpt-6.1-sol` |

The agent definition under `$(omp config path)/agents/` was never needed, because the override names the model first. That directory has no `plan-reviewer.md` anyway.

**It counts.** The first command prints exactly one line, and it matches the second: *"the dispatch ran on its pin only when the first prints exactly one line, equal to the second's; the provider takes no part. The pinned model reached through another provider counts, and `- **Models**:` still records each full `provider/model`."* The provider being `openai-codex` rather than the pin's `onara/cx` route doesn't matter.

## Next action
Step 3: *"A round with no blocker and nothing carried is OKAY; go to step 7."* So:
1. Write review.md (step 7) and commit it.
2. Run `V --reviewed <change-dir>` (step 8).

There is no verifier triage (step 4) and no ask (steps 5–6).

## review.md fields for this round

- **Verdict**: `OKAY`. Step 7: *"Verdict is OKAY when no confirmed blocking finding, no untriaged finding and no finding awaiting an answer remains open, otherwise REJECT."* Step 3 says the same: *"A round with no blocker and nothing carried is OKAY."*
- **Reviewer**: `plan-reviewer, PlanReviewAddReset`. Step 7: *"the reviewer ids in dispatch order (scope A then scope B; a retried reviewer is listed with its retry's id)"*. The template reads `plan-reviewer, <scope A or only reviewer id>`.
- **Verifier**: `blocker-verifier, none`. Step 7: *"`blocker-verifier` and its subagent id (`none` when no finding needed triage)"*.
- **Models**: `PlanReviewAddReset openai-codex/gpt-6.1-sol`, with no `(no verdict)`. Step 7: *"`- **Models**:` with one entry per dispatch of this round … as `<subagent id> <provider/model>` with every further model that dispatch ran on appended and `(no verdict)` after an attempt whose result did not count"*. The line-227 sentence above also applies: Models records the full `provider/model`.
- **Awaiting**: `none`. Step 7: *"`- **Awaiting**:` naming what is open when you write it (`none`, `exception`, `exhaustion`, `incomplete`, `scope` or `triage`)"*. Nothing is open.
- **`## Blockers`**: `none`, so no blocker carries a marker. Step 7: *"`## Blockers`: `none` for OKAY"*. The markers (`not triaged: the verifier has not returned`, `… failed twice`, `… the round is incomplete`, or a verifier result and reason) apply only to REJECT records.

One unconfirmed detail: I used `PlanReviewAddReset` as the subagent id because no other id was given. If the runtime allocated a different id for that dispatch, that id goes into Reviewer and Models instead.
````

## Result

PASS. Pin `onara/cx/gpt-6.1-sol:high`, every turn on `openai-codex/gpt-6.1-sol`; `model-name.mjs` prints `gpt-6.1-sol` for both, the dispatch counts and Models records `openai-codex/gpt-6.1-sol`.
