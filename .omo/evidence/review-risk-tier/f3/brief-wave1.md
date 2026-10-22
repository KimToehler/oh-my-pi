**Local code review. No PR exists.** Do NOT run `gh pr view`, `gh pr diff`, or any remote fetch. Do NOT try to post comments to a PR. Do NOT try `gh pr list` or `gh pr create`. Review the local diff supplied below. Do not modify any files.

**Diff:** `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/integration-review-review-risk-tier.patch`
**Changed files:** `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/integration-review-review-risk-tier.files`
**Plan:** `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/plans/review-risk-tier.md` (if it exists, read it for the design rules, the "Out of Scope" list, and the "Verification" checklist)
**Seam list:** Lanes: (1) new shared module plan-contract.mjs (scanMarkdown, planContent, mergeGateSection, SECTION_PATTERN moved from validate-gate-record.mjs; new readRiskTier) consumed by validate-gate-record.mjs and gate-convergence.mjs; (2) validate-gate-record.mjs tier rules (validatePlanContract riskTier, validateRecord mandatory_class/reviewers_run for internal-tooling); (3) gate-convergence.mjs: gate_baseline.risk_tier, risk_tier_change event, gateState, decide() cap TOOLING_FIX_ROUNDS=2, decide command continue refusal, retier command, snapshot pinned plan copy (plan_sha256, plan_copy, PLAN stdout line 3), wave copy/source/legacy checks; (4) prose: review-work SKILL.md (Phase 0.5 auth-secrets-pii definition, Risk tier paragraph, Phase 0.6, Phase 4, Fix waves steps 1/3), integration-review SKILL.md (Step 2 pinned PLAN path, Step 4 cap), rules plan-merge-gate.md, plan-review-process.md PROCESS 5, lesson-size-gate-to-audience.md, merge-gate.ts header comment. Cross-slice contracts: the error/stdout strings the skills tell agents to expect versus what the scripts print; the snapshot stdout line order consumed by both skills; tier vocabulary (product | internal-tooling, personal refused) identical in parser, validator, convergence, rules and skills; the auth-secrets-pii definition identical across SKILL.md and plan-merge-gate.md.

**Asymmetry constraint:** you have only the diff, the file list, the plan, and the seam list. You do not have my reasoning for any specific decision. Read the whole diff end to end before forming opinions. If something looks wrong, flag it; I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

## Walk the seven failure modes

For each mode, name a specific instance from the diff, or write "no instance found". Every mode ends in an instance or no instance found. Skipping a mode silently is a defect in the review.

1. **Duplication across slices/files.** Two near-identical helpers, components, SCSS blocks, or DTO conversions in different files. Ask: did slice N reinvent something slice M introduced? Are there two functions with different names doing the same thing? Two style rules with 80%+ overlap?
2. **Naming inconsistency.** Same concept, different word in different places (`kicker` / `label` / `tag`; `lede` / `subtitle` / `description`; `onSave` / `handleSave` / `submit`). Pick three nouns from the diff: do they use the same word for the same concept across files?
3. **Uneven API surface.** One component accepts `lede`, its sibling takes `subtitle`, a third has neither. One method returns `Observable<void>`, another `Promise<boolean>`. One DTO has `createdAt`, another `created`. One i18n key family uses `@@dialog_*`, another `@@confirm_dialog_*`. Would a union of all the inputs across these components look uniform?
4. **Mixed conventions.** Same concept implemented two ways across slices (`data-pill="primary"` vs `class="primary-pill"`; `signal()` vs `BehaviorSubject` for the same kind of state). Did later slices respect the pattern the first slice established? If they diverged, was it intentional?
5. **Missing abstractions (abstraction gravity).** Three or more near-identical patterns is a question, not always an obligation: would a fourth consumer copy-paste again? Is there a five-line block in 3+ files with only a field name changing? Also the inverse, premature abstraction: a one-consumer helper that should be inlined.
6. **Dead code.** Back-compat aliases with no consumers after a later cleanup slice, unused helpers, computed inputs nobody binds, CSS variables nobody references, translation keys not wired up. For each new helper, type, input, variable, class, or key, search the tree: is it used anywhere other than by tests or by code the diff deleted?
7. **Doc drift.** User-facing docs, locale and translation files, OpenAPI spec, README, CHANGELOG, and agent instruction files must match changed behavior. Did the diff change logic or a workflow that docs also explain? Are all new i18n keys present in every locale file the project ships? Was the OpenAPI spec file updated when the API changed?

## Surprise scope and the plan

Compare the changed files and touched symbols against the plan. Use targeted searches to check that the diff touched only the symbols the work intended to touch. Files changed outside the feature's surface area, or symbols modified that the plan does not list, are red flags to investigate.

If a plan exists:
- Walk every "Out of Scope" line. Confirm none of them got implemented.
- Walk every "Verification" checklist item. Confirm each was actually done.
- Walk every i18n key. Confirm each is present in every locale file the project ships.
- Walk every slice's "Files modified" list. Confirm only those files (plus their tests) appear in the diff.

## Seams

Check every contract in the seam list for consistency on both sides of the seam: producer and consumer, shared type and its users, config key and its readers, docs and the behavior they describe.

## Simplification pass over the merged whole

Look for cross-slice simplification candidates that no per-slice review could see: a helper introduced in slice 2 that collapses a five-line dance in slice 4, a computed from slice 3 that is unused after slice 7's cleanup, generated-looking boilerplate repeated across slices. Report each as Should-fix.

## Class rule

A finding is one instance of a defect class. For EVERY finding write:
- `class:` a short name for the defect class, and `sites:` every site of that class across the WHOLE tree, with the exact search command you ran (not only the files in the diff); or
- `single instance: <reason>` when you searched and the class has no other site.

Report the whole class in one round. Do not leave sibling sites for a later round.

## Blocking threshold

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

## Report format

Output a markdown report with three buckets:
- **Must-fix:** every finding that meets the blocking threshold, each on its own `Blocker B<n>:` line. Nothing else is Must-fix.
- **Should-fix:** findings below the threshold: correctness and security findings without a realistic trigger on a protected asset, dead code, consistency issues, missing abstractions, naming drift, doc drift, premature abstractions, cross-slice simplification candidates.
- **Nit:** style, optional polish, taste calls.

Each finding carries: `file:line` (or symbol name plus path); **what** the issue is, in one sentence; **why** it matters, in one sentence; **fix**, in 1-3 lines or a small snippet; and its `class:` / `sites:` or `single instance:` line.

Empty buckets are still a deliverable. Finish with a **Checked** list naming the seven modes (each with its instance or "no instance found"), the surprise-scope walk, the plan walks, the seam list, and the simplification pass.

## Closing rule

End the report with exactly one line containing only PASS or FAIL. FAIL when any Must-fix exists. Nothing may follow that line.