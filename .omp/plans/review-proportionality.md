# Proportional verification and an approach decision in plan review

Status: planning draft, revised three times. Round 1 (`plan-reviewer` REJECT, three blockers; `oracle` assessment) was addressed in full except the oracle's in-gate effectiveness pilot, which became a post-merge observation. Plan-mode review round 1/2 rejected with three blockers; the user decided on 2026-10-30: class `concurrency-state`, and minimal fixes for the F1 credential scan and fixture byte binding. Round 2/2 rejected with two blockers, both confirmed and fixed: the credential inventory now covers every source an ordinary session can resolve (`.env` files, SSO cache) with per-source sentinels, and F1-D runs Continue, Re-plan and Stop each in its own copy through to the fresh dispatch or its absence. Nothing implemented or deployed. The user chose a lean session plan after stopping `plan-adopt-and-cap` at round 11. Worktree prepared: `.worktrees/review-proportionality`, branch `feat/review-proportionality`, base `b25d0cd677`. After approval, the execution copy goes to `.omp/plans/review-proportionality.md` in that worktree.

## Goal and scope

Cover the five agreed points: (1) proportional verification, (2) class from the delivered change, (3) an approach question with diagnosis and recommendation, (4) splitting the class-setting part instead of waiving its class, (5) bounded review scope for QA tooling. Objective: fewer plan-review and fix rounds and less end-to-end time without worse defect detection. This change can show its mechanisms work; it cannot show the objective is met. That is observed after merge (Effectiveness).

Two mechanisms ship together: the verification boundary (points 1, 2, 5) and the approach decision (points 3, 4). No new checker, proxy, sandbox, credential holder, validator change, record schema or reviewer lane. `plan-adopt-and-cap` stays untouched; this plan replaces its unmerged D1 approach question, and its build-vs-adopt work and lesson globs are re-planned on top of this. Brief enforcement is a separate change, without a user-focus field.

## Current evidence

- Review instruction: `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:319-435`. Three fixed lenses; an early ask for eligible blockers; otherwise two fix rounds, then a per-blocker ask after the third REJECT (`:399-417`). No approach question.
- Tasks contract: `schema.yaml:258` requires every task to end in one deterministic `Verify:` command that directly proves its result; `templates/tasks.md:17` asks F1 for a "command that checks every scenario's recorded result"; the verification lens asks whether each Verify command fails when its task is broken (`schema.yaml:368-371`). For model-read instructions this is what produced output-scoring checkers. `validate-openspec-change.mjs:118-136` checks only Verify syntax.
- `plan-reviewer.md:77` triggers CHECK 1 on any real credential and requires a full holder/sink inventory plus sentinel control. A plan that only runs ordinary sessions currently trips it, which a scope paragraph elsewhere cannot override.
- Classes: `review-work/SKILL.md:93-102`; `Blocker disposition` (`:404-430`) excludes every blocker of a non-`none` change from Accept. Exclusions are applied by the orchestrator, not checked by the validator (`validate-openspec-change.mjs:404-430`). Unchanged here.
- Stopped change: `review.md` at `88a0cf257d` holds five blockers (stale gate class on Re-plan, three verification gaps, classification of the new persisted Window state); rounds 3-10 repeatedly concern checkers, sandbox/proxy credentials and run identity. A diagnosis, not a claim that those findings were false.
- `plan-review-eval-domain.md:9` includes any agent run through a runner or manager process.
- Config: this repository's `openspec/config.yaml` and the deployed seed `team-config/agent/skills/review-work/openspec/config.yaml` both carry the class rules. The installer copies the seed only when a project has no config (`install-openspec-workflow.mjs:129,144-145`) and refuses this repository's symlinked schema (`team-config/README.md:115-117,136-139`).
- Class precedent: `review-stop-rule` (instructions deciding when review stops, no validator change) was class `none`; `plan-review-lenses` was `concurrency-state` because it changed validator predicates.
- Parallel `review-transition-invariants` edits Phase 2 briefs and integration-review, not the paragraphs here; preserve it on integration.

## Design

### 1. Verification proportional to the changed surface

Add `## Change verification` to `team-config/agent/skills/review-work/SKILL.md`, before Phase 0.5. It is the one definition; schema, rules and agent prompt reference it. Required text:

