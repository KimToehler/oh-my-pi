# Design

## Context

See proposal.md - Why. Status: the bullets below describe `main` at the branch base `24d0280`, and their line numbers refer to that tree. Tasks 1-4 are implemented on `a8c2fd80ff` (`scripts/trailer.mjs`, the `--trailer` mode, `GC wave --trailer`, the guidance). The remaining delta is tasks.md section 5: the two F3 wave 1 fixes, D4's non-token-verdict exclusion and D3's artifact size bound, plus the extended guidance check below. Current state the design builds on (paths relative to `team-config/agent/skills/review-work/`):

- `scripts/validate-gate-record.mjs` parses trailers in `parseTrailer` / `parseTrailerBody` / `parseCriteriaBlock` (lines 433-497) and checks them in `validateTrailer` (499-567) and `reconcileBlockers` (572-599). The only caller is the record check (line 863). `validateTrailer` compares `model_id` with the record's resolution and `verdict` with the record's verdict; everything else depends only on the trailer text, the invocation and the plan text (restated-criterion check, line 562). Modes today: `--plan-only` and the full record check (`main`, 941-985).
- `scripts/gate-convergence.mjs wave` (471-563) takes `--outcome <name>=<value>` for `qa`, `implementation-audit`, `strategic-risk-review` and records them without reading any reviewer output. It already loads the plan bytes (file, or the folder bundle via `folder-plan.mjs`) and verifies they equal the wave snapshot (489-499) before recording.
- Finished `task` subagents stay addressable: kept-alive agents go `idle` and later `parked`, and `write agent://<id>` revives them with their transcript (`packages/coding-agent/src/task/executor.ts` `finalizeSubagentLifecycle`, `persisted-revive.ts`). Isolated runs are not revivable; review-work dispatches `auditor` and `oracle` without isolation.
- `SKILL.md` Phase 3 treats a missing trailer like a bare FAIL (one fresh respawn) and forbids `write agent://<id>` to a reviewer that already returned a verdict; `rules/merge-gate-proof.md` line 47 says "Never trim or edit a trailer; re-run the invocation."; `rules/delegation.md` lines 31-36 forbid a follow-up message to an old reviewer (`write agent://...`) for re-reviews and let review-work's own procedure override that paragraph. The rule is enforced at runtime: a session reply that plans such a message can be interrupted with `rule_violation`.

## Goals / Non-Goals

**Goals:**
- One implementation of the trailer rules, used by the record check, the new standalone check and `GC wave`.
- A malformed trailer costs one short follow-up turn of the same reviewer, not a new review.

**Non-Goals:**
- Changing the trailer format, the record schema, the record check's rules or the ledger event shapes.
- Binding the ledger to the trailer bytes later cited by the record (the record check still validates whatever the record cites).
- Structured-output reviewer agents (harness-enforced shape). That would replace the trailer storage contract and the `auditor` / `oracle` definitions; a separate change if wanted.

## Decisions

**D1 - Shared trailer module.** Move the trailer parser and every trailer rule that does not depend on the record into `scripts/trailer.mjs`, exporting `checkTrailer(text, { field, invocation, verdict, planText })`. It returns `{ scalars, securityDelta, blockerIds }` and throws `TrailerError` carrying `field` and `detail`. The record check calls it, then adds the model binding (`model_id` equals the resolution) and maps `TrailerError` to its `block`. Findings keep their current field names in the record check (`verdicts.<n>.trailer_artifact…`). The rules that move: single block on whole marker lines, repeated keys, `invocation`, `sections_covered` against the required sections per invocation, non-empty `model_id`, `security_delta`, verdict token, verdict equal to the expected verdict, blocker reconciliation, at least one five-field criterion, and no invariant restated from the plan text. Alternative rejected: `GC` spawning the validator. It would reload and re-resolve the plan the wave has just verified, and spawning adds a second argument contract to keep in sync. Alternative rejected: accepting aliases such as `adversarial_criterion`. Every alias widens the parser that guards against appended blocks, and repair makes tolerance unnecessary.

