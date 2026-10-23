# Review blocking threshold and recorded downgrades (plan A of 2)

## Context

Today every finding a gate reviewer reports blocks the merge. The reviewer briefs push this with `False positives are cheaper than missed issues.` The bundled plan-reviewer turns every triggered CHECK gap into a blocker, and integration-review classes whole categories as Must-fix regardless of consequence. In real sessions this cost 7 F2 waves for a local docs-check script and about 8 fix-delta rounds over `.env` edge cases (NUL bytes, short reads) in a dev-env script.

This plan makes three changes:
1. Every gate reviewer still reports everything it finds, but marks as a blocker only what meets one shared **blocking threshold**. That covers four paths: auditor as implementation-audit, oracle as strategic-risk-review, auditor running the integration-review brief, and plan-reviewer.
2. Reviewers number their blockers, both in the reply and in the trailer, and the validator checks that both lists match.
3. A record that leaves a FAIL unfixed must account for **every** blocker with one `downgrades` entry. Only then does it count as a user-authorized override. The Gate proof reports it as such, never as PASS.

Plan B (`review-risk-tier`) follows separately: Risk tier, a cap of 2 fix rounds per lane for internal-tooling, and a narrower `auth-secrets-pii`.

Two subsystems:
- the trailer and record contract of `validate-gate-record.mjs`;
- the reviewer and gate-proof contract prose.

They ship together because the briefs emit the `Blocker Bn:` lines and the `blockers:` trailer field, and the validator reads both. A validator without the briefs refuses every new FAIL trailer; briefs without the validator record nothing.

## Approach

### 0. Worktree

```
git -C /Users/tim/git/oh-my-pi worktree add .worktrees/review-blocking-threshold -b feat/review-blocking-threshold main
```

All paths are relative to `/Users/tim/git/oh-my-pi/.worktrees/review-blocking-threshold`. In shell commands, `S=team-config/agent/skills/review-work/scripts`.

### 1. Commit the tests first (RED against the original validator)

Commit 1 changes only test files and fixtures in `$S`.

**`fixtures/trailers/fail-implementation-audit.txt`:** after `verdict: FAIL`, add the line `blockers: B1`. The narrative line `Blocker B1: ...` already exists.

**`fixtures/override-with-fail.json`:** add:
```json
"downgrades": [{ "invocation": "implementation-audit", "blocker": "B1", "rule": "below-threshold", "reason": "needs a hand-edited local .env; no protected asset reachable", "disposition": "residual" }]
```

**`validate-gate-record.test.mjs`, helpers:**
- `buildTrailer`: add `blockers: null` and `narrative: "Narrative findings precede the trailer."` to the default `fields`. Append `"blockers"` to the key list `["invocation", "sections_covered", "model_id", "security_delta", "verdict"]`; a `null` value is skipped as before.
- Replace the fixed return string with `` `${fields.narrative}\n\n${head.join("\n")}\n` ``.

**New tests**, under a comment `// Blocker reconciliation`. Each row runs `runWithTrailer(record, buildTrailer({...}))` on `fixtureByName("override-with-fail.json")` with `reviewed_sha: head`, unless the row names another record.

Blocked rows (status 1 and the given stderr regex):

| Row | Trailer / record | stderr |
|---|---|---|
| two blockers, one downgrade | `verdict: "FAIL", blockers: "B1, B2", narrative: "Blocker B1: a\nBlocker B2: b"` | `/blocker B2 of implementation-audit has no downgrade entry/` |
| narrative blocker missing from the trailer | `verdict: "FAIL", blockers: "B1", narrative: "Blocker B1: a\nBlocker B2: b"` | `/narrative reports B2/` |
| trailer ID without a narrative blocker | `verdict: "FAIL", blockers: "B1, B2", narrative: "Blocker B1: a"` | `/no narrative Blocker B2/` |
| FAIL without `blockers:` | `verdict: "FAIL", narrative: "Blocker B1: a"` | `/blockers/` |
| PASS with `blockers: B1` | record `validRecord()`, trailer `blockers: "B1"` | `/only a FAIL trailer lists blockers/` |
| no downgrades | fixture trailer, `delete r.downgrades` | `/downgrades/` |
| unknown rule | `r.downgrades[0].rule = "nitpick"` | `/downgrades\.0\.rule/` |
| unknown blocker ID | `r.downgrades[0].blocker = "B7"` | `/downgrades\.0\.blocker/` |
| duplicate entry | entry doubled | `/downgrades the same blocker twice/` |
| downgrades without override | `validRecord()` plus `downgrades` from the fixture | `/downgrades/` |

