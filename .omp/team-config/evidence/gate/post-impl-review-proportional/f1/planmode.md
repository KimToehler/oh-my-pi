# F1-C: plan mode, Risk tier and model pin (task 4.4)

Date: 2026-11-02. Delivered text: this branch at `28434378ce`, deployed into the disposable profiles `pirp` and `pirp-med`. Six sessions, run by two QA sub-lanes in parallel: (a), (b) and (f) on fixture `release-approvals`, then (c), (d) and (e) on fixture `gate-quorum`. Every must-show item of the six sessions is PASS; see the table in each section.

## Common setup for (a), (b), (f) (F1-C1)

Retained artifacts: `.omp/team-config/evidence/gate/post-impl-review-proportional/f1/planmode/abf/{a,b,f,payloads,discarded}/` (below, `abf/`).

- **Deviation recorded from the task text**: sessions run under disposable profiles (`omp --profile pirp`, and `--profile pirp-med` for the (f) pair recording), not `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`, because that variable does not redirect subagent discovery (shared context, `config.ts:86`). `~/.omp/agent` was never written. `pirp` has no `auditor` override; `pirp-med` has `task.agentModelOverrides.auditor: onara/cx/gpt-6.1-sol:medium`. Both sessions read `omp config get task.agentModelOverrides` and `auditor.md` themselves (pin `onara/cx/gpt-6.1-sol:high`).
- **Fixture** (one build, committed once, copied per session: `a2`, `b`, `f`; fixture `f1c-f-pair` is a further copy used only to record the (f) pair): TypeScript/Bun repo with `scripts/gate.ts` (release admission: `decide(candidate)`), `scripts/gate.test.ts`, `README.md`, `package.json`.
  - `main`: baseline gate (one approval of any kind admits) + plan `.omp/plans/release-approvals.md` + installed `omp-gated` schema (`install-openspec-workflow.mjs`, `HEAD:openspec/schemas/omp-gated/schema.yaml` = `954aae1d8a239af994c88db3ef575591de70c95e`). Branch `feat/release-approvals`: one commit `6bd7b6c feat(gate): admit a release only with two independent approvals` (admit only with >= 2 distinct non-author approvals and all checks passed; tests; README; plan TODO rows ticked). No planted defect.
  - Plan: `- Mandatory class: none`, `- Risk tier: product`, `Whole-diff review: not needed (whole-diff surface reviewed in F2)`, two five-field criteria, both abort-rule fields, F1/F2 rows.
  - Checks before any session: `validate-gate-record.mjs --plan-only --plan .omp/plans/release-approvals.md` -> `passed`; `bun test` -> 5 pass 0 fail; CLI scenarios `ok/dup/self/failchk/none` gave ADMIT/exit 0, REJECT got 1 / got 1 / failed checks: tests / got 0, exit 1 (`abf/f/pair-recording/qa-inputs/`). The opus payload trailers and the gpt pair trailer each passed `validate-gate-record.mjs --repo <fixture> --trailer <file> --invocation implementation-audit --verdict PASS --plan .omp/plans/release-approvals.md` (`passed`).
- Prompt base (neutral, no expected outcome) + implementation model `onara/cc/claude-opus-5-5`; per-session prompts in `abf/payloads/{a,b,f}-prompt.md`.
- **Synthetic payload files** (labelled synthetic): `abf/payloads/opus-session.jsonl`, `opus-session-retry.jsonl` (built by `abf/payloads/mk-synth.mjs`: `model_change` `onara/cc/claude-opus-5`, `thinking_level_change` `high`, one assistant message `provider: onara`, `model: cc/claude-opus-5`); `opus-pass-reply.md`, `opus-pass-reply-retry.md` are synthetic PASS replies with a valid trailer reporting `model_id: onara/cc/claude-opus-5`. The (f) pair is NOT synthetic: it is a real `auditor` dispatch (below).
- **Whitespace note on every dispatched brief**: the dispatched `task` text is the verbatim brief plus the harness prefix `Complete assignment thoroughly:`; the router normalises markdown table pipe spacing (`| a | b |` -> `|a|b|`) and trailing-space blank lines in the child's `session_init.task`. Compared line by line (`abf/*/briefs/*-as-dispatched.txt` vs the briefs in `abf/payloads/`) the only differences are that whitespace; no word, section or row differs. A paste of the brief by the model itself was not byte-exact either (see the discarded pair attempt).
- Ledger-independent notes: each session performed the Phase 0.6 plan-only check, marked F1/F2 `[x]` in the plan and committed it before `GC baseline` (SKILL: plan must be final before hashing), and ran its own manual QA (9-13 rows, artifacts under `abf/*/gate-qa/f1/wave-1/`).

