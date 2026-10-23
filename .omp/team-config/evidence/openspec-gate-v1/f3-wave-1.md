## Must-fix

Blocker B1: `team-config/agent/skills/review-work/SKILL.md:408`; `scripts/validate-gate-record.mjs:819-839` — **Smoke evidence disappears from a normal fresh checkout.** For a standard-tier folder, the documented workflow writes QA artifacts to an ignored, never-staged path, but validation now requires the smoke artifact to exist and end in `exit=0`. A tracked record and trailers copied through Git therefore cannot validate in another checkout after the original worktree or its local evidence is removed. The failure is reversible by recreating the evidence, but it breaks the gate consumer’s ability to validate the recorded review. **Fix:** prescribe a durable, tracked smoke artifact outside the ignored evidence area, committed before `reviewed_sha`, or provide another durable evidence mechanism consistent with the plan’s evidence-policy exclusion. Add a fresh-checkout validation test.  
  **class:** nondurable required evidence. **sites:** the standard-tier smoke check and the Fix waves artifact-location instruction cited above. Whole-tree search: `functions.grep` for `smoke:|evidence/.*wave|artifact.*tracked|artifacts go`, path `.worktrees/openspec-gate/team-config/agent/skills/review-work`.

## Should-fix

- `team-config/agent/skills/review-work/scripts/gate-convergence.mjs:253-262`; `SKILL.md:114` — The documented standard-tier limit is at most two fix rounds, but convergence applies the same blocker-trend rules to all tiers and can return `CONTINUE` beyond that limit. This does not block under the stated threshold because the skill itself instructs the orchestrator to observe the limit; the executable ledger does not enforce it. **Fix:** make the folder tier available to convergence and stop at the stated limit, or explicitly identify the limit as a manual workflow rule.  
  **class:** documented convergence limit without enforcement. **sites:** `gate-convergence.mjs:253-262`, `SKILL.md:114`. Whole-tree searches: `functions.grep` for `fix.round|fix_round|whole_diff|security_delta` under `.worktrees/openspec-gate/team-config/agent/skills/review-work`, and for `MAX_|STOP|round|wave|limit` in `gate-convergence.mjs`.

- `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:765-770,805-814` — Folder classification retains only the Whole-diff boolean, so a record’s nonempty skip reason can disagree with the reason in `gate.md`. The decision to run F3 remains correct, so this is not a blocker, but the recorded explanation can misstate the plan’s justification. **Fix:** retain the parsed `not needed` reason and compare it with `record.whole_diff.reason`, with a mismatch test.  
  **class:** incomplete classification equality. **sites:** `parseGateClassification` and `checkFolderClassification`. Whole-tree search: `functions.grep` for `wholeDiff|whole_diff\.reason|Whole-diff review|checkFolderClassification` under `.worktrees/openspec-gate/team-config/agent/skills/review-work`.

- `team-config/agent/skills/review-work/SKILL.md:365-369,451-465` — The general instructions still say to hash `<plan>` with `shasum`, and the record example omits the folder-required `review_tier`, despite the folder-specific instructions elsewhere. This is recoverable from the validator diagnostic and does not itself invalidate a correctly constructed record, but it makes the new workflow needlessly ambiguous. **Fix:** qualify the hash instructions as file-plan-only and add a folder-record example or annotate the required field.  
  **class:** folder workflow documentation drift. **sites:** the hash instructions and Phase 5 record example. Whole-tree search: `functions.grep` for `"review_tier"|"plan_sha256"|shasum -a 256 <plan>|at most two fix rounds` in `.worktrees/openspec-gate`.

## Nit

None.

## Checked

- **Duplication:** no actionable cross-slice duplication found; the independently constructed test bundle is useful as an oracle.
- **Naming inconsistency:** no actionable instance found across *folder plan*, *bundle*, and *review tier*.
- **Uneven API surface:** no actionable instance found; folder and file plan inputs intentionally differ.
- **Mixed conventions:** no actionable instance found; folder snapshot checks and bundle construction consume the same map.
- **Missing abstractions:** no actionable cross-slice abstraction candidate found.
- **Dead code:** searched the new snapshot, bundle, and pure-checker exports; each has a production caller.
- **Doc drift:** found the file-only hash instructions and record example noted above.
- **Surprise scope:** compared the changed-file list and touched code with the plan. `folder-plan.mjs` is an additional helper supporting the planned snapshot; no listed out-of-scope subsystem was implemented.
- **Plan walks:** the implementation TODOs are marked complete, but the supplied files do not establish that their verification commands ran. F3, F1, and F2 remain unchecked in the plan; the four-record mechanical loop and installed-surface scenarios therefore remain unproven in this review. No i18n keys or locale changes appear in the diff.
- **Seams:** traced snapshot/bundle/digest and pinning; pure OpenSpec checker and CLI file selection; convergence folder key; gate classification and documentation; and the file-plan branch. Smoke-evidence durability and skip-reason equality are findings above. File-plan byte-for-byte compatibility requires the plan’s pending mechanical evidence.
- **Simplification pass:** no additional actionable cross-slice simplification found.
- **Verification:** read-only review; no tests or commands were run.

FAIL