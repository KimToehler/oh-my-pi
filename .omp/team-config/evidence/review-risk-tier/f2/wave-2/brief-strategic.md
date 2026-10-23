Read-only strategic risk review. Do not run commands, fetch network context, modify files, or spawn sub-reviewers.

Changed files:
M	team-config/agent/extensions/merge-gate.ts
M	team-config/agent/rules/lesson-size-gate-to-audience.md
M	team-config/agent/rules/plan-merge-gate.md
M	team-config/agent/rules/plan-review-process.md
M	team-config/agent/skills/integration-review/SKILL.md
M	team-config/agent/skills/review-work/SKILL.md
M	team-config/agent/skills/review-work/scripts/gate-convergence.mjs
M	team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
A	team-config/agent/skills/review-work/scripts/plan-contract.mjs
M	team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
M	team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs


Diff:
```diff
diff --git a/team-config/agent/extensions/merge-gate.ts b/team-config/agent/extensions/merge-gate.ts
index 3f3df5a43c..f5a0139d05 100644
--- a/team-config/agent/extensions/merge-gate.ts
+++ b/team-config/agent/extensions/merge-gate.ts
@@ -12,7 +12,7 @@
  * Plan time: a plan-mode proposal (`write xd://propose`) is refused until the plan passes
  * `validate-gate-record.mjs --plan-only`. The validator owns every plan decision: the opt-out
  * declaration (`- Merge gate: not applicable (<reason>)` as a top-level bullet outside code fences),
- * the `## Merge gate` criteria, the abort-rule fields, and file-or-directory plan interpretation.
+ * the `## Merge gate` criteria, the abort-rule fields, the optional Risk tier field, and file-or-directory plan interpretation.
  * This hook treats the plan path as opaque and never reads plan content.
  *
  * Cross-family plan review is native in omp (`plan.review.enabled`); this extension does not review.
diff --git a/team-config/agent/rules/lesson-size-gate-to-audience.md b/team-config/agent/rules/lesson-size-gate-to-audience.md
index 24be336b09..057698caa2 100644
--- a/team-config/agent/rules/lesson-size-gate-to-audience.md
+++ b/team-config/agent/rules/lesson-size-gate-to-audience.md
@@ -1,5 +1,5 @@
 ---
-description: Size the threat model and merge gate to who runs the tool; a personal local-only tool gets "Merge gate: not applicable" and proves value with a real run, not adversarial review waves
+description: Size the threat model and merge gate to who runs the tool and what it can damage; personal tools opt out, dev/CI/proof tooling that reaches no protected asset declares Risk tier: internal-tooling
 globs:
   - "**/plan.md"
   - "**/.omo/plans/**/*.md"
@@ -31,5 +31,6 @@ the gate leaves unfixed goes into the record's downgrades with the user's overri
   eligibility. Hardening beyond that is a follow-up, driven by real use.
 - Before the gate, write the **value proof**: the one real end-to-end run whose result the user would act on.
   Run it before any review wave.
+- Dev, CI, or proof tooling in a product repo that reaches no protected asset (production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, irreversible state) and does not change how product code is gated: `- Risk tier: internal-tooling` with `Mandatory class: none`. One auditor, two fix rounds per lane, then freeze or re-plan; unfixed blockers go into the record's downgrades. Anything that reaches one is product.
 - Gate waves: follow the review-work skill's "Fix waves" section; it stops when fix-induced blockers
-  rise or the blocker count does not fall over three waves.
+  rise, the blocker count does not fall over three waves, or an internal-tooling lane has used its two fix rounds.
diff --git a/team-config/agent/rules/plan-merge-gate.md b/team-config/agent/rules/plan-merge-gate.md
index 334655f1b4..4f4f5f323a 100644
--- a/team-config/agent/rules/plan-merge-gate.md
+++ b/team-config/agent/rules/plan-merge-gate.md
@@ -19,6 +19,7 @@ time, after reviewers were paid for, so get it right at plan time.
 ## Merge gate
 - Author's risk assessment: <what could break, and how badly>
 - Mandatory class: <none | auth-secrets-pii | schema-migration | wire-contract-api | concurrency-state>
+- Risk tier: <product | internal-tooling>
 - Whole-diff review: <needed | not needed + reason>   (needed when the change spans 3+ modules/layers)
 - Accepted residual risks: <named risks that may not block a gate wave, or none (<reason>)>
 - Out of scope for blocking: <areas, modes, providers whose findings become follow-ups, or none (<reason>)>
@@ -37,6 +38,20 @@ time, after reviewers were paid for, so get it right at plan time.
 Every behavioural criterion needs all five fields; the negative control is the one that is most
 often missing and the one that makes the criterion discriminate. Mandatory class other than
 `none` means both reviewers run at F2, no discretion.
+`auth-secrets-pii` applies when the change touches a real credential, an authentication or authorisation path, or third-party personal data. Classify the value and its reach, never the filename: a provider key or production token read from a local `.env` is real; a synthetic password generated only for disposable local/test services is not.
+
+## Risk tier
+
+- `product`: ships to users or production, or can reach a protected asset (production data, a
+  real credential, third-party personal data, tenant isolation, money, an audit trail,
+  irreversible state). Full gate; mandatory classes apply. A plan without the field is product.
+- `internal-tooling`: dev, CI, and proof tooling that reaches no protected asset. `Mandatory
+  class` must be exactly `none`. F2 runs exactly one implementation-audit; each gate lane allows
+  two fix rounds, and a third wave that still has blockers stops for freeze or re-plan, with
+  unfixed blockers in the record's `downgrades`. A protected asset in reach makes the plan product.
+- `personal`: a local tool for one user opts out with `- Merge gate: not applicable (<reason>)`;
+  the validator refuses `Risk tier: personal`.
+- The value is exactly one tier word; the reason goes into `Author's risk assessment`.
 
 ## The criteria are the abort rule
 
diff --git a/team-config/agent/rules/plan-review-process.md b/team-config/agent/rules/plan-review-process.md
index ccc7104dc0..b3db0b9056 100644
--- a/team-config/agent/rules/plan-review-process.md
+++ b/team-config/agent/rules/plan-review-process.md
@@ -1,16 +1,17 @@
 ---
-description: Plan-review process checks from the Evo2 branch - abort rule, decided assumptions, cut at two subsystems, fix deltas
+description: Plan-review process checks from the Evo2 branch - abort rule, decided assumptions, cut at two subsystems, fix deltas, risk tier
 agents: [plan-reviewer]
 alwaysApply: true
 ---
 
 # Process checks
 
-Labels are PROCESS 1-4. Same form as CHECK n: each fires only on its trigger; a triggered check without the required answer is a blocker under the blocking threshold of the reviewer's <decision> (otherwise a note), naming the label and the plan slot. Among equal severity, PROCESS blockers follow CHECK 1-8.
+Labels are PROCESS 1-5. Same form as CHECK n: each fires only on its trigger; a triggered check without the required answer is a blocker under the blocking threshold of the reviewer's <decision> (otherwise a note), naming the label and the plan slot. Among equal severity, PROCESS blockers follow CHECK 1-8.
 
-Opt-out first: before any PROCESS check, look for a top-level bullet `- Merge gate: not applicable (<reason>)` outside code fences. If the plan has one, you MUST NOT report PROCESS 1, 2 or 3 for it, not even as a lower-severity blocker; PROCESS 4 is never skipped; an undecided contingency in such a plan is out of PROCESS scope. CHECK and DOMAIN rules still apply on their own triggers. A quoted or nested opt-out line is not an opt-out.
+Opt-out first: before any PROCESS check, look for a top-level bullet `- Merge gate: not applicable (<reason>)` outside code fences. If the plan has one, you MUST NOT report PROCESS 1, 2, 3 or 5 for it, not even as a lower-severity blocker; PROCESS 4 is never skipped; an undecided contingency in such a plan is out of PROCESS scope. CHECK and DOMAIN rules still apply on their own triggers. A quoted or nested opt-out line is not an opt-out.
 
 - **PROCESS 1, abort rule.** Trigger: a `## Merge gate` section with feature-specific criteria. Required: every criterion is decidable, meaning its invariant names an observable property of a named component and its negative control names an input or state that must fail ("the system is secure" is not decidable); `Accepted residual risks` and `Out of scope for blocking` name concrete risks or areas, or `none` with a reason that holds against the plan; no accepted residual risk or out-of-scope area contradicts a criterion's invariant.
 - **PROCESS 2, decided assumptions.** Trigger: an assumption or contingency whose acceptance is open ("if not acceptable", "otherwise", "if reality is X", "falls nicht", "sonst"). Required: the decision and who made it; a fallback that adds a subsystem (proxy, staging tree, daemon, store, endpoint) is designed in this plan or named as a separate plan before implementation.
 - **PROCESS 3, cut.** Trigger: the plan changes more than two subsystems (packages, services, or independently testable mechanisms). Required: a cut into plans with their own gates, or evidence that the parts cannot ship separately.
 - **PROCESS 4, fix delta.** Trigger: the assignment is a fix delta (fix entries plus their diff). Check the diff before any table. Required: (a) the delta adds no subsystem (process, proxy, store, staging tree, daemon, endpoint, or another independently testable mechanism); one that does is a blocker: it becomes its own plan; (b) every removed or weakened line that protected something (a `DELETE`, cleanup, reset, guard, check, validation, refusal) has a named replacement in the delta or a reason the protection is obsolete; a removal without either is a correctness blocker that quotes the removed line and names the scenario it now breaks; (c) the delta fixes what its fix entries name; CHECK 1-8 and triggered DOMAIN checks apply to what the delta adds, changes or removes and to defects it causes or exposes in unchanged code, under the blocking threshold, against the plan invariants in the assignment. A missing table is a separate blocker ranked below (b).
+- **PROCESS 5, risk tier.** Trigger: `- Risk tier: internal-tooling` in `## Merge gate`. Required: under normal use the planned change reaches no protected asset as the blocking threshold defines it (it is dev, CI, or proof tooling), and it does not change how product code is gated. A plan that reaches one, or changes a gate, is a blocker: it is product, and its `Mandatory class` follows from the change.
diff --git a/team-config/agent/skills/integration-review/SKILL.md b/team-config/agent/skills/integration-review/SKILL.md
index 5acbc43867..128727c554 100644
--- a/team-config/agent/skills/integration-review/SKILL.md
+++ b/team-config/agent/skills/integration-review/SKILL.md
@@ -56,7 +56,7 @@ git diff --name-only <base>...HEAD > /tmp/integration-review-<slug>.files
 
 ### Step 2 - Dispatch ONE reviewer with the verbatim brief (caller)
 