**D2 - Validator trailer mode.** `--trailer <file>` with required `--invocation` (`implementation-audit` or `strategic-risk-review`), `--verdict` (`PASS`, `FAIL`, `INCONCLUSIVE`) and `--plan`. `--trailer` with `--record` or `--plan-only`, or `--invocation` / `--verdict` without `--trailer`, blocks. The plan loads as in the other modes (file text, or folder bundle), so the restated-criterion check sees the bytes the record check will see. The file is read from the working tree, with no tracked or digest requirement, because trailers are staged only in Phase 5. Field prefix `trailer`. Output contract unchanged: one word on stdout, the finding on stderr, exit 0 or 1.

**D3 - `GC wave --trailer`.** New repeatable option `--trailer <invocation>=<path>`, path resolved against `--repo`. In lane F2, each `implementation-audit` / `strategic-risk-review` outcome of PASS or FAIL needs exactly one; an INCONCLUSIVE outcome may carry one, and then it is checked too. A trailer for an invocation without an outcome, a duplicate, or any `--trailer` in lane F3 fails. Each trailer file is read under the record check's 1 MiB artifact bound (`MAX_ARTIFACT_BYTES`, moved to `gate-layout.mjs` and imported by both scripts), so an artifact the record would refuse is refused here too, and runs `checkTrailer` with `ctx.planBytes` (already verified equal to the snapshot's plan) and the outcome as verdict. All checks run before `append`, so a refusal leaves the ledger untouched and the same command can be re-run after a repair. Outcome values stay the orchestrator's normalised reading of the original reply (Phase 2-3), so a repair turn that changes its verdict is refused here and by the D2 check. `SKILL.md` Fix waves step 3 gains, after its `--outcome` bullet, the bullet `- one --trailer <invocation>=<trailer file> for each reviewer outcome that is PASS or FAIL, and for an INCONCLUSIVE one whose reply has a trailer;` (the option name and argument in code spans).

**D4 - Repair procedure (SKILL.md Phase 3).** Phase 3's sentence "A reply carrying no trailer is the same case …" is replaced by this paragraph, verbatim, followed by the fenced message:

