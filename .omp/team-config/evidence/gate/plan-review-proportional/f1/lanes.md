# F1-D: the other review lanes are unchanged

Date: 2026-11-02, re-run for row 5.33 on the head that carries the wave-3 text
(`b7cd4fd13a`).

Schema blob the delivered instruction of this head carries:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`.)

## The diff

```
$ git diff --stat main -- team-config/agent/skills/review-work/SKILL.md \
                          team-config/agent/skills/integration-review/SKILL.md
 team-config/agent/skills/review-work/SKILL.md | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)
```

`team-config/agent/skills/integration-review/SKILL.md` has **no hunk at all**: F3 is untouched by
this change. `review-work/SKILL.md` has two hunks, both inside `## Blocker disposition`, three
changed lines:

1. `@@ -416,7 +416,7 @@` — the section's own scope sentence. Plan review is removed from the list
   of lanes that read this section, and the sentence now says plan review of an `omp-gated` change
   triages every reviewer finding with `blocker-verifier` instead.
2. `@@ -436,9 +436,9 @@` — **Accept paths**: `plan-review Accept and Override` drops out of the
   list of paths where a blocker may stay unfixed.
3. the same hunk — **The user's explicit request**: `plan-review Accept or Override` drops out of
   the list of paths the user may ask for.

## The QA lane's note

Every hunk is a **plan-review reference being removed** from a section that keeps working
unchanged for the other lanes. Nothing in the file's F2 machinery changed:

- `Phase 4` and its Downgrades: untouched (no hunk).
- `Fix waves`: untouched (no hunk).
- F3 / `integration-review` Step 4: untouched, and its SKILL.md has no hunk at all.
- The **Eligible**, **Excluded** and **Covered** paragraphs of `Blocker disposition`: untouched.
  The eligibility definition, the exclusion list and the coverage rule are byte-identical to
  `main`, so every lane that still reads the section reads exactly what it read before.

The three changed lines are the clean cutover this change requires: plan review no longer has an
Accept path at all, so a sentence that still offered one would be a second, contradicting rule.
The record of the live runs is in `.../f1/standard.md`, `.../f1/risky.md`, `.../f1/security.md`,
`.../f1/seeded.md`, `.../f1/failed-triage.md`, `.../f1/partial-round.md` and
`.../f1/substitution.md`: no session offered Accept, and every finding went through the verifier.
