# QA row P1: Plan review: Credential fallback to the parent model

Carried from F1. Per capture:

- `credential-fallback`: Captured on `acaf0ea77f`. Later commits until the reviewed head: `e40e449cfc`, `2fcb711078`, `4f92bdb783` change prose only (`SKILL.md` 8 lines, `schema.yaml` 10 lines; no script changed, `git diff --stat acaf0ea77f HEAD -- . ':!.omp'`), and `ee392ff25d` changes only tasks.md checkboxes, the README follow-ups list and F1 evidence. The plan-review model check still covers `plan-reviewer` with the same name-only comparison; the schema edits add which agents it covers, the delta reviewer and the exception rewrite, none of which this row reaches (it ends at round 1's count or before any dispatch counts).

## Observed

### credential-fallback

PASS. Override `openai-codex/gpt-6.1-sol:high` is unreachable in this home; both attempts (`HuskyPeacock`, `EvilWhippet`) ran only on `onara/cc/claude-opus-5-5`, neither counted, nothing was recorded, and the user was told the model that ran.

## Cited captures (tracked at the reviewed SHA)

- `34010b482245b7b0f8a529cebb00b2df2e6a5a728741565f55fa95808fa47f90`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/credential-fallback.md`
- `77568509a53103da166e0b7cdb26200975fbbf295038bf3842a23375f701e772`  `.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/setup.md`

Verdict: PASS