```
**Trailer repair.** A reply that delivers its review and states one verdict token but whose trailer is missing or fails the trailer check is repaired before any new dispatch: keep the reply as local evidence (`.omp/team-config/evidence/<plan basename>/wave-<n>/<invocation>-reply.md`, git-ignored), send the same reviewer exactly one `write agent://<id>` with the message below, `{CHECK FINDING}` replaced by the check's stderr line, store its answer exactly as delivered (`read agent://<id>`, never retyped, never joined to the first reply) as the `*trailer*` artifact, and run the trailer check on it with `--verdict` set to the first reply's verdict. Only when the repaired trailer fails the check, or the reviewer cannot be reached or does not answer, dispatch a fresh reviewer with the verbatim brief. The reply of the fresh reviewer gets the same single repair; if its trailer still fails, the invocation is INCONCLUSIVE for this wave and no further reviewer is dispatched. An empty or ack-only reply, a bare verdict without the review, or a missing deliverable is not repaired: it takes the bounded fresh-context retry above, then INCONCLUSIVE. A reply without a verdict token, or with conflicting ones, is `INCONCLUSIVE` and gets no repair. At most one repair message per reply.
```

Message:

```
TRAILER REPAIR. Your review is finished: do not review again, read nothing, and keep your verdict. Reply with only every `Blocker B<n>:` line of your previous reply, verbatim, then the REVIEW-TRAILER-v1 block exactly as the brief specifies it, field names unchanged, filled in for that review. Check finding: {CHECK FINDING}
```

A trailer whose verdict is not a verdict token (`APPROVE`, `REJECT`, any other value) is excluded from repair: Phase 2 reads it as a brief that solicited the wrong vocabulary, and a repair under that brief would turn it into a canonical trailer without the verbatim brief ever being sent (F3 wave 1, B1). Phase 3 therefore gains, directly after the paragraph's sentence on empty or ack-only replies, the sentence "A trailer whose verdict field is not PASS, FAIL or INCONCLUSIVE is not repaired either: the brief solicited the wrong vocabulary (Phase 2), so it takes the bounded fresh-context retry with the verbatim brief, then INCONCLUSIVE.", and Phase 2's `APPROVE` sentence ends "instead of translating the answer or sending a trailer repair."

Joining the repair answer to the first reply is excluded because the first reply's malformed block would make two blocks. The Phase 3 rule against messaging a reviewer that returned a verdict keeps its purpose (no stale-context re-review after fixes) and gains this one exception: the repair adds no input and asks for no judgement. The trailer-storage paragraph after Phase 2 points to this paragraph. `merge-gate-proof.md` line 47 becomes "Never trim or edit a trailer; ask the same reviewer for its trailer (review-work Phase 3), else re-run the invocation." `rules/delegation.md` keeps its re-review sentence and appends, directly after "never a follow-up message to the old reviewer (`write agent://...`).", the sentence "The review-work TRAILER REPAIR. message is not a re-review: it goes to the same reviewer by design." That way the runtime rule enforcement does not interrupt the repair. Trust: the validator cannot witness a dispatch either way (`SKILL.md` Phase 5, "The validator reads files; it cannot witness the dispatch"). The repair reply comes from the same reviewer session under the same brief, and `history://<id>` keeps both turns.

The guidance check (tasks.md 4.1) compares whitespace-normalised text against the exact sentences of D4 and D5. It also checks that Fix waves step 3, between its `--outcome qa=PASS|FAIL` bullet and "Then act on the decision", names `--trailer` with the D3 sentence. It requires that `merge-gate-proof.md`, once the D4 sentence is removed from it, names no other re-run or re-dispatch of the invocation (`re-run the invocation`, `re-dispatch`), so the rule cannot prescribe a fresh dispatch before or besides the repair. It runs on six in-memory variants, which must fail: a Phase 3 without the sentence that excludes bare verdicts from repair, a Phase 3 whose fallback sentence is replaced by a re-dispatch-first sentence, a Phase 3 whose bound sentence is replaced by another fresh dispatch, a step 3 without the D3 sentence, a `delegation.md` whose exception sentence is replaced by an unrelated `TRAILER REPAIR.` mention, and a `merge-gate-proof.md` that puts "Re-run the invocation first." in front of the D4 sentence.

**D5 - Brief header.** Each reviewer brief gets, as its second line: `Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.` The diff and inputs follow, so the block's own position at the end is unchanged.

**D6 - Scope.** Two independently testable mechanisms (validator, `GC`) plus guidance. They share one contract, `trailer.mjs` and the `--trailer` vocabulary, and must ship in one cutover. `GC wave` refusing PASS/FAIL outcomes without trailers is only operable once `SKILL.md` step 3 passes `--trailer`, and the repair step needs the D2 check to exist.

## F1 environment and liveness

F1 scenarios s3 (live repair) and s4 (installed copy) run outside the unit suite. Their environment:

| Phase | Network | Runtime/Platform | Commands | Need met? |
|---|---|---|---|---|
| s3 dispatch and repair | LLM router for the `auditor` model | the omp session executing task 6.3 (darwin/arm64, Bun), its `task` executor and agent registry | `task` (agent `auditor`, not isolated), `read agent://<id>`, `write agent://<id>`, `read history://<id>` | yes: the session executing 6.3 has the task tool and router access |
| s3 check | none | node, worktree scripts by absolute path | `node <worktree>/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --trailer ...` | yes |
| s4 install and check | none | Bun/node, a fresh temporary `PI_CODING_AGENT_DIR` with `PI_PROFILE` and `OMP_PROFILE` unset | `bun scripts/install-team-config.ts`, the installed validator, the guidance check with `AGENT_ROOT` | yes |

