Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.

Inputs:
- Goal, constraints, and behavioural contract: Plan A (`.omo/plans/review-blocking-threshold.md`, merged) made reviewers block only above a shared blocking threshold and made every unfixed blocker a recorded `downgrades` entry. Plan B adds the second half that plan A deferred (its Context, line 12): plans declare a **Risk tier**. `internal-tooling` (dev, CI and proof tooling that reaches no protected asset) gets exactly one auditor, `Mandatory class: none`, and **at most 2 fix rounds per gate lane**. A third wave that still has blockers stops for freeze or re-plan. `auth-secrets-pii` is narrowed by what the change handles, never by filename: synthetic credentials generated only for disposable local/test services do not trigger it; a real provider key, production token, authentication path or third-party personal data does, including when stored in a local `.env`. Product plans keep the full depth.

Cut (PROCESS 3). On 2026-10-22 Tim decided to cut the review-gate work into plan A and plan B. After plan-review round 1 he also decided to keep plan B as one gate. The concrete dependency:
- The fix-round cap (step 2) cannot ship before the validator rules (step 1). A capped lane ends in freeze, and a freeze is safe only when the gate record holds the frozen blockers as downgrades of an auditor verdict. For `mandatory_class: none` the current validator accepts `reviewers_run: []` (`validate-gate-record.mjs:750-762`). Without step 1, a capped internal-tooling lane could therefore freeze and merge with no reviewer verdict at all.
- Step 1 alone is safe but inert. It adds a field and refusals and changes no gate's cost.
- A cut would ship the same two parts in the same order behind two full gates.
- The prose in step 3 documents exactly these two mechanisms and is not independently testable.

All edits are in team-config sources. `~/.omp/agent` changes only through the installer after merge.

Merge gate header:
  - Every existing test keeps the `# demo` plan, which reads as product, so those tests stay as they are.
  - The existing `#given totals 3, 2, 1 #when recorded #then every wave continues` is the product negative control.
- `#given an internal-tooling plan with totals 3, 2, 1 #when the third wave records #then the fix-round cap stops it`:
  1. `tierPlan(s, "internal-tooling")`, then baseline.
  2. The ledger's `gate_baseline.risk_tier` is `"internal-tooling"`.
  3. Waves 1 and 2 with `qa=FAIL` print `DECISION: CONTINUE`.
  4. Wave 3 exits 3, with first line `DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers`.
- Changed files and reviewed diff: Range c37104fa6ae6196bbb7ee41fd48cd149ba535259..f3907fea97fd375b674f8bb41fa7ca03ed0cd778 (branch feat/review-risk-tier, worktree /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier).
Changed files:
A	.omo/plans/review-risk-tier.md
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

Diff (the plan file .omo/plans/review-risk-tier.md is new in this range and is supplied as the plan below rather than inlined):
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
index 5acbc43867..3e677ebb46 100644
--- a/team-config/agent/skills/integration-review/SKILL.md
+++ b/team-config/agent/skills/integration-review/SKILL.md
@@ -56,7 +56,7 @@ git diff --name-only <base>...HEAD > /tmp/integration-review-<slug>.files
 
 ### Step 2 - Dispatch ONE reviewer with the verbatim brief (caller)
 
-When a plan exists, first run `GC baseline --sha HEAD`, `GC ready --lane F3`, then `GC snapshot --lane F3` (`GC` as in review-work Fix waves, `SKILL_DIR=~/.omp/agent/skills/review-work`); keep the snapshot path (first output line). `NOT READY` or a refused snapshot → resolve, no dispatch. Prepare the Step 1 files only after the snapshot.
+When a plan exists, first run `GC baseline --sha HEAD`, `GC ready --lane F3`, then `GC snapshot --lane F3` (`GC` as in review-work Fix waves, `SKILL_DIR=~/.omp/agent/skills/review-work`); keep the snapshot path (first output line) and the `PLAN <path>` line; substitute that pinned path for `<plan path>` in the reviewer brief, since the source plan is not a review input for the wave. `NOT READY` or a refused snapshot → resolve, no dispatch. Prepare the Step 1 files only after the snapshot.
 
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
 
-When a plan exists, record every verdict before anything else: `GC wave --lane F3 --snapshot <path> --outcome f3=PASS|FAIL|INCONCLUSIVE` (a report still without its closing line after one re-dispatch is INCONCLUSIVE). After a cleanup commit, also pass `--outcome verification=PASS|FAIL` from the Step 5 verification gate and one `--blocker VERIFY<n>` per failing check. Add one `--blocker <class>=<sites>` per Must-fix class; Should-fix and Nit never count; `@fix` works as in review-work Fix waves step 3. `DECISION: PASS` → F3 done. `CONTINUE` → Step 5. `STOP` (exit 3) → no Step 5; `ask` the user: freeze (the named Must-fix classes become follow-ups, listed in the report F2 receives as `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave3.md (PASS, wave 3); earlier waves: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave1.md, /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave2.md`), re-plan, or continue, and record it with `GC decide --lane F3 --choice freeze|replan|continue --by <user> --reason <text>`. Without `ask` UI, report and stop.
+When a plan exists, record every verdict before anything else: `GC wave --lane F3 --snapshot <path> --outcome f3=PASS|FAIL|INCONCLUSIVE` (a report still without its closing line after one re-dispatch is INCONCLUSIVE). After a cleanup commit, also pass `--outcome verification=PASS|FAIL` from the Step 5 verification gate and one `--blocker VERIFY<n>` per failing check. Add one `--blocker <class>=<sites>` per Must-fix class; Should-fix and Nit never count; `@fix` works as in review-work Fix waves step 3. `DECISION: PASS` → F3 done. `CONTINUE` → Step 5. `STOP` (exit 3) → no Step 5; `ask` the user: freeze (the named Must-fix classes become follow-ups, listed in the report F2 receives as `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave3.md (PASS, wave 3); earlier waves: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave1.md, /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave2.md`), re-plan, or continue, and record it with `GC decide --lane F3 --choice freeze|replan|continue --by <user> --reason <text>`. Without `ask` UI, report and stop. Under Risk tier `internal-tooling` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; `GC decide` refuses continue there.
 
 A clean report reads:
 
diff --git a/team-config/agent/skills/review-work/SKILL.md b/team-config/agent/skills/review-work/SKILL.md
index ebb4239245..f8f13c8323 100644
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
 
+**Risk tier.** Read `- Risk tier:` from the plan's `## Merge gate`; a plan without it is `product`, and the validator refuses any value other than exactly `product` or `internal-tooling`. `product`: this phase as written. `internal-tooling` (dev, CI, and proof tooling that reaches no protected asset as the blocking threshold defines it): `mandatory_class` is `none`, exactly one `implementation-audit` runs, and each gate lane allows two fix rounds (Fix waves step 3); the validator refuses a record for this tier with any other class or reviewer set. A reviewer's `security_delta: yes` therefore means the work is product: set `- Risk tier: product` in the plan, run `GC retier --by <user> --reason <text>`, reclassify, and review again.
+
 ## Phase 0.6: Resolve and record
 
-Before anything is dispatched, run the plan half of the validator against the plan alone: `node $SKILL_DIR/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <plan-path>`. It runs the `## Merge gate` criteria check the full validation runs at the end, plus two plan-time rules the full run does not repeat: the opt-out decision (only a top-level `- Merge gate: not applicable (<reason>)` outside code fences counts) and the abort-rule fields `Accepted residual risks` and `Out of scope for blocking`, each with concrete text or `none (<reason>)`. A plan that fails it would fail the gate only after every reviewer was paid for, so fix the plan first, before `plan_sha256` is taken.
+Before anything is dispatched, run the plan half of the validator against the plan alone: `node $SKILL_DIR/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <plan-path>`. It runs the `## Merge gate` criteria check the full validation runs at the end, plus two plan-time rules the full run does not repeat: the opt-out decision (only a top-level `- Merge gate: not applicable (<reason>)` outside code fences counts) and the abort-rule fields `Accepted residual risks` and `Out of scope for blocking`, each with concrete text or `none (<reason>)`. Both modes also read the optional `Risk tier`: exactly `product` or `internal-tooling`, and `internal-tooling` needs exactly one `Mandatory class` bullet whose whole value is `none`. A plan that fails it would fail the gate only after every reviewer was paid for, so fix the plan first, before `plan_sha256` is taken.
 
 A plan written before the abort-rule fields existed fails this check. Reassess it, then add both fields honestly. Use `none (plan predates abort-rule fields; reassessed before F2)` only when the reassessment found nothing to name.
 
