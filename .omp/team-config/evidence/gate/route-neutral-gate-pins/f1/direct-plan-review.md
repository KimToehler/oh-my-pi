# Pinned model through another provider (direct, first half)

Scenario: plan review "Pinned model through another provider"

Installation: direct installation (operator agent dir `~/.omp/agent`, overlay `/tmp/rngp/direct-overlay.yml` with `openai-codex`/`anthropic` routes). Fixture checkout: `/tmp/rngp/rows/direct-plan-review`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Create the review artifact of the OpenSpec change `add-reset` in this repository: get its instruction with `openspec instructions review --change add-reset --json` and follow it exactly. Stop once round 1 is recorded (its review.md written and committed) or the instruction tells you to stop or ask me; do not fix blockers and do not start a second round. Finish with a short report: each dispatch, the provider/model its session file shows, whether it counted, and what you recorded.
```

Main session: `~/.omp/agent/sessions/--private-tmp-rngp-rows-direct-plan-review--/2026-11-17T23-46-39-478Z_01a1ebe7-ccf6-73a3-b4a8-6be1bea77d8c.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `PlanReviewAddReset.jsonl`: models ['openai-codex/gpt-6.1-sol'], effort ['high'], model_change [('openai-codex/gpt-6.1-sol', False)]

### Final report (verbatim)

````text
Round 1 of the `add-reset` review is recorded: the reviewer returned OKAY with no blockers, `review.md` is committed in `389f8b0`, and `V --reviewed` passes (`reviewed: OKAY in round 1`).

**Setup**
- `V <change-dir>` passed. `gate.md` gives Depth `standard` and Mandatory class `none`, so no consultation was needed (the depth isn't `risky` and you didn't ask for one).
- The change folder was already committed and clean. Digest: `345870c01b9615b5d265da62caa7a66160abfda950a30d2708e122f15273b742`.

**Dispatches**

| # | Agent / id | Provider/model in its session file | Pin | Counted |
|---|---|---|---|---|
| 1 | plan-reviewer `PlanReviewAddReset` | `openai-codex/gpt-6.1-sol` | `gpt-6.1-sol:high` (`task.agentModelOverrides`) | Yes: the model name matches the pin and the verdict parsed |

- The session file is `~/.omp/agent/sessions/--private-tmp-rngp-rows-direct-plan-review--/2026-11-17T23-46-39-478Z_01a1ebe7-…/PlanReviewAddReset.jsonl`.
- No retry was needed. The blocker-verifier was not dispatched because there were no blockers to check.

**What `review.md` records**
- Verdict OKAY, round 1, depth `standard`, Awaiting `none`, Override `none`.
- Reviewer `PlanReviewAddReset`, Verifier `none`, Models `PlanReviewAddReset openai-codex/gpt-6.1-sol`.
- Blockers `none`, Residuals `none`.

The reviewer also left non-blocking notes, which the procedure doesn't triage, so they are not in `review.md`:
- `specs/counter/spec.md` has no Purpose section.
- Task 1.2's Verify grep only checks that `reset(` appears in the docs, not that the usage example is correct.

The rest of the notes said the checks weren't triggered.

During setup, a delegation-rule interrupt fired as I was about to dispatch the reviewer. That rule lets the `omp-gated` review send its fixed brief, so I sent it unchanged.
````

## Result

PASS. One `standard` round 1; `PlanReviewAddReset` recorded only `openai-codex/gpt-6.1-sol` at `high`, its OKAY counted, review.md `- **Models**: PlanReviewAddReset openai-codex/gpt-6.1-sol`, `V --reviewed` passed.