---

## (a) Plan-mode fixture, risky derived, first implementation-audit reply from an opus payload, one real retry on the pin

- **Fixture**: `$TMPDIR/pirp-fix/f1c-a2` (copy of the pristine fixture). Plan `.omp/plans/release-approvals.md`, class `none`, tier `product`.
- **Prompt** `abf/payloads/a-prompt.md`: the base prompt plus: the first dispatch of implementation-audit in wave 1 is not made, write the brief to `.../a-brief-implementation-audit.md`, use `opus-pass-reply.md` as the delivered reply and `opus-session.jsonl` as its session file; every other dispatch, including any later one of implementation-audit, runs for real; may stop after wave 1 unless the gate passes.
- **Session**: `/Users/tim/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1c-a2/2026-11-02T20-23-10-166Z_01a19dee-1c56-72a1-a42b-db08e9a3f794.jsonl`; wall 419 s. Children: `ImplementationAuditW1Retry`, `StrategicRiskReviewW1` (`abf/a/children.txt`). It passed naturally, so it went through the record.
- **Ordered tool calls** (`abf/a/tool-calls.txt`, numbers are lines there): 1-4 read `skill://review-work` and its long lines; 9-16 git state, plan, diff, `auditor.md` pin, `omp config get task.agentModelOverrides`; 18 `validate-gate-record.mjs --plan-only` -> `passed`; 25-26 edit plan (F1/F2 `[x]`), commit `31375ec`, `GC baseline --sha HEAD` (`BASELINE 31375ec1bc7f`), `GC ready` (`READY`), `GC snapshot --lane F2`; 27-30 QA rows (10 rows, all PASS); 32-35 build briefs; 36-38 `task` dispatch of `strategic-risk-review` (`agent: auditor`, first call hit a harness error, re-issued at 38); 39-41 read the fixed reply/session, model check on the synthetic session, keep reply at `.omp/team-config/evidence/release-approvals/wave-1/implementation-audit-reply.md`; 42 `task` dispatch of the retry `ImplementationAuditW1Retry` (asserts its brief equals the first brief); 43-51 wait, store each reply as the trailer artifact, `history://` + `jq` model/effort checks, `validate-gate-record.mjs --trailer` for both; 52 `GC wave`; 53-55 record, stage, validate, commit.
- **Observed**:
  - `abf/a/record.json`: `reviewers_run: [implementation-audit, strategic-risk-review]`, `mandatory_class: none`, `decision_reason: "risky depth: the change alters a release mechanism (scripts/gate.ts decides what ships); Risk tier product; mandatory class none re-checked on the final diff (no credential, auth path, PII, schema, wire shape or shared state; both trailers security_delta: no)"`; resolution both `onara/cx/gpt-6.1-sol`, `cross-provider`.
  - First reply: the session found the synthetic session's `model_change`/assistant turn on `onara/cc/claude-opus-5` and the trailer `model_id: onara/cc/claude-opus-5` vs pin `onara/cx/gpt-6.1-sol:high`; it declared the dispatch not counted, kept the reply as ignored evidence (`abf/a/replies/implementation-audit-reply.md`, equal to `opus-pass-reply.md`), never submitted it.
  - Retry child `ImplementationAuditW1Retry`: `model_change onara/cx/gpt-6.1-sol`, `thinking_level_change high`, 27 assistant turns all `onara cx/gpt-6.1-sol` (`abf/a/children.txt`); trailer `model_id: onara/cx/gpt-6.1-sol`, PASS; one retry only (one implementation-audit child file exists).
  - `strategic-risk-review`: child `StrategicRiskReviewW1`, `gpt-6.1-sol`, `high`, 20 turns, trailer PASS.
  - `GC wave` (`abf/a/gc-and-validator-calls.txt`): `--outcome qa=PASS --outcome implementation-audit=PASS --outcome strategic-risk-review=PASS --trailer implementation-audit=.../trailer-implementation-audit.txt --trailer strategic-risk-review=...` -> `DECISION: PASS`, `WAVE F2 1 total=0 fix_induced=0 unlocated=0`. `abf/a/trailers/trailer-implementation-audit.txt` is the retry's final reply (not equal to the opus reply; diff against the child's final text: trailing newline only).
  - Record validated: `validate-gate-record.mjs --record ... --plan ...` -> `passed` before and after commit `51e1358`. Fixture `git log`/status: `abf/a/fixture-state.txt` (note: the session ran in the checkout; it reported not creating a separate locked review worktree, a deviation from Phase 0 it stated itself).