-When a plan exists, first run `GC baseline --sha HEAD`, `GC ready --lane F3`, then `GC snapshot --lane F3` (`GC` as in review-work Fix waves, `SKILL_DIR=~/.omp/agent/skills/review-work`); keep the snapshot path (first output line). `NOT READY` or a refused snapshot → resolve, no dispatch. Prepare the Step 1 files only after the snapshot.
+When a plan exists, first run `GC baseline --sha HEAD`, `GC ready --lane F3`, then `GC snapshot --lane F3` (`GC` as in review-work Fix waves, `SKILL_DIR=~/.omp/agent/skills/review-work`); keep the snapshot path (first output line) and the `PLAN <path>` line; substitute that pinned path for `<plan path>` in the reviewer brief, since the source plan is not a review input for the wave. `NOT READY` or a refused snapshot → resolve, no dispatch. A snapshot refused because this unrecorded wave already has a different or incomplete snapshot is resolved by restarting the wave as in review-work Fix waves step 1. Prepare the Step 1 files only after the snapshot.
 
 Dispatch a single omp `task` call with one item: `agent: "auditor"`, `solutionSpace: "Whole-diff review of a finished branch; defects unknown"`, `task:` the brief below unchanged, filling only the placeholders. The result is delivered automatically; do not poll. At integration-review time there is usually **no PR yet**, so the brief puts the reviewer in local mode up front; that stops it from improvising with `gh pr view`, `git fetch`, or its own discovery logic.
 
@@ -65,7 +65,7 @@ Dispatch a single omp `task` call with one item: `agent: "auditor"`, `solutionSp
 
 **Diff:** `/tmp/integration-review-<slug>.patch`
 **Changed files:** `/tmp/integration-review-<slug>.files`
-**Plan:** `<plan path>` (if it exists, read it for the design rules, the "Out of Scope" list, and the "Verification" checklist)
+**Plan:** `<plan path>` (the pinned `PLAN` path from `GC snapshot`, never the source plan; if it exists, read it for the design rules, the "Out of Scope" list, and the "Verification" checklist)
 **Seam list:** <each lane or slice and the cross-slice contracts it touched>
 
 **Asymmetry constraint:** you have only the diff, the file list, the plan, and the seam list. You do not have my reasoning for any specific decision. Read the whole diff end to end before forming opinions. If something looks wrong, flag it; I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.
@@ -144,7 +144,7 @@ When a plan exists, first run `GC ready --lane F3` and `GC snapshot --lane F3`,
 
 The last line of the report is the verdict: `PASS` means no Must-fix remains, `FAIL` means at least one does. A report without that final line is not a verdict. Re-dispatch and ask for the closing line; do not infer the verdict from the buckets.
 
-When a plan exists, record every verdict before anything else: `GC wave --lane F3 --snapshot <path> --outcome f3=PASS|FAIL|INCONCLUSIVE` (a report still without its closing line after one re-dispatch is INCONCLUSIVE). After a cleanup commit, also pass `--outcome verification=PASS|FAIL` from the Step 5 verification gate and one `--blocker VERIFY<n>` per failing check. Add one `--blocker <class>=<sites>` per Must-fix class; Should-fix and Nit never count; `@fix` works as in review-work Fix waves step 3. `DECISION: PASS` → F3 done. `CONTINUE` → Step 5. `STOP` (exit 3) → no Step 5; `ask` the user: freeze (the named Must-fix classes become follow-ups, listed in the report F2 receives as `{F3 REPORT PATH}`), re-plan, or continue, and record it with `GC decide --lane F3 --choice freeze|replan|continue --by <user> --reason <text>`. Without `ask` UI, report and stop.
+When a plan exists, record every verdict before anything else: `GC wave --lane F3 --snapshot <path> --outcome f3=PASS|FAIL|INCONCLUSIVE` (a report still without its closing line after one re-dispatch is INCONCLUSIVE). After a cleanup commit, also pass `--outcome verification=PASS|FAIL` from the Step 5 verification gate and one `--blocker VERIFY<n>` per failing check. Add one `--blocker <class>=<sites>` per Must-fix class; Should-fix and Nit never count; `@fix` works as in review-work Fix waves step 3. `DECISION: PASS` → F3 done. `CONTINUE` → Step 5. `STOP` (exit 3) → no Step 5; `ask` the user: freeze (the named Must-fix classes become follow-ups, listed in the report F2 receives as `{F3 REPORT PATH}`), re-plan, or continue, and record it with `GC decide --lane F3 --choice freeze|replan|continue --by <user> --reason <text>`. Without `ask` UI, report and stop. Under Risk tier `internal-tooling` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; `GC decide` refuses continue there.
 
 A clean report reads:
 
diff --git a/team-config/agent/skills/review-work/SKILL.md b/team-config/agent/skills/review-work/SKILL.md
index ebb4239245..db923dbca7 100644
--- a/team-config/agent/skills/review-work/SKILL.md
+++ b/team-config/agent/skills/review-work/SKILL.md
@@ -92,16 +92,18 @@ Docs-only is not automatically skippable. Instructions, skills, config docs, run
 
 Discretion does not apply to these classes. Always run both invocations:
 
-1. auth, secrets, PII
+1. auth, secrets, PII: the change touches a real credential, an authentication or authorisation path, or third-party personal data. A real credential currently grants access outside disposable local/test services, regardless of where it is stored; a provider key or production token in a local `.env` is real. A synthetic password generated only for the developer's disposable local stack, or a test fixture that grants no external access, is not.
 2. schema or migration
 3. wire contract or public API shape
 4. concurrency or state machine
 
 Judgement habituates toward "does not need it". Across 400 repeat reviewers and 11,429 reviews, approval drifted from 30.1% to 36.8%, inline comments fell 22%, and word count fell 28%, while rising approval negatively correlated with comment effort ([Habituation at the Gate](https://arxiv.org/abs/2606.22721)). These four classes remain immune to that drift, supported by [OWASP ASVS](https://github.com/OWASP/ASVS) and [OWASP Top 10](https://owasp.org/www-project-top-ten/).
 
+**Risk tier.** Read `- Risk tier:` from the plan's `## Merge gate`; a plan without it is `product`, and the validator refuses any value other than exactly `product` or `internal-tooling`. `product`: this phase as written. `internal-tooling` (dev, CI, and proof tooling that reaches no protected asset as the blocking threshold defines it): `mandatory_class` is `none`, exactly one `implementation-audit` runs, and each gate lane allows two fix rounds (Fix waves step 3); the validator refuses a record for this tier with any other class or reviewer set. A reviewer's `security_delta: yes` reports a real credential, an authentication or authorisation path, third-party personal data, or weakened access to a protected asset, and therefore means the work is product: set `- Risk tier: product` in the plan, run `GC retier --by <user> --reason <text>`, reclassify, and review again. A synthetic credential limited to disposable local/test services is `security_delta: no`.
+
 ## Phase 0.6: Resolve and record
 
-Before anything is dispatched, run the plan half of the validator against the plan alone: `node $SKILL_DIR/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <plan-path>`. It runs the `## Merge gate` criteria check the full validation runs at the end, plus two plan-time rules the full run does not repeat: the opt-out decision (only a top-level `- Merge gate: not applicable (<reason>)` outside code fences counts) and the abort-rule fields `Accepted residual risks` and `Out of scope for blocking`, each with concrete text or `none (<reason>)`. A plan that fails it would fail the gate only after every reviewer was paid for, so fix the plan first, before `plan_sha256` is taken.
+Before anything is dispatched, run the plan half of the validator against the plan alone: `node $SKILL_DIR/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <plan-path>`. It runs the `## Merge gate` criteria check the full validation runs at the end, plus two plan-time rules the full run does not repeat: the opt-out decision (only a top-level `- Merge gate: not applicable (<reason>)` outside code fences counts) and the abort-rule fields `Accepted residual risks` and `Out of scope for blocking`, each with concrete text or `none (<reason>)`. Both modes also read the optional `Risk tier`: exactly `product` or `internal-tooling`, and `internal-tooling` needs exactly one `Mandatory class` bullet whose whole value is `none`. A plan that fails it would fail the gate only after every reviewer was paid for, so fix the plan first, before `plan_sha256` is taken.
 
 A plan written before the abort-rule fields existed fails this check. Reassess it, then add both fields honestly. Use `none (plan predates abort-rule fields; reassessed before F2)` only when the reassessment found nothing to name.
 
@@ -217,7 +219,7 @@ REVIEW-TRAILER-v1
 invocation: implementation-audit
 sections_covered: <numbers you received, comma-separated>
 model_id: <your exact resolved model ID, or unresolved>
-security_delta: <yes|no from your own section 3>
+security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
 verdict: <PASS|FAIL|INCONCLUSIVE>
 blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
 adversarial_criteria:
@@ -272,7 +274,7 @@ REVIEW-TRAILER-v1
 invocation: strategic-risk-review
 sections_covered: <numbers of the questions you received, comma-separated>
 model_id: <your exact resolved model ID, or unresolved>
-security_delta: <yes|no - did this change move a data class somewhere new>
+security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
 verdict: <PASS|FAIL|INCONCLUSIVE>
 blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
 adversarial_criteria:
@@ -340,7 +342,7 @@ Gate passes only when QA matrix has no failing row and every invocation actually
 
 Used as the final gate before a merge, a PR handoff, or a plan's completion, this skill is **blocking**. A timeout, ack-only reply, missing deliverable, explicit `BLOCKED:`, or `INCONCLUSIVE` lane is not a pass. Treat it as failed: investigate the underlying uncertainty with the `debugging` skill when runtime behaviour may be wrong, fix with evidence through Fix waves, and re-run the affected invocation before claiming completion or merging.
 