@@ -340,7 +342,7 @@ Gate passes only when QA matrix has no failing row and every invocation actually
 
 Used as the final gate before a merge, a PR handoff, or a plan's completion, this skill is **blocking**. A timeout, ack-only reply, missing deliverable, explicit `BLOCKED:`, or `INCONCLUSIVE` lane is not a pass. Treat it as failed: investigate the underlying uncertainty with the `debugging` skill when runtime behaviour may be wrong, fix with evidence through Fix waves, and re-run the affected invocation before claiming completion or merging.
 
-Re-classify `mandatory_class` against the **final diff**, not against the plan. The plan's class was set before the work existed and goes stale the moment a wave adds something. Re-classify when any of these appear anywhere in the final diff, whether or not the plan predicted them: a new external network recipient, a new field in a persisted or transmitted structure, a new data class reaching an existing recipient, a new authentication or authorisation path, a schema or migration step, a changed wire contract, or new shared mutable state. A reviewer reporting a security delta while the record says `none` blocks, and correctly so - the reviewer saw the final diff and the plan did not.
+Re-classify `mandatory_class` against the **final diff**, not against the plan. The plan's class was set before the work existed and goes stale the moment a wave adds something. Re-classify when any of these appear anywhere in the final diff, whether or not the plan predicted them: a new external network recipient, a new field in a persisted or transmitted structure, a new data class reaching an existing recipient, a new authentication or authorisation path, a schema or migration step, a changed wire contract, or new shared mutable state. A reviewer reporting a security delta while the record says `none` blocks, and correctly so - the reviewer saw the final diff and the plan did not. Under Risk tier `internal-tooling` that block means re-tier, as in Phase 0.5.
 
 **Downgrades.** A reviewer blocker the gate leaves unfixed ends only in `override` plus exactly one `downgrades` entry per blocker id of every FAIL trailer, never silently. `rule` says why it may stay: `below-threshold` when you judge that the finding misses both (a) and (b) of the blocking threshold, with `reason` naming the missing trigger or asset, and the user agreed; `accepted-residual` when the plan's `Accepted residual risks` covers it; `out-of-scope` when `Out of scope for blocking` covers it; `frozen` when the user chose freeze at a convergence STOP. `disposition` is `residual` or `follow-up`; a follow-up names where it is tracked in `reason`.
 
@@ -390,9 +392,9 @@ Mandatory class: <none or class>
 Applies when this review is a plan's merge gate. `GC` = `node $SKILL_DIR/scripts/gate-convergence.mjs --repo <repo root> --plan <plan path>`, with the plan path from Phase 0.6. A wave is Phase 1 plus, when it passes, Phases 2-3, all on the snapshot taken in step 1. `.omo/gate-deltas/` holds review artifacts; never commit it.
 
 1. Before Phase 1:
-   - `GC baseline --sha HEAD` (prints the existing baseline when F3 already set one);
+   - `GC baseline --sha HEAD` (prints the existing baseline when F3 already set one); it records the plan's Risk tier, which binds the gate: a later plan edit to `product` needs `GC retier --by <user> --reason <text>` (internal-tooling to product only; a gate never moves to internal-tooling), and every other command refuses until then;
    - `GC ready --lane F2`; `NOT READY` → resolve every listed reason and dispatch nothing;