Passing row: trailer `verdict: "FAIL", blockers: "B1, B2", narrative: "Blocker B1: a\n**Blocker B2**: b"` with two entries (B1 `below-threshold`, B2 `frozen`) → status 0.

Run `bun test $S/validate-gate-record.test.mjs 2>&1 | tail -40 > .omo/evidence/review-blocking-threshold/red.txt`.

Expected: every blocked row except "PASS with `blockers: B1`" fails against the original validator, because it accepts unknown fields. "PASS with `blockers: B1`" also fails (exit 0 instead of 1). The existing test `#given legitimate override with FAIL verdict` stays green. Commit 1: `test(review-work): blocker reconciliation and downgrades (RED)`.

### 2. Implement trailer `blockers` and narrative reconciliation

In `$S/validate-gate-record.mjs`:
- **`parseTrailer(text, field)`:** also return `narrative = lines.slice(0, openIndexes[0]).concat(lines.slice(closeIndexes[0] + 1))`, i.e. the reply without the trailer block. Its callers use only `scalars` and `criteria`, so it now returns `{ scalars, criteria, narrative }`.
- **`validateTrailer`:** after the `scalars.verdict !== recordVerdict` block:
  - `narrativeIds`: every line of `trailer.narrative` matching `/^\s*(?:[-*]\s+)?(?:\*\*)?Blocker (B[1-9]\d*)(?:\*\*)?\s*:/`, captured ID, deduplicated in order.
  - **`FAIL`:**
    - `scalars.blockers` must match `/^B[1-9]\d*(\s*,\s*B[1-9]\d*)*$/`; otherwise `block(\`${field}.blockers\`, "a FAIL trailer lists its blocker ids as B1, B2, ...; without them no downgrade can be reconciled")`.
    - Split on commas and trim. A duplicate → `block(\`${field}.blockers\`, "repeats a blocker id")`.
    - Each narrative ID missing from the trailer → `block(\`${field}.blockers\`, \`narrative reports ${id} but the trailer omits it\`)`.
    - Each trailer ID missing from the narrative → `block(\`${field}.blockers\`, \`no narrative Blocker ${id}: line in the reply\`)`.
  - **Otherwise:** `scalars.blockers` must be `undefined` or `"none"`; else `block(\`${field}.blockers\`, "only a FAIL trailer lists blockers")`. Narrative lines are not checked for PASS: the existing marker-quoting test (`Blocker B1: SKILL.md:239 ...` with a PASS trailer) stays green.
  - Return `{ securityDelta, blockerIds }`, where `blockerIds` is the trailer list or `[]`.

### 3. Implement `downgrades`

In `validateRecord`:
- In the trailer loop, collect `blockersByInvocation.set(verdict.invocation, outcome.blockerIds)`.
- After the existing `blockers` loop at the end of the function:
  - `const failing = verdicts.filter((v) => v.verdict === "FAIL")`.
  - `Object.hasOwn(record, "downgrades") && (!hasOverride || failing.length === 0)` → `block("downgrades", "only with an override over a FAIL verdict")`.
  - `hasOverride && failing.length > 0`:
    - `requireArray(record, "downgrades")`.
    - Each entry must be a non-array object (`downgrades.${index}`) with:
      - `invocation`: an invocation in `failing`;
      - `blocker`: in `blockersByInvocation.get(invocation)`;
      - `rule`: `below-threshold` | `accepted-residual` | `out-of-scope` | `frozen`;
      - `reason`: non-empty and without `\n`;
      - `disposition`: `residual` | `follow-up`.
    - A repeated `invocation/blocker` → `block(\`downgrades.${index}\`, "downgrades the same blocker twice")`.
    - Then, per FAIL invocation and ID without an entry: `block("downgrades", \`blocker ${id} of ${invocation} has no downgrade entry\`)`.

Run `bun run test:team-config 2>&1 | tail -20 > .omo/evidence/review-blocking-threshold/green.txt`. All green. Commit 2: `feat(review-work): reconcile reviewer blockers and require a downgrade per unfixed blocker`.

### 4. Shared blocking threshold

Use this text verbatim at every place step 5 names "the threshold text":

```
Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.
```

### 5. Reviewer and gate-proof contract (prose)