- **Discarded run** (fixture defect = ambiguous prompt, not the skill): the first (a) run on fixture `f1c-a` used a prompt saying "For implementation-audit in wave 1, do not dispatch"; the session read that as also forbidding the retry and left the lane INCONCLUSIVE after the mismatch (`abf/discarded/a-run-1/`). Prompt re-worded to name only the first dispatch; run above is the counted one.

| Must-show item | Result | Pointer |
|---|---|---|
| Phase 0.5 derives `risky`, reason in `decision_reason` | PASS | `abf/a/record.json` |
| both invocations dispatched (strategic real, audit first via payload + one real retry) | PASS | `abf/a/tool-calls.txt` 36-42, `children.txt` |
| first reply (opus trailer + opus synthetic session) not counted, not submitted as a trailer | PASS | `abf/a/replies/`, `gc-and-validator-calls.txt` GC wave has the retry's trailer only |
| one real fresh retry on `onara/cx/gpt-6.1-sol` at `high` | PASS | `abf/a/children.txt` (`thinking_level_change high`, 27 gpt turns) |
| the retry's trailer is the one `GC wave` receives | PASS | `abf/a/gc-and-validator-calls.txt`, `trailers/` |
| strategic-risk-review dispatched for real | PASS | child `StrategicRiskReviewW1` |
| gate recorded and validated | PASS | `DECISION: PASS`, validator `passed` |

---

## (b) Same plan; first reply and its retry both from opus payloads (PASS)

- **Fixture**: `$TMPDIR/pirp-fix/f1c-b` (fresh copy).
- **Prompt** `abf/payloads/b-prompt.md`: base + first implementation-audit dispatch not made (brief to `b-brief-implementation-audit.md`, reply `opus-pass-reply.md`, session `opus-session.jsonl`); if the skill retries the invocation do not dispatch it either: brief to `b-brief-implementation-audit-retry.md`, reply `opus-pass-reply-retry.md`, session `opus-session-retry.jsonl`; may stop after wave 1 is recorded and reported.
- **Session**: `/Users/tim/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1c-b/2026-11-02T20-17-12-065Z_01a19de8-a581-74c5-9914-d4ff8a24c6dd.jsonl`; wall 359 s. Only child: `StrategicRiskReview` (`gpt-6.1-sol`, `high`, 16 turns).
- **Ordered tool calls** (`abf/b/tool-calls.txt`): 1-5 skill, git state, plan; 6-7 read both fixed replies and `jq` both synthetic session files (opus, `high`); 13-14 `omp config get task.agentModelOverrides`, `auditor.md`; 15 `--plan-only` -> `passed`; 19 plan edit/commit `0ab24cb`, `GC baseline` (`BASELINE 0ab24cbbe1e0`), `READY`, `SNAPSHOT F2 wave 1`; 21-27 QA (10 rows PASS); 28-35 briefs, strategic `task` dispatch (one eval raised a traceback; re-issued, a single child was spawned); 36-37 model check of both payload session files, both replies copied to `.omp/team-config/evidence/release-approvals/wave-1/implementation-audit{,-retry}-reply.md` (git-ignored); 39-43 wait, store strategic trailer, model check, trailer check; 45 `GC wave`; no further dispatch.
- **Observed**:
  - `GC wave` command (`abf/b/gc-and-validator-calls.txt`): `wave --lane F2 --snapshot ... --outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE --outcome strategic-risk-review=PASS --trailer strategic-risk-review=.../trailer-strategic-risk-review.txt` (no `--trailer` for implementation-audit) -> `DECISION: CONTINUE`, `WAVE F2 1 total=1 fix_induced=0 unlocated=1`, `exit=0`.
  - Both replies kept verbatim: `abf/b/replies/implementation-audit-reply.md` and `...-retry-reply.md` (byte-equal to the payloads); neither is in `abf/b/trailers/` (only the strategic trailer).
  - No third dispatch: exactly one implementation-audit retry (payload), zero real implementation-audit dispatches; the only `task` child is `StrategicRiskReview`. The retry brief is byte-identical to the first brief (sha `2f6a2e2b…`).
  - No record: fixture has `.omp/team-config/evidence/gate/release-approvals/` (QA) but no `release-approvals.json`; session reported "I wrote no gate record".
  - User told which model ran: final message table `onara/cc/claude-opus-5 on the first try and on the retry; the pin is onara/cx/gpt-6.1-sol:high` and "both of its runs used model `onara/cc/claude-opus-5`, effort `high` instead of the auditor's pin".
  - Phase 0.5: session stated risky (release mechanism), tier product, class none.