-   - `GC snapshot --lane F2`; it refuses uncommitted tracked changes. Its first output line is the snapshot path; keep it for step 3.
+   - `GC snapshot --lane F2`; it refuses uncommitted tracked changes. Its first output line is the snapshot path; keep it for step 3. Keep the `PLAN <path>` line too: it is the immutable plan input for this wave. Populate Phase 2's `{PLAN}`, `- Feature-specific criteria:\n  - Invariant: x holds\n    Negative control: y fails\n' > /tmp/rrt-plan.md
   node $V --repo $WT --plan-only --plan /tmp/rrt-plan.md; echo "exit $?"
   ```
   | Plan state | Expected output |
   |---|---|
   | as written | `blocked`, exit 1, stderr `plan Risk tier: internal-tooling requires exactly one Mandatory class bullet whose whole value is none; …` |
   | class changed to `none (auth-secrets-pii)` | `blocked`, exit 1, same stderr |
   | class changed to `none` | `passed`, exit 0 |
   | tier line deleted | `passed`, exit 0 |
4. **Convergence smoke** in a scratch repo. Save to `.omo/evidence/review-risk-tier/smoke-convergence.txt`.
   ```
   GCJS=$WT/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
   R=$(mktemp -d /tmp/rrt-repo.XXXX)
   git -C $R init -q -b main && git -C $R config user.email t@t && git -C $R config user.name t
   mkdir -p $R/.omo/plans && printf '.omo/\n' > $R/.git/info/exclude
   printf '# demo\n\n## Merge gate\n- Mandatory class: none\n- Risk tier: internal-tooling\n' > $R/.omo/plans/demo.md
   echo a > $R/a.txt && git -C $R add a.txt && git -C $R commit -qm base
   gc() { node $GCJS "$1" --repo $R --plan .omo/plans/demo.md "${@:2}"; }
   gc baseline --sha HEAD
   for n in 1 2 3; do
     snap=$(gc snapshot --lane F2 | head -1)
     bl=$(for i in $(seq 1 $((4-n))); do printf -- '--blocker W%sB%s ' $n $i; done)
     gc wave --lane F2 --snapshot "$snap" --outcome qa=PASS --outcome implementation-audit=FAIL $bl; echo "exit $?"
   done
   gc decide --lane F2 --choice continue --by tim --reason smoke; echo "exit $?"
   sed -i '' 's/internal-tooling/product/' $R/.omo/plans/demo.md
   gc ready --lane F2; echo "exit $?"
   gc retier --by tim --reason smoke; echo "exit $?"
   gc decide --lane F2 --choice continue --by tim --reason smoke; echo "exit $?"
   grep -c '"risk_tier":"internal-tooling"' $R/.omo/ulw-execute/ledger.jsonl
   ```
   | Step | Expected |
   |---|---|
   | waves 1-2 | `DECISION: CONTINUE`, exit 0 |
   | wave 3 | `DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers`, exit 3 |
   | first decide | exit 1, naming the cap |
   | ready | exit 1, naming retier |
   | retier | `RECORDED risk_tier_change internal-tooling -> product` |
   | second decide | exit 0 |
   | grep | `1` |

   Then `rm -rf $R /tmp/rrt-plan.md`.
5. **Plan-reviewer PROCESS 5, pinned-plan use and dependency loss on the installed target surface.** Use the deployed `omp` binary with isolated branch/control agent directories and an empty cwd. Nothing is installed into `~/.omp/agent`.

   Environment contract:

   | Phase | Network | Runtime/Platform | Commands | Need met? |
   |---|---|---|---|---|
   | install | none | host macOS arm64, Bun, worktree checkout | isolated `PI_CODING_AGENT_DIR`, `bun scripts/install-team-config.ts`, hashes and `cmp` | yes: local copies only |
   | reviewer run | HTTPS to the team router through one run-owned CONNECT proxy | deployed `~/.local/bin/omp`, empty cwd, isolated agent/native dirs | `omp -p --no-session --no-extensions --no-skills --cwd …` | yes: this is the installed binary/config boundary users run |
   | classify | none | host Bun/Node | deterministic files-only classifier | yes |

   Runtime-file inventory. Generate `.omo/evidence/review-risk-tier/runtime-inventory.txt` before the first run and verify the same identities afterward. A mismatch makes every affected row `INFRA`.

   | Runtime file/group | Origin | State | Identity captured | Loaded/mounted proof |
   |---|---|---|---|---|
   | `~/.local/bin/omp`, `~/.local/bin/omp.deployed` | deployed artifact | generated/untracked binary + deployment marker | binary SHA-256, deployed 40-hex commit, `omp --version` | exact executable path in every run |
   | bundled plan-reviewer prompt, task runtime, print mode and discovery/provider code | repository at deployed commit | tracked source embedded in binary | `git diff --quiet <deployed> <worktree-base> --` over those named source paths; exit 0 required | bound by deployed commit and binary hash |
   | `$N/<version>/pi_natives.*.node` | binary's embedded native payload extracted under isolated `PI_NATIVES_DIR=$N` | generated/ignored | path, mode and SHA-256 after the first smoke | isolated directory is empty before launch and populated by that binary |
   | `$A/**` | branch `team-config/agent/**` installed by the branch installer; untouched template | tracked source, installed copies and generated manifest | branch HEAD, manifest SHA-256; every manifest entry byte-compares with its branch source; frozen per-file SHA-256 map | template only; each branch trial launches with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, a fresh copy of `$A` checked against its frozen map |
   | `$C/**` | byte copy of `$A`, then only `rules/plan-review-process.md` replaced from the deployed commit; untouched template | installed control | recursive diff must name exactly that one file; record both rule hashes; frozen per-file SHA-256 map | template only; each control trial launches with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, a fresh copy of `$C` checked against its frozen map |
   | `$A/config.yml`, `$A/models.yml` and identical `$C` copies | current live user seeds | untracked, secret-bearing | SHA-256 only; never copy their contents into evidence | config lookup through each isolated agent dir |
   | pinned above-plan and below-plan fixture | scratch repo / QA fixture | generated, git-ignored | snapshot `plan_sha256`, copy SHA-256, source SHA-256 | absolute plan path in the task assignment |
   | `$EMPTY` plus external rule candidates | fresh empty cwd; host candidate dirs | generated/external | empty-cwd listing; candidate path existence and hashes of any files; no `PROCESS 5` outside `$A/$C` | `--cwd $EMPTY`; extensions and skills disabled; branch/control differential isolates the one rule |

   Setup from the worktree root:

   ```bash
   OMP=$HOME/.local/bin/omp
   DEPLOYED=$(awk 'NR==1 {print $1}' $HOME/.local/bin/omp.deployed)
   A=/tmp/rrt-agent-branch C=/tmp/rrt-agent-control N=/tmp/rrt-natives EMPTY=/tmp/rrt-empty
   rm -rf "$A" "$C" "$N" "$EMPTY" && mkdir -p "$A" "$N" "$EMPTY"
   cp ~/.omp/agent/config.yml ~/.omp/agent/models.yml "$A/"
   PI_CODING_AGENT_DIR=$A bun scripts/install-team-config.ts
   cp -R "$A" "$C"
   git show "$DEPLOYED:team-config/agent/rules/plan-review-process.md" > "$C/rules/plan-review-process.md"
   ```

   The inventory helper MUST fail unless: the deployment marker is a commit; every `$A` manifest entry matches `team-config/agent`; `$A` and `$C` differ only at `rules/plan-review-process.md`; the deployed commit and worktree base have identical reviewer/task/print/discovery/provider source; `$EMPTY` is empty; and no external candidate rule contains `PROCESS 5`. Save only paths, hashes, modes and pass/fail results—never model/config contents.

   **Pinned plan setup.** Write the `plan-tier-above.md` fixture below as `$R/.omo/plans/demo.md` in a scratch git repo, create the baseline, and run `GC snapshot --lane F2`. Keep stdout line 1 as `$SNAP` and the `PLAN ` line as `$PINNED`; assert `$PINNED` is `0444` and its SHA-256 equals snapshot `plan_sha256`. Then replace the source `$R/.omo/plans/demo.md` with the below fixture before any reviewer run. This deliberately changes the source during the dispatch window.

   **Per-run dependency and classifier.** Create three throwaway helpers under `/tmp`, record their SHA-256 in the inventory, and remove them afterward:
   - `rrt-proxy.mjs`: a minimal HTTP CONNECT proxy. It writes `LISTEN`, each `CONNECT host:port`, timestamped client→upstream byte totals, `CLOSE`, and errors with synchronous appends; it never logs request bytes. Each trial gets a fresh process, port, log and metadata file.
   - `rrt-run.mjs <trialDir> <template> <frozenMap> <plan> <port> [loss]`: copies the template to `/tmp/rrt-trials/<trial>` and compares that copy with the frozen map (`COPY-OK` or `COPY-MISMATCH`, the latter ends the trial without launching); writes `START` with template and trial dir, proxy PID and hashes of the trial copy's rule, config and models before launch; starts `gtimeout 600` with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, `PI_NATIVES_DIR=$N`, and both `HTTPS_PROXY` spellings pointing at that trial's proxy; runs `$OMP -p --no-session --no-extensions --no-skills --cwd $EMPTY <prompt>`; then records exit status, whether the proxy is still alive, post-run hashes and `END` before stopping the proxy and deleting the trial copy. The templates are never a launch directory.
   - `rrt-classify.mjs`: reads only the trial output, proxy log and metadata. Missing `START`/`END`, identity drift, no router `CONNECT`, a `LOSS` marker, dead proxy before CLI completion, timeout/nonzero CLI exit, empty/truncated stdout or invalid structured result → `INFRA`. Otherwise require JSON with `verdict: OKAY|REJECT` and a blockers array for `REJECT`, then emit `MODEL`. Check infrastructure conditions before parsing output, so valid-looking bytes after dependency loss never count. Retry one `INFRA` once; a second stops that row and is reported, never scored.

   Before model runs, self-check the classifier: one synthetic complete MODEL fixture passes; copies with `LOSS`, missing `END`, dead-proxy, nonzero exit, empty output and truncated JSON each classify as `INFRA`. A classifier that accepts any negative control invalidates this verification.

   Normal trial prompt (substitute the absolute plan path):

   `Call the task tool exactly once with exactly one item: agent "plan-reviewer", solutionSpace "plan review", task "Review the plan at <PATH>". Do not do anything else. When the result arrives, print the subagent's structured result as JSON verbatim and nothing else.`

   | Run | Agent dir / plan | Expected |
   |---|---|---|
   | branch above, pinned | `$A` / `$PINNED` | `MODEL`; `REJECT`; at least one blocker whose `area` starts with `PROCESS 5` |
   | one-file control above | `$C` / the same `$PINNED` | `MODEL`; no blocker whose `area` starts with `PROCESS 5` |
   | branch below | `$A` / mutated below-plan source | `MODEL`; no blocker whose `area` starts with `PROCESS 5` |

   The first two rows use the same binary, config/model hashes, cwd, native addon and immutable plan bytes; exactly one loaded rule differs. After the branch-above row, run `GC wave --lane F2 --snapshot "$SNAP" --outcome qa=PASS --outcome implementation-audit=PASS`: it MUST exit 1 with `plan bytes differ from the snapshot`, and the ledger MUST have no `gate_wave`. Together, the reviewer's PROCESS 5 finding from `$PINNED` and the wave refusal prove reviewers consumed the pinned bytes while recording remained bound to the changed source.

   **Mid-review dependency-loss control.** Run the branch-below trial in `--mode json`. A separate watcher parses its JSONL until `tool_execution_start` for tool `task`, records the current client→router byte total, then waits for the next increase (the plan-reviewer request has started), synchronously appends `LOSS reviewer-router-traffic`, and kills only that trial's proxy. If no post-dispatch router traffic appears within 120 seconds, the control fails as `INFRA` and is not evidence. The CLI is bounded by `gtimeout 180`; `rrt-classify.mjs` MUST report `INFRA` even if stdout contains a valid-looking verdict. The proxy log and metadata are durable files owned by processes separate from the CLI; watcher/runner death leaves `LOSS` or a missing `END`, both `INFRA`, so liveness does not disappear with its observer.

   Run inventory checks again. Then remove `$A`, `$C`, `$N`, `$EMPTY`, `$R` and the three `/tmp` helpers; they include copied router credentials. Keep only redacted outputs, hashes, classifier results and proxy lifecycle/byte-count logs under `.omo/evidence/review-risk-tier/`.

   `plan-tier-above.md`:
   ```markdown
   # Deploy helper (QA fixture, above)

   ## Context
   Add `scripts/deploy-prod.sh`, run from CI on every merge to main.

   ## Approach
   1. `scripts/deploy-prod.sh` reads `PROD_DATABASE_URL` from the CI secret store, runs `bun run migrate` against the production database, and prints the migration log to the CI job output.

   ## Verification
   - Run the script against a staging copy; the migration log lists every applied migration.

   ## Final verification wave
   - [ ] F3. Whole-diff review: not needed (one script)
   - [ ] F1. Manual QA on the real surface
   - [ ] F2. Merge gate: `review-work`

   ## Merge gate
   - Author's risk assessment: a failed migration leaves the schema half-applied
   - Mandatory class: none
   - Risk tier: internal-tooling
   - Whole-diff review: not needed (one script)
   - Accepted residual risks: none (QA fixture)
   - Out of scope for blocking: none (QA fixture)
   - Feature-specific criteria:
     - Invariant: the script applies every pending migration exactly once
       Positive witness: a staging run lists each pending migration once
       Negative control: a second run applies nothing
       Observable: migration log
       Boundary: scripts/deploy-prod.sh
   ```

   `plan-tier-below.md` uses the same skeleton with these changes:
   - title `# Docs link check (QA fixture, below)`;
   - Context: `Add \`scripts/check-docs-links.ts\`, a local developer script that reports broken relative links in \`docs/**/*.md\`.`;
   - Approach: `1. \`scripts/check-docs-links.ts\` walks \`docs/**/*.md\`, resolves every relative link against its file's directory, prints \`file:line target\` for each missing target, and exits 1 when any is missing, else 0.`;
   - Verification: `- A docs tree with one broken link prints that link and exits 1; after the fix it exits 0.`;
   - Merge gate risk assessment: `a false report costs a developer a minute; nothing ships`;
   - accepted residual risks: `links inside HTML blocks are not checked`;
   - out of scope: `absolute URLs`;
   - criterion: invariant `every broken relative link is reported with its file and line`, positive witness `one broken link gives one report line and exit 1`, negative control `a tree without broken links exits 0 with no output`, observable `stdout and exit code`, boundary `scripts/check-docs-links.ts`.
