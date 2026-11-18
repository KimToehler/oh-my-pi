# QA row P3: Plan review: Pinned model through another provider (bare override, direct; and onara pin with openai-codex turns, seeded)

Carried from F1. Per capture:

- `direct-plan-review`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The plan-review model check still covers `plan-reviewer` with the same name-only comparison; the schema edits add which agents it covers, the delta reviewer and the exception rewrite, none of which this row reaches (it ends at round 1's count or before any dispatch counts).
- `seeded-other-provider`: Captured on `4f92bdb783`, the last code commit; `ee392ff25d` changes no instruction text (tasks.md checkboxes, README follow-ups list, F1 evidence).

## Observed

### direct-plan-review

PASS. One `standard` round 1; `PlanReviewAddReset` recorded only `openai-codex/gpt-6.1-sol` at `high`, its OKAY counted, review.md `- **Models**: PlanReviewAddReset openai-codex/gpt-6.1-sol`, `V --reviewed` passed.

### seeded-other-provider

PASS. Pin `onara/cx/gpt-6.1-sol:high`, every turn on `openai-codex/gpt-6.1-sol`; `model-name.mjs` prints `gpt-6.1-sol` for both, the dispatch counts and Models records `openai-codex/gpt-6.1-sol`.

## Cited captures (tracked at the reviewed SHA)

- `5d34fc6aeecb6bb6f413331af05f7ba0a6fb954e24cf0b21586a99bf03733a23`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/direct-plan-review.md`
- `9d049e14af256b25ff4ba9d3b6ae5194d7d1461fb704920c505019aab525368a`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-other-provider.md`
- `9ba13ebc26113595f17eeea3c8fc4a388d9b65c528e7e2f37e83f08c3a3bdf51`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/other-provider/PlanReviewAddReset.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