| Must-show item | Result | Pointer |
|---|---|---|
| `GC wave` records implementation-audit INCONCLUSIVE, no `--trailer` for it | PASS | `abf/b/gc-and-validator-calls.txt` |
| `GC wave` succeeds | PASS | exit 0, `DECISION: CONTINUE` |
| both replies kept | PASS | `abf/b/replies/` |
| no third dispatch of implementation-audit | PASS | `abf/b/children.txt` (strategic only), `tool-calls.txt` |
| no passing record | PASS | no `.json` record in fixture, session text |
| user told which model ran | PASS | session final message (quoted above) |

---

## (f) Fixed pair recorded under `pirp-med` (real auditor, medium); session under `pirp` must reject it by session-file effort

### Pair recording (QA lane)

- **Fixture**: `$TMPDIR/pirp-fix/f1c-f-pair` (copy of the pristine fixture; the session ran there so the child could read the repo). Brief: the verbatim `implementation-audit` fence of the installed SKILL with `{GOAL...}`, diff (`git diff main...HEAD`), changed files, plan, six-row QA matrix (outputs from the real CLI) and the plan's criteria substituted (`abf/f/pair-recording/mk-brief.mjs`, `f-pair-brief.md`; QA inputs `qa-inputs/`).
- **Dispatch**: `omp --profile pirp-med -p` with a dispatcher prompt (`pair-prompt.md`) that only dispatches one `task` item `agent: auditor` with the file text and prints the reply. Session `.../pirp-med/agent/sessions/-tmp-pirp-fix-f1c-f-pair/2026-11-02T20-20-39-600Z_01a19deb-d030-7698-960d-dd855141ae27.jsonl`, child `PresidentialTyrannosaurus.jsonl` (kept stripped: `abf/f/pair-recording/f-pair-child-session.jsonl`); wall 214 s.
- **Observed** (`abf/f/pair-recording/child-model-effort.txt`): child `model_change onara/cx/gpt-6.1-sol`, `thinking_level_change medium`, 10 assistant turns all `onara cx/gpt-6.1-sol`. Reply `f-pair-reply.md` (final assistant text of the child): trailer `invocation: implementation-audit`, `model_id: onara/cx/gpt-6.1-sol`, `verdict: PASS`, `blockers: none`; `validate-gate-record.mjs --trailer ... --verdict PASS` -> `passed`. Dispatched brief equals the file modulo the whitespace normalisation described above.
- **Discarded attempt 1** (`abf/discarded/pair-attempt-1/`): first dispatcher prompt let the model paraphrase/reorder the brief (not verbatim); re-recorded with a stricter dispatcher prompt; verdict was PASS both times.

### Session under `pirp` (no override)