> Change verification is work done only to establish this change's evidence: its manual QA sessions, disposable fixtures and one-off evidence helpers. Code, instructions or tooling that will serve users, CI, installation, a benchmark or later reviews after delivery are part of the delivered change, even when named tests, docs or QA. Classify by use, not by location or filename.
>
> For model-read instruction text, prove the delivered text deterministically, and exercise the changed workflow in fresh ordinary agent sessions on disposable fixtures. Retain the relevant outputs, written artifacts and successful tool interactions, and judge the observed behaviour directly. Do not require a deterministic checker that infers or re-scores model behaviour, or a new proxy, sandbox or credential for this evidence. Exercise each changed mechanism and its riskiest branch, plus adjacent behaviour. Name unexercised branches and uncertainty; never report them as passed. A missing proof of material behaviour still blocks under the existing threshold.

Tasks contract (`schema.yaml:258`, `templates/tasks.md`): a `Verify:` command stays deterministic, but proves what can be proven deterministically: the delivered text, artifact presence and evidence integrity. A task whose result is model behaviour names its real-session scenario and evidence path; the QA lane judges it. Replace the template's F1 placeholder with "the scenarios, their evidence paths and the observation each must show". Verification lens paragraph (`schema.yaml:367-373`): for model behaviour, judge whether the planned real run can expose the failure, not whether a command re-scores it. Add a model-read-text line to Phase 1's channel list. QA matrix, artifact rule, failure stop and evidence binding stay. No new wording tests; an incidental-wording test that breaks is deleted, not re-pinned.

### 2. Mandatory class from delivered behaviour

Append to `Change verification`:

> Derive Mandatory class from the behaviour and reach of the delivered change, not from the tools used to verify it. An ordinary session using its existing provider authentication does not make an instruction-only change auth-secrets-pii. Verification that discloses a credential, weakens access or damages protected data is still a security defect: stop and replace the unsafe verification. This never exempts delivered auth, migration, wire/API or concurrency/state behaviour from its class, including changes to an existing state machine.

Reference it from Phase 0.5, `team-config/agent/rules/plan-merge-gate.md` and the schema's gate instruction; add "of the delivered change" to the gate rule in both config files. Class values, tiers and reviewer counts unchanged.

This change: tier `product` (it changes review of product work). Class `concurrency-state`, decided by the user on 2026-10-30: section 3 changes the transitions of the existing review flow after a REJECT (a new approach decision, changed resume behaviour), and this section's own rule keeps the class of a changed state machine. Consequence: F2 runs `implementation-audit` and `strategic-risk-review`, and no blocker of this change's own gate is Accept-eligible.

### 3. Approach question: diagnosis before another fix round

Edit schema steps 4-6; keep the dispatch context, base brief, correctness paragraph, incomplete-round retry and the Blocker disposition reference.

