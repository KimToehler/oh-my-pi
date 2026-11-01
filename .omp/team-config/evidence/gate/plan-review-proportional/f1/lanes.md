# F1-D: the other review lanes are untouched

Date: 2026-11-01, re-checked after the F2 wave-1 fixes; neither skill file was touched by them.

## Method

```
git diff --stat main -- team-config/agent/skills/review-work/SKILL.md \
                        team-config/agent/skills/integration-review/SKILL.md
git diff -U0 main -- <same two files> | grep '^@@'
```

## Result

```
 team-config/agent/skills/review-work/SKILL.md | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)
```

`team-config/agent/skills/integration-review/SKILL.md` has no diff against `main` at all: the F3
lane is byte-identical.

Three single-line hunks in `review-work/SKILL.md`, at lines 419, 439 and 441. The
`## Blocker disposition` section runs from line 417 to line 444 (`## Fix waves: delta review and
convergence (F2)` starts at 445), so all three hunks sit inside that one section. Each removes
exactly the plan-review references from a lane enumeration and nothing else:

- **419** (the section's scope sentence): drops `plan review (the `omp-gated` schema's `review`
  instruction)` from the lane list and appends the pointer that plan review of an `omp-gated`
  change triages every finding with the `blocker-verifier` agent instead. F2 (Phase 4 and Fix
  waves), delta reviews and F3 (`integration-review` Step 4) stay named as before.
- **439** (Accept paths): drops `plan-review Accept and Override` from the list of paths where a
  blocker can stay unfixed. The Phase 4 override, an F2 or F3 freeze and a delta accept are
  unchanged, including the `internal-tooling` wave-3 clause.
- **441** (The user's explicit request): drops `at plan-review Accept or Override` and the
  `gate.md` entry / Override from the record list. The freeze, the delta accept, the `frozen`
  `downgrades` entry, the F3 report's follow-up list and `GC accept --reason` are unchanged, as is
  the closing sentence about the ordinary Phase 4 override.

Nothing else in the section moved: the Eligible paragraph with the two-limb blocking threshold, the
exclusion list, `No unrequested mechanism` and every other line are untouched. No hunk falls in
`## Fix waves: delta review and convergence (F2)` (445+), in Phase 4, or anywhere in the F3 lane.

## Acceptance

| criterion | result |
|---|---|
| every hunk is a plan-review reference inside `Blocker disposition` | yes, 3 of 3 (lines 419, 439, 441; section 417-444) |
| nothing in Phase 4, Fix waves or F3 changed | yes: no hunk at 445+, `integration-review/SKILL.md` has no diff |