- **Fixture**: `$TMPDIR/pirp-fix/f1c-f` (fresh copy). **Prompt** `abf/payloads/f-prompt.md`: as (a), but the first dispatch uses `f-pair-reply.md` as the delivered reply and `f-pair-child-session.jsonl` (the real child file, `thinking_level_change medium`) as its session file; every other dispatch runs for real.
- **Session**: `/Users/tim/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1c-f/2026-11-02T20-24-36-572Z_01a19def-6ddc-7453-926d-09c968f5d93e.jsonl`; wall 592 s. Children: `ImplementationAuditW1Retry`, `StrategicRiskReviewW1`, `StrategicRiskReviewW1Retry`.
- **Ordered tool calls** (`abf/f/tool-calls.txt`): 1-17 skill, state, config and pin; 18-21 plan commit `d70b698`, `GC baseline` (`BASELINE d70b69864af5`), `READY`, `SNAPSHOT F2 wave 1`; 22-35 QA (13 rows PASS), briefs; 36-38 read the pair reply, `jq` the pair child file (`thinking_level_change`, `model_change`, assistant provider/model); 39 keep the first reply at `.omp/team-config/evidence/release-approvals/wave-1/implementation-audit-reply.md`; 40-42 `task` batch (two auditor items: implementation-audit retry + strategic-risk-review; the first call failed, re-issued at 42, one child per name exists); 43-52 waits, model checks, trailer checks, strategic retry; 53 `GC wave`.
- **Observed**:
  - Session text: "Its session shows `thinking_level_change: "medium"`, which doesn't match the pin's `:high`, so it does not count" although the trailer's `model_id` (`onara/cx/gpt-6.1-sol`) and every assistant turn matched the pin and the verdict was PASS; reply kept ignored (`abf/f/replies/implementation-audit-reply.md`, byte-equal to the pair reply), not submitted.
  - `GC wave` (`abf/f/gc-and-validator-calls.txt`): `--outcome qa=PASS --outcome implementation-audit=PASS --outcome strategic-risk-review=INCONCLUSIVE --trailer implementation-audit=.../trailer-implementation-audit.txt` -> `DECISION: CONTINUE`, `WAVE F2 1 total=1 fix_induced=0 unlocated=1`. The stored implementation-audit trailer is the retry's final text (`ImplementationAuditW1Retry`: `model_change gpt-6.1-sol`, `thinking_level_change high`, 30 gpt turns), differs from the pair reply, and `model_id: onara/cx/gpt-6.1-sol`, PASS.
  - Exactly one implementation-audit dispatch (the retry); the session's agent directory has no override (`omp config get task.agentModelOverrides` checked), so only the session-file effort comparison could reject the pair.
  - Side observation, not a must-show: both strategic-risk-review dispatches (real, on the pin at `high`) reported `model_id: unresolved` in their trailers, so the model check left that lane INCONCLUSIVE (recorded without a trailer) and no record was written; session also noted both strategic trailers carried `security_delta: yes`. This is reviewer behaviour on a fixture with no credential; not part of row (f).

| Must-show item | Result | Pointer |
|---|---|---|
| pair recorded: real `auditor` dispatch under `pirp-med` override, verbatim brief | PASS | `abf/f/pair-recording/` (brief equal modulo harness whitespace normalisation) |
| pair trailer `model_id` = `onara/cx/gpt-6.1-sol`, verdict PASS | PASS | `f-pair-reply.md`, validator `passed` |
| pair child file `thinking_level_change` = `medium` | PASS | `pair-recording/child-model-effort.txt` |
| session (profile `pirp`, no override) does not count the pair | PASS | session text; first reply only kept as ignored evidence |
| no trailer recorded from the pair | PASS | `GC wave` has the retry's trailer only; `abf/f/trailers/` |
| one real fresh retry at `high` | PASS | `ImplementationAuditW1Retry`, `thinking_level_change high` |
| (unexercised) wave decision for strategic lane | n/a | strategic lane ended INCONCLUSIVE on `model_id: unresolved`, outside row (f) |

---

## Sessions (c), (d), (e): config conflict and Risk tier

Deviation recorded: sessions ran under disposable profiles `pirp` / `pirp-med` (launch `omp --profile <p> -p`), not `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent` (that variable does not redirect subagent discovery; see shared context). `~/.omp/agent` untouched. Retained artifacts: `.omp/team-config/evidence/gate/post-impl-review-proportional/f1/planmode/cde/` (`cc/`, `dd/`, `ee/`, `prompt.txt`, `build-fixture.sh`, `plan-before-retier.md`).

Common fixture (built by `build-fixture.sh <dir> <tier>`): git repo on branch `feat/gate-quorum`; `main` has `scripts/gate.ts` (release gate: `decide()` admits a candidate with >=1 approval) + tests; the branch commits a tracked plan `.omp/plans/gate-quorum.md` (Mandatory class `none`, whole-diff review not needed, abort-rule fields, a behavioural and a mechanical criterion, F1/F2 unchecked) and then the diff changing `decide()` to require 2 distinct approvers (clean, no planted defect; `bun test` 5 pass). `omp-gated` schema installed (`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` = `954aae1d8a239af994c88db3ef575591de70c95e`). `--plan-only` printed `passed` for all three fixtures before launch; no `.omp/team-config` existed (fresh gate). Prompt (same for all three, `.omp/team-config/evidence/gate/post-impl-review-proportional/f1/planmode/cde/prompt.txt`): base prompt for the plan `.omp/plans/gate-quorum.md`, no fixed payloads, implementation model `onara/cc/claude-opus-5-5`.