-Re-classify `mandatory_class` against the **final diff**, not against the plan. The plan's class was set before the work existed and goes stale the moment a wave adds something. Re-classify when any of these appear anywhere in the final diff, whether or not the plan predicted them: a new external network recipient, a new field in a persisted or transmitted structure, a new data class reaching an existing recipient, a new authentication or authorisation path, a schema or migration step, a changed wire contract, or new shared mutable state. A reviewer reporting a security delta while the record says `none` blocks, and correctly so - the reviewer saw the final diff and the plan did not.
+Re-classify `mandatory_class` against the **final diff**, not against the plan. The plan's class was set before the work existed and goes stale the moment a wave adds something. Re-classify when any of these appear anywhere in the final diff, whether or not the plan predicted them: a new external network recipient, a new field in a persisted or transmitted structure, a new data class reaching an existing recipient, a new authentication or authorisation path, a schema or migration step, a changed wire contract, or new shared mutable state. A reviewer reporting a security delta while the record says `none` blocks, and correctly so - the reviewer saw the final diff and the plan did not. Under Risk tier `internal-tooling` that block means re-tier, as in Phase 0.5.
 
 **Downgrades.** A reviewer blocker the gate leaves unfixed ends only in `override` plus exactly one `downgrades` entry per blocker id of every FAIL trailer, never silently. `rule` says why it may stay: `below-threshold` when you judge that the finding misses both (a) and (b) of the blocking threshold, with `reason` naming the missing trigger or asset, and the user agreed; `accepted-residual` when the plan's `Accepted residual risks` covers it; `out-of-scope` when `Out of scope for blocking` covers it; `frozen` when the user chose freeze at a convergence STOP. `disposition` is `residual` or `follow-up`; a follow-up names where it is tracked in `reason`.
 
@@ -390,10 +392,10 @@ Mandatory class: <none or class>
 Applies when this review is a plan's merge gate. `GC` = `node $SKILL_DIR/scripts/gate-convergence.mjs --repo <repo root> --plan <plan path>`, with the plan path from Phase 0.6. A wave is Phase 1 plus, when it passes, Phases 2-3, all on the snapshot taken in step 1. `.omo/gate-deltas/` holds review artifacts; never commit it.
 
 1. Before Phase 1:
-   - `GC baseline --sha HEAD` (prints the existing baseline when F3 already set one);
+   - `GC baseline --sha HEAD` (prints the existing baseline when F3 already set one); it records the plan's Risk tier, which binds the gate: a later plan edit to `product` needs `GC retier --by <user> --reason <text>` (internal-tooling to product only; a gate never moves to internal-tooling), and every other command refuses until then;
    - `GC ready --lane F2`; `NOT READY` → resolve every listed reason and dispatch nothing;
-   - `GC snapshot --lane F2`; it refuses uncommitted tracked changes. Its first output line is the snapshot path; keep it for step 3.
-2. Until the wave is recorded, change nothing tracked. QA artifacts go under `.omo/evidence/<plan basename>/wave-<n>/`; they are local and git-ignored (never staged), so the snapshot's clean-tree check is unaffected. Only the record and the `*trailer*` files are staged, in Phase 5. Between waves commit only fix code. A commit without a delta review blocks the next wave.
+   - `GC snapshot --lane F2`; it refuses uncommitted tracked changes. Its first output line is the snapshot path; keep it for step 3. Keep the `PLAN <path>` line too: it is the immutable plan input for this wave. Populate Phase 2's `{PLAN}`, `{CRITERIA WITH FIVE FIELDS}`, accepted residual risks and out-of-scope fields from that copy, never from the source plan; `GC wave` verifies both the copy and source before recording. A wave's snapshot is write-once and named per plan, lane and wave: re-running `snapshot` on the same commit and plan bytes only re-prints it, and anything else (other plan bytes, another commit, a copy without its JSON) is refused, because reviewers may hold the old copy. Restart the wave: delete the snapshot and its plan copy, snapshot again, and re-dispatch every reviewer of that wave.
+2. Until the wave is recorded, change nothing tracked. QA artifacts go under `.omo/evidence/<plan basename>/wave-<n>/`; they are local and git-ignored (never staged), so the snapshot's clean-tree check is unaffected. Only the record and the `*trailer*` files are staged, in Phase 5. Between waves commit only fix code and the plan edits a fix or freeze needs. A commit with neither a delta review nor an exemption (step 5) blocks the next wave.
 3. After the wave's verdicts, before any fix, run `GC wave --lane F2 --snapshot <path from step 1>` with:
    - `--outcome qa=PASS|FAIL`, plus `--outcome <invocation>=PASS|FAIL|INCONCLUSIVE` for each invocation that ran, normalised as in Phases 2-3;
    - one `--blocker QA<n>` per failing QA row;
@@ -408,9 +410,10 @@ Applies when this review is a plan's merge gate. `GC` = `node $SKILL_DIR/scripts
      - re-plan: a separate plan for the affected mechanism;
      - continue: one more fix wave.
 
-     Record the answer with `GC decide --lane F2 --choice freeze|replan|continue --by <user> --reason <text>`. The script refuses freeze after failing QA or an INCONCLUSIVE invocation, because the record requires passing QA rows and a trailer per invocation. Without `ask` UI, report the numbers and options and stop.
-4. Each fix is first an `N.` row under `## TODOs`. A fix that adds a subsystem (process, proxy, store, staging tree, daemon, endpoint) is not a row: stop and plan it separately. Implement and commit.
+     Record the answer with `GC decide --lane F2 --choice freeze|replan|continue --by <user> --reason <text>`. The script refuses freeze after failing QA or an INCONCLUSIVE invocation, because the record requires passing QA rows and a trailer per invocation. Without `ask` UI, report the numbers and options and stop. Under Risk tier `internal-tooling` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; the script refuses continue there. Work that needs more rounds is product: re-tier it as in Phase 0.5, after which continue is legal.
+4. Each fix is first an `N.` row under `## TODOs`. A fix that adds a subsystem (process, proxy, store, staging tree, daemon, endpoint) is not a row: stop and plan it separately. Implement and commit. Verify in proportion: after each fix, the changed module's own tests plus RED for each new test; the full suite once per fix round, after its last code commit and before the next snapshot. A commit exempted in step 5 needs no tests.
 5. Review each contiguous commit range once, naming every row it implements:
+   Exempt instead, at your judgement, a commit that changes no behaviour and no review input: a final-verification checkbox, a comment, prose that no reviewer brief or criterion reads. Run `GC exempt --sha <commit> --reason <what it changes>`; the reason is in the ledger, so a wrong exemption stays visible. Like a delta verdict, an exemption decides the commit for the whole gate, F2 and F3 alike. Plan edits to criteria, residual risks, scope or `## TODOs` rows are review inputs: review them with their fix. A commit with a REJECT cannot be exempted. When in doubt, review.
    a. `GC patch --base <base> --head <head> --out .omo/gate-deltas/F2-<first row>-<head12>-<UTC yyyymmddHHMMSS>`. It writes one read-only patch per commit plus a manifest, and prints the manifest path.
    b. Dispatch one `task` item: `agent: "plan-reviewer"`, `solutionSpace: "Review of a fix delta; defects unknown"`, `task:` the delta brief below.
    c. Write the reviewer's structured result verbatim (copy the delivered payload or `read agent://<id>`, never retype it) to `verdict.json` in that directory, then run `GC delta --lane F2 --dir <dir> --row <id> [--row <id>…]`.
diff --git a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
index f9d8a20130..e977592215 100755
--- a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
+++ b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
@@ -1,20 +1,23 @@
 #!/usr/bin/env node
 // Gate-wave convergence and fix-delta coverage for review-work (F2) and integration-review (F3).
 // The skills call this script; it is the only writer and judge of the gate_baseline,
-// fix_delta_review, gate_wave and convergence_decision ledger events. Every decision is
+// fix_delta_review, delta_exemption, gate_wave, convergence_decision and risk_tier_change ledger events. Every decision is
 // deterministic and every undecidable state refuses rather than guesses.
 import { execFileSync, spawnSync } from "node:child_process"
 import { createHash } from "node:crypto"
 import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
 import path from "node:path"
 import { parseArgs } from "node:util"
+import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"
 
 class GateError extends Error {}
 const fail = (message) => {
   throw new GateError(message)
 }
 
-const OWN_EVENTS = new Set(["gate_baseline", "fix_delta_review", "gate_wave", "convergence_decision"])
+const OWN_EVENTS = new Set(["gate_baseline", "fix_delta_review", "delta_exemption", "gate_wave", "convergence_decision", "risk_tier_change"])
+const TIERS = new Set(["product", "internal-tooling"])
+const TOOLING_FIX_ROUNDS = 2
 const LANES = new Set(["F2", "F3"])
 const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
 const SHA = /^[0-9a-f]{40}$/