**`team-config/agent/skills/review-work/SKILL.md`**
- **Both briefs** (implementation-audit ~line 195, strategic-risk-review ~line 252):
  - Replace `False positives are cheaper than missed issues.` with `Report what you find; the blocking threshold below decides which findings block.`
  - Insert the threshold text as its own paragraph directly after.
- **Implementation-audit** `Return blockers with severity,` (~line 210): becomes `Return each blocker on its own Blocker B<n>: line with severity,`.
- **Strategic-risk-review** (~line 262): before `For every blocker name`, insert `Start each blocker with its own Blocker B<n>: line.`
- **Both trailer templates:** after `verdict:`, insert `blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>`. Do not change `security_delta`.
- **Phase 3:** after `A rejecting invocation must name its blockers inline`, insert `A FAIL whose Blocker B<n>: lines and trailer blockers: field disagree is incomplete: re-dispatch it like a missing trailer; never edit the reply.`
- **Phase 4:** replace the first sentence `Gate passes only when QA matrix has no failing row and every invocation actually run returned PASS.` with:
  `Gate passes only when QA matrix has no failing row and every invocation actually run returned PASS. The one other outcome that permits merge is an override: QA passed, every invocation returned PASS or FAIL with a stored trailer, the user agreed in this session, and the record names them in override.by and carries one downgrades entry per blocker of every FAIL trailer. An override is reported as overridden, never as PASS.`
  Then, after the paragraph `Re-classify mandatory_class ...`, insert a paragraph headed `Downgrades.`:
  - The rule values:
    - `below-threshold`: the orchestrator judges that the finding misses (a) and (b) of the blocking threshold, `reason` names the missing trigger or asset, and the user agreed;
    - `accepted-residual`: covered by the plan's `Accepted residual risks`;
    - `out-of-scope`: covered by `Out of scope for blocking`;
    - `frozen`: the user chose freeze at a convergence STOP.
  - `disposition`: `residual` or `follow-up`.
  - A `follow-up` names its tracking place in `reason`.
- **Fix waves step 3, freeze bullet:** replace `naming every remaining reviewer blocker` with `with one downgrades entry per remaining reviewer blocker (rule frozen)`.
- **Phase 5 JSON example:** after `"blockers"`, add `"downgrades": [{ "invocation": "implementation-audit", "blocker": "B1", "rule": "below-threshold", "reason": "<missing trigger or asset, one line>", "disposition": "residual" }],`. Append to the paragraph starting ``reviewers_run` is an empty array``:
  `downgrades appears only with an override over a FAIL verdict and holds exactly one entry per blocker id of each FAIL trailer; a FAIL trailer's blockers: field must equal the reply's Blocker B<n>: lines; rule is below-threshold, accepted-residual, out-of-scope, or frozen; disposition is residual or follow-up.`

**`team-config/agent/rules/merge-gate-proof.md`**
- Template line 18: `implementation-audit: <PASS|FAIL|FAIL overridden> · ...`; line 19 likewise `<PASS|FAIL|FAIL overridden|not run (reason)>`.
- After line 20, insert the template line `  override: none | by <user> · <n> downgrades (<count per rule>)`.
- In the outcome list after `passed`, insert:
  `- overridden: RAN, every FAIL carries an override the user gave in this session, one downgrades entry per blocker, and the record validated; write the verdict as FAIL overridden and fill the override line;`
- Line 29: becomes `Only passed, overridden and legitimately skipped lines allow a merge request.`

**`team-config/agent/skills/integration-review/SKILL.md`**
- Line 40: replace `False positives are cheaper than missed issues.` with `Findings are cheap; blockers are not: the blocking threshold in the brief decides what is Must-fix.`
- Brief line 71: same replacement as in the review-work briefs.
- Insert a section `## Blocking threshold` containing the threshold text directly before `## Report format` in the brief.
- Report buckets (lines 114-116) become:
  - `- **Must-fix:** every finding that meets the blocking threshold, each on its own Blocker B<n>: line. Nothing else is Must-fix.`
  - `- **Should-fix:** findings below the threshold: correctness and security findings without a realistic trigger on a protected asset, dead code, consistency issues, missing abstractions, naming drift, doc drift, premature abstractions, cross-slice simplification candidates.`
  - `- **Nit:** style, optional polish, taste calls.`

