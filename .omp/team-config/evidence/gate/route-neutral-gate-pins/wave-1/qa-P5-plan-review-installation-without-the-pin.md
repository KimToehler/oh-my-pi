# QA row P5: Plan review: Installation without the pin

Carried from F1. Per capture:

- `no-pin`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The plan-review model check still covers `plan-reviewer` with the same name-only comparison; the schema edits add which agents it covers, the delta reviewer and the exception rewrite, none of which this row reaches (it ends at round 1's count or before any dispatch counts).

## Observed

### no-pin

PASS. No `plan-reviewer` override and no definition pin; the one dispatch (`onara/cx/gpt-6.1-terra` at `medium`, the task role) did not count, no review.md was written, and the user was told to add `task.agentModelOverrides.plan-reviewer`.

## Cited captures (tracked at the reviewed SHA)

- `0e744e9dfca5deec6e8d7f81793039ee5cdfd6b9af1bbd8fba94dfb7382d8239`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/no-pin.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