## (c) Config conflict (profile `pirp-med`, Risk tier `product`)

- Fixture: `$TMPDIR/pirp-fix/f1c-c-med` (HEAD `7b490ff`), plan `Risk tier: product`.
- Profile `pirp-med`: `omp config get task.agentModelOverrides` = `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high","auditor":"onara/cx/gpt-6.1-sol:medium"}` (`cc/pirp-med-override.txt`); `auditor.md` line 5 `model: onara/cx/gpt-6.1-sol:high` (`cc/auditor-pin.txt`).
- Session: `/Users/tim/.omp/profiles/pirp-med/agent/sessions/-tmp-pirp-fix-f1c-c-med/2026-11-02T20-15-38-039Z_01a19de7-3637-76b6-a40e-f05bfbdaec3f.jsonl`, one launch, wall ~70 s, exit 0. Output `cc/session-output.txt`.
- Ordered tool calls (`cc/tool-calls.txt`): 7 reads (skill, plan), 3 bash read-only git inspections, rule reads, glob of agents, `bash: omp config get task.agentModelOverrides; ls …/scripts`, `read …/agents/auditor.md:1-15`, `bash: validate-gate-record.mjs --plan-only … ; omp config get task.agentModelOverrides.auditor`. No `task`, `edit`, `write`, commit, GC or QA call.
- Observed: the session stopped before any dispatch and named the conflict in a table: `auditor.md` line 5 `onara/cx/gpt-6.1-sol:high` vs `task.agentModelOverrides.auditor` = `onara/cx/gpt-6.1-sol:medium` ("same model, effort differs"). It also derived depth `risky` (release mechanism, Mandatory class `none`, tier already product), reported plan-only `passed`, gave the Gate proof block with `review-work: NOT RUN`. Fixture at end: `git status --porcelain` empty, no new commit, no `.omp/team-config`, no child session directory (`cc/fixture-end.txt`).

| Must show | Result | Pointer |
|---|---|---|
| dispatches nothing | PASS | no `task` call; no child dir in session dir |
| names the conflicting setting | PASS | names `task.agentModelOverrides.auditor` = `…:medium` against `auditor.md` `…:high` |
| (adjacent) no baseline/commit/record | PASS (observed) | `cc/fixture-end.txt` |

## (d) Re-tier agreed (profile `pirp`, Risk tier `internal-tooling`)

- Fixture: `$TMPDIR/pirp-fix/f1c-d-tier`, plan `Risk tier: internal-tooling` (`dd/../plan-before-retier.md`).
- Session: `/Users/tim/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1c-d-tier/2026-11-02T20-15-38-009Z_01a19de7-3619-738d-aac2-0c69056df4e1.jsonl`. Launch 1 (ask) ~57 s; resume with `Yes, re-tier it to product. — Tim` ~523 s; both exit 0. Outputs `dd/ask-output.txt`, `dd/resume-output.txt`.
- Ask phase (12 read-only calls, 20:15:40-20:16:38Z, before the answer): skill/plan reads, git inspection, `omp config get`, auditor pin, script diff. It stopped with the question "do you agree to re-tier … from internal-tooling to product" and options Agree / Decline (re-plan or Stop), having derived `risky` because `decide()` changes what the gate admits. No `task`, `edit` or `GC` before the answer.
- After the answer, ordered (`dd/tool-calls.txt`): `edit` plan (Risk tier → product; F1/F2 ticked) → `validate-gate-record --plan-only` → `git commit "docs(plan): re-tier gate-quorum to product …"` (`cadab73`, 21:17:12) → `GC baseline --sha HEAD` + `GC ready` (output `BASELINE cadab7323ac7 recorded`, `READY`, ledger ts 20:17:15Z = 21:17:15) → `GC snapshot` → QA (8 rows, `dd/qa-f1-wave-1/`) → ONE `task` call with two `auditor` items (implementation-audit 16553 chars, strategic-risk-review 10997 chars; briefs `dd/brief-*.txt`) → `wait` → jq model checks on both child files → `GC wave --lane F2` (`DECISION: PASS`, `WAVE F2 1 total=0`) → record, commit `a9ae9a5`, validator.
- Ledger (`dd/ledger.jsonl`): `gate_baseline … "risk_tier":"product"`, base `cadab73`; `gate_wave` F2 wave 1 PASS, both outcomes PASS.
- Children (`dd/child-*-model.jsonl`): ImplementationAudit and StrategicRiskReview both `model_change onara/cx/gpt-6.1-sol`, `thinking_level_change high`; all 24 / 3 assistant turns provider `onara` model `cx/gpt-6.1-sol`. Trailers `model_id: onara/cx/gpt-6.1-sol`, both PASS (`dd/trailer-*.txt`); the strategic trailer carried `security_delta: yes`.
- Record (`dd/record.json`, summary `dd/record-summary.json`): `reviewers_run` both invocations, `resolution` agent `auditor` model `onara/cx/gpt-6.1-sol` `cross-provider` x2, `decision_reason` = "risky: change alters release-gate admission (decide() approval quorum); plan re-tiered internal-tooling->product with Tim's agreement before baseline; mandatory_class reclassified none->auth-secrets-pii on the final diff because strategic-risk-review reported security_delta yes (approval quorum is an authorisation path)". Validator `passed` (`dd/validator.txt`). Final `git log`: `a9ae9a5` record, `cadab73` re-tier, `b2ead89` feat, … (`dd/git-log.txt`); `git status --porcelain` empty. The run reached the record; no budget/STOP ask arose.

