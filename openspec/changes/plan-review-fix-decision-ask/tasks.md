# Tasks

## 1. Spec alignment

- [ ] 1.1 Confirm the delta in `specs/openspec-plan-review/spec.md` is the main spec's `Early ask at a complete round with eligible blockers` block with only the scenario "Round with only blocking findings keeps the existing path" changed, and that the instruction it describes already asks (`schema.yaml` step 4, "A blocker whose fix needs a user decision is asked as in step 6"). Verify: `C=openspec/changes/plan-review-fix-decision-ask; awk '/^### Requirement: Early ask at a complete round/{p=1} /^### Requirement: The early ask is recorded first/{p=0} p' openspec/specs/openspec-plan-review/spec.md > /tmp/pr-main-block.md && sed -n '/^### Requirement: Early ask/,$p' $C/specs/openspec-plan-review/spec.md > /tmp/pr-delta-block.md && test "$(diff -B /tmp/pr-main-block.md /tmp/pr-delta-block.md | grep -c '^[<>]')" = 2 && grep -q 'A blocker whose fix needs a user decision is asked as in step 6' team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml && DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec validate plan-review-fix-decision-ask --strict --no-interactive`

## 2. Final verification

- [ ] 2.1 F1. Manual QA on the real surface: in a scratch copy of this worktree, `openspec archive plan-review-fix-decision-ask --yes` applies the delta; `f1/archive.txt` retains the archive output, `git diff --stat` and `git diff` of `openspec/specs/openspec-plan-review/spec.md` (exactly one changed line, the scenario's THEN), and `openspec validate --specs --strict --no-interactive` passing. Evidence path `.omp/team-config/evidence/gate/plan-review-fix-decision-ask/f1/archive.txt`, on the head after the last commit; the QA lane judges the observation. Verify: `F=.omp/team-config/evidence/gate/plan-review-fix-decision-ask/f1/archive.txt; test -s $F && grep -q '1 file changed, 1 insertion(+), 1 deletion(-)' $F`

## Workflow follow-up

- F2 merge gate (`review-work`), after 2.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates; then archive the change (`openspec archive plan-review-fix-decision-ask`). No deploy needed.