**`team-config/agent/agents/auditor.md`**, line 17: replace with:
```
- Mark a finding as a blocker only when it meets the brief's blocking threshold. Without one in the brief: it breaks the goal or a consumer the change affects (also in unchanged code), or a realistic trigger (normal use, or plausible input from outside the trust boundary) reaches a protected asset (production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, irreversible state). Report every other finding as a non-blocking risk with one line on why. Do not invent defects or restate implementation.
```

**`team-config/agent/agents/oracle.md`**: no change. The strategic-risk-review brief carries the threshold.

**`packages/coding-agent/src/prompts/agents/plan-reviewer.md`** (bundled; authoritative source of the CHECK contract):
- **`<method>`, line 51:** after `every check applies to what the delta adds, changes or removes.`, insert `A defect the delta causes or exposes in unchanged code also counts; a pre-existing defect it neither causes nor exposes is a note.`
- **`<mechanical_checks>`, line 75:** replace `When a check is triggered and the plan lacks the required answer, that is a blocker: name the check number and the exact plan slot (section, todo id, or quoted line).` with `When a check is triggered and the plan lacks the required answer, that gap is a blocker when it meets the blocking threshold in <decision>, otherwise a note; either way name the check number and the exact plan slot (section, todo id, or quoted line).`
- **CHECK 1 trigger:** replace `a protected value (credential, token, PII)` with `a protected value (a real credential or token, third-party personal data; a local development default or test fixture value is not one)`.
- **`<decision>`:** insert the threshold text as the new first bullet, but replace its sentence `Each blocker starts a line with ... in order) and names` with `Each blocker names` (the schema's `blockers` array is the list). Change `Report every evidenced blocker` to `Report every evidenced blocker that meets the threshold`.

**`team-config/agent/rules/plan-review-process.md`**
- Line 9: replace `a triggered check without the required answer is a blocker naming the label and the plan slot.` with `a triggered check without the required answer is a blocker under the blocking threshold of the reviewer's <decision> (otherwise a note), naming the label and the plan slot.`
- PROCESS 4 (c) becomes `(c) the delta fixes what its fix entries name; CHECK 1-8 and triggered DOMAIN checks apply to what the delta adds, changes or removes and to defects it causes or exposes in unchanged code, under the blocking threshold.`
- (a), (b) and the last sentence stay unchanged.

**`team-config/agent/rules/lesson-size-gate-to-audience.md`**: add a second **Why** paragraph:
```
A product repo's dev tooling hit the same loop: a dev-env script that writes a local .env ran about eight fix-delta rounds over NUL bytes and short reads, and a local docs-check script ran seven F2 waves, while the product milestones had not started. Every round counted every finding as a blocker. Reviewers now mark blockers only against the shared blocking threshold, and every blocker the gate leaves unfixed goes into the record's downgrades with the user's override.
```

Commit 3: `docs(review): shared blocking threshold for every gate reviewer; overridden gate outcome`.

### 6. Install for QA

Install the branch config into an isolated agent dir only: `cp ~/.omp/agent/config.yml ~/.omp/agent/models.yml /tmp/rbt-agent/ && PI_CODING_AGENT_DIR=/tmp/rbt-agent bun scripts/install-team-config.ts`, and run every QA probe with `PI_CODING_AGENT_DIR=/tmp/rbt-agent`. Never install the branch into the live `~/.omp/agent`: other sessions share it and a deploy of `main` resets it mid-run. Bundled `plan-reviewer.md` changes reach the probes through the worktree source (`bun packages/coding-agent/src/cli.ts`). Live sessions pick everything up only after `scripts/deploy-local.sh` from `main` after the merge.

## Critical files & anchors

- `$S/validate-gate-record.mjs`:
  - `parseTrailer` (~390): return `narrative` as well;
  - `validateTrailer` (~414-476): `blockers` check;
  - `validateRecord`: trailer loop (~758-790) and end of the function (~807): `downgrades`.
- `$S/validate-gate-record.test.mjs`:
  - `buildTrailer` (~139-169), `runWithTrailer` (~187);
  - the marker-quoting test (~822): must stay green unchanged.
- `packages/coding-agent/src/prompts/agents/plan-reviewer.md`: `<mechanical_checks>` preamble, CHECK 1, `<decision>`.
- `team-config/agent/rules/merge-gate-proof.md`: the "overridden" outcome.

## Verification

Evidence goes to `.omo/evidence/review-blocking-threshold/` in the worktree.

1. `red.txt` (step 1) shows the new blocked rows failing against the original validator. `green.txt` (step 3) shows `bun run test:team-config` all green.
2. `bun test packages/coding-agent/test/bundled-agent-parsing.test.ts`: green.
3. **Reviewer classification on the real surface.** Two fixtures, written once to `.omo/evidence/review-blocking-threshold/fixtures/`.
   - **below** (substantiated defect, below threshold): diff adding `scripts/dev-env.sh`:
     ```
     #!/usr/bin/env bash
     set -u
     current=$(cat .env 2>/dev/null)
     if ! grep -q '^POSTGRES_PASSWORD=' <<<"$current"; then
       [ -s .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo >> .env
       echo 'POSTGRES_PASSWORD=devpass' >> .env
     fi
     ```
     Defects reviewers may name: an unreadable existing `.env` or an `export POSTGRES_PASSWORD=` line gets a duplicate key appended. Local and reversible. (The first fixture version lacked the trailing-newline guard; plan-reviewer correctly blocked its concatenation on a common `.env` without final newline, so the fixture was fixed, not the threshold.)
   - **above** (above threshold): diff in `src/invoices.ts` changing `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2` to `SELECT * FROM invoices WHERE id = $1`, with the `tenantId` argument removed. Tenant isolation broken on normal use.
   - Plan text for plan-reviewer: each fixture as a one-step plan (`Add scripts/dev-env.sh as follows: <code>` / `Change the invoice lookup in src/invoices.ts as follows: <diff>`) plus `- Merge gate: not applicable (QA fixture)`.

   Per reviewer path and fixture (8 runs), dispatch with:
   ```
   bun packages/coding-agent/src/cli.ts -p --no-session "<dispatch prompt>"
   ```
   The dispatch prompt is `Dispatch exactly one task item with agent <agent>, solutionSpace '<solutionSpace>', task <brief>. Print the reviewer's reply verbatim and nothing else.` Store the output as `<path>-<fixture>.txt`.

| Path | agent | brief |
|---|---|---|
| implementation-audit | auditor | review-work implementation-audit brief from the worktree SKILL.md, filled with the fixture diff and a QA matrix with one PASS row |
| strategic-risk-review | oracle | review-work strategic-risk-review brief, auditor findings `none` |
| integration-review | auditor | integration-review brief; diff and file list as `/tmp/integration-review-<fixture>.patch` / `.files`, seam list `single slice` |
| plan-reviewer | plan-reviewer | `Review the plan at <plan path>` |

   Expected:
   - **below:** verdict PASS / OKAY / closing `PASS`, **and** the substantiated defect named as a note, Should-fix, or non-blocking risk. A run that does not mention the defect is no evidence: run it once more. If the second run is also silent, or a path blocks on the defect in two runs, record that path as INCONCLUSIVE in the QA matrix with the reviewer's stated trigger.
   - **above:** verdict FAIL / REJECT, with the tenant check as a blocker. For the three trailer paths, that is a `Blocker B1:` line plus trailer `blockers: B1`.
   - Validate both implementation-audit trailers in scratch records against `$S/validate-gate-record.mjs`: below without override → exit 0; above with an override and one downgrade → exit 0.
   - If below comes back as FAIL/REJECT on the defect, the threshold does not work for that path. Sharpen the wording of that path's prompt and repeat the run; never adjust the fixture.

## Assumptions & contingencies

- The bundled `plan-reviewer.md` is changed directly. It is the authoritative source of the CHECK contract.
- An override with downgrades permits merge, but only with the user's consent in the same session. The Gate proof shows it as `FAIL overridden`, never as PASS.
- A FAIL trailer without `blockers:` in an unshipped old record fails validation; re-review that record instead of editing it.

## TODOs

1. F3 B1 (duplicate-blocker-id): `reconcileBlockers` in `$S/validate-gate-record.mjs` rejects a narrative that carries the same `Blocker B<n>:` id on two lines (`block(\`${field}.blockers\`, \`narrative repeats Blocker ${id}\`)`) before building the set; RED test first: two narrative `Blocker B1:` lines with trailer `blockers: B1` and one downgrade must exit 1 naming `narrative repeats Blocker B1`.
2. F3 B2 (inconclusive-override): an override admits only `PASS` and `FAIL` verdicts. In `validateRecord`, `hasOverride` with a verdict outside `PASS`/`FAIL` blocks `verdicts.<i>.verdict` with `INCONCLUSIVE cannot be overridden; re-run the invocation`; SKILL.md Phase 5 sentence "may accompany `FAIL` or `INCONCLUSIVE` verdicts" becomes "may accompany `FAIL` verdicts only; an `INCONCLUSIVE` invocation is re-run, never overridden". RED tests first: override with an INCONCLUSIVE-only verdict, and override with FAIL plus INCONCLUSIVE (two invocations), each exit 1 naming `INCONCLUSIVE cannot be overridden`.
3. F1 row 15 (unsupported-variant gap, decided by Tim: not blocking, must still be reported): in the shared blocking threshold, after the sentence ending "racing manual runs) is not one.", insert "A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker." at all four sites (review-work SKILL.md both briefs, integration-review SKILL.md, plan-reviewer.md `<decision>`), and the matching clause in auditor.md line 17. Re-run all 8 probes; expected below: PASS/OKAY with the `export` gap named as a note.
4. F2 B1 (gate-outcome-contract): `team-config/agent/rules/merge-gate-proof.md` line 31: replace "If any line is not passed, say so at the top of the reply and do not ask for merge approval;" with "If any line is neither passed, overridden, nor legitimately skipped, say so at the top of the reply and do not ask for merge approval;". No test: prose rule, verified by the F2 re-review.
5. F2 B2 (criterion wording, decided by Tim 2026-10-22): the third feature-specific criterion's negative control reads "each of the four paths returns PASS or OKAY and names at least one substantiated local, reversible dev-env defect as a note or Should-fix (examples: an unhandled `export` assignment, a wrong working directory, a read failure collapsing into key absence); the paths need not name the same defect; plan-reviewer OKAY with a note on the existing-`.env` case counts (decided by Tim, 2026-10-22)". Plan re-hashed; F2 wave 2 runs both reviewers.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over 4ffd036450...e95a628838, four waves; wave 1 FAIL (two classes, fixed in ccc437d187..ee9042b824 with OKAY delta), waves 2-4 PASS; reports under `.omo/evidence/review-blocking-threshold/f3/`
- [x] F1. Manual QA on the real surface: `.omo/evidence/review-blocking-threshold/qa-matrix.md`, 15 rows PASS (rows 3-7 on e95a628838, probes on f3ba443fa0)
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: a threshold worded too loosely could let a reviewer call a real security finding a note; a reconciliation gap would let an override hide an unfixed blocker. Team-wide config and the bundled plan reviewer are affected; reversible by reverting and reinstalling.
- Mandatory class: schema-migration
- Whole-diff review: needed (validator, team-config skills, agents and rules, bundled plan-reviewer prompt)
- Accepted residual risks: reviewer judgement against the prose threshold is non-deterministic; Verification 3 samples each path once per fixture and cannot prove it for every finding
- Out of scope for blocking: Risk tier, fix-round caps and mandatory-class narrowing (plan B review-risk-tier); gate records already on main
- Feature-specific criteria:
  - Invariant: an override over a FAIL verdict validates only when every blocker id of each FAIL trailer has exactly one downgrades entry
    Positive witness: trailer blockers B1, B2 with narrative lines for both and entries for B1 and B2 exits 0
    Negative control: the same trailer with an entry only for B1 exits 1 naming blocker B2
    Observable: validator exit code and stderr
    Boundary: validateRecord in team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
  - Invariant: a FAIL trailer's blockers field equals the set of Blocker B<n> lines in the stored reply
    Positive witness: narrative Blocker B1 and Blocker B2 with trailer blockers B1, B2 validates
    Negative control: narrative Blocker B1 and B2 with trailer blockers B1 exits 1 naming B2
    Observable: validator exit code and stderr
    Boundary: validateTrailer in team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
  - Invariant: every gate reviewer path blocks an above-threshold defect and only notes a substantiated below-threshold one
    Positive witness: the tenant-check removal returns FAIL or REJECT with it as a blocker on all four paths
    Negative control: each of the four paths returns PASS or OKAY and names at least one substantiated local, reversible dev-env defect as a note or Should-fix (examples: an unhandled `export` assignment, a wrong working directory, a read failure collapsing into key absence); the paths need not name the same defect; plan-reviewer OKAY with a note on the existing-`.env` case counts (decided by Tim, 2026-10-22)
    Observable: reviewer verdict and classification in the stored transcripts
    Boundary: installed auditor, oracle and integration-review briefs, and plan-reviewer from the worktree source