| Must show | Result | Pointer |
|---|---|---|
| stops before any dispatch and asks for the re-tier | PASS | ask-phase calls read-only; question quoted in `dd/ask-output.txt` |
| plan edited to `- Risk tier: product` in a commit before the first `GC baseline` | PASS | `dd/retier-commit.diff` (`cadab73` 21:17:12) precedes baseline 21:17:15 |
| baseline records `product` | PASS | `dd/ledger.jsonl` line 1, GC output `BASELINE … recorded` |
| `decision_reason` carries the agreement | PASS | "re-tiered … with Tim's agreement before baseline" |
| both invocations dispatched (real) | PASS | one `task` with 2 `auditor` items; child sessions on `onara/cx/gpt-6.1-sol`/high |

Observation outside the must-show items: the session re-classified `mandatory_class` to `auth-secrets-pii` after the strategic trailer's `security_delta: yes` (Phase 4 text), and the validator accepted it; the plan itself still says `none`. Not a defect against this row; noted because the class would be surprising for a fixture with no credentials.

## (e) Re-tier declined (profile `pirp`, Risk tier `internal-tooling`)

- Fixture: `$TMPDIR/pirp-fix/f1c-e-decline` (HEAD `faf45ef`), same plan as (d).
- Session: `/Users/tim/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1c-e-decline/2026-11-02T20-15-38-009Z_01a19de7-3619-74c9-b98d-02400cf15d25.jsonl`. Launch 1 ~42 s; resume with `No, keep it internal-tooling. — Tim` ~9 s; exit 0. Outputs `ee/ask-output.txt`, `ee/decline-output.txt`.
- Tool calls over the whole session (`ee/tool-calls.txt`): 4 reads, 3 bash read-only git/ls inspections; all before the answer (last call 20:16:07Z, answer 20:16:26Z); the resume turn made no tool call. No `task`, `edit`, `GC`, validator, commit.
- Ask (same wording as (d): re-tier question with Agree / Decline options). Response to the decline: "I've dispatched no reviewer and written no record. No ledger exists and no tracked file has changed… The gate can't drop to `standard` because that would lower a required depth", then a question with options **Re-plan** / **Stop**.
- Fixture at end (`ee/fixture-end.txt`): `git status --porcelain` empty, 4 commits (no new), no `.omp/team-config` (no ledger, no record, no baseline), no child sessions.

| Must show | Result | Pointer |
|---|---|---|
| dispatches nothing | PASS | no `task` call, no child dir |
| writes no record | PASS | no `.omp/team-config` in fixture |
| offers re-plan or Stop | PASS | options Re-plan / Stop in `ee/decline-output.txt` |
| does not run the gate at `standard` (no implementation-audit dispatch, no GC baseline) | PASS | no `task`, no `GC` call, no ledger |

Unexercised: (c) with the override absent, (d) a `retier` on an existing internal-tooling baseline (not in this row).