6. **After merge to main**, from `/Users/tim/git/oh-my-pi`: run `bun scripts/install-team-config.ts`. Then `diff -q team-config/agent/skills/review-work/scripts/plan-contract.mjs ~/.omp/agent/skills/review-work/scripts/plan-contract.mjs` must print nothing. Running sessions pick up the change after a restart.

## Assumptions & contingencies

- The cap is two fix rounds per gate lane, with F2 and F3 counted separately. Wave 3 with blockers stops, and continue is refused there. Tim set this limit on 2026-10-22.
- A missing `Risk tier` means `product`. Ledgers and records written before this change keep their behaviour. Snapshots in flight lack `plan_sha256` and `plan_copy` and are refused; take a new snapshot.
- If an isolated Verification 5 run fails authentication or twice classifies as `INFRA`, stop that row and report it. Do not install branch config into `~/.omp/agent`, because other sessions read it.

## TODOs

1. F3-B1: re-run Verification 5 so the inventory contract holds after the runs. Keep `$A` and `$C` as untouched templates that are never a launch directory, and freeze a per-file SHA-256 map of each at the pre-run inventory; the pre, post and final inventories check each template against its map. Each trial copies its template into a fresh `/tmp/rrt-trials/<trial>` and, before launching omp, compares every file of that copy with the frozen map; a missing, extra or different file writes `COPY-MISMATCH`, skips the launch and classifies as INFRA. omp then runs with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>` (table rows `$A/**`, `$C/**` and `rrt-run.mjs`). Use-time binding: HASH-PRE and HASH-POST hash that copy's `rules/plan-review-process.md`, `config.yml` and `models.yml`, so a change to them that lasts into the run shows as identity drift and classifies as INFRA. Nothing but the trial's own omp writes the trial copy; a change made and reverted inside the sub-second window between the copy check and omp's load is not detected. Controls: freeze a scratch template; an unchanged copy gives `COPY-OK`; a rule file changed after freezing gives `COPY-MISMATCH` and INFRA. Extract natives with one warm-up smoke before the first scored trial. Every trial from the earlier runs is reported as INFRA.
2. F3 Should-fix: `lesson-size-gate-to-audience.md` limits `internal-tooling` to dev, CI, or proof tooling that reaches no protected asset, matching `plan-merge-gate.md`.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over <main at worktree creation>...<head>
- [x] F1. Manual QA on the real surface: Verification 2-5 transcripts under `.omo/evidence/review-risk-tier/`, on the head after F3's last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: a wrong tier parse or tier binding would let a product plan run with one auditor and a cap, or leave internal-tooling lanes looping as before. A wrong decide rule would block a legitimate continue or freeze. The new ledger event and snapshot fields are persisted state. Team-wide config, reversible by reinstalling main.
- Mandatory class: concurrency-state
- Risk tier: product
- Whole-diff review: needed (two gate scripts, a new shared module, two skills, three rules, one extension comment)
- Accepted residual risks: `--by` on retier and decide is self-reported, so an agent can enter the user's name; a plan that falsely declares internal-tooling is caught only by plan-review PROCESS 5 and the auditor's security_delta, both judgement calls; the owner of the local checkout can deliberately chmod, alter and restore a pinned plan copy during a review read, but this requires active gate tampering and gains no capability the owner lacks
- Out of scope for blocking: ledgers, snapshots and gate records written before this change; OpenSpec change folders as --plan; the bundled plan-reviewer prompt packages/coding-agent/src/prompts/agents/plan-reviewer.md
- Feature-specific criteria:
  - Invariant: an internal-tooling gate lane stops after two fix rounds, and continue is refused at that stop
    Positive witness: internal-tooling plan, wave totals 3, 2, 1: wave 3 prints DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers and exits 3; decide --choice continue exits 1; freeze exits 0
    Negative control: the same totals on a plan without Risk tier print DECISION: CONTINUE on all three waves
    Observable: gate-convergence stdout first line and exit code
    Boundary: gate-convergence.mjs decide() and the decide command
  - Invariant: the gate's tier is bound at baseline and changes only through retier, internal-tooling to product; every wave reviewer reads a pinned copy of the snapshot's plan bytes, and recording requires both that copy and the source plan to retain the bound digest
    Positive witness: snapshot prints a `PLAN` path whose read-only bytes hash to `plan_sha256`; after the source changes, a plan-reviewer given that path still reports the pinned plan's PROCESS 5 blocker, while wave refuses the changed source and writes no `gate_wave`; after retier, wave 3 with one blocker continues and the ledger holds one `risk_tier_change`
    Negative control: a product gate whose plan says internal-tooling refuses snapshot and retier; a same-tier source edit, tampered pinned copy, legacy snapshot without plan fields, and snapshot taken before retier each make wave exit 1 without `gate_wave`; the same plan under the one-file control rule has no PROCESS 5 blocker
    Observable: snapshot/copy digests and mode, reviewer structured result, exit codes, stderr, ledger events
    Boundary: gate-convergence.mjs gateState, readLedger, retier, snapshot and wave; review-work and integration-review plan-path substitution
  - Invariant: Risk tier reads product when absent and refuses personal, any value other than exactly product or internal-tooling, duplicates, and internal-tooling without exactly one Mandatory class bullet whose whole value is none
    Positive witness: a plan without the field, and one with Risk tier internal-tooling plus Mandatory class none, both exit 0 under --plan-only
    Negative control: Risk tier personal, internal-tooling (or product), and internal-tooling with Mandatory class auth-secrets-pii, none (auth-secrets-pii) or none, concurrency-state each exit 1 naming plan Risk tier
    Observable: validator stdout word, exit code and stderr
    Boundary: validate-gate-record.mjs validatePlanContract via plan-contract.mjs readRiskTier
  - Invariant: a gate record for an internal-tooling plan validates only with mandatory_class none and reviewers_run exactly implementation-audit
    Positive witness: the pass fixture under an internal-tooling plan exits 0
    Negative control: the same record with mandatory_class auth-secrets-pii exits 1 on mandatory_class; with reviewers_run empty, or with implementation-audit plus strategic-risk-review, it exits 1 on reviewers_run; each message names the tier
    Observable: validator exit code and stderr field
    Boundary: validate-gate-record.mjs validateRecord
  - Invariant: `auth-secrets-pii` and `Risk tier` classify the asset and its reach, not the filename: synthetic credentials limited to disposable local/test services may be internal-tooling, while real provider/production credentials, authentication paths and third-party personal data remain product even when read from a local `.env`
    Positive witness: the docs-link fixture under the installed branch rule has no PROCESS 5 blocker
    Negative control: the production migration fixture reads a real CI credential and reaches production; under the same installed branch rule it is REJECT with a PROCESS 5 blocker despite naming itself internal-tooling
    Observable: structured plan-reviewer verdict and blocker area from valid `MODEL` trials
    Boundary: installed `plan-review-process.md`, `plan-merge-gate.md` and review-work Phase 0.5`, accepted residual risks and out-of-scope fields from that copy, never from the source plan; `GC wave` verifies both the copy and source before recording.
 2. Until the wave is recorded, change nothing tracked. QA artifacts go under `.omo/evidence/<plan basename>/wave-<n>/`; they are local and git-ignored (never staged), so the snapshot's clean-tree check is unaffected. Only the record and the `*trailer*` files are staged, in Phase 5. Between waves commit only fix code. A commit without a delta review blocks the next wave.
 3. After the wave's verdicts, before any fix, run `GC wave --lane F2 --snapshot <path from step 1>` with:
    - `--outcome qa=PASS|FAIL`, plus `--outcome <invocation>=PASS|FAIL|INCONCLUSIVE` for each invocation that ran, normalised as in Phases 2-3;
@@ -408,7 +410,7 @@ Applies when this review is a plan's merge gate. `GC` = `node $SKILL_DIR/scripts
      - re-plan: a separate plan for the affected mechanism;
      - continue: one more fix wave.
 
-     Record the answer with `GC decide --lane F2 --choice freeze|replan|continue --by <user> --reason <text>`. The script refuses freeze after failing QA or an INCONCLUSIVE invocation, because the record requires passing QA rows and a trailer per invocation. Without `ask` UI, report the numbers and options and stop.
+     Record the answer with `GC decide --lane F2 --choice freeze|replan|continue --by <user> --reason <text>`. The script refuses freeze after failing QA or an INCONCLUSIVE invocation, because the record requires passing QA rows and a trailer per invocation. Without `ask` UI, report the numbers and options and stop. Under Risk tier `internal-tooling` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; the script refuses continue there. Work that needs more rounds is product: re-tier it as in Phase 0.5, after which continue is legal.
 4. Each fix is first an `N.` row under `## TODOs`. A fix that adds a subsystem (process, proxy, store, staging tree, daemon, endpoint) is not a row: stop and plan it separately. Implement and commit.
 5. Review each contiguous commit range once, naming every row it implements:
    a. `GC patch --base <base> --head <head> --out .omo/gate-deltas/F2-<first row>-<head12>-<UTC yyyymmddHHMMSS>`. It writes one read-only patch per commit plus a manifest, and prints the manifest path.
diff --git a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
index f9d8a20130..b0c6831193 100755
--- a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
+++ b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
@@ -1,20 +1,23 @@
 #!/usr/bin/env node
 // Gate-wave convergence and fix-delta coverage for review-work (F2) and integration-review (F3).
 // The skills call this script; it is the only writer and judge of the gate_baseline,
-// fix_delta_review, gate_wave and convergence_decision ledger events. Every decision is
+// fix_delta_review, gate_wave, convergence_decision and risk_tier_change ledger events. Every decision is
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
+const OWN_EVENTS = new Set(["gate_baseline", "fix_delta_review", "gate_wave", "convergence_decision", "risk_tier_change"])
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
@@ -100,6 +104,7 @@ const SHAPES = {
     by: isString,
     reason: isString,
   },
+  risk_tier_change: { from: (v) => v === "internal-tooling", to: (v) => v === "product", by: isString, reason: isString },
 }
 
 function readLedger(repo, key, { requireBaseline = true } = {}) {
@@ -118,7 +123,7 @@ function readLedger(repo, key, { requireBaseline = true } = {}) {
   if (baselines.length > 1) fail(`undecidable: ${baselines.length} gate_baseline events for ${key}`)
   if (baselines.length === 0) {
     if (requireBaseline) fail(`undecidable: no gate_baseline for ${key}; run baseline before the first gate wave`)
-    return { baseline: undefined, events: [] }
+    return { baseline: undefined, tier: undefined, events: [] }
   }
   const start = baselines[0].index
   const events = []
@@ -137,7 +142,25 @@ function readLedger(repo, key, { requireBaseline = true } = {}) {
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
@@ -250,9 +273,12 @@ function blameCommit(repo, sha, { file, line }) {
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
@@ -280,13 +306,13 @@ const commands = {
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
@@ -295,7 +321,7 @@ const commands = {
 
   snapshot(ctx) {
     const lane = requireLane(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     if (trackedChanges(ctx.repo) !== "") {
       fail("working tree has uncommitted tracked changes; commit them (and review them as a delta) before the wave")
     }
@@ -303,10 +329,17 @@ const commands = {
     const reasons = readyReasons(ctx.repo, state, lane, head)
     if (reasons.length > 0) fail(`not ready: ${reasons.join("; ")}`)
     const wave = laneWaves(state.events, lane).length + 1
-    const file = path.join(ctx.repo, ".omo", "gate-deltas", `${lane}-wave-${wave}.snapshot.json`)
-    mkdirSync(path.dirname(file), { recursive: true })
-    writeFileSync(file, `${JSON.stringify({ lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]) })}\n`)
-    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}`)
+    const dir = path.join(ctx.repo, ".omo", "gate-deltas")
+    const file = path.join(dir, `${lane}-wave-${wave}.snapshot.json`)
+    const planCopy = path.join(dir, `${lane}-wave-${wave}.plan.md`)
+    mkdirSync(dir, { recursive: true })
+    // A previous snapshot of the same unrecorded wave left a read-only copy; replace it.
+    if (existsSync(planCopy)) chmodSync(planCopy, 0o600)
+    writeFileSync(planCopy, ctx.planBytes)
+    chmodSync(planCopy, 0o444)
+    const record = { lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]), plan_sha256: ctx.planSha256, plan_copy: path.relative(ctx.repo, planCopy) }
+    writeFileSync(file, `${JSON.stringify(record)}\n`)
+    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}\nPLAN ${planCopy}`)
   },
 
   patch(ctx) {
@@ -333,7 +366,7 @@ const commands = {
   delta(ctx) {
     const lane = requireLane(ctx.values)
     const rows = requireRows(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
     const head = resolveCommit(ctx.repo, "HEAD")
     if (!isAncestor(ctx.repo, state.baseline, checked.manifest.base_sha) || !isAncestor(ctx.repo, checked.manifest.head_sha, head)) {
@@ -365,7 +398,7 @@ const commands = {
   accept(ctx) {
     const lane = requireLane(ctx.values)
     if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("accept needs --by and --reason")
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
     const latest = state.events
       .filter((e) => e.event === "fix_delta_review" && e.base_sha === checked.manifest.base_sha && e.head_sha === checked.manifest.head_sha)
@@ -393,7 +426,7 @@ const commands = {
 
   wave(ctx) {
     const lane = requireLane(ctx.values)
-    const state = readLedger(ctx.repo, ctx.key)
+    const state = gateState(ctx)
     const waves = laneWaves(state.events, lane)
     const n = waves.length + 1
 
@@ -409,6 +442,17 @@ const commands = {
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
@@ -454,7 +498,7 @@ const commands = {
       if (blamed.some((sha) => fixCommits.has(sha))) fixInduced.push(blocker.id)
       else if (blamed.length === 0) unlocated.push(blocker.id)
     }
-    const outcome = decide(waves, blockers.length, fixInduced.length)
+    const outcome = decide(waves, blockers.length, fixInduced.length, state.tier)
     append(ctx.repo, {
       event: "gate_wave",
       plan: ctx.key,
@@ -478,12 +522,15 @@ const commands = {
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
@@ -493,6 +540,16 @@ const commands = {
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
@@ -522,18 +579,25 @@ function main() {
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
index dd2ba202b8..915ae34382 100644
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
@@ -330,3 +331,168 @@ test("#given a ledger without a trailing newline #when an event is appended #the
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
- Repository context and plan: Repository root: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier. Read any repository file you need. Plan: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/plans/review-risk-tier.md (sha256 b393acd0a2036a9aab3f8430f6e1bd4fb7cfcc2dcb160e171fa0394200f97688); read it completely.
- Manual QA matrix and artifacts: # F1 QA matrix: review-risk-tier

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

Artifacts are under /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/.
- Author-supplied behavioural criteria: - Feature-specific criteria:\n  - Invariant: x holds\n    Negative control: y fails\n' > /tmp/rrt-plan.md
   node $V --repo $WT --plan-only --plan /tmp/rrt-plan.md; echo "exit $?"
   ```
   | Plan state | Expected output |
   |---|---|
   | as written | `blocked`, exit 1, stderr `plan Risk tier: internal-tooling requires exactly one Mandatory class bullet whose whole value is none; …` |
   | class changed to `none (auth-secrets-pii)` | `blocked`, exit 1, same stderr |
   | class changed to `none` | `passed`, exit 0 |
   | tier line deleted | `passed`, exit 0 |
4. **Convergence smoke** in a scratch repo. Save to `.omo/evidence/review-risk-tier/smoke-convergence.txt`.
   ```
   GCJS=$WT/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
   R=$(mktemp -d /tmp/rrt-repo.XXXX)
   git -C $R init -q -b main && git -C $R config user.email t@t && git -C $R config user.name t
   mkdir -p $R/.omo/plans && printf '.omo/\n' > $R/.git/info/exclude
   printf '# demo\n\n## Merge gate\n- Mandatory class: none\n- Risk tier: internal-tooling\n' > $R/.omo/plans/demo.md
   echo a > $R/a.txt && git -C $R add a.txt && git -C $R commit -qm base
   gc() { node $GCJS "$1" --repo $R --plan .omo/plans/demo.md "${@:2}"; }
   gc baseline --sha HEAD
   for n in 1 2 3; do
     snap=$(gc snapshot --lane F2 | head -1)
     bl=$(for i in $(seq 1 $((4-n))); do printf -- '--blocker W%sB%s ' $n $i; done)
     gc wave --lane F2 --snapshot "$snap" --outcome qa=PASS --outcome implementation-audit=FAIL $bl; echo "exit $?"
   done
   gc decide --lane F2 --choice continue --by tim --reason smoke; echo "exit $?"
   sed -i '' 's/internal-tooling/product/' $R/.omo/plans/demo.md
   gc ready --lane F2; echo "exit $?"
   gc retier --by tim --reason smoke; echo "exit $?"
   gc decide --lane F2 --choice continue --by tim --reason smoke; echo "exit $?"
   grep -c '"risk_tier":"internal-tooling"' $R/.omo/ulw-execute/ledger.jsonl
   ```
   | Step | Expected |
   |---|---|
   | waves 1-2 | `DECISION: CONTINUE`, exit 0 |
   | wave 3 | `DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers`, exit 3 |
   | first decide | exit 1, naming the cap |
   | ready | exit 1, naming retier |
   | retier | `RECORDED risk_tier_change internal-tooling -> product` |
   | second decide | exit 0 |
   | grep | `1` |

   Then `rm -rf $R /tmp/rrt-plan.md`.
5. **Plan-reviewer PROCESS 5, pinned-plan use and dependency loss on the installed target surface.** Use the deployed `omp` binary with isolated branch/control agent directories and an empty cwd. Nothing is installed into `~/.omp/agent`.

   Environment contract:

   | Phase | Network | Runtime/Platform | Commands | Need met? |
   |---|---|---|---|---|
   | install | none | host macOS arm64, Bun, worktree checkout | isolated `PI_CODING_AGENT_DIR`, `bun scripts/install-team-config.ts`, hashes and `cmp` | yes: local copies only |
   | reviewer run | HTTPS to the team router through one run-owned CONNECT proxy | deployed `~/.local/bin/omp`, empty cwd, isolated agent/native dirs | `omp -p --no-session --no-extensions --no-skills --cwd …` | yes: this is the installed binary/config boundary users run |
   | classify | none | host Bun/Node | deterministic files-only classifier | yes |

   Runtime-file inventory. Generate `.omo/evidence/review-risk-tier/runtime-inventory.txt` before the first run and verify the same identities afterward. A mismatch makes every affected row `INFRA`.

   | Runtime file/group | Origin | State | Identity captured | Loaded/mounted proof |
   |---|---|---|---|---|
   | `~/.local/bin/omp`, `~/.local/bin/omp.deployed` | deployed artifact | generated/untracked binary + deployment marker | binary SHA-256, deployed 40-hex commit, `omp --version` | exact executable path in every run |
   | bundled plan-reviewer prompt, task runtime, print mode and discovery/provider code | repository at deployed commit | tracked source embedded in binary | `git diff --quiet <deployed> <worktree-base> --` over those named source paths; exit 0 required | bound by deployed commit and binary hash |
   | `$N/<version>/pi_natives.*.node` | binary's embedded native payload extracted under isolated `PI_NATIVES_DIR=$N` | generated/ignored | path, mode and SHA-256 after the first smoke | isolated directory is empty before launch and populated by that binary |
   | `$A/**` | branch `team-config/agent/**` installed by the branch installer; untouched template | tracked source, installed copies and generated manifest | branch HEAD, manifest SHA-256; every manifest entry byte-compares with its branch source; frozen per-file SHA-256 map | template only; each branch trial launches with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, a fresh copy of `$A` checked against its frozen map |
   | `$C/**` | byte copy of `$A`, then only `rules/plan-review-process.md` replaced from the deployed commit; untouched template | installed control | recursive diff must name exactly that one file; record both rule hashes; frozen per-file SHA-256 map | template only; each control trial launches with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, a fresh copy of `$C` checked against its frozen map |
   | `$A/config.yml`, `$A/models.yml` and identical `$C` copies | current live user seeds | untracked, secret-bearing | SHA-256 only; never copy their contents into evidence | config lookup through each isolated agent dir |
   | pinned above-plan and below-plan fixture | scratch repo / QA fixture | generated, git-ignored | snapshot `plan_sha256`, copy SHA-256, source SHA-256 | absolute plan path in the task assignment |
   | `$EMPTY` plus external rule candidates | fresh empty cwd; host candidate dirs | generated/external | empty-cwd listing; candidate path existence and hashes of any files; no `PROCESS 5` outside `$A/$C` | `--cwd $EMPTY`; extensions and skills disabled; branch/control differential isolates the one rule |

   Setup from the worktree root:

   ```bash
   OMP=$HOME/.local/bin/omp
   DEPLOYED=$(awk 'NR==1 {print $1}' $HOME/.local/bin/omp.deployed)
   A=/tmp/rrt-agent-branch C=/tmp/rrt-agent-control N=/tmp/rrt-natives EMPTY=/tmp/rrt-empty
   rm -rf "$A" "$C" "$N" "$EMPTY" && mkdir -p "$A" "$N" "$EMPTY"
   cp ~/.omp/agent/config.yml ~/.omp/agent/models.yml "$A/"
   PI_CODING_AGENT_DIR=$A bun scripts/install-team-config.ts
   cp -R "$A" "$C"
   git show "$DEPLOYED:team-config/agent/rules/plan-review-process.md" > "$C/rules/plan-review-process.md"
   ```

   The inventory helper MUST fail unless: the deployment marker is a commit; every `$A` manifest entry matches `team-config/agent`; `$A` and `$C` differ only at `rules/plan-review-process.md`; the deployed commit and worktree base have identical reviewer/task/print/discovery/provider source; `$EMPTY` is empty; and no external candidate rule contains `PROCESS 5`. Save only paths, hashes, modes and pass/fail results—never model/config contents.

   **Pinned plan setup.** Write the `plan-tier-above.md` fixture below as `$R/.omo/plans/demo.md` in a scratch git repo, create the baseline, and run `GC snapshot --lane F2`. Keep stdout line 1 as `$SNAP` and the `PLAN ` line as `$PINNED`; assert `$PINNED` is `0444` and its SHA-256 equals snapshot `plan_sha256`. Then replace the source `$R/.omo/plans/demo.md` with the below fixture before any reviewer run. This deliberately changes the source during the dispatch window.

   **Per-run dependency and classifier.** Create three throwaway helpers under `/tmp`, record their SHA-256 in the inventory, and remove them afterward:
   - `rrt-proxy.mjs`: a minimal HTTP CONNECT proxy. It writes `LISTEN`, each `CONNECT host:port`, timestamped client→upstream byte totals, `CLOSE`, and errors with synchronous appends; it never logs request bytes. Each trial gets a fresh process, port, log and metadata file.
   - `rrt-run.mjs <trialDir> <template> <frozenMap> <plan> <port> [loss]`: copies the template to `/tmp/rrt-trials/<trial>` and compares that copy with the frozen map (`COPY-OK` or `COPY-MISMATCH`, the latter ends the trial without launching); writes `START` with template and trial dir, proxy PID and hashes of the trial copy's rule, config and models before launch; starts `gtimeout 600` with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>`, `PI_NATIVES_DIR=$N`, and both `HTTPS_PROXY` spellings pointing at that trial's proxy; runs `$OMP -p --no-session --no-extensions --no-skills --cwd $EMPTY <prompt>`; then records exit status, whether the proxy is still alive, post-run hashes and `END` before stopping the proxy and deleting the trial copy. The templates are never a launch directory.
   - `rrt-classify.mjs`: reads only the trial output, proxy log and metadata. Missing `START`/`END`, identity drift, no router `CONNECT`, a `LOSS` marker, dead proxy before CLI completion, timeout/nonzero CLI exit, empty/truncated stdout or invalid structured result → `INFRA`. Otherwise require JSON with `verdict: OKAY|REJECT` and a blockers array for `REJECT`, then emit `MODEL`. Check infrastructure conditions before parsing output, so valid-looking bytes after dependency loss never count. Retry one `INFRA` once; a second stops that row and is reported, never scored.

   Before model runs, self-check the classifier: one synthetic complete MODEL fixture passes; copies with `LOSS`, missing `END`, dead-proxy, nonzero exit, empty output and truncated JSON each classify as `INFRA`. A classifier that accepts any negative control invalidates this verification.

   Normal trial prompt (substitute the absolute plan path):

   `Call the task tool exactly once with exactly one item: agent "plan-reviewer", solutionSpace "plan review", task "Review the plan at <PATH>". Do not do anything else. When the result arrives, print the subagent's structured result as JSON verbatim and nothing else.`

   | Run | Agent dir / plan | Expected |
   |---|---|---|
   | branch above, pinned | `$A` / `$PINNED` | `MODEL`; `REJECT`; at least one blocker whose `area` starts with `PROCESS 5` |
   | one-file control above | `$C` / the same `$PINNED` | `MODEL`; no blocker whose `area` starts with `PROCESS 5` |
   | branch below | `$A` / mutated below-plan source | `MODEL`; no blocker whose `area` starts with `PROCESS 5` |

   The first two rows use the same binary, config/model hashes, cwd, native addon and immutable plan bytes; exactly one loaded rule differs. After the branch-above row, run `GC wave --lane F2 --snapshot "$SNAP" --outcome qa=PASS --outcome implementation-audit=PASS`: it MUST exit 1 with `plan bytes differ from the snapshot`, and the ledger MUST have no `gate_wave`. Together, the reviewer's PROCESS 5 finding from `$PINNED` and the wave refusal prove reviewers consumed the pinned bytes while recording remained bound to the changed source.

   **Mid-review dependency-loss control.** Run the branch-below trial in `--mode json`. A separate watcher parses its JSONL until `tool_execution_start` for tool `task`, records the current client→router byte total, then waits for the next increase (the plan-reviewer request has started), synchronously appends `LOSS reviewer-router-traffic`, and kills only that trial's proxy. If no post-dispatch router traffic appears within 120 seconds, the control fails as `INFRA` and is not evidence. The CLI is bounded by `gtimeout 180`; `rrt-classify.mjs` MUST report `INFRA` even if stdout contains a valid-looking verdict. The proxy log and metadata are durable files owned by processes separate from the CLI; watcher/runner death leaves `LOSS` or a missing `END`, both `INFRA`, so liveness does not disappear with its observer.

   Run inventory checks again. Then remove `$A`, `$C`, `$N`, `$EMPTY`, `$R` and the three `/tmp` helpers; they include copied router credentials. Keep only redacted outputs, hashes, classifier results and proxy lifecycle/byte-count logs under `.omo/evidence/review-risk-tier/`.

   `plan-tier-above.md`:
   ```markdown
   # Deploy helper (QA fixture, above)

   ## Context
   Add `scripts/deploy-prod.sh`, run from CI on every merge to main.

   ## Approach
   1. `scripts/deploy-prod.sh` reads `PROD_DATABASE_URL` from the CI secret store, runs `bun run migrate` against the production database, and prints the migration log to the CI job output.

   ## Verification
   - Run the script against a staging copy; the migration log lists every applied migration.

   ## Final verification wave
   - [ ] F3. Whole-diff review: not needed (one script)
   - [ ] F1. Manual QA on the real surface
   - [ ] F2. Merge gate: `review-work`

   ## Merge gate
   - Author's risk assessment: a failed migration leaves the schema half-applied
   - Mandatory class: none
   - Risk tier: internal-tooling
   - Whole-diff review: not needed (one script)
   - Accepted residual risks: none (QA fixture)
   - Out of scope for blocking: none (QA fixture)
   - Feature-specific criteria:
     - Invariant: the script applies every pending migration exactly once
       Positive witness: a staging run lists each pending migration once
       Negative control: a second run applies nothing
       Observable: migration log
       Boundary: scripts/deploy-prod.sh
   ```

   `plan-tier-below.md` uses the same skeleton with these changes:
   - title `# Docs link check (QA fixture, below)`;
   - Context: `Add \`scripts/check-docs-links.ts\`, a local developer script that reports broken relative links in \`docs/**/*.md\`.`;
   - Approach: `1. \`scripts/check-docs-links.ts\` walks \`docs/**/*.md\`, resolves every relative link against its file's directory, prints \`file:line target\` for each missing target, and exits 1 when any is missing, else 0.`;
   - Verification: `- A docs tree with one broken link prints that link and exits 1; after the fix it exits 0.`;
   - Merge gate risk assessment: `a false report costs a developer a minute; nothing ships`;
   - accepted residual risks: `links inside HTML blocks are not checked`;
   - out of scope: `absolute URLs`;
   - criterion: invariant `every broken relative link is reported with its file and line`, positive witness `one broken link gives one report line and exit 1`, negative control `a tree without broken links exits 0 with no output`, observable `stdout and exit code`, boundary `scripts/check-docs-links.ts`.
6. **After merge to main**, from `/Users/tim/git/oh-my-pi`: run `bun scripts/install-team-config.ts`. Then `diff -q team-config/agent/skills/review-work/scripts/plan-contract.mjs ~/.omp/agent/skills/review-work/scripts/plan-contract.mjs` must print nothing. Running sessions pick up the change after a restart.

## Assumptions & contingencies

- The cap is two fix rounds per gate lane, with F2 and F3 counted separately. Wave 3 with blockers stops, and continue is refused there. Tim set this limit on 2026-10-22.
- A missing `Risk tier` means `product`. Ledgers and records written before this change keep their behaviour. Snapshots in flight lack `plan_sha256` and `plan_copy` and are refused; take a new snapshot.
- If an isolated Verification 5 run fails authentication or twice classifies as `INFRA`, stop that row and report it. Do not install branch config into `~/.omp/agent`, because other sessions read it.

## TODOs

1. F3-B1: re-run Verification 5 so the inventory contract holds after the runs. Keep `$A` and `$C` as untouched templates that are never a launch directory, and freeze a per-file SHA-256 map of each at the pre-run inventory; the pre, post and final inventories check each template against its map. Each trial copies its template into a fresh `/tmp/rrt-trials/<trial>` and, before launching omp, compares every file of that copy with the frozen map; a missing, extra or different file writes `COPY-MISMATCH`, skips the launch and classifies as INFRA. omp then runs with `PI_CODING_AGENT_DIR=/tmp/rrt-trials/<trial>` (table rows `$A/**`, `$C/**` and `rrt-run.mjs`). Use-time binding: HASH-PRE and HASH-POST hash that copy's `rules/plan-review-process.md`, `config.yml` and `models.yml`, so a change to them that lasts into the run shows as identity drift and classifies as INFRA. Nothing but the trial's own omp writes the trial copy; a change made and reverted inside the sub-second window between the copy check and omp's load is not detected. Controls: freeze a scratch template; an unchanged copy gives `COPY-OK`; a rule file changed after freezing gives `COPY-MISMATCH` and INFRA. Extract natives with one warm-up smoke before the first scored trial. Every trial from the earlier runs is reported as INFRA.
2. F3 Should-fix: `lesson-size-gate-to-audience.md` limits `internal-tooling` to dev, CI, or proof tooling that reaches no protected asset, matching `plan-merge-gate.md`.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over <main at worktree creation>...<head>
- [x] F1. Manual QA on the real surface: Verification 2-5 transcripts under `.omo/evidence/review-risk-tier/`, on the head after F3's last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: a wrong tier parse or tier binding would let a product plan run with one auditor and a cap, or leave internal-tooling lanes looping as before. A wrong decide rule would block a legitimate continue or freeze. The new ledger event and snapshot fields are persisted state. Team-wide config, reversible by reinstalling main.
- Mandatory class: concurrency-state
- Risk tier: product
- Whole-diff review: needed (two gate scripts, a new shared module, two skills, three rules, one extension comment)
- Accepted residual risks: `--by` on retier and decide is self-reported, so an agent can enter the user's name; a plan that falsely declares internal-tooling is caught only by plan-review PROCESS 5 and the auditor's security_delta, both judgement calls; the owner of the local checkout can deliberately chmod, alter and restore a pinned plan copy during a review read, but this requires active gate tampering and gains no capability the owner lacks
- Out of scope for blocking: ledgers, snapshots and gate records written before this change; OpenSpec change folders as --plan; the bundled plan-reviewer prompt packages/coding-agent/src/prompts/agents/plan-reviewer.md
- Feature-specific criteria:
  - Invariant: an internal-tooling gate lane stops after two fix rounds, and continue is refused at that stop
    Positive witness: internal-tooling plan, wave totals 3, 2, 1: wave 3 prints DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers and exits 3; decide --choice continue exits 1; freeze exits 0
    Negative control: the same totals on a plan without Risk tier print DECISION: CONTINUE on all three waves
    Observable: gate-convergence stdout first line and exit code
    Boundary: gate-convergence.mjs decide() and the decide command
  - Invariant: the gate's tier is bound at baseline and changes only through retier, internal-tooling to product; every wave reviewer reads a pinned copy of the snapshot's plan bytes, and recording requires both that copy and the source plan to retain the bound digest
    Positive witness: snapshot prints a `PLAN` path whose read-only bytes hash to `plan_sha256`; after the source changes, a plan-reviewer given that path still reports the pinned plan's PROCESS 5 blocker, while wave refuses the changed source and writes no `gate_wave`; after retier, wave 3 with one blocker continues and the ledger holds one `risk_tier_change`
    Negative control: a product gate whose plan says internal-tooling refuses snapshot and retier; a same-tier source edit, tampered pinned copy, legacy snapshot without plan fields, and snapshot taken before retier each make wave exit 1 without `gate_wave`; the same plan under the one-file control rule has no PROCESS 5 blocker
    Observable: snapshot/copy digests and mode, reviewer structured result, exit codes, stderr, ledger events
    Boundary: gate-convergence.mjs gateState, readLedger, retier, snapshot and wave; review-work and integration-review plan-path substitution
  - Invariant: Risk tier reads product when absent and refuses personal, any value other than exactly product or internal-tooling, duplicates, and internal-tooling without exactly one Mandatory class bullet whose whole value is none
    Positive witness: a plan without the field, and one with Risk tier internal-tooling plus Mandatory class none, both exit 0 under --plan-only
    Negative control: Risk tier personal, internal-tooling (or product), and internal-tooling with Mandatory class auth-secrets-pii, none (auth-secrets-pii) or none, concurrency-state each exit 1 naming plan Risk tier
    Observable: validator stdout word, exit code and stderr
    Boundary: validate-gate-record.mjs validatePlanContract via plan-contract.mjs readRiskTier
  - Invariant: a gate record for an internal-tooling plan validates only with mandatory_class none and reviewers_run exactly implementation-audit
    Positive witness: the pass fixture under an internal-tooling plan exits 0
    Negative control: the same record with mandatory_class auth-secrets-pii exits 1 on mandatory_class; with reviewers_run empty, or with implementation-audit plus strategic-risk-review, it exits 1 on reviewers_run; each message names the tier
    Observable: validator exit code and stderr field
    Boundary: validate-gate-record.mjs validateRecord
  - Invariant: `auth-secrets-pii` and `Risk tier` classify the asset and its reach, not the filename: synthetic credentials limited to disposable local/test services may be internal-tooling, while real provider/production credentials, authentication paths and third-party personal data remain product even when read from a local `.env`
    Positive witness: the docs-link fixture under the installed branch rule has no PROCESS 5 blocker
    Negative control: the production migration fixture reads a real CI credential and reaches production; under the same installed branch rule it is REJECT with a PROCESS 5 blocker despite naming itself internal-tooling
    Observable: structured plan-reviewer verdict and blocker area from valid `MODEL` trials
    Boundary: installed `plan-review-process.md`, `plan-merge-gate.md` and review-work Phase 0.5