@@ -63,6 +66,7 @@ function append(repo, event) {
   appendFileSync(file, `${prefix}${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
 }
 
+const isSha256 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v)
 const isString = (v) => typeof v === "string" && v.length > 0
 const isSha = (v) => typeof v === "string" && SHA.test(v)
 const isShaList = (v) => Array.isArray(v) && v.every(isSha)
@@ -70,7 +74,7 @@ const isStringList = (v) => Array.isArray(v) && v.every(isString)
 
 // Field checks per own event; a wrong shape is undecidable, never silently skipped.
 const SHAPES = {
-  gate_baseline: { base_sha: isSha },
+  gate_baseline: { base_sha: isSha, risk_tier: (v) => v === undefined || TIERS.has(v) },
   fix_delta_review: {
     lane: (v) => LANES.has(v),
     rows: (v) => isStringList(v) && v.length > 0,
@@ -82,6 +86,7 @@ const SHAPES = {
     verdict_sha256: (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v),
     round: (v) => Number.isInteger(v) && v >= 1,
   },
+  delta_exemption: { sha: isSha, reason: isString },
   gate_wave: {
     lane: (v) => LANES.has(v),
     wave: (v) => Number.isInteger(v) && v >= 1,
@@ -100,6 +105,7 @@ const SHAPES = {
     by: isString,
     reason: isString,
   },
+  risk_tier_change: { from: (v) => v === "internal-tooling", to: (v) => v === "product", by: isString, reason: isString },
 }
 
 function readLedger(repo, key, { requireBaseline = true } = {}) {
@@ -118,7 +124,7 @@ function readLedger(repo, key, { requireBaseline = true } = {}) {
   if (baselines.length > 1) fail(`undecidable: ${baselines.length} gate_baseline events for ${key}`)
   if (baselines.length === 0) {
     if (requireBaseline) fail(`undecidable: no gate_baseline for ${key}; run baseline before the first gate wave`)
-    return { baseline: undefined, events: [] }
+    return { baseline: undefined, tier: undefined, events: [] }
   }
   const start = baselines[0].index
   const events = []
@@ -137,7 +143,25 @@ function readLedger(repo, key, { requireBaseline = true } = {}) {
     }
     events.push(event)
   }
-  return { baseline: baselines[0].value.base_sha, events }
+  let tier = baselines[0].value.risk_tier ?? "product"
+  for (const event of events) {
+    if (event.event !== "risk_tier_change") continue
+    if (event.from !== tier) fail(`undecidable: ledger risk_tier_change from ${event.from} while the gate runs as ${tier}`)
+    tier = event.to
+  }
+  return { baseline: baselines[0].value.base_sha, tier, events }
+}
+
+// The ledger state of a gate whose bound tier must match the plan's current Risk tier.
+function gateState(ctx) {
+  const state = readLedger(ctx.repo, ctx.key)
+  if (state.tier !== ctx.planTier) {
+    if (state.tier === "internal-tooling") {
+      fail("plan Risk tier is product but this gate runs as internal-tooling; record the change with retier --by <user> --reason <text>")
+    }
+    fail("plan Risk tier is internal-tooling but this gate runs as product; a gate never moves to internal-tooling: set the plan back to product or gate the work under a new plan file")
+  }
+  return state
 }
 
 function laneWaves(events, lane) {
@@ -148,11 +172,13 @@ function laneWaves(events, lane) {
   return waves
 }
 
+// The latest ledger event naming a commit decides it: a delta verdict, or the orchestrator's
+// exemption for a commit that changes no behaviour and no review input.
 function commitStates(repo, state, head) {
-  const deltas = state.events.filter((e) => e.event === "fix_delta_review")
+  const verdicts = state.events.filter((e) => e.event === "fix_delta_review" || e.event === "delta_exemption")
   return revList(repo, state.baseline, head).map((sha) => {
     let latest
-    for (const delta of deltas) if (delta.fix_shas.includes(sha)) latest = delta
+    for (const event of verdicts) if (event.event === "delta_exemption" ? event.sha === sha : event.fix_shas.includes(sha)) latest = event
     const status = latest === undefined ? "unreviewed" : latest.verdict === "REJECT" ? "rejected" : "accepted"
     return { sha, status }
   })
@@ -250,9 +276,12 @@ function blameCommit(repo, sha, { file, line }) {
   return out ? out.split(/\s/)[0] : null
 }
 
-function decide(waves, total, fixInduced) {
+function decide(waves, total, fixInduced, tier) {
   const n = waves.length + 1
   if (total === 0) return { decision: "PASS" }
+  if (tier === "internal-tooling" && n > TOOLING_FIX_ROUNDS) {
+    return { decision: "STOP", reason: `internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds; wave ${n} still has ${total} blockers` }
+  }
   if (n >= 2 && fixInduced > waves[n - 2].blockers_fix_induced) {
     return { decision: "STOP", reason: `fix-induced blockers rose from ${waves[n - 2].blockers_fix_induced} to ${fixInduced}` }
   }
@@ -280,13 +309,13 @@ const commands = {
     const { baseline } = readLedger(ctx.repo, ctx.key, { requireBaseline: false })
     if (baseline) return console.log(`BASELINE ${short(baseline)} existing`)
     const sha = resolveCommit(ctx.repo, ctx.values.sha)
-    append(ctx.repo, { event: "gate_baseline", plan: ctx.key, base_sha: sha })
+    append(ctx.repo, { event: "gate_baseline", plan: ctx.key, base_sha: sha, risk_tier: ctx.planTier })
     console.log(`BASELINE ${short(sha)} recorded`)
   },
 
   ready(ctx) {
     const lane = requireLane(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const reasons = readyReasons(ctx.repo, state, lane, resolveCommit(ctx.repo, "HEAD"))
     if (reasons.length === 0) return console.log("READY")
     console.log(["NOT READY", ...reasons].join("\n"))
@@ -295,7 +324,7 @@ const commands = {
 
   snapshot(ctx) {
     const lane = requireLane(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     if (trackedChanges(ctx.repo) !== "") {
       fail("working tree has uncommitted tracked changes; commit them (and review them as a delta) before the wave")
     }
@@ -303,10 +332,44 @@ const commands = {
     const reasons = readyReasons(ctx.repo, state, lane, head)
     if (reasons.length > 0) fail(`not ready: ${reasons.join("; ")}`)
     const wave = laneWaves(state.events, lane).length + 1
-    const file = path.join(ctx.repo, ".omo", "gate-deltas", `${lane}-wave-${wave}.snapshot.json`)
-    mkdirSync(path.dirname(file), { recursive: true })
-    writeFileSync(file, `${JSON.stringify({ lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]) })}\n`)
-    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}`)
+    const dir = path.join(ctx.repo, ".omo", "gate-deltas")
+    // The ledger numbers waves per plan, so the files carry the plan key too: another plan gated in
+    // this checkout starts its own wave 1 instead of meeting this plan's write-once snapshot.
+    const prefix = `${lane}-${sha256(ctx.key).slice(0, 12)}-wave-${wave}`
+    const file = path.join(dir, `${prefix}.snapshot.json`)
+    const planCopy = path.join(dir, `${prefix}.plan.md`)
+    mkdirSync(dir, { recursive: true })
+    // A wave's snapshot is write-once: reviewers may already be reading its plan copy, so any rerun
+    // only re-prints an unchanged snapshot. Other bytes, another commit or a partial pair mean the
+    // wave must be restarted deliberately, with every reviewer re-dispatched.
+    if (existsSync(file) || existsSync(planCopy)) {
+      let previous
+      let copyBytes
+      try {
+        previous = JSON.parse(readFileSync(file, "utf8"))
+        copyBytes = readFileSync(planCopy)
+      } catch {
+        previous = undefined
+      }
+      const same =
+        previous !== undefined &&
+        previous.sha === head &&
+        previous.plan_sha256 === ctx.planSha256 &&
+        previous.plan_copy === path.relative(ctx.repo, planCopy) &&
+        sha256(copyBytes) === ctx.planSha256
+      if (!same) {
+        fail(
+          `${lane} wave ${wave} already has a snapshot on other plan bytes or another commit, or an incomplete one; reviewers may hold the old copy. ` +
+            `Delete ${path.relative(ctx.repo, file)} and ${path.relative(ctx.repo, planCopy)}, then snapshot again and re-dispatch every reviewer of this wave`,
+        )
+      }
+      return console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}\nPLAN ${planCopy}`)
+    }
+    writeFileSync(planCopy, ctx.planBytes, { flag: "wx" })
+    chmodSync(planCopy, 0o444)
+    const record = { lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]), plan_sha256: ctx.planSha256, plan_copy: path.relative(ctx.repo, planCopy) }
+    writeFileSync(file, `${JSON.stringify(record)}\n`, { flag: "wx" })
+    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}\nPLAN ${planCopy}`)
   },
 
   patch(ctx) {
@@ -333,7 +396,7 @@ const commands = {
   delta(ctx) {
     const lane = requireLane(ctx.values)
     const rows = requireRows(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
     const head = resolveCommit(ctx.repo, "HEAD")
     if (!isAncestor(ctx.repo, state.baseline, checked.manifest.base_sha) || !isAncestor(ctx.repo, checked.manifest.head_sha, head)) {
@@ -365,7 +428,7 @@ const commands = {
   accept(ctx) {
     const lane = requireLane(ctx.values)
     if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("accept needs --by and --reason")
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
     const latest = state.events
       .filter((e) => e.event === "fix_delta_review" && e.base_sha === checked.manifest.base_sha && e.head_sha === checked.manifest.head_sha)
@@ -391,9 +454,21 @@ const commands = {
     console.log("RECORDED fix_delta_review verdict=accepted-risk")
   },
 
+  exempt(ctx) {
+    if (!isString(ctx.values.reason)) fail("exempt needs --reason")
+    const state = gateState(ctx)
+    const sha = resolveCommit(ctx.repo, ctx.values.sha)
+    const found = commitStates(ctx.repo, state, resolveCommit(ctx.repo, "HEAD")).find((entry) => entry.sha === sha)
+    if (!found) fail(`${short(sha)} is not a commit in baseline..HEAD`)
+    // A REJECT is closed by a covering review or the user's accept, never by the orchestrator alone.
+    if (found.status === "rejected") fail(`${short(sha)} has a REJECT; review a covering range again or accept it`)
+    append(ctx.repo, { event: "delta_exemption", plan: ctx.key, sha, reason: ctx.values.reason })
+    console.log(`RECORDED delta_exemption ${short(sha)}`)
+  },
+
   wave(ctx) {
     const lane = requireLane(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const waves = laneWaves(state.events, lane)
     const n = waves.length + 1
 
@@ -409,6 +484,17 @@ const commands = {
     if (snapshot.tree !== git(ctx.repo, ["rev-parse", "HEAD^{tree}"]) || trackedChanges(ctx.repo) !== "") {
       fail("state changed since the wave was dispatched: tracked files differ from the snapshot")
     }
+    if (!isSha256(snapshot.plan_sha256) || !isString(snapshot.plan_copy)) {
+      fail("state changed since the wave was dispatched: snapshot predates the pinned plan copy; retake the snapshot")
+    }
+    let pinned
+    try {
+      pinned = readFileSync(path.resolve(ctx.repo, snapshot.plan_copy))
+    } catch {
+      fail("state changed since the wave was dispatched: pinned plan copy differs from the snapshot")
+    }
+    if (sha256(pinned) !== snapshot.plan_sha256) fail("state changed since the wave was dispatched: pinned plan copy differs from the snapshot")
+    if (snapshot.plan_sha256 !== ctx.planSha256) fail("state changed since the wave was dispatched: plan bytes differ from the snapshot")
 
     const outcomes = {}
     for (const spec of ctx.values.outcome ?? []) {
@@ -454,7 +540,7 @@ const commands = {
       if (blamed.some((sha) => fixCommits.has(sha))) fixInduced.push(blocker.id)
       else if (blamed.length === 0) unlocated.push(blocker.id)
     }
-    const outcome = decide(waves, blockers.length, fixInduced.length)
+    const outcome = decide(waves, blockers.length, fixInduced.length, state.tier)
     append(ctx.repo, {
       event: "gate_wave",
       plan: ctx.key,
@@ -478,12 +564,15 @@ const commands = {
     const lane = requireLane(ctx.values)
     if (!CHOICES.has(ctx.values.choice)) fail("--choice must be freeze, replan or continue")
     if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("decide needs --by and --reason")
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const last = laneWaves(state.events, lane).at(-1)
     if (last?.decision !== "STOP") fail(`${lane} has no stopped wave to decide`)
     if (state.events.some((e) => e.event === "convergence_decision" && e.lane === lane && e.wave === last.wave)) {
       fail(`${lane} wave ${last.wave} is already decided`)
     }
+    if (state.tier === "internal-tooling" && last.wave > TOOLING_FIX_ROUNDS && ctx.values.choice === "continue") {
+      fail(`internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds per lane: choose freeze or replan, or re-tier the plan to product (retier) to continue`)
+    }
     if (lane === "F2" && ctx.values.choice === "freeze") {
       const outcomes = Object.values(last.outcomes)
       if (last.outcomes.qa !== "PASS" || outcomes.includes("INCONCLUSIVE")) {
@@ -493,6 +582,16 @@ const commands = {
     append(ctx.repo, { event: "convergence_decision", plan: ctx.key, lane, wave: last.wave, choice: ctx.values.choice, by: ctx.values.by, reason: ctx.values.reason })
     console.log(`RECORDED convergence_decision lane=${lane} wave=${last.wave} choice=${ctx.values.choice}`)
   },
+
+  retier(ctx) {
+    if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("retier needs --by and --reason")
+    // Not gateState: the tier mismatch is the reason this command runs.
+    const state = readLedger(ctx.repo, ctx.key)
+    if (state.tier !== "internal-tooling") fail(`this gate runs as ${state.tier}; retier moves internal-tooling to product only`)
+    if (ctx.planTier !== "product") fail("set - Risk tier: product in the plan before retier")
+    append(ctx.repo, { event: "risk_tier_change", plan: ctx.key, from: "internal-tooling", to: "product", by: ctx.values.by, reason: ctx.values.reason })
+    console.log("RECORDED risk_tier_change internal-tooling -> product")
+  },
 }
 
 function main() {
@@ -522,18 +621,25 @@ function main() {
   if (!isString(values.repo)) fail("--repo is required")
   const repo = path.resolve(values.repo)
   let key
+  let planBytes
+  let planTier
+  let planSha256
   if (command !== "patch") {
     if (!isString(values.plan)) fail("--plan is required")
     const resolved = path.resolve(repo, values.plan)
     try {
-      readFileSync(resolved)
+      planBytes = readFileSync(resolved)
     } catch {
       fail(`plan ${values.plan} is not readable`)
     }
+    planSha256 = sha256(planBytes)
+    const parsed = readRiskTier(mergeGateSection(planContent(scanMarkdown(planBytes.toString("utf8")))))
+    if (parsed.error) fail(`plan Risk tier: ${parsed.error}`)
+    planTier = parsed.tier
     const relative = path.relative(repo, resolved)
     key = relative.startsWith("..") || path.isAbsolute(relative) ? resolved : relative
   }
-  commands[command]({ repo, key, values })
+  commands[command]({ repo, key, values, planBytes, planTier, planSha256 })
 }
 
 try {
diff --git a/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs b/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
index dd2ba202b8..6651ed5850 100644
--- a/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
+++ b/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
@@ -1,6 +1,7 @@
 import assert from "node:assert/strict"
 import { execFileSync, spawnSync } from "node:child_process"
-import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
+import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
+import { createHash } from "node:crypto"
 import { tmpdir } from "node:os"
 import path from "node:path"
 import test from "node:test"
@@ -147,6 +148,27 @@ test("#given a fix commit after a wave #when ready runs #then it names the commi
   assert.equal(after.stdout.trim(), "READY")
 })
 
+test("#given a commit after a wave #when the orchestrator exempts it with a reason #then ready passes in both lanes, while a rejected commit cannot be exempted in either", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  assert.equal(s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "B1").status, 0)
+  const tick = s.commit("docs/plan.md", "- [x] F2\n", "tick F2")
+  for (const lane of ["F2", "F3"]) assert.match(s.gc("ready", "--lane", lane).stdout, new RegExp(`unreviewed fix commit ${tick.slice(0, 12)}`))
+  assert.equal(s.gc("exempt", "--sha", tick).status, 1)
+  const exempted = s.gc("exempt", "--sha", tick, "--reason", "checkbox only")
+  assert.equal(exempted.status, 0, exempted.stderr)
+  // Like a delta verdict, an exemption decides the commit for the whole gate, so both lanes read it.
+  for (const lane of ["F2", "F3"]) assert.equal(s.gc("ready", "--lane", lane).stdout.trim(), "READY")
+  const base = s.head()
+  const fix = s.commit("src/a.ts", "line one\nbroken\nline three\n", "fix R1")
+  assert.equal(s.delta("F3", base, fix, "REJECT").result.status, 0)
+  const refused = s.gc("exempt", "--sha", fix, "--reason", "comment only")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, /has a REJECT/)
+  assert.equal(s.ledger().filter((e) => e.event === "delta_exemption").length, 1)
+  for (const lane of ["F2", "F3"]) assert.match(s.gc("ready", "--lane", lane).stdout, new RegExp(`rejected fix commit ${fix.slice(0, 12)}`))
+})
+
 test("#given a rejected commit #when only its amendment is approved #then it stays open until a covering range is accepted", (t) => {
   const s = sandbox(t)
   s.gc("baseline", "--sha", "HEAD")
@@ -330,3 +352,250 @@ test("#given a ledger without a trailing newline #when an event is appended #the
   assert.deepEqual(JSON.parse(lines[0]), { ts: "x", event: "merge", plan: "other" })
   assert.equal(JSON.parse(lines[1]).event, "gate_baseline")
 })
+
+// Risk tier: the tier is bound at baseline, internal-tooling lanes stop after two fix rounds, and
+// every wave pins the plan bytes its reviewers read.
+const tierPlan = (s, tier) => writeFileSync(path.join(s.repo, PLAN), `# demo\n\n## Merge gate\n- Mandatory class: none\n- Risk tier: ${tier}\n`)
+const waveEvents = (s) => s.ledger().filter((e) => e.event === "gate_wave")
+
+function toolingStop(s) {
+  tierPlan(s, "internal-tooling")
+  s.gc("baseline", "--sha", "HEAD")
+  let last
+  for (const [index, count] of [3, 2, 1].entries()) {
+    last = s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=FAIL", ...blockers(`W${index}B`, count))
+  }
+  return last
+}
+
+test("#given an internal-tooling plan with totals 3, 2, 1 #when the third wave records #then the fix-round cap stops it", (t) => {
+  const s = sandbox(t)
+  tierPlan(s, "internal-tooling")
+  s.gc("baseline", "--sha", "HEAD")
+  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "internal-tooling")
+  let last
+  for (const [index, count] of [3, 2, 1].entries()) {
+    last = s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count))
+    if (index < 2) {
+      assert.equal(last.status, 0, last.stderr)
+      assert.equal(first(last.stdout), "DECISION: CONTINUE")
+    }
+  }
+  assert.equal(last.status, 3, last.stderr)
+  assert.equal(first(last.stdout), "DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers")
+})
+
+test("#given an internal-tooling cap STOP #when decide runs #then continue is refused and freeze is recorded", (t) => {
+  const s = sandbox(t)
+  assert.equal(toolingStop(s).status, 3)
+  const refused = s.gc("decide", "--lane", "F2", "--choice", "continue", "--by", "tim", "--reason", "t")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, /internal-tooling allows 2 fix rounds per lane/)
+  assert.equal(s.gc("decide", "--lane", "F2", "--choice", "freeze", "--by", "tim", "--reason", "t").status, 0)
+})
+
+test("#given an internal-tooling gate whose plan moves to product #when commands run #then they refuse until retier, and after retier the lane runs as product", (t) => {
+  const s = sandbox(t)
+  tierPlan(s, "internal-tooling")
+  s.gc("baseline", "--sha", "HEAD")
+  for (const [index, count] of [3, 2].entries()) {
+    assert.equal(s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count)).status, 0)
+  }
+  tierPlan(s, "product")
+  const refused = s.gc("snapshot", "--lane", "F2")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, /record the change with retier/)
+  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
+  assert.equal(retier.status, 0, retier.stderr)
+  assert.equal(first(retier.stdout), "RECORDED risk_tier_change internal-tooling -> product")
+  const third = s.wave("F2", "--outcome", "qa=FAIL", ...blockers("W2B", 1))
+  assert.equal(third.status, 0, third.stderr)
+  assert.equal(first(third.stdout), "DECISION: CONTINUE")
+  assert.equal(s.ledger().filter((e) => e.event === "risk_tier_change").length, 1)
+  const again = s.gc("retier", "--by", "tim", "--reason", "t")
+  assert.equal(again.status, 1)
+  assert.match(again.stderr, /this gate runs as product/)
+})
+
+test("#given a product gate whose plan moves to internal-tooling #when snapshot or retier runs #then both refuse", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  tierPlan(s, "internal-tooling")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  assert.equal(snap.status, 1)
+  assert.match(snap.stderr, /never moves to internal-tooling/)
+  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
+  assert.equal(retier.status, 1)
+  assert.match(retier.stderr, /this gate runs as product/)
+})
+
+test("#given a snapshot #when it is written #then the plan copy is exact, read-only and named on stdout", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  assert.equal(snap.status, 0, snap.stderr)
+  const lines = snap.stdout.split("\n")
+  const copy = lines[2].replace(/^PLAN /, "")
+  assert.ok(lines[2].startsWith("PLAN ") && path.isAbsolute(copy), lines[2])
+  const source = readFileSync(path.join(s.repo, PLAN))
+  assert.deepEqual(readFileSync(copy), source)
+  assert.equal(statSync(copy).mode & 0o777, 0o444)
+  const json = JSON.parse(readFileSync(lines[0], "utf8"))
+  assert.equal(json.plan_sha256, createHash("sha256").update(source).digest("hex"))
+  assert.equal(path.join(s.repo, json.plan_copy), copy)
+})
+
+test("#given a source plan changed and restored after snapshot #when the pinned copy is read and the wave records #then the copy stays original and the wave passes", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  const copy = snap.stdout.split("\n")[2].replace(/^PLAN /, "")
+  const original = readFileSync(path.join(s.repo, PLAN))
+  writeFileSync(path.join(s.repo, PLAN), "# changed\n")
+  assert.deepEqual(readFileSync(copy), original)
+  writeFileSync(path.join(s.repo, PLAN), original)
+  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
+  assert.equal(result.status, 0, result.stderr)
+})
+
+test("#given a pinned plan copy is tampered with #when the wave records #then it is refused and nothing is written", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  const copy = snap.stdout.split("\n")[2].replace(/^PLAN /, "")
+  chmodSync(copy, 0o644)
+  writeFileSync(copy, "# tampered\n")
+  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /pinned plan copy differs/)
+  assert.equal(waveEvents(s).length, 0)
+})
+
+test("#given a snapshot taken before a retier #when the wave records on it #then it is refused and nothing is written", (t) => {
+  const s = sandbox(t)
+  tierPlan(s, "internal-tooling")
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  tierPlan(s, "product")
+  assert.equal(s.gc("retier", "--by", "tim", "--reason", "t").status, 0)
+  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /plan bytes differ from the snapshot/)
+  assert.equal(waveEvents(s).length, 0)
+})
+
+test("#given a same-tier plan edit between snapshot and wave #when the wave records #then it is refused and nothing is written", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after dispatch\n")
+  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /plan bytes differ from the snapshot/)
+  assert.equal(waveEvents(s).length, 0)
+})
+
+const REFUSED_RESNAPSHOT = /F2 wave 1 already has a snapshot on other plan bytes or another commit, or an incomplete one/
+
+test("#given an unrecorded wave snapshot #when snapshot reruns unchanged #then neither file is rewritten, and other plan bytes are refused until both files are deleted", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const first = s.gc("snapshot", "--lane", "F2")
+  assert.equal(first.status, 0, first.stderr)
+  const [file, , planLine] = first.stdout.split("\n")
+  const copy = planLine.replace(/^PLAN /, "")
+  const dispatched = readFileSync(copy)
+  const json = readFileSync(file, "utf8")
+  const written = [statSync(copy).mtimeMs, statSync(file).mtimeMs]
+  const again = s.gc("snapshot", "--lane", "F2")
+  assert.equal(again.status, 0, again.stderr)
+  assert.equal(again.stdout, first.stdout)
+  assert.deepEqual([statSync(copy).mtimeMs, statSync(file).mtimeMs], written)
+  assert.equal(statSync(copy).mode & 0o777, 0o444)
+  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after dispatch\n")
+  const refused = s.gc("snapshot", "--lane", "F2")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
+  assert.deepEqual(readFileSync(copy), dispatched)
+  assert.equal(readFileSync(file, "utf8"), json)
+  rmSync(file)
+  chmodSync(copy, 0o600)
+  rmSync(copy)
+  const retaken = s.gc("snapshot", "--lane", "F2")
+  assert.equal(retaken.status, 0, retaken.stderr)
+  assert.notDeepEqual(readFileSync(copy), dispatched)
+  assert.equal(waveEvents(s).length, 0)
+})
+
+test("#given an unrecorded wave snapshot #when a new commit with the same tree lands and snapshot reruns #then it is refused and the dispatched SHA stays", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const first = s.gc("snapshot", "--lane", "F2")
+  const file = first.stdout.split("\n")[0]
+  const json = readFileSync(file, "utf8")
+  s.git("commit", "-q", "--allow-empty", "-m", "empty")
+  const delta = s.delta("F2", JSON.parse(json).sha, s.head(), "OKAY")
+  assert.equal(delta.result.status, 0, delta.result.stderr)
+  const refused = s.gc("snapshot", "--lane", "F2")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
+  assert.equal(readFileSync(file, "utf8"), json)
+})
+
+test("#given a plan copy without its snapshot JSON #when snapshot runs #then it is refused and the copy is not replaced", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const first = s.gc("snapshot", "--lane", "F2")
+  const [file, , planLine] = first.stdout.split("\n")
+  const copy = planLine.replace(/^PLAN /, "")
+  const dispatched = readFileSync(copy)
+  rmSync(file)
+  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after the JSON was lost\n")
+  const refused = s.gc("snapshot", "--lane", "F2")
+  assert.equal(refused.status, 1)
+  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
+  assert.deepEqual(readFileSync(copy), dispatched)
+  assert.equal(existsSync(file), false)
+})
+
+test("#given one plan's retained wave-1 snapshot #when a second plan in the same checkout snapshots its wave 1 #then it gets its own files and the first plan's stay untouched", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const first = s.gc("snapshot", "--lane", "F2")
+  const [firstFile, , firstPlanLine] = first.stdout.split("\n")
+  const firstJson = readFileSync(firstFile, "utf8")
+  const OTHER = ".omo/plans/other.md"
+  writeFileSync(path.join(s.repo, OTHER), "# other plan\n")
+  const other = (...args) => s.run(args[0], "--plan", OTHER, ...args.slice(1))
+  assert.equal(other("baseline", "--sha", "HEAD").status, 0)
+  const second = other("snapshot", "--lane", "F2")
+  assert.equal(second.status, 0, second.stderr)
+  const [secondFile, , secondPlanLine] = second.stdout.split("\n")
+  assert.notEqual(secondFile, firstFile)
+  assert.equal(readFileSync(secondPlanLine.replace(/^PLAN /, ""), "utf8"), "# other plan\n")
+  assert.equal(readFileSync(firstFile, "utf8"), firstJson)
+  assert.deepEqual(readFileSync(firstPlanLine.replace(/^PLAN /, "")), readFileSync(path.join(s.repo, PLAN)))
+})
+
+test("#given a legacy snapshot without the plan fields #when wave runs #then it is refused and nothing is written", (t) => {
+  const s = sandbox(t)
+  s.gc("baseline", "--sha", "HEAD")
+  const snap = s.gc("snapshot", "--lane", "F2")
+  const file = snap.stdout.split("\n")[0]
+  const json = JSON.parse(readFileSync(file, "utf8"))
+  delete json.plan_sha256
+  delete json.plan_copy
+  writeFileSync(file, `${JSON.stringify(json)}\n`)
+  const result = s.gc("wave", "--lane", "F2", "--snapshot", file, "--outcome", "qa=PASS")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /retake|plan_sha256|snapshot/)
+  assert.equal(waveEvents(s).length, 0)
+})
+
+test("#given a personal tier #when baseline runs #then it is refused", (t) => {
+  const s = sandbox(t)
+  tierPlan(s, "personal")
+  const result = s.gc("baseline", "--sha", "HEAD")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /plan Risk tier: personal plans run no merge gate/)
+})
diff --git a/team-config/agent/skills/review-work/scripts/plan-contract.mjs b/team-config/agent/skills/review-work/scripts/plan-contract.mjs
new file mode 100644
index 0000000000..50db501939
--- /dev/null
+++ b/team-config/agent/skills/review-work/scripts/plan-contract.mjs
@@ -0,0 +1,87 @@
+// omp-local plan contract. Code fences and HTML comments are not plan content: a template or an
+// example quoted there must neither satisfy nor skip a plan check. Every plan parser reads the
+// content-only text, so a plan without fences or comments parses exactly as before.
+export const SECTION_PATTERN = /^## Merge gate\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m
+
+export function scanMarkdown(text) {
+  const lines = []
+  let fence = null
+  let inComment = false
+  for (const raw of text.split("\n")) {
+    if (fence !== null) {
+      // A closer may not sit deeper than its opener: plans quote list-indented fences inside an
+      // outer fence, and CommonMark's 0-3 space closer would end the outer fence there.
+      const close = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(raw)
+      if (close && close[1].length <= fence.indent && close[2][0] === fence.marker[0] && close[2].length >= fence.marker.length) fence = null
+      lines.push({ text: raw, content: false })
+      continue
+    }
+    if (!inComment) {
+      const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(raw)
+      // A backtick fence's info string carries no backtick; "```a``` b" is inline code, not a fence.
+      if (open && !(open[2][0] === "`" && open[3].includes("`"))) {
+        fence = { indent: open[1].length, marker: open[2] }
+        lines.push({ text: raw, content: false })
+        continue
+      }
+    }
+    let rest = raw
+    let kept = ""
+    while (rest.length > 0) {
+      if (inComment) {
+        const end = rest.indexOf("-->")
+        if (end === -1) break
+        rest = rest.slice(end + 3)
+        inComment = false
+      } else {
+        const start = rest.indexOf("<!--")
+        if (start === -1) {
+          kept += rest
+          break
+        }
+        kept += rest.slice(0, start)
+        rest = rest.slice(start + 4)
+        inComment = true
+      }
+    }
+    if (kept === raw) lines.push({ text: raw, content: true })
+    else lines.push({ text: kept.trimEnd(), content: kept.trim() !== "" })
+  }
+  return lines
+}
+
+export function planContent(lines) {
+  return lines.filter((line) => line.content).map((line) => line.text).join("\n")
+}
+
+export function mergeGateSection(content) {
+  return content.match(SECTION_PATTERN)?.[1]
+}
+
+const TIER_LINE = /^-\s+(?:\*\*)?Risk tier(?:\*\*)?\s*:(?:\*\*)?(.*)$/i
+const CLASS_LINE = /^-\s+(?:\*\*)?Mandatory class(?:\*\*)?\s*:(?:\*\*)?(.*)$/i
+
+const normalise = (value) => value.replace(/[`*]/g, "").trim().toLowerCase()
+
+// Reads the plan's Risk tier from the output of mergeGateSection (possibly undefined). Never throws.
+export function readRiskTier(section) {
+  if (section === undefined) return { tier: "product" }
+  const lines = section.split("\n")
+  const tierLines = lines.map((line) => TIER_LINE.exec(line)).filter(Boolean)
+  if (tierLines.length === 0) return { tier: "product" }
+  if (tierLines.length > 1) return { error: "duplicate" }
+  const tier = normalise(tierLines[0][1])
+  if (tier === "personal") {
+    return { error: "personal plans run no merge gate; replace the section with the top-level bullet - Merge gate: not applicable (<reason>)" }
+  }
+  if (tier !== "product" && tier !== "internal-tooling") {
+    return { error: "must be exactly product or internal-tooling; put the reason in Author's risk assessment" }
+  }
+  if (tier === "internal-tooling") {
+    const classLines = lines.map((line) => CLASS_LINE.exec(line)).filter(Boolean)
+    if (classLines.length !== 1 || normalise(classLines[0][1]) !== "none") {
+      return { error: "internal-tooling requires exactly one Mandatory class bullet whose whole value is none; a mandatory class makes the plan product" }
+    }
+  }
+  return { tier }
+}
diff --git a/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs b/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
index 651d02d403..983c8a6401 100644
--- a/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
+++ b/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
@@ -4,6 +4,7 @@ import { createHash } from "node:crypto"
 import { readFileSync, realpathSync, statSync } from "node:fs"
 import path from "node:path"
 import { parseArgs } from "node:util"
+import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"
 
 class GateError extends Error {}
 
@@ -516,10 +517,6 @@ function reconcileBlockers(scalars, narrative, field) {
   return ids
 }
 
-// omp-local plan contract. Code fences and HTML comments are not plan content: a template or an
-// example quoted there must neither satisfy nor skip a plan check. Every plan parser reads the
-// content-only text, so a plan without fences or comments parses exactly as before.
-const SECTION_PATTERN = /^## Merge gate\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m
 const CRITERIA_HEADER_PATTERN = /^(\s*)-\s+(?:\*\*)?Feature-specific criteria\b[^\n]*(?:\*\*)?\s*:?\s*$/mi
 // The opt-out is one top-level bullet. A glued suffix (`not applicableXYZ`) is not a declaration.
 const OPT_OUT_PATTERN = /^-\s+(?:\*\*)?Merge gate(?:\*\*)?\s*:\s*(?:\*\*)?\s*not applicable(?=$|[\s(.,;:\u2013\u2014])/i
@@ -527,59 +524,10 @@ const ABORT_FIELDS = ["Accepted residual risks", "Out of scope for blocking"]
 const DEFERRAL_MARKERS = new Set(["tbd", "tba", "tbc", "todo", "fixme", "xxx", "n/a", "na", "?", "-", "...", "\u2026"])
 const DEFERRAL_PREFIX = /^(?:tbd|tba|tbc|todo|fixme|xxx|n\/a)(?!\p{L})/u
 
-function scanMarkdown(text) {
-  const lines = []
-  let fence = null
-  let inComment = false
-  for (const raw of text.split("\n")) {
-    if (fence !== null) {
-      // A closer may not sit deeper than its opener: plans quote list-indented fences inside an
-      // outer fence, and CommonMark's 0-3 space closer would end the outer fence there.
-      const close = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(raw)
-      if (close && close[1].length <= fence.indent && close[2][0] === fence.marker[0] && close[2].length >= fence.marker.length) fence = null
-      lines.push({ text: raw, content: false })
-      continue
-    }
-    if (!inComment) {
-      const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(raw)
-      // A backtick fence's info string carries no backtick; "```a``` b" is inline code, not a fence.
-      if (open && !(open[2][0] === "`" && open[3].includes("`"))) {
-        fence = { indent: open[1].length, marker: open[2] }
-        lines.push({ text: raw, content: false })
-        continue
-      }
-    }
-    let rest = raw
-    let kept = ""
-    while (rest.length > 0) {
-      if (inComment) {
-        const end = rest.indexOf("-->")
-        if (end === -1) break
-        rest = rest.slice(end + 3)
-        inComment = false
-      } else {
-        const start = rest.indexOf("<!--")
-        if (start === -1) {
-          kept += rest
-          break
-        }
-        kept += rest.slice(0, start)
-        rest = rest.slice(start + 4)
-        inComment = true
-      }
-    }
-    if (kept === raw) lines.push({ text: raw, content: true })
-    else lines.push({ text: kept.trimEnd(), content: kept.trim() !== "" })
-  }
-  return lines
-}
-
-function planContent(lines) {
-  return lines.filter((line) => line.content).map((line) => line.text).join("\n")
-}
-
-function mergeGateSection(content) {
-  return content.match(SECTION_PATTERN)?.[1]
+function riskTier(section) {
+  const parsed = readRiskTier(section)
+  if (parsed.error) block("plan Risk tier", parsed.error)
+  return parsed.tier
 }
 
 function validateCriteria(section) {
@@ -673,6 +621,7 @@ function validatePlanContract(planText) {
   }
   validateCriteria(section)
   validateAbortRuleFields(section)
+  riskTier(section)
 }
 
 function validateRecord(record, context) {
@@ -736,6 +685,9 @@ function validateRecord(record, context) {
   if (!mandatoryClasses.has(record.mandatory_class)) {
     block("mandatory_class", "must be none, auth-secrets-pii, schema-migration, wire-contract-api, or concurrency-state")
   }
+  if (context.riskTier === "internal-tooling" && record.mandatory_class !== "none") {
+    block("mandatory_class", "the plan declares Risk tier internal-tooling, which requires none; a mandatory class makes the work product: set - Risk tier: product, run gate-convergence retier, and review again")
+  }
 
   const implementationModels = requireArray(record, "implementation_models")
   if (implementationModels.length === 0) {
@@ -760,6 +712,9 @@ function validateRecord(record, context) {
       if (!reviewerSet.has(required)) block("reviewers_run", `mandatory_class requires missing invocation ${required}`)
     }
   }
+  if (context.riskTier === "internal-tooling" && (reviewers.length !== 1 || reviewers[0] !== "implementation-audit")) {
+    block("reviewers_run", "the plan declares Risk tier internal-tooling, which runs exactly implementation-audit; for no reviewer or a second one, use Risk tier product")
+  }
 
   const resolutions = requireArray(record, "resolution")
   const verdicts = requireArray(record, "verdicts")
@@ -926,7 +881,8 @@ function main() {
     validatePlanContract(planText)
     return "passed"
   }
-  validateCriteria(mergeGateSection(planContent(scanMarkdown(planText))))
+  const section = mergeGateSection(planContent(scanMarkdown(planText)))
+  validateCriteria(section)
   const recordPath = path.resolve(repo, values.record)
   const context = {
     head: execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
@@ -935,6 +891,7 @@ function main() {
     planText,
     pinned: new Set(),
     repo,
+    riskTier: riskTier(section),
   }
   // PHASE 2 begins here. The plan and every trailer are pinned by `validateRecord` against their
   // recorded digests; the record itself cannot self-bind, so it has its own admission.
diff --git a/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs b/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
index f0481ae006..575e497972 100644
--- a/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
+++ b/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
@@ -482,7 +482,7 @@ function planOnly(text) {
   }
 }
 
-function fullMode(text) {
+function fullMode(text, mutate = () => {}) {
   const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-abort-"))
   try {
     const planPath = path.join(directory, "plan.md")
@@ -490,6 +490,7 @@ function fullMode(text) {
     const record = validRecord()
     record.plan = path.relative(sandboxRepo, planPath)
     record.plan_sha256 = planDigest(planPath)
+    mutate(record)
     return run(record, { plan: planPath })
   } finally {
     rmSync(directory, { recursive: true, force: true })
@@ -510,6 +511,8 @@ const acceptedPlans = [
   // A list-indented fence inside an outer fence must not close the outer one: the onara
   // AGENTS_MD_SLIM_PLAN quotes "  ```python ... ```" inside "```markdown", then opts out.
   ["an opt-out after an outer fence quoting an indented fence", `# Plan\n\n${fence}markdown\n- example:\n\n  ${fence}python\n  x = 1\n  ${fence}\n${fence}\n\n- Merge gate: not applicable (docs-only)\n`],
+  ["an internal-tooling tier with Mandatory class none", gatedPlan({ after: "- Risk tier: internal-tooling\n" })],
+  ["a bold product tier", gatedPlan({ after: "- **Risk tier:** product\n" })],
 ]
 
 for (const [name, text] of acceptedPlans) {
@@ -546,6 +549,15 @@ const blockedPlans = [
   ["an opt-out with a slash suffix", "# Plan\n- Merge gate: not applicable/xyz\n", /Merge gate: section is required/],
   ["an opt-out together with feature criteria", gatedPlan({ after: "- Merge gate: not applicable (contradiction)\n" }), /opt-out.*criteria|criteria.*opt-out/i],
   ["a Merge gate heading only inside a fence", `# Plan\n${fence}\n## Merge gate\n${criteriaBlock}${fence}\n`, /Merge gate: section is required/],
+  ["a personal tier", gatedPlan({ after: "- Risk tier: personal\n" }), /plan Risk tier: personal plans run no merge gate.*not applicable/],
+  ["an unknown tier", gatedPlan({ after: "- Risk tier: internal\n" }), /plan Risk tier: must be exactly product or internal-tooling/],
+  ["the template tier line", gatedPlan({ after: "- Risk tier: <product | internal-tooling>\n" }), /plan Risk tier: must be exactly/],
+  ["a tier with an inline reason", gatedPlan({ after: "- Risk tier: internal-tooling (or product)\n" }), /plan Risk tier: must be exactly/],
+  ["a duplicate tier", gatedPlan({ after: "- Risk tier: product\n- Risk tier: product\n" }), /plan Risk tier: duplicate/],
+  ["internal-tooling with a mandatory class", gatedPlan({ after: "- Risk tier: internal-tooling\n" }).replace("- Mandatory class: none", "- Mandatory class: auth-secrets-pii"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/],
+  ["internal-tooling with none plus a parenthesised class", gatedPlan({ after: "- Risk tier: internal-tooling\n" }).replace("- Mandatory class: none", "- Mandatory class: none (auth-secrets-pii)"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/],
+  ["internal-tooling with none plus a listed class", gatedPlan({ after: "- Risk tier: internal-tooling\n" }).replace("- Mandatory class: none", "- Mandatory class: none, concurrency-state"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/],
+  ["internal-tooling without a Mandatory class bullet", gatedPlan({ after: "- Risk tier: internal-tooling\n" }).replace("- Mandatory class: none\n", ""), /plan Risk tier: internal-tooling requires exactly one Mandatory class/],
 ]
 
 for (const [name, text, expected] of blockedPlans) {
@@ -558,6 +570,25 @@ for (const [name, text, expected] of blockedPlans) {
   })
 }
 
+const IT = gatedPlan({ after: "- Risk tier: internal-tooling\n" })
+
+test("#given an internal-tooling plan #when full mode validates the pass record #then it exits zero", () => {
+  const result = fullMode(IT)
+  assert.equal(result.status, 0, result.stderr)
+})
+
+for (const [name, mutate, field] of [
+  ["a mandatory class", (r) => { r.mandatory_class = "auth-secrets-pii" }, "mandatory_class"],
+  ["no reviewer", (r) => { r.reviewers_run = [] }, "reviewers_run"],
+  ["a second reviewer", (r) => { r.reviewers_run = ["implementation-audit", "strategic-risk-review"] }, "reviewers_run"],
+]) {
+  test(`#given an internal-tooling plan and a record outside its reviewer contract #when full mode runs #then the named field blocks (${name})`, () => {
+    const result = fullMode(IT, mutate)
+    assert.equal(result.status, 1)
+    assert.match(result.stderr, new RegExp(`^${field}: the plan declares Risk tier internal-tooling`))
+  })
+}
+
 test("#given a prior-shape plan without abort fields #when validated #then full mode passes and --plan-only blocks", () => {
   const prior = gatedPlan({ risks: "", scope: "" })
   assert.equal(fullMode(prior).status, 0, "full mode must keep accepting plans that predate the abort fields")
```

Manual QA matrix:
# F1 QA matrix: review-risk-tier

Head: 8e9b1a1e8afdb8ca54d34912efda50e18168a377. Artifact paths are relative to `.omo/evidence/review-risk-tier/`.

Verification 5 was run four times. Trials from the first three runs are INFRA or superseded and are not evidence:

- `runs-v1-infra/`: the post-run check found the branch and control agent dirs differing beyond the one rule file, because trials wrote runtime state into them.
- `runs-v2-superseded/`: the trial copies were not checked against the templates before launch (F3 fix-delta round 1).
- `runs-v3-confounded/`: branch-above and control-above ran in different scratch repos (F3 wave 2, B1).

The fourth run keeps `$A` and `$C` as untouched templates. Each template has a per-file SHA-256 map frozen at the pre-run inventory (`runs/branch.json`, `runs/control.json`). Every trial copies its template into a fresh trial-owned directory, checks that copy against the frozen map before omp starts, and launches with that copy as `PI_CODING_AGENT_DIR`. All trials and the wave refusal use one scratch repo (tracked: `.gitignore`, `README`; `.omo/` untracked, as in this repo) and one pinned copy. `runs/pinned-snapshot.txt` lists the repo files before the trials; the same command after the trials and the refusal printed the identical list (job output, not saved to a file). The helper hashes equal those of the third run. `runtime-inventory.txt` holds the pre and post checks; every row passes and all identities equal the pre-run values. `/tmp/rrt-*` was removed afterwards and the evidence secret scan is clean.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | RED for step 1 | new validator rows against the unchanged scripts | new blocked/tier rows fail | 12 fail | PASS | red-step1.txt |
| 2 | RED for step 2 | new convergence rows against the unchanged script | new cap/tier/pinned rows fail | fail as listed | PASS | red-step2.txt |
| 3 | Suites green | `bun run test:team-config` on 8e9b1a1e8afd | 0 fail | 444 pass, 0 fail | PASS | green.txt |
| 3a | Cap RED on the real code (Verification 2) | delete the `decide()` cap line, `bun test gate-convergence.test.mjs`, restore from backup | cap tests fail; file restored | 2 fail (fix-round cap, continue refused), 24 pass; restore: `git diff --quiet` exit 0, file hash = HEAD blob | PASS | red-cap.txt, red-cap-restore.txt |
| 3b | Plan-only smoke (Verification 3) | real validator `--plan-only` on the four plan states | blocked/blocked/passed/passed, exit 1/1/0/0 | `auth-secrets-pii` blocked exit 1; `none (auth-secrets-pii)` blocked exit 1; `none` passed exit 0; tier line deleted passed exit 0 | PASS | smoke-plan-only.txt |
| 3c | Convergence smoke (Verification 4) | scratch repo, internal-tooling plan, waves 3/2/1 blockers, decide, retier | waves 1-2 CONTINUE exit 0; wave 3 STOP exit 3; decide continue exit 1 naming the cap; ready exit 1 naming retier; retier recorded; second decide exit 0; grep `1` | exactly as expected | PASS | smoke-convergence.txt |
| 3d | Classifier self-check | synthetic MODEL fixture plus one fixture per INFRA condition | MODEL for the complete fixture; INFRA for loss, missing END, dead proxy, nonzero exit, empty, truncated, drift, copy mismatch, no router CONNECT | as expected; classifier hash equals the one used in the scored run | PASS | classifier-selfcheck.txt |
| 4 | Copy-check control | freeze a scratch template; unchanged copy, then change one rule file after freezing | unchanged `COPY-OK`; mutated `COPY-MISMATCH`, INFRA | `COPY-OK files=436`; `COPY-MISMATCH differs rules/plan-review-process.md`; `INFRA trial agent copy differs from the frozen template map` | PASS | runs/copy-check-control.txt, runs/copy-ok/, runs/copy-mutated/ |
| 5 | Pinned snapshot | `GC baseline`, `GC snapshot --lane F2`, then overwrite the source plan with the below fixture | copy mode 444, copy = snapshot digest = above fixture; source digest changes | `92671c25…` for all three; source `ed2fd9cd…` | PASS | runs/pinned-snapshot.txt |
| 6 | branch-above | deployed omp, branch rules, reviewer given the pinned copy | MODEL REJECT with a PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=yes blockers=5` | PASS | runs/branch-above/ |
| 7 | Wave refusal | `GC wave --lane F2 --snapshot $SNAP --outcome qa=PASS --outcome implementation-audit=PASS` after the source changed | exit 1, `plan bytes differ from the snapshot`, no `gate_wave` | as expected; `gate_wave-count=0` | PASS | runs/pinned-wave-refusal.txt |
| 8 | control-above | same repo and pinned copy as 6, one-file control rule | MODEL, no PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=no blockers=6` | PASS | runs/control-above/ |
| 9 | branch-below | branch rules, reviewer given the mutated source (below fixture) | MODEL, no PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=no blockers=4` | PASS | runs/branch-below/ |
| 10 | Dependency loss mid-review | `--mode json`; the proxy is killed after router traffic follows the task start | INFRA | `COPY-OK`; LOSS 0.2 s after TASK-START; CLI exit 124; `INFRA dependency loss recorded` | PASS | runs/killed-below/ |

## Re-run on head 18867ae3fd0f0ba5e1e5399c22c772b97b5ffd50

Since 8e9b1a1 only `gate-convergence.mjs`, its tests and the two skills' prose changed (rows 3-7 of `## TODOs`); the validator, `plan-contract.mjs` and every rule file are byte-identical, so rows 3b and 4-10 stand. The rows that exercise `gate-convergence.mjs` ran again. Artifacts under `head-18867ae/`.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 11 | Suites green | `bun run test:team-config` on 7af7d75958 (last script change; 18867ae changes only a test and prose) and `gate-convergence.test.mjs` on 18867ae | 0 fail | 449 pass, 0 fail; 31 pass, 0 fail | PASS | wave-2/green.txt, wave-2/gate-convergence-tests.txt |
| 12 | Cap RED on the real code | delete the three-line cap block in `decide()` (`node --check` ok), run the convergence tests, restore | the 2 cap tests fail; file restored | 2 fail, 29 pass; `restore-diff-exit=0` | PASS | head-18867ae/red-cap.txt |
| 13 | Convergence smoke, plus exempt and snapshot rerun | Verification 4 script in a scratch repo, then: a commit after wave 3, `ready`, `exempt` without and with `--reason`, `ready` F2/F3; identical snapshot rerun; snapshot after a plan edit | as Verification 4; NOT READY naming the commit; exempt without reason exit 1; with reason recorded; READY in F2 and F3; identical rerun prints the same snapshot; edited plan refused exit 1 | exactly as expected; snapshot files named `F2-<plan hash>-wave-<n>` | PASS | head-18867ae/smoke-convergence.txt |
| 14 | New-test RED | row 5 and row 7 tests against the prior script | each fails | 1 fail each | PASS | red-f3-b1-wave4.txt, red-exempt.txt |


Implementation-audit findings:
## 1. Goal and behavioural contract

The implementation addresses the tier parser, reviewer-set validation, convergence cap, plan pinning, re-tiering, and the approved delta-exemption addition. The pinned plan also requires Verification 2–5 evidence **on the head after F3’s last code commit**.

## 2. Correctness, regressions, architecture, wire contracts

I traced the changed parser and validator checks through record validation, and the convergence changes through baseline, snapshot, wave, retier, exemption, and readiness handling. I found no additional implementation blocker above the supplied threshold.

The F3 wave-5 report records the cross-plan snapshot-name collision class as closed at both snapshot artifact sites; I did not re-derive that class.

## 3. Security and privacy delta

The reviewed diff changes review classification and gate tooling; I found no change that itself touches a real credential, an authentication or authorisation path, third-party personal data, or weakens access to a protected asset. The plan explicitly accepts the judgement-based risk of an incorrectly declared tier.

## 4. Verification adequacy

Blocker B1: **High — final-head end-to-end verification is missing.** The normal trigger is completion of F3 after changes to `gate-convergence.mjs` and the review skills. The pinned plan requires Verification 2–5 transcripts on the post-F3 head (`.omo/gate-deltas/F2-ba0e8f9390af-wave-2.plan.md:440-441`) and specifically requires the installed-reviewer/pinned-plan and wave-refusal witness (`:457-461`). The QA matrix’s Verification 5 runs are tied to `8e9b1a1` (`.omo/evidence/review-risk-tier/qa-matrix.md:3,32`); the later `18867ae` rerun covers convergence smoke and focused tests, but carries the earlier installed-reviewer rows forward despite the convergence and skill-prose changes. Thus the claimed combined real-surface witness has not been demonstrated on the required final tree. The gap is reversible: rerun Verification 5 on the post-F3 head, retaining its inventory, pinned-plan, reviewer/control, refusal, and dependency-loss artifacts; update F1 only after it passes. **class:** stale integrated verification after changed dependencies. **sites:** Verification 5 rows carried forward at `qa-matrix.md:16-32` and the checked F1 assertion at the pinned plan’s `:441`; search: `Head:|Re-run on head|rows 3b and 4-10 stand|F1\. Manual QA|Positive witness: snapshot prints` across the QA matrix and pinned plan. The class remains open at those sites.

The supplied convergence-test artifact reports 31 passing tests, including snapshot, tier, cap, and exemption cases. This audit did not run tests or reproduce the manual QA.

## 5. Final

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A final integrated QA witness must exercise the same installed workflow dependencies that will ship, rather than combining observations captured before a dependency changed.
  positive_witness: The installed reviewer, snapshot producer, and wave recorder are exercised together on the post-F3 tree, with their identities recorded.
  negative_control: A reviewer trial from before a convergence-script change is reused as the final integrated witness without rerunning that trial.
  observable: Runtime inventory and trial artifacts identify the tested tree and show the pinned-plan review and wave refusal in the same run.
  boundary: Installed-target Verification 5 and its QA matrix.
END-REVIEW-TRAILER

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Answer four questions:
1. Does change hold up architecturally against rest of system?
2. What does auditor's line-level view structurally miss?
3. Which failure mode would hurt most in production, and is it addressed?
4. Is any auditor finding a false positive on unchanged behaviour?

Brief guard: if this message did not carry all four questions, the diff, the changed-file list, the QA matrix, and the implementation-audit findings, return INCONCLUSIVE and name what was missing.

Do not re-derive auditor findings. Start each blocker with its own `Blocker B<n>:` line. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: <numbers of the questions you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER
