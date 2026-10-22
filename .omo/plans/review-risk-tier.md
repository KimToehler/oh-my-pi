# Review risk tier and fix-round cap for the merge gate (plan B of 2)

## Context

Plan A (`.omo/plans/review-blocking-threshold.md`, merged) made reviewers block only above a shared blocking threshold and made every unfixed blocker a recorded `downgrades` entry. Plan B adds the second half that plan A deferred (its Context, line 12): plans declare a **Risk tier**. `internal-tooling` (dev, CI and proof tooling that reaches no protected asset) gets exactly one auditor, `Mandatory class: none`, and **at most 2 fix rounds per gate lane**. A third wave that still has blockers stops for freeze or re-plan. `auth-secrets-pii` is narrowed by what the change handles, never by filename: synthetic credentials generated only for disposable local/test services do not trigger it; a real provider key, production token, authentication path or third-party personal data does, including when stored in a local `.env`. Product plans keep the full depth.

Cut (PROCESS 3). On 2026-10-22 Tim decided to cut the review-gate work into plan A and plan B. After plan-review round 1 he also decided to keep plan B as one gate. The concrete dependency:
- The fix-round cap (step 2) cannot ship before the validator rules (step 1). A capped lane ends in freeze, and a freeze is safe only when the gate record holds the frozen blockers as downgrades of an auditor verdict. For `mandatory_class: none` the current validator accepts `reviewers_run: []` (`validate-gate-record.mjs:750-762`). Without step 1, a capped internal-tooling lane could therefore freeze and merge with no reviewer verdict at all.
- Step 1 alone is safe but inert. It adds a field and refusals and changes no gate's cost.
- A cut would ship the same two parts in the same order behind two full gates.
- The prose in step 3 documents exactly these two mechanisms and is not independently testable.

All edits are in team-config sources. `~/.omp/agent` changes only through the installer after merge.

## Approach

### 0. Worktree

```
git -C /Users/tim/git/oh-my-pi worktree add .worktrees/review-risk-tier -b feat/review-risk-tier main
```

Every path below is relative to `/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier`. In shell commands, `S=team-config/agent/skills/review-work/scripts`.

Steps 1 and 2 each run the same cycle:
1. Write the tests first.
2. Run them against the unchanged scripts and save the output as `.omo/evidence/review-risk-tier/red-step<N>.txt`. The new blocked rows must fail; rows that already pass may pass.
3. Implement.
4. Run `bun run test:team-config` until it is green.
5. Commit only the named files.

### 1. Shared plan parser and the validator tier rules

**New module `$S/plan-contract.mjs`.** Today `validate-gate-record.mjs` is the only plan parser; `gate-convergence.mjs` has none.
- Move these out of `$S/validate-gate-record.mjs` byte-for-byte, as named exports:
  - the comment block "omp-local plan contract. Code fences and HTML comments…" (lines ~519-521);
  - `SECTION_PATTERN`;
  - `scanMarkdown`, `planContent` and `mergeGateSection`.
- These stay in the validator: `CRITERIA_HEADER_PATTERN`, `OPT_OUT_PATTERN`, `ABORT_FIELDS`, the `DEFERRAL_*` constants, and every `validate*` function.
- Add `export function readRiskTier(section)`.
  - Input: `section` is the output of `mergeGateSection(...)` and may be `undefined`.
  - Output: `{ tier: "product" | "internal-tooling" }` or `{ error: string }`. It never throws.
  - Logic:
    1. `section === undefined` → `{ tier: "product" }`.
    2. Split `section` on `\n`. Tier lines match `/^-\s+(?:\*\*)?Risk tier(?:\*\*)?\s*:(?:\*\*)?(.*)$/i`. This is the same label shape as `validateAbortRuleFields`, and it matches top-level bullets only.
    3. No tier line → `{ tier: "product" }`. More than one → `{ error: "duplicate" }`.
    4. Normalise a value: take capture group 1, remove every `` ` `` and `*`, trim, lowercase.
       - `personal` → `{ error: "personal plans run no merge gate; replace the section with the top-level bullet - Merge gate: not applicable (<reason>)" }`.
       - Anything other than exactly `product` or `internal-tooling` → `{ error: "must be exactly product or internal-tooling; put the reason in Author's risk assessment" }`.
    5. For `internal-tooling`, class lines match `/^-\s+(?:\*\*)?Mandatory class(?:\*\*)?\s*:(?:\*\*)?(.*)$/i`. The plan needs exactly one, and its normalised value must equal `none` with no other text. Otherwise → `{ error: "internal-tooling requires exactly one Mandatory class bullet whose whole value is none; a mandatory class makes the plan product" }`.
    6. Otherwise → `{ tier }`.

**`$S/validate-gate-record.mjs`:**
- Imports: `import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"`. Leave the `node:fs` import line untouched, because the fs-surface test counts it.
- Add `function riskTier(section) { const parsed = readRiskTier(section); if (parsed.error) block("plan Risk tier", parsed.error); return parsed.tier }`.
- `validatePlanContract`: after `validateAbortRuleFields(section)`, call `riskTier(section)`. The opt-out branch returns before this point and does not change.
- `main()` full mode: replace `validateCriteria(mergeGateSection(planContent(scanMarkdown(planText))))` with `const section = mergeGateSection(planContent(scanMarkdown(planText)))`, then `validateCriteria(section)`. Add `riskTier: riskTier(section)` to `context`.
- `validateRecord` gets two checks:
  - Directly after the `mandatoryClasses` membership check (~735-738), before `implementation_models`:
    `if (context.riskTier === "internal-tooling" && record.mandatory_class !== "none") block("mandatory_class", "the plan declares Risk tier internal-tooling, which requires none; a mandatory class makes the work product: set - Risk tier: product, run gate-convergence retier, and review again")`
  - Directly after the existing `mandatory_class requires missing invocation` loop (~758-762):
    `if (context.riskTier === "internal-tooling" && (reviewers.length !== 1 || reviewers[0] !== "implementation-audit")) block("reviewers_run", "the plan declares Risk tier internal-tooling, which runs exactly implementation-audit; for no reviewer or a second one, use Risk tier product")`

**Tests in `$S/validate-gate-record.test.mjs`:**
- Change `fullMode(text)` to `fullMode(text, mutate = () => {})`, calling `mutate(record)` before `run(...)`. Existing callers do not change.
- New `acceptedPlans` rows:
  - `["an internal-tooling tier with Mandatory class none", gatedPlan({ after: "- Risk tier: internal-tooling\n" })]`
  - `["a bold product tier", gatedPlan({ after: "- **Risk tier:** product\n" })]`
- New `blockedPlans` rows. Let `IT = gatedPlan({ after: "- Risk tier: internal-tooling\n" })`.
  - `["a personal tier", gatedPlan({ after: "- Risk tier: personal\n" }), /plan Risk tier: personal plans run no merge gate.*not applicable/]`
  - `["an unknown tier", gatedPlan({ after: "- Risk tier: internal\n" }), /plan Risk tier: must be exactly product or internal-tooling/]`
  - `["the template tier line", gatedPlan({ after: "- Risk tier: <product | internal-tooling>\n" }), /plan Risk tier: must be exactly/]`
  - `["a tier with an inline reason", gatedPlan({ after: "- Risk tier: internal-tooling (or product)\n" }), /plan Risk tier: must be exactly/]`
  - `["a duplicate tier", gatedPlan({ after: "- Risk tier: product\n- Risk tier: product\n" }), /plan Risk tier: duplicate/]`
  - `["internal-tooling with a mandatory class", IT.replace("- Mandatory class: none", "- Mandatory class: auth-secrets-pii"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/]`
  - `["internal-tooling with none plus a parenthesised class", IT.replace("- Mandatory class: none", "- Mandatory class: none (auth-secrets-pii)"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/]`
  - `["internal-tooling with none plus a listed class", IT.replace("- Mandatory class: none", "- Mandatory class: none, concurrency-state"), /plan Risk tier: internal-tooling requires exactly one Mandatory class/]`
  - `["internal-tooling without a Mandatory class bullet", IT.replace("- Mandatory class: none\n", ""), /plan Risk tier: internal-tooling requires exactly one Mandatory class/]`
- New test `#given an internal-tooling plan #when full mode validates the pass record #then it exits zero`: `fullMode(IT)` gives status 0. This is the positive witness: `pass.json` has `mandatory_class: none` and `reviewers_run: ["implementation-audit"]`.
- New table test `#given an internal-tooling plan and a record outside its reviewer contract #when full mode runs #then the named field blocks`. Each row: `fullMode(IT, mutate)` gives status 1, and stderr matches `^<field>: the plan declares Risk tier internal-tooling`.
  - `["a mandatory class", (r) => { r.mandatory_class = "auth-secrets-pii" }, "mandatory_class"]`
  - `["no reviewer", (r) => { r.reviewers_run = [] }, "reviewers_run"]`
  - `["a second reviewer", (r) => { r.reviewers_run = ["implementation-audit", "strategic-risk-review"] }, "reviewers_run"]`

Commit: `feat(review-work): read Risk tier from the plan's merge gate`.

### 2. Convergence: tier bound at baseline, fix-round cap, audited re-tier, plan bytes bound per wave

All changes are in `$S/gate-convergence.mjs`.

**Imports and constants:**
- `import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"`.
- Constants `TIERS = new Set(["product", "internal-tooling"])` and `TOOLING_FIX_ROUNDS = 2`.
- In the header comment (line 4), add `risk_tier_change` to the list of ledger events.

**Ledger:**
- Add `risk_tier_change` to `OWN_EVENTS`.
- `SHAPES.gate_baseline` gains `risk_tier: (v) => v === undefined || TIERS.has(v)`. A missing value comes from an old ledger and reads as product.
- `SHAPES.risk_tier_change = { from: (v) => v === "internal-tooling", to: (v) => v === "product", by: isString, reason: isString }`.
- `readLedger` returns `{ baseline, tier, events }`, with `tier: undefined` in the no-baseline branch. Compute `tier` like this:
  1. Start with `tier = baselines[0].value.risk_tier ?? "product"`.
  2. Walk `events` in order. For each `risk_tier_change`:
     - if `event.from !== tier` → `fail(\`undecidable: ledger risk_tier_change from ${event.from} while the gate runs as ${tier}\`)`;
     - otherwise `tier = event.to`.

**Tier check against the plan:**
- New `function gateState(ctx)`:
  1. `const state = readLedger(ctx.repo, ctx.key)`.
  2. If `state.tier !== ctx.planTier`:
     - `state.tier === "internal-tooling"` → `fail("plan Risk tier is product but this gate runs as internal-tooling; record the change with retier --by <user> --reason <text>")`;
     - otherwise → `fail("plan Risk tier is internal-tooling but this gate runs as product; a gate never moves to internal-tooling: set the plan back to product or gate the work under a new plan file")`.
  3. Return `state`.
- Use `gateState(ctx)` instead of `readLedger(ctx.repo, ctx.key)` in `ready`, `snapshot`, `delta`, `accept`, `wave` and `decide` (lines ~289, 298, 336, 368, 396, 481).
- `baseline` keeps `readLedger(..., { requireBaseline: false })`. It still prints `BASELINE <sha> existing` and runs no tier check.

**Commands:**
- `baseline`, new baseline only: append `{ event: "gate_baseline", plan: ctx.key, base_sha: sha, risk_tier: ctx.planTier }`. Stdout does not change; a test anchors `^BASELINE [0-9a-f]{12} recorded$`.
- `snapshot`:
  1. Write the exact `ctx.planBytes` to `.omo/gate-deltas/<lane>-wave-<n>.plan.md`. If a stale copy for the same unrecorded wave exists, chmod it `0600` before replacing it; chmod the finished copy `0444`.
  2. The snapshot JSON gains `plan_sha256: ctx.planSha256` and repo-relative `plan_copy`. Write the JSON only after the copy succeeds.
  3. Keep the existing first two stdout lines unchanged; append `PLAN <absolute plan-copy path>`. Review briefs for this wave use that path, never the mutable source plan.
- `wave`, after the tree check:
  1. Require `snapshot.plan_sha256` and `snapshot.plan_copy`; a snapshot taken before this change is refused and must be retaken.
  2. Hash the pinned copy. If it differs from `snapshot.plan_sha256`, fail `state changed since the wave was dispatched: pinned plan copy differs from the snapshot`.
  3. If `snapshot.plan_sha256 !== ctx.planSha256`, fail `state changed since the wave was dispatched: plan bytes differ from the snapshot`.
  4. Call `decide(waves, blockers.length, fixInduced.length, state.tier)`.
- `decide(waves, total, fixInduced, tier)`: right after the `total === 0` PASS line, insert
  `if (tier === "internal-tooling" && n > TOOLING_FIX_ROUNDS) return { decision: "STOP", reason: \`internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds; wave ${n} still has ${total} blockers\` }`
  The two existing STOP rules follow unchanged.
- `decide` command: after the "already decided" check, add
  `if (state.tier === "internal-tooling" && last.wave > TOOLING_FIX_ROUNDS && ctx.values.choice === "continue") fail(\`internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds per lane: choose freeze or replan, or re-tier the plan to product (retier) to continue\`)`
  A STOP at wave 2 comes from the fix-induced rule, and continue stays allowed there.
- New command `retier(ctx)`, placed after `decide` in `commands`:
  1. `!isString(ctx.values.by) || !isString(ctx.values.reason)` → `fail("retier needs --by and --reason")`.
  2. `const state = readLedger(ctx.repo, ctx.key)`. Do not use `gateState`: the tier mismatch is the reason this command runs.
  3. `state.tier !== "internal-tooling"` → `fail(\`this gate runs as ${state.tier}; retier moves internal-tooling to product only\`)`.
  4. `ctx.planTier !== "product"` → `fail("set - Risk tier: product in the plan before retier")`.
  5. Append `{ event: "risk_tier_change", plan: ctx.key, from: "internal-tooling", to: "product", by: ctx.values.by, reason: ctx.values.reason }`.
  6. Print `RECORDED risk_tier_change internal-tooling -> product`.

**`main()`:**
1. Replace the bare `readFileSync(resolved)` with `planBytes = readFileSync(resolved)` inside the same try/catch, keeping its message.
2. Then:
   - `planSha256 = sha256(planBytes)`;
   - `const parsed = readRiskTier(mergeGateSection(planContent(scanMarkdown(planBytes.toString("utf8")))))`;
   - `if (parsed.error) fail(\`plan Risk tier: ${parsed.error}\`)`;
   - `planTier = parsed.tier`.
3. Pass `{ repo, key, values, planBytes, planTier, planSha256 }` to the command. `patch` reads no plan, so those plan fields are undefined.

**Tests in `$S/gate-convergence.test.mjs`:**
- Add a helper next to `first`: `const tierPlan = (s, tier) => writeFileSync(path.join(s.repo, PLAN), \`# demo\n\n## Merge gate\n- Mandatory class: none\n- Risk tier: ${tier}\n\`)`.
  - Every existing test keeps the `# demo` plan, which reads as product, so those tests stay as they are.
  - The existing `#given totals 3, 2, 1 #when recorded #then every wave continues` is the product negative control.
- `#given an internal-tooling plan with totals 3, 2, 1 #when the third wave records #then the fix-round cap stops it`:
  1. `tierPlan(s, "internal-tooling")`, then baseline.
  2. The ledger's `gate_baseline.risk_tier` is `"internal-tooling"`.
  3. Waves 1 and 2 with `qa=FAIL` print `DECISION: CONTINUE`.
  4. Wave 3 exits 3, with first line `DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers`.
- `#given an internal-tooling cap STOP #when decide runs #then continue is refused and freeze is recorded`:
  1. The same three waves, with `--outcome qa=PASS --outcome implementation-audit=FAIL`.
  2. `decide --choice continue --by tim --reason t` exits 1, stderr matching `/internal-tooling allows 2 fix rounds per lane/`.
  3. `decide --choice freeze --by tim --reason t` exits 0.
- `#given an internal-tooling gate whose plan moves to product #when commands run #then they refuse until retier, and after retier the lane runs as product`:
  1. Two waves, totals 3 and 2.
  2. `tierPlan(s, "product")`. `snapshot --lane F2` exits 1, stderr matching `/record the change with retier/`.
  3. `retier --by tim --reason t` exits 0 and prints `RECORDED risk_tier_change internal-tooling -> product`.
  4. Wave 3 with one blocker prints `DECISION: CONTINUE`; the cap no longer applies.
  5. A second `retier` exits 1, matching `/this gate runs as product/`.
- `#given a product gate whose plan moves to internal-tooling #when snapshot or retier runs #then both refuse`:
  1. Product baseline, then `tierPlan(s, "internal-tooling")`.
  2. `snapshot` exits 1, matching `/never moves to internal-tooling/`.
  3. `retier --by tim --reason t` exits 1, matching `/this gate runs as product/`.
- `#given a snapshot #when it is written #then the plan copy is exact, read-only and named on stdout`: the copy bytes equal the source plan, its mode is `0444`, snapshot `plan_sha256` equals its digest, and stdout line 3 is `PLAN <absolute copy path>`.
- `#given a source plan changed and restored after snapshot #when the pinned copy is read and the wave records #then the copy stays original and the wave passes`: this is the edit-and-restore negative control; reviewers are safe because the skills dispatch the copy, not the source.
- `#given a pinned plan copy is tampered with #when the wave records #then it is refused and nothing is written`: chmod the copy for the test, change it, then expect exit 1, `/pinned plan copy differs/`, and no `gate_wave`.
- `#given a snapshot taken before a retier #when the wave records on it #then it is refused and nothing is written`:
  1. Internal-tooling baseline, then `snapshot`; keep the path.
  2. `tierPlan(s, "product")`, then `retier`.
  3. `wave --snapshot <kept path> --outcome qa=PASS` exits 1, stderr matching `/plan bytes differ from the snapshot/`.
  4. The ledger has no `gate_wave`.
- `#given a same-tier plan edit between snapshot and wave #when the wave records #then it is refused and nothing is written`:
  1. Product baseline, then `snapshot`; keep the path.
  2. Append `\n- Accepted residual risks: edited after dispatch\n` to the plan.
  3. `wave --snapshot <kept path> --outcome qa=PASS` exits 1, stderr matching `/plan bytes differ from the snapshot/`.
  4. The ledger has no `gate_wave`.
- `#given a legacy snapshot without the plan fields #when wave runs #then it is refused and nothing is written`.
- `#given a personal tier #when baseline runs #then it is refused`: after `tierPlan(s, "personal")`, `baseline --sha HEAD` exits 1, stderr matching `/plan Risk tier: personal plans run no merge gate/`.

Commit: `feat(review-work): cap internal-tooling gate lanes at two fix rounds`.

### 3. Prose: tier contract, cap, narrower auth-secrets-pii, plan-review check

**`team-config/agent/skills/review-work/SKILL.md`:**
- Phase 0.5, mandatory item 1 (line ~95): replace `1. auth, secrets, PII` with `1. auth, secrets, PII: the change touches a real credential, an authentication or authorisation path, or third-party personal data. A real credential currently grants access outside disposable local/test services, regardless of where it is stored; a provider key or production token in a local \`.env\` is real. A synthetic password generated only for the developer's disposable local stack, or a test fixture that grants no external access, is not.`
- Phase 0.5, new paragraph after the habituation paragraph (line ~100):
  `**Risk tier.** Read \`- Risk tier:\` from the plan's \`## Merge gate\`; a plan without it is \`product\`, and the validator refuses any value other than exactly \`product\` or \`internal-tooling\`. \`product\`: this phase as written. \`internal-tooling\` (dev, CI, and proof tooling that reaches no protected asset as the blocking threshold defines it): \`mandatory_class\` is \`none\`, exactly one \`implementation-audit\` runs, and each gate lane allows two fix rounds (Fix waves step 3); the validator refuses a record for this tier with any other class or reviewer set. A reviewer's \`security_delta: yes\` therefore means the work is product: set \`- Risk tier: product\` in the plan, run \`GC retier --by <user> --reason <text>\`, reclassify, and review again.`
- Phase 0.6 (line 104): after the sentence ending `each with concrete text or \`none (<reason>)\`.`, insert `Both modes also read the optional \`Risk tier\`: exactly \`product\` or \`internal-tooling\`, and \`internal-tooling\` needs exactly one \`Mandatory class\` bullet whose whole value is \`none\`.`
- Phase 4, re-classify paragraph (line ~343): append `Under Risk tier \`internal-tooling\` that block means re-tier, as in Phase 0.5.`
- Fix waves step 1:
  - `GC baseline` bullet (line ~393): append `; it records the plan's Risk tier, which binds the gate: a later plan edit to \`product\` needs \`GC retier --by <user> --reason <text>\` (internal-tooling to product only; a gate never moves to internal-tooling), and every other command refuses until then`.
  - `GC snapshot` bullet: keep both the first output line (snapshot path) and the `PLAN <path>` line. The latter is the immutable plan input for this wave. Populate Phase 2's `{PLAN}`, `{CRITERIA WITH FIVE FIELDS}`, accepted residual risks and out-of-scope fields from that copy, never from the source plan; `GC wave` verifies both the copy and source before recording.
- Fix waves step 3, after `Without \`ask\` UI, report the numbers and options and stop.` (line ~411): append `Under Risk tier \`internal-tooling\` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; the script refuses continue there. Work that needs more rounds is product: re-tier it as in Phase 0.5, after which continue is legal.`

**`team-config/agent/skills/integration-review/SKILL.md`:**
- Step 2 (lines ~59, 68): keep the `PLAN <path>` line from `GC snapshot` and substitute that pinned path for `<plan path>` in the reviewer brief. The source plan is not a review input for the wave.
- Step 4 (line ~147): after `Without ask UI, report and stop.`, append `Under Risk tier \`internal-tooling\` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; \`GC decide\` refuses continue there.`

**`team-config/agent/rules/plan-merge-gate.md`:**
- Template: insert `- Risk tier: <product | internal-tooling>` after the `Mandatory class` line.
- After `Mandatory class other than \`none\` means both reviewers run at F2, no discretion.`, add: `\`auth-secrets-pii\` applies when the change touches a real credential, an authentication or authorisation path, or third-party personal data. Classify the value and its reach, never the filename: a provider key or production token read from a local \`.env\` is real; a synthetic password generated only for disposable local/test services is not.`
- Insert this section before `## The criteria are the abort rule`:
  ```
  ## Risk tier

  - `product`: ships to users or production, or can reach a protected asset (production data, a
    real credential, third-party personal data, tenant isolation, money, an audit trail,
    irreversible state). Full gate; mandatory classes apply. A plan without the field is product.
  - `internal-tooling`: dev, CI, and proof tooling that reaches no protected asset. `Mandatory
    class` must be exactly `none`. F2 runs exactly one implementation-audit; each gate lane allows
    two fix rounds, and a third wave that still has blockers stops for freeze or re-plan, with
    unfixed blockers in the record's `downgrades`. A protected asset in reach makes the plan product.
  - `personal`: a local tool for one user opts out with `- Merge gate: not applicable (<reason>)`;
    the validator refuses `Risk tier: personal`.
  - The value is exactly one tier word; the reason goes into `Author's risk assessment`.

  ```

**`team-config/agent/rules/plan-review-process.md`:**
- Frontmatter `description`: append `, risk tier`.
- `Labels are PROCESS 1-4.` becomes `Labels are PROCESS 1-5.`
- In the opt-out paragraph, `you MUST NOT report PROCESS 1, 2 or 3 for it` becomes `you MUST NOT report PROCESS 1, 2, 3 or 5 for it`.
- Append this bullet: `- **PROCESS 5, risk tier.** Trigger: \`- Risk tier: internal-tooling\` in \`## Merge gate\`. Required: under normal use the planned change reaches no protected asset as the blocking threshold defines it (it is dev, CI, or proof tooling), and it does not change how product code is gated. A plan that reaches one, or changes a gate, is a blocker: it is product, and its \`Mandatory class\` follows from the change.`

**`team-config/agent/rules/lesson-size-gate-to-audience.md`:**
- `description`: `Size the threat model and merge gate to who runs the tool and what it can damage; personal tools opt out, dev/CI/proof tooling declares Risk tier: internal-tooling`.
- Under **How to apply**, insert before the last bullet: `- Dev, CI, or proof tooling in a product repo: \`- Risk tier: internal-tooling\` with \`Mandatory class: none\`. One auditor, two fix rounds per lane, then freeze or re-plan; unfixed blockers go into the record's downgrades.`
- Last bullet: replace `it stops when fix-induced blockers rise or the blocker count does not fall over three waves.` with `it stops when fix-induced blockers rise, the blocker count does not fall over three waves, or an internal-tooling lane has used its two fix rounds.`

**`team-config/agent/extensions/merge-gate.ts`**, header comment line ~15: change `the abort-rule fields, and file-or-directory plan interpretation` to `the abort-rule fields, the optional Risk tier field, and file-or-directory plan interpretation`. Comment only.

Commit: `docs(review-work): document Risk tier, fix-round cap and narrower auth-secrets-pii`.

## Critical files & anchors

- `$S/validate-gate-record.mjs`:
  - moved block ~519-583;
  - `validatePlanContract` ~665;
  - `validateRecord`: mandatory-class check ~735, reviewer checks ~750-762;
  - `main()` full mode ~929;
  - the fs-surface source test (~1490-1560) pins the `node:fs` import line and the readers, so do not touch them.
- `$S/gate-convergence.mjs`:
  - `OWN_EVENTS` and `SHAPES` (17, 72-103);
  - `readLedger` (105-141);
  - `decide()` (253);
  - commands: baseline 279, snapshot 296, wave 394, decide 477;
  - `main()` (498-537).
- `$S/gate-convergence.test.mjs`: `sandbox` (15-64) writes the plan under ignored `.omo/`; `first` (66).
- `$S/validate-gate-record.test.mjs`: `gatedPlan`, `planOnly` and `fullMode` (470-497); `acceptedPlans` and `blockedPlans` (500-559).

## Verification

From the worktree root:

1. **Suites.** `bun run test:team-config` is green with every suite, including the new rows from steps 1-2. `red-step1.txt` and `red-step2.txt` show the new blocked and tier rows failing against the unchanged scripts.
2. **Cap RED on the real code.**
   1. `cp $S/gate-convergence.mjs /tmp/gc.bak`.
   2. Delete the `decide()` cap line by edit.
   3. Run `bun test $S/gate-convergence.test.mjs`. The fix-round-cap test must fail; save the output as `.omo/evidence/review-risk-tier/red-cap.txt`.
   4. `cp /tmp/gc.bak $S/gate-convergence.mjs`. Then `git diff --quiet -- $S/gate-convergence.mjs` must exit 0.
3. **Plan-only smoke** against the real validator. Save to `.omo/evidence/review-risk-tier/smoke-plan-only.txt`.
   ```
   WT=/Users/tim/git/oh-my-pi/.worktrees/review-risk-tier
   V=$WT/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
   printf '# p\n\n## Merge gate\n- Mandatory class: auth-secrets-pii\n- Risk tier: internal-tooling\n- Accepted residual risks: flaky CI\n- Out of scope for blocking: Windows\n- Feature-specific criteria:\n  - Invariant: x holds\n    Negative control: y fails\n' > /tmp/rrt-plan.md
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
3. F2-B1: a wave's `GC snapshot` is write-once. A rerun for the same unrecorded wave on the same commit SHA and plan bytes, with an intact copy, re-prints the existing snapshot without writing either file. Other plan bytes, another commit (even with the same tree), a copy without its JSON or a JSON without its copy are refused, naming both files to delete and that every reviewer of the wave must be re-dispatched; first writes use exclusive create. Tests: unchanged rerun leaves both files' mtimes, other bytes refused until both files are deleted; empty commit refused; orphaned copy refused. RED against the unchanged script in `red-f2-b1.txt` and against 377f94d113 in `red-f2-b1-round2.txt`. Document the restart in review-work Fix waves step 1 and integration-review Step 2.
4. F2-B2: both trailer templates define `security_delta: yes` as a real credential, an authentication or authorisation path, third-party personal data, or weakened access to a protected asset; a synthetic credential limited to disposable local/test services is `no`. Phase 0.5 states the same. The validator's `security_delta: yes` + `mandatory_class: none` refusal stays unchanged.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over <main at worktree creation>...<head>
- [x] F1. Manual QA on the real surface: Verification 2-5 transcripts under `.omo/evidence/review-risk-tier/`, on the head after F3's last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

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