- **Trigger:** a complete REJECT at round 3 or later; earlier only when the correctness lens returned OKAY and every open blocker concerns this change's verification method. Below the trigger, the existing early-ask and automatic-fix paths are unchanged.
- **Record first:** before any ask or automatic fix, write that round's REJECT, digest, lens ids and blockers verbatim to `review.md`. Round numbering as today (first dispatch 1, incremented per dispatch, including after a resume). No Window field, answer ledger or counter reset. Incomplete rounds still write nothing and stop.
- **The question:** one ask, before any per-blocker ask. It shows the round; per lens the verdict and blocker count; per blocker its area and whether it concerns the delivered change or this change's verification (by consequence, not by lens; shown so the user can dispute it; never changes severity or eligibility); the Mandatory class, the delivered part that sets it and its effect on Accept. Then a causal diagnosis, what keeps generating blockers, and a recommendation: the option that removes that cause while best keeping the goal, with the reason. No blocker-count vote; no pre-written fixes as options.
- **Continue:** fix every non-eligible blocker and dispatch a fresh round; ask per blocker only for eligible ones (Accept recommended, as today) and for a fix that needs a user decision (fix alternatives and Stop, never Accept). Stop at any of those asks ends the flow without fixes. (Amended 2026-10-31 by user decision after F1-D copy 1: a fix that narrows scope or picks between approaches the artifacts leave open needs the user's choice.)
- **Re-plan:** no per-blocker ask; nothing from this round enters gate.md as Accept, Override or residual risk. Revise design, verification and every affected artifact, including gate classification when the new approach changes it; create design.md when absent. Validate, then a fresh three-lens round.
- **Split:** section 4; offered only when valid, recommended only by the diagnosis.
- **Stop:** no fix, no dispatch; apply stays blocked.

Every later complete REJECT at round 3 or later asks again; Re-plan buys no new fix window. A session resumed with the approach question unanswered asks it again before any edit or dispatch; the recorded REJECT keeps apply blocked.

### 4. Split the class-setting part, never waive its class

Offer Split only when the class is not `none` and a named class-setting part can ship separately from a useful remainder. Name both scopes, why they are independent, and any part of the original goal the remainder no longer meets; choosing Split is the user's explicit approval of that scope change. Without a useful independent remainder, no Split option.

Split ends the fix loop: revise the plan to the retained scope, name the removed part as a separate plan or change to be proposed before it is implemented, reclassify the retained behaviour, and review fresh before apply. Never implement the removed part, accept its blockers, or lower the class while its trigger remains.

### 5. Lens scope: verification sufficiency, not a QA product

- `plan-reviewer.md:77`, CHECK 1 trigger: after "a local development default or test fixture value is not one", add "; neither is the provider authentication an agent session already holds, when the plan only runs ordinary sessions and never copies, routes, logs, stores or reconfigures it". A plan that does any of those, or delivers code handling a credential, still triggers the full check.
- `team-config/agent/rules/plan-review-process.md`: an unnumbered scope paragraph referencing `skill://review-work` `Change verification`, for session plans and fix deltas too. Unreadable section: say so, infer no exemption. Verification judges whether the real run can expose the claimed failure and whether retained outputs establish the material behaviour. Triggered checks of delivered behaviour keep their full inventories; ordinary change verification is judged for sufficiency and concrete protected-asset risk, not given run-identity or dependency-lifetime inventories because a session uses its normal model connection.
- Matching one-sentence clauses in the schema's fixed verification and checks paragraphs; fixed text, never orchestrator-added focus.
- `plan-review-eval-domain.md:9`: an ordinary local interactive QA session, including one driven through the terminal device, is not a run through a runner. Metaharness changes, containers, remote hosts and runner-managed experiments keep the checks.
- Disclosure, unsafe QA access, fabricated or malformed evidence and missing material proof stay blocking; gate-record, trailer and QA-artifact binding are unchanged.

## Implementation tasks

All paths in the worktree; absolute paths when a tool runs elsewhere. Unstarted; planning authorizes no edits.

1. [ ] Point 1: `Change verification` section, Phase 1 line, tasks instruction and template, verification lens clause. Verify: diff review of the text; F1-A, F1-B.
2. [ ] Point 2: class paragraph and its references in Phase 0.5, `plan-merge-gate.md`, schema gate instruction, both config files. Verify: F1-A, F1-C.
3. [ ] Point 3: approach question in schema steps 4-6. Verify: F1-D.
4. [ ] Point 4: Split. Verify: F1-E.
5. [ ] Point 5: CHECK 1 trigger in `packages/coding-agent/src/prompts/agents/plan-reviewer.md`, `plan-review-process.md` paragraph, checks lens clause, eval-domain trigger. Verify: `bun test packages/coding-agent/test/bundled-agent-parsing.test.ts`; F1-B, F1-C.
6. [ ] Specs: in `openspec/specs/openspec-plan-review/spec.md` reconcile the early-ask and third-REJECT scenarios with the approach question, and add approach-decision and lens-scope requirements; add `openspec/specs/change-verification/spec.md` for the shared boundary and class rule. One Negative control per requirement; early eligible asks, incomplete stops and post-implementation vocabulary preserved. Verify: strict spec validation below.
7. [ ] Docs: `team-config/README.md` review section (approach question, verification method, consumer config hand-merge); `packages/coding-agent/CHANGELOG.md` Unreleased/Changed: plan-reviewer no longer asks for a credential inventory when a plan only runs ordinary sessions. Commit the coherent unit before final verification.

## Real-surface verification

Evidence root: `.omp/team-config/evidence/gate/review-proportionality/f1/`. Installed omp, fresh ordinary sessions, existing model configuration; no copied auth, isolated agent dir, new key or proxy.

**Delivered bytes.** Each fixture is a disposable git repository outside this one. Two kinds of files, kept apart: *delivered files* (`.omp/skills/review-work/**`, `.omp/rules/<the three edited rules>`, `.omp/agents/plan-reviewer.md`, `openspec/schemas/omp-gated/**`, and `openspec/config.yaml` from the deployed seed) come only from the commit under test, via `git -C <worktree> archive <sha> <source paths> | tar -x` into a scratch dir and a move to those native locations; *scenario inputs* (proposal, specs, design, tasks, review.md, repository code, and F1-B's planted defect) are written by hand and never count as delivered. Each row writes `delivered.sha256`: one line per delivered fixture file with its SHA-256 and its source path at `<sha>`. Immediately before the session starts and again after it ends, the SHA-256 of each delivered fixture file must equal `git -C <worktree> show <sha>:<source path> | shasum -a 256`; any mismatch or missing file voids the row. Control, once: change one byte in a delivered fixture copy; the before-session comparison must report that file and the row must not start. Before F2, `git diff --quiet <sha> HEAD -- <source paths>` must succeed for every row's `<sha>`, else the row is stale and re-run. Project precedence already established: project rules and skills win over same-name user ones; project `.omp/agents` beats bundled agents (`task/discovery.ts:77-81`; `omp agents unpack --project` is the supported override path). Per fixture, `openspec schema which omp-gated` must name the fixture copy.

**Credentials in retained evidence.** Holders of the real provider credentials an ordinary session can resolve: `~/.omp/agent/models.yml` (provider `apiKey` values); `~/.omp/agent/agent.db` table `auth_credentials` (column `data`, which also receives refreshed tokens); the omp process environment (variables whose names contain `KEY`, `TOKEN` or `SECRET`); `<fixture>/.env` and `~/.env` (`packages/ai/src/env-api-key.ts:49`; on this machine `~/.env` is absent and fixtures carry none); `~/.aws/sso/cache` (`packages/ai/src/providers/aws-credentials.ts:449-465`; no AWS provider is configured and the cache is empty). The scan loads every source that exists, at the start of F1 and again at scan time (refreshed tokens included), and fails closed, staging nothing, when a source that exists cannot be read or parsed. Sinks: the model requests to the provider (the session's existing transport, unchanged); the session files under `--session-dir`, outside the repository and never retained; the terminal screen captured by the TUI device; and the files retained under the evidence root, the only sink that enters the repository. Chokepoint: the evidence root before staging; nothing outside it is staged by F1. The scan reads the values into memory, never prints them, reports per source only how many values it loaded and per retained file only a hit count; staging requires zero hits in every file. Sentinel controls, once each: (a) inputs: a scratch copy of each source format (models.yml, an `auth_credentials` row in a scratch SQLite file, an environment variable, a `.env` file, an SSO cache file), each holding one fresh random sentinel, given to the loader in place of the real paths: every source must yield its sentinel; (b) sinks: each sentinel planted in a scratch copy of one retained file of each kind (lens output, call log, artifact, screen capture) must give exactly one hit per planted copy. The real configuration is never modified. Retain only inputs, relevant outputs, call arguments and results, answers and resulting artifacts; read every retained file for unrelated private context before committing. A credential hit fails the row and the file is never staged.

| Row | Real workflow and expected observation | Must fail when |
|---|---|---|
| F1-A planning and class | Fresh session plans adding `Group release notes by package before listing changes.` to a fixture release-notes skill, through the gate and tasks instructions. gate.md says class `none`; tasks prove the text deterministically and name a real-session scenario for the behaviour; no scoring checker, no new credential. | The session's own authentication sets `auth-secrets-pii`, or tasks demand a behaviour-scoring checker. |
| F1-B lens scope and material gap | Fixed verification and checks briefs over F1-A's fixture: neither blocks for a missing deterministic checker or a credential/run inventory of the ordinary session. Second copy, one defect added: the behaviour scenario only checks that the sentence exists in the file, so it passes before the behaviour does. The verification lens must block on it. | An inventory- or checker-only blocker appears, or the planted material gap is not a blocker. |
| F1-C security stays blocking | Fixture 1: delivered code writes a real refresh token to an unprotected file, no storage or error-sink design. Class `auth-secrets-pii` and an evidenced CHECK 1 finding. Fixture 2: an instruction-only plan whose QA step copies the provider key from the agent config into a committed evidence file. Checks lens blocks under CHECK 1. Both reviewed as plans; no real secret is used or executed. | Either fixture gets class `none` without a security finding, or the copied key passes as ordinary verification. |
| F1-D approach question | OIDC fixture inputs from `plan-adopt-and-cap` at `88a0cf257d` without Window; seed `review.md` Round 2 REJECT; validate the fixture. The fixture's class `auth-secrets-pii` makes every blocker non-eligible. Three fresh copies, each with a real three-lens round; at its REJECT, in each copy: the round's review.md is written successfully before the first ask, and the ask's counts, assignments, class effect, diagnosis and recommendation match the actual lens outputs. Copy 1 (Continue): kill the session at the open question and resume; it asks again before any edit or dispatch. Answer Continue: the artifacts are changed for the blockers, `V` passes, a new digest is taken, and three fresh lens tasks are dispatched; stop the session once they are dispatched. Copy 2 (Re-plan): revised artifacts (class included), no gate.md Accept, then the validated fresh dispatch; stop there. Copy 3 (Stop): no artifact edit and no dispatch after the answer; review.md stays as written. | Ask before the successful write; counts or diagnosis contradict the outputs; resume edits or dispatches first; Continue offers Accept for a non-eligible blocker, asks per non-eligible blocker other than for a fix that needs a user decision, or skips the fresh dispatch; Re-plan records an Accept or leaves a changed class stale; Stop edits or dispatches. |
| F1-E Split and pre-cap regression | F1-D's fixture plus an independent rename `httpClient()` to `apiClient()` (no callers). At the approach question, Split may separate auth from the rename, never lower auth's class in place; choose Split, inspect both scopes and the retained class. Fresh copy without review.md: a round-1 REJECT with no eligible blocker takes the ordinary fix path, no approach question. | Split offered without a useful remainder; auth kept with a lower class; approach question at an ordinary round-1 REJECT. |

Reviewer verdicts are observations: never fabricate one to reach a branch. An unexpected OKAY leaves that branch unexercised, reported as such, never PASS. Recommendations are judged against the actual blockers, not a wording match. A tie between causes, incomplete-round retry and an unsplittable classified plan get instruction review only; F1 claims no runtime coverage of them. Extraction scripts may collect calls but never assign PASS from tool names or from absent or malformed blockers.

After the last edit, from the worktree:

- `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec schema validate omp-gated`
- `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 openspec validate --specs --strict --no-interactive`
- `bun test packages/coding-agent/test/bundled-agent-parsing.test.ts`
- `bun run test:team-config`, once per fix round after its last edit
- `node team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --repo . --plan-only --plan .omp/plans/review-proportionality.md`

## Rollout

After the gate passes and the merge: `scripts/deploy-local.sh` (builds the binary with the new bundled plan-reviewer prompt and syncs team-config). This repository needs no installer: its schema is a symlink to the canonical one. Consumer repositories (onara, weaver): run `install-openspec-workflow.mjs` for the schema; their existing `openspec/config.yaml` is never rewritten, so merge the changed gate rule by hand (README documents it). Restart affected sessions. Rollback: revert, redeploy; review and gate record formats are unchanged.

## Effectiveness (after merge, not a gate)

Record on the next real changes planned under the new workflow, against the stopped `plan-adopt-and-cap` (11 rounds) and earlier archived reviews: review dispatches, fix rounds, end-to-end time including re-plans and user waits, and whether material security, evidence, classification and correctness defects were still found. Count completion against the originally authorized goal; a smaller split remainder is not a faster completion. No benchmark runner; no claim before that data exists.

## TODOs

Seven implementation entries above. Append actual F1/F2/F3 fixes here with defect class and site before implementing them.

8. [x] F3 fix, class `contradictory-classification-scenario`, site `openspec/specs/change-verification/spec.md:59-67`: limit the "Instruction-only change" scenario (class `none`) to an instruction change that alters no delivered auth, migration, wire/API or state-machine behaviour, so it no longer contradicts the "Changed review state machine" scenario. Verify: strict spec validation.
9. [x] F3 fix, class `unreconciled-early-ask-contract`, sites `openspec/specs/openspec-plan-review/spec.md:68-71,99-101` and `team-config/README.md:194-197`: restrict the round-2 eligible-blocker ask scenario and the early-ask Negative control to rounds below the approach-question trigger, and state in the README that the early approach-question trigger (correctness OKAY, only verification blockers) comes before any per-blocker ask. Verify: strict spec validation.

## Final verification wave

- [ ] F3. Whole-diff review: `integration-review` over `b25d0cd677...HEAD`, report `.omp/team-config/evidence/gate/review-proportionality/f3-integration-review-report.md`; integrate the default branch first as Fix waves step 1 requires.
- [ ] F1. Manual QA on the real surface: F1-A through F1-E, one evidence path each under `.omp/team-config/evidence/gate/review-proportionality/f1/`, on the head after F3's last code commit.
- [ ] F2. Merge gate: `review-work`, SHA-bound `team-config.merge-gate/v3` record validated.

## Merge gate

- Author's risk assessment: too narrow a verification scope, or the CHECK 1 carve-out, could let a real credential disclosure or a missing material proof through review; too broad recreates the QA-subsystem spiral. The approach question steers scope but never authorizes apply. Product tier because review of product work changes. Class `concurrency-state` (user decision, 2026-10-30): the change alters transitions of the existing review flow, so both F2 reviewers run and no blocker of this gate is Accept-eligible.
- Mandatory class: concurrency-state
- Risk tier: product
- Whole-diff review: needed (schema orchestration, review-work policy, scoped reviewer rules and the bundled plan-reviewer prompt are separate consuming surfaces)
- Accepted residual risks: instruction following and the delivered-change/verification assignment are model judgement; F1 shows each mechanism on fixtures, not a compliance rate. A cause tie, incomplete-round retry and an unsplittable classified plan get instruction review only. Re-plan at round 3 or later asks again at the next REJECT instead of opening a new fix window. No reduction in rounds, time or missed defects is claimed before the post-merge observation.
- Out of scope for blocking: verbatim-dispatch enforcement; build-vs-adopt and lesson globs from the stopped branch; plan mode's own review loop; F2/F3 convergence algorithms; model and effort choices; the post-merge effectiveness observation. Evidence binding and the Blocker disposition exclusions stay in force and are not waived by this scope.
- Feature-specific criteria:
  - Invariant: the shared policy, tasks contract and plan-reviewer scope separate delivered behaviour from ordinary change verification; an instruction-only change is verified by real sessions without a scoring checker or an auth class from its normal model connection, while planted material gaps and credential disclosure still block.
    Positive witness: F1-A gate.md class `none` with deterministic text checks plus a named real-session scenario; F1-B's clean copy gets no checker- or inventory-only blocker.
    Negative control: F1-B's planted sentence-presence-only scenario, F1-C's delivered token storage and F1-C's key-copying QA step each MUST produce a blocker (and F1-C fixture 1 class `auth-secrets-pii`).
    Observable: retained gate.md, tasks.md and the full lens verdicts with their evidence.
    Boundary: review-work/SKILL.md Change verification, Phase 0.5 and Phase 1; schema gate, tasks, verification and checks text; templates/tasks.md; plan-reviewer.md CHECK 1; plan-review-process.md; plan-review-eval-domain.md.
  - Invariant: at the trigger, a complete REJECT is written to review.md before the first ask, the approach question matches the actual lens outputs, a resumed session asks again before acting, and below the trigger the existing paths are unchanged.
    Positive witness: in all three F1-D copies the successful write precedes the ask and the ask's counts, assignments and diagnosis match the outputs; in copy 1 the resumed session asks again first, and Continue leads to fixes, a passing `V`, a new digest and three fresh lens dispatches, with per-blocker asks only for fixes that need a user decision and never an Accept.
    Negative control: an ask before the write, counts contradicting the outputs, an edit or dispatch before the resumed question, or an approach question at F1-E's ordinary round-1 REJECT MUST fail the row.
    Observable: review.md content and write results, lens outputs, ordered ask arguments and answers.
    Boundary: omp-gated/schema.yaml review steps 4-6; existing review.md Round and Verdict fields.
  - Invariant: Re-plan, Split and Stop never accept a blocker or authorize apply; the retained behaviour sets the class, and every affected artifact is revised before a fresh review.
    Positive witness: F1-D copy 2 (Re-plan) revises artifacts, class included, without an Accept, then a validated fresh round; F1-D copy 3 (Stop) makes no edit or dispatch; F1-E Split names both independent scopes and keeps auth's class on the auth scope.
    Negative control: a stale class after Re-plan, an edit or dispatch after Stop, or auth retained with a lowered class after Split MUST fail the row.
    Observable: answers, ordered calls, before and after artifacts, the next dispatch or its absence.
    Boundary: schema approach options; unchanged review-work/SKILL.md Blocker disposition and the apply-time `--reviewed` check.