Target-environment controls (each must give the stated failure; a pass is a defect, because it would mean that host state rather than the tested copy produced the result):
- s3: the same `--trailer` command with the host-installed validator (`~/.omp/agent/skills/review-work/scripts/validate-gate-record.mjs`, pre-deploy) gives `blocked` with exit 1, so s3's `passed` came from the worktree validator.
- s4: the guidance check with `AGENT_ROOT` set to an empty temporary directory exits non-zero (no fallback to `team-config/agent` or `~/.omp/agent`). Also, the installed validator with the installed copy's `skills/review-work/scripts/trailer.mjs` removed fails on the s1 repair reply, so the installed validator loads its own `trailer.mjs`.

s3 depends on these resources staying available:

| Dependency | lifetime | holder | check before | check after | phase on loss |
|---|---|---|---|---|---|
| reviewer id | dispatch to repair reply | the omp session's agent registry (not isolated, so revivable when parked) | `read agent://<id>` shows the first reply | the repair reply is delivered under the same id | infrastructure: trial VOID |
| LLM router | each reviewer turn | router service | dispatch returns a reply | repair turn returns a reply | infrastructure: trial VOID |
| worktree validator and `SKILL.md` | whole scenario | worktree at the 6.3 head | `git rev-parse HEAD` recorded | same SHA at the end | infrastructure: trial VOID |

A VOID trial is no reviewer outcome: it stores no trailer, runs no `--trailer` check, counts as neither PASS nor FAIL of the repair, and s3 is run again. Loss control: a second `auditor` is dispatched on the same scratch diff and cancelled with `write proc://<id>/kill` before it replies. s3 records that no reply was delivered, that the trial was classified VOID, and that no trailer file exists for it. A control trial that produced a stored trailer or a check result is a defect.

## Risks / Trade-offs

- [The repair turn reconsiders and changes the verdict] → `--verdict` binding in D2 and D3; mismatch falls back to a fresh dispatch.
- [A repaired FAIL artifact holds only the first line of each blocker] → findings detail stays in the local original reply that fix waves read; the record needs only the blocker ids.
- [The reviewer is no longer addressable (parked revival fails, session gone)] → fresh dispatch as before.
- [`GC wave` refuses a legitimate wave] → nothing is appended; the finding names the field; repair or re-dispatch, then run the same command again.
- [The record check and the `GC` check drift apart] → one module, D1; the record check's existing suite runs unchanged against it.
- [Prompt cache expired before the repair turn] → one more input pass, still without the tool calls and output of a review.

## Migration Plan

1. Merge, then run `scripts/deploy-local.sh`. It installs into `getAgentDir()` only. Every other agent directory (each `~/.omp/profiles/*/agent`, `PI_CODING_AGENT_DIR` installs) needs `env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=<dir> bun scripts/install-team-config.ts`.
2. Restart every running omp session after installing (binary, `bun --cwd=packages/coding-agent src/cli.ts`, `dist/cli.js`, ACP), as `scripts/deploy-local.sh` already asks at its end. A session loads its rules at start, so a session started before the deploy still carries the old `delegation.md` and `merge-gate-proof.md` text and may be interrupted by rule enforcement when it sends the repair message. The scripts and `SKILL.md` are read at use and need no restart.
3. After deploy and restart, the first real trailer repair in a restarted session is the post-merge witness (Workflow follow-up in tasks.md).
4. A gate mid-wave on a deployed agent dir must add `--trailer` to its next `GC wave`; the trailer files already exist from Phase 3.
5. Rollback: redeploy the previous commit and restart sessions as in step 2. The ledger is untouched (no new event shape).
