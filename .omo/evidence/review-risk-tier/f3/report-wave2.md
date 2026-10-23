## Must-fix

Blocker B1: **The PROCESS 5 differential has a changing repository context** — `.omo/evidence/review-risk-tier/qa-matrix.md:8-10,22-25` says the scored branch-above run used a scratch repository with an untracked plan, while control-above came from the tracked-plan scratch repository. The reviewers observed different repository contents: `runs/branch-above/out.txt:14-15` reports a root containing `README`, `.gitignore`, and `.omo`, whereas `runs/control-above/out.txt:8-9` reports only `.omo` and `.gitignore`. The trigger is the ordinary execution of the plan’s installed-surface verification; the precondition is scoring these two runs as the one-file differential. Because the reviewer inspects the fixture repository, the changed context is a confounder: the e…
**Fix:** Run branch-above and control-above against the same pinned copy in the same unchanged scratch repository, retaining the wave-refusal proof and the existing runtime identity checks.  
**class:** Confounded differential verification.  
**sites:** The scored branch-above and control-above pair in `qa-matrix.md:22-25`; the different repository observations in the two `out.txt` files above. Search: `functions.grep` over `.omo/evidence/review-risk-tier/runs/branch-above`, `runs/control-above`, and `runs/tracked-plan-variant` for `PLAN |plan=|pinned|demo\.md`, supplemented by reading `qa-matrix.md` and both trial outputs.

## Should-fix

- **Snapshot artifacts share a namespace across plans** — `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:332-340` names both the snapshot and pinned copy by lane and wave alone, so overlapping gates for two plans in one checkout can overwrite one another’s artifacts. The digest checks generally refuse the displaced wave rather than silently recording it, but the review must then be repeated. **Fix:** Include a stable plan-key digest or unique dispatch identifier in both filenames. This is non-blocking because the supplied threshold excludes overlapping local runs and the interruption is reversible.  
  **class:** Cross-plan artifact namespace collision.  
  **sites:** The snapshot and plan-copy filenames at lines 333-334. Search: `functions.grep` over the worktree for `wave-\$\{wave\}\.snapshot|wave-\$\{wave\}\.plan|plan_copy|PLAN <path>`.

## Nit

None.

## Checked

- **Duplication across slices/files:** No problematic duplicate parser found; validator and convergence consume the shared module.
- **Naming inconsistency:** Compared *risk tier*, *plan copy*, and *wave* across scripts and skills; no inconsistent naming instance found.
- **Uneven API surface:** No instance found in the changed interfaces.
- **Mixed conventions:** No conflicting implementation convention found.
- **Missing abstractions:** No additional cross-slice abstraction justified.
- **Dead code:** Searched the new parser exports and convergence helpers and their consumers; no unused new helper found.
- **Doc drift:** Compared tier vocabulary, credential classification, cap and snapshot instructions across scripts, skills and rules; no conflicting instance found.
- **Surprise scope:** The changed-file inventory matches the planned scripts, tests, skills, rules, extension comment and tracked plan; no unrelated implementation found.
- **Plan walks:** The bundled plan-reviewer prompt and OpenSpec folder support were not changed. Legacy artifacts are excluded from blocking; legacy snapshots are deliberately refused. No i18n keys were added. RED, green-suite, smoke, classifier and runtime-inventory artifacts were inspected; the installed-surface differential has the gap in B1. Post-merge installation remains pending.
- **Seams:** Traced the shared parser into both consumers; tier and reviewer-set validation; ledger binding, cap and retier; snapshot output and digest checks; and skill/rule vocabulary and credential definitions.
- **Simplification pass:** No cross-slice simplification candidate beyond the snapshot namespace change reported above.

FAIL

[Some lines truncated to 768 chars. Use agent://F3Wave2:raw:3-3 to read line 3 whole]
