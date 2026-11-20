# F1 row: Fixed reviewer briefs on a pinned model (openspec-plan-review)

Fixture: worktree `.worktrees/f1-native-fixture-review` (detached at 6933006fe0), change `openspec/changes/f1-review` (a copy of this change's planning files, Depth `standard`). Deployed head 3e78520b8e; overlay `PI_CONFIG_FILES=<worktree>/team-config/seed/config.yml` (seed `plan-reviewer: openai-codex/gpt-6.1-sol:high`, f1/setup.md); `blocker-verifier` override removed, so its definition pin `openai-codex/gpt-6.1-sol:medium` applies.

Fresh session prompt: run `openspec instructions review --change f1-review --json` and follow it exactly through round 1, model check and triage included; stop once round 1's review.md is recorded and committed; edit no plan artifact.

```
$ jq -c '<task tool-call arguments>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-review/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-7274-beb5-efc91eca70d7.jsonl
{"context":"Independent review of an OpenSpec change (planning artifacts only; nothing is implemented yet).","items":[{"agent":"plan-reviewer","name":"PlanReviewF1R1","has_model":false}]}
{"context":"Triage of plan-review blockers for an OpenSpec change (planning artifacts only; nothing is implemented yet).","items":[{"agent":"blocker-verifier","name":"VerifyF1R1","has_model":false}]}
$ diff <fixed brief + all-scopes paragraph from `openspec instructions review`, paths filled> <PlanReviewF1R1's task text>
exit 0
$ jq -r '<assistant provider/model>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-review/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-7274-beb5-efc91eca70d7/PlanReviewF1R1.jsonl | sort | uniq -c
     19 openai-codex/gpt-6.1-sol
$ jq -r 'select(.type=="thinking_level_change") | .thinkingLevel' <same file>
high
$ jq -r '<assistant provider/model>' ~/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-review/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-7274-beb5-efc91eca70d7/VerifyF1R1.jsonl | sort | uniq -c
      5 openai-codex/gpt-6.1-sol
$ jq -r 'select(.type=="thinking_level_change") | .thinkingLevel' <same file>
medium
$ node model-name.mjs openai-codex/gpt-6.1-sol:high openai-codex/gpt-6.1-sol:medium openai-codex/gpt-6.1-sol
gpt-6.1-sol
gpt-6.1-sol
gpt-6.1-sol
$ git -C .worktrees/f1-native-fixture-review log --oneline 6933006fe0..HEAD
427dfd5625 plan(f1-review): round 1 triaged, 1 confirmed blocker
a8ac55a295 plan(f1-review): round 1 REJECT, triage pending
$ sed -n 1,12p openspec/changes/f1-review/review.md
# Review

- **Verdict**: REJECT
- **Reviewed digest**: 4fa8eeae809fe5ff658236653747fb4c71ea3f19eeccec171116d082bc821791
- **Depth**: standard
- **Reviewer**: plan-reviewer, PlanReviewF1R1
- **Verifier**: blocker-verifier, VerifyF1R1
- **Models**: PlanReviewF1R1 openai-codex/gpt-6.1-sol; VerifyF1R1 openai-codex/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: none
- **Override**: none

```

The round counted: one plan-reviewer on its pin at `high`, `- **Models**:` naming `openai-codex/gpt-6.1-sol` for it, and the verifier (blocker-verifier, native pin) triaged the one blocker. The verdict itself is REJECT: the reviewer read the fixture copy of this change and found that tasks.md 4.2's rows did not name every scenario of their requirements. The real change's F1 rows were extended for that finding (see f1/plan-review-count.md and f1/audit.md, which exercise the remaining scenarios).

The session's final report, verbatim:

> Round 1 ended in **REJECT**: the reviewer raised one blocker and the verifier confirmed it as blocking. The final record is committed as `427dfd5625`. As you asked, I edited no plan artifacts and ran no further rounds. `V --reviewed` now fails with exit 1, which is expected after a REJECT and keeps apply blocked.
> 
> **How the round ran:**
> - **Validation and digest:** `V` passed. The change folder was already committed and clean at `6933006fe0`. Digest: `4fa8eeae…1791`.
> - **Depth:** `standard` (Mandatory class `none`). No architecture consultation was required and you didn't ask for one, so step 2a was skipped.
> - **Model check:** both dispatches ran on their pinned model.
>   - `PlanReviewF1R1` ran only on `openai-codex/gpt-6.1-sol`. Its pin, from `task.agentModelOverrides`, is `openai-codex/gpt-6.1-sol:high`, which `model-name.mjs` reduces to `gpt-6.1-sol` for both.
>   - `VerifyF1R1` ran only on `openai-codex/gpt-6.1-sol`. It has no override, so its pin comes from the `blocker-verifier.md` definition: `openai-codex/gpt-6.1-sol:medium`. Both again reduce to `gpt-6.1-sol`.
> - **Triage:** before dispatching the verifier I committed a pre-triage record as `a8ac55a295`, with Awaiting `triage`. The verifier returned exactly one result for index 1: confirmed, blocking, not protected, not in the security scope. So no exception or scope question was needed. The fix is still owed: the budget allows one fix-delta check next.
> - **Briefs:** I compared both briefs against the prompts saved in the session files, and they were dispatched word for word.
> - **Two deviations from the script:**
>   - My first reviewer dispatch, made from eval, was stopped by the `delegation` rule hook before anything was spawned (`history://` showed no agent). I re-dispatched directly with the task tool. That rule explicitly allows the omp-gated fixed brief.
>   - The instruction doesn't set a `context` string for the verifier, so I supplied a one-line one myself.
> 
> **review.md** (committed in `427dfd5625`):
> 
> ```markdown
> # Review
> 
> - **Verdict**: REJECT
> - **Reviewed digest**: 4fa8eeae809fe5ff658236653747fb4c71ea3f19eeccec171116d082bc821791
> - **Depth**: standard
> - **Reviewer**: plan-reviewer, PlanReviewF1R1
> - **Verifier**: blocker-verifier, VerifyF1R1
> - **Models**: PlanReviewF1R1 openai-codex/gpt-6.1-sol; VerifyF1R1 openai-codex/gpt-6.1-sol
> - **Round**: 1
> - **Awaiting**: none
> - **Override**: none
> 
> ## Blockers
> 
> ### All scopes (PlanReviewF1R1)
> 
> 1. **CHECK 6 — tasks.md 4.2 / F1 entry-path coverage**
>    - Defect: The requirement rows omit materially different admission paths. In particular, the audit row cannot detect a gate incorrectly refusing an auditor override that changes only its provider: both planned probes still pass. This affects the explicitly supported existing-member override workflow during normal use; the resulting gate refusal is reversible. The planned review also never dispatches the newly rerouted blocker-verifier.
>    - Evidence: openspec/changes/f1-review/tasks.md:21 plans a native auditor dispatch and a mismatched-trailer rejection, but no provider-only auditor-override admission, lower-effort rejection, substituted retry, or substituted repair. Those cases are required by specs/post-implementation-review/spec.md:12-40, with provider-only refusal explicitly forbidden at :44. The plan-review row omits missing-pin and substituted-verifier paths required by specs/openspec-plan-review/spec.md:36-44. team-config/agent/skills/review-work/SKILL.md:181 explicitly requires a standard requirement row to exercise its scenarios within that row. The installer helper only checks provider prefixes (scripts/install-team-config.test.ts:805), so it cannot substitute for these workflow checks.
>    - Change: Complete the existing requirement rows with their omitted scenarios, retaining the actual inputs, dispatch/check interactions and observed outcomes. Exercise blocker-verifier on the native pin. For otherwise unreachable failure/provider variants, use disposable session-shaped fixtures in fresh sessions applying the delivered instructions; no reachable router or model-behaviour scoring checker is necessary.
>    - Verifier: confirmed, blocking. tasks.md:21 exercises only native auditor success and a mismatched trailer; both still produce their expected outcomes if provider-only auditor overrides are incorrectly refused. It also omits the lower-effort, substituted retry/repair, missing-pin and substituted-verifier cases and never dispatches blocker-verifier. These paths are specified in specs/post-implementation-review/spec.md:12-44 and specs/openspec-plan-review/spec.md:36-44. The installer helper at scripts/install-team-config.test.ts:805 checks provider prefixes, not workflow admission, and the planned regression suite does not exercise these instruction-driven paths. SKILL.md:181 requires scenarios within each standard requirement row. Provider-only overrides are an explicitly supported normal existing-member workflow (design.md D3 and Migration Plan); missing its admission proof is material and outside neither gate.md exclusion. No protected asset is implicated.
> 
> ## Residuals
> 
> none
> ```
> 
> **Session files:**
> - `PlanReviewF1R1`: `/Users/tim/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-review/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-7274-beb5-efc91eca70d7/PlanReviewF1R1.jsonl`
> - `VerifyF1R1`: `/Users/tim/.omp/agent/sessions/-git-oh-my-pi-.worktrees-f1-native-fixture-review/2026-11-20T12-46-57-870Z_01a1f8fe-e94e-7274-beb5-efc91eca70d7/VerifyF1R1.jsonl`

`<assistant provider/model>` is the filter `select(.type=="message" and .message.role=="assistant") | .message.provider + "/" + .message.model`.