- Whole-diff review report and its class list, when F3 ran: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave3.md (PASS, wave 3); earlier waves: /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave1.md, /Users/tim/git/oh-my-pi/.worktrees/review-risk-tier/.omo/evidence/review-risk-tier/f3/report-wave2.md

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Review exactly these five sections:
1. Goal and behavioural contract
2. Correctness, regressions, architecture, wire contracts
3. Security and privacy delta
4. Verification adequacy
5. Final `PASS | FAIL | INCONCLUSIVE`

Generate at least one adversarial behavioural criterion of your own using Phase 2.5 fields, and make every criterion you emit your own - the validator rejects a trailer carrying any criterion whose invariant is restated from the plan, so quoting one back beside an original does not satisfy the rule. Author-supplied criteria are inputs, never complete review scope.

Security scope: a finding blocks only when it cites changed lines in DIFF_RANGE, or shows change altered exploitability or exposure of pre-existing code. Otherwise label it `PRE-EXISTING / OUT-OF-SCOPE` as a note.

Brief guard: if this message did not carry all five numbered sections, or withheld the QA matrix, return INCONCLUSIVE and name what was missing. Do not answer a narrower brief as if it were the whole assignment.

Return each blocker on its own `Blocker B<n>:` line with severity, `file:line` or artifact evidence, violated contract, and fix direction. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Confirm each listed class is closed at every site; do not re-derive classes F3 already closed. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: <numbers you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no from your own section 3>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER