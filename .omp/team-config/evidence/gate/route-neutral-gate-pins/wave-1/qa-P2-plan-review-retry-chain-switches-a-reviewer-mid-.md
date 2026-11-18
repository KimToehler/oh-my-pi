# QA row P2: Plan review: Retry chain switches a reviewer mid-run

Carried from F1. Per capture:

- `seeded-switch`: Captured on `4f92bdb783`, the last code commit; `ee392ff25d` changes no instruction text (tasks.md checkboxes, README follow-ups list, F1 evidence).

## Observed

### seeded-switch

PASS. Scope A's first dispatch (last turns on `onara/cc/claude-opus-5`) does not count; the retry `PlanReviewScopeA2` and `PlanReviewScopeB` count; the round continues with the retry's verdict, Reviewer lists `PlanReviewScopeA2`, and Models lists both scope A attempts with the switched one marked `(no verdict)`. The fixture's gate.md says `standard` while the seeded round is a risky scope A/B pair; the session flags that mismatch, which is a property of the fixture, not of the check.

## Cited captures (tracked at the reviewed SHA)

- `96a535e91439501a66925719c3d53660fa371e71a842e96a535e6433e7495c54`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded-switch.md`
- `91c222c7811edad08ddefc48c0fadf90489a8f06c6eb0bcdecd3e7cceb3f9d32`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeA.jsonl`
- `38ad013b57818fd42ab939fb7201f0bc695189155b91dc9595c0c902539976e0`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeA2.jsonl`
- `3ee3828e2eefd5b6d450b57456acaa75ee6522eb7b90fe85c98aace036374c34`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeB.jsonl`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
