# Design

## Context

See proposal.md (Why). The post-implementation flow lives in `team-config/agent/skills/review-work/SKILL.md`. Phase 0.5 picks the invocations (`:91-115`), Phase 1 is F1 (`:156-179`), Phase 2 holds the two briefs (`:183-302`), Phase 4 the verdict and Override (`:362`), and Fix waves the GC loop and the delta review (`:445-492`). F3 lives in `team-config/agent/skills/integration-review/SKILL.md` and dispatches `auditor` with its own brief (`:61`). These code contracts constrain what instruction text alone can change:

- `validate-gate-record.mjs:648-659`: `reviewers_run` admits only `implementation-audit` and `strategic-risk-review`, without duplicates, and a class other than `none` requires both. The `resolution[].agent` field is free-form (`:670-672`). The model in the trailer must equal the one in the resolution (`:452`).
- `trailer.mjs:20-23`: `implementation-audit` needs sections 1-5, and `strategic-risk-review` needs sections 1-4.
- `validate-gate-record.mjs:547-551`: `whole_diff.run` must match the `gate.md` `Whole-diff review` field. When the field says not needed, the record repeats its reason verbatim. `validate-openspec-change.mjs:183` accepts `not needed (<reason>)`.
- An Override needs only `override.by`, `override.reason` and one `downgrades` entry per FAIL blocker (`validate-gate-record.mjs:579-590`, `:769-792`). It reads no `gate-convergence` decision. `GC decide` refuses unless the last wave stopped (`gate-convergence.mjs:618`). The only STOPs are the trend rules and the internal-tooling cap (`:283-296`).
- The validator puts no wave constraint on QA artifact paths: it has no `wave-` match.
- The seed resolves `@review` to `onara/cx/gpt-6.1-terra:high` and `@oracle` to `onara/cx/gpt-6.1-sol:xhigh` (`team-config/seed/config.yml:11-13`). Its retry chain maps `gpt-6.1-sol` to `claude-opus-5` (`:33-34`); since main `ddbd95d024` it switches only on a usage limit (`retry.fallbackOn: usage-limit`, `:25`), while a profile config that predates that key still switches on any provider error (`team-config/README.md:112-114`). An agent's frontmatter `model:` pins its model, for example `blocker-verifier.md:5`.

## Goals / Non-Goals

**Goals:**

- Post-implementation cost and wall-clock follow the change's risk. A `standard` change ends after one review wave, or after one fix round and its closing wave.
- Every lane runs on the strongest reviewer measured so far, and a dispatch that ran on another model does not count.
- No wave loop runs without bound: after the budget, the user decides.
- The change stays inside the current record, trailer and ledger contracts, so no validator or test changes ship with it.

**Non-Goals:**

- Removing bookkeeping. That is Slice B: per-wave GC snapshots, the brief guard, `sections_covered`, `adversarial_criteria`, `whole_diff`, `plan_sha256` over `tasks.md`, the delta review the GC requires before a closing wave, and validator enforcement of the model pin.
- A findings filter after implementation (D6).
- The decomposed review (Open Questions).
- How the gate handles a main merge, which stays as written in Fix waves step 1.

## Decisions

### D1: Instructions only, inside the current contracts

Every change below maps onto fields and checks that exist today:
- the second lane keeps the `strategic-risk-review` invocation and its four numbered sections;
- both lanes record `agent: auditor`;
- F3's absence is the existing `not needed (<reason>)` form;
- the exhaustion ask ends in the existing Override.

Alternative: change the validator in this change, so that it admits two runs of one brief, retires `whole_diff` and lets a delta check close the gate. Rejected. It would make this a code change of the gate validator, which is the riskiest file in the flow (897 lines, 2892 test lines). The user chose to slice the instructions first. The cost of this choice is D5's closing wave and a vestigial `whole_diff` field until Slice B.

### D2: Depth comes from gate.md, or from Phase 0.5 for plan-mode plans

An OpenSpec change reads `Depth` from `gate.md`, the same field and rules as `openspec-plan-review` "Review depth follows the change's risk". A plan-mode plan has no such field. Phase 0.5 derives the same value from the plan's class and from whether the plan changes a review, gate or release mechanism. The orchestrator may raise the depth on the final diff and records why in `decision_reason`. It never lowers it. This keeps one depth rule for both plan kinds. The validator already requires both invocations for a class other than `none`, so `risky` by class is enforced. `risky` by mechanism alone, with class `none`, rests on the instruction.

`risky` depth is product work. Under Risk tier `internal-tooling` the validator admits exactly one `implementation-audit` (`validate-gate-record.mjs:660-662`). A plan of that tier that derives or is raised to `risky` is therefore re-tiered to `product`, with the user's agreement, before any reviewer is dispatched. The ledger fixes the order: `GC baseline` records the plan's tier when it first runs (`gate-convergence.mjs:312-317`), and `GC retier` needs an existing `internal-tooling` baseline (`:644-646`). On a fresh gate the plan is edited to `- Risk tier: product` and committed before the first `GC baseline`, which then records `product`, and the agreement goes into `decision_reason`. On a gate whose baseline already records `internal-tooling`, the plan edit is followed by the existing `GC retier` with the user's name and reason. If the user declines, the gate stops: it dispatches nothing, writes no record and tells the user that `risky` depth needs Risk tier `product`, so the choices are re-plan or Stop. It never falls back to `standard`, because that would lower a required depth.

Alternative: keep Phase 0.5's discretionary "consequence or uncertainty is high" for class `none`. Rejected. It leaves a change to a review mechanism with one reviewer whenever its class is `none`; review-stop-rule was such a change, and its F2 B1 (the early ask ignored Stop) was real. Discretion also drifts toward fewer reviewers (SKILL.md:112).

### D3: F3 folds into F2. The second lane carries the whole-diff surface and is not a replica

Today F3 and F2 both dispatch `auditor`, each with its own waves and deltas. plan-review-proportional took 4 waves of each. After this change, F3's surface (its failure-mode list, scope-plan walk, seams and simplification) becomes:
- for `standard`, review hints in section 2 of the `implementation-audit` brief;
- for `risky`, a rewritten `strategic-risk-review` brief with four numbered questions, dispatched in parallel with the audit and no longer fed the audit's findings:
  1. architecture and cross-module seams across the whole diff;
  2. consistency, duplication and simplification across files;
  3. the failure mode that would hurt most in production, and whether it is handled;
  4. what a line-level reading of the diff would miss.

The checklists become hints, not mandatory sections, because the trailer's section numbers are the only enforced structure. `gate.md` and plan merge gates state `Whole-diff review: not needed (whole-diff surface reviewed in F2)`.

Alternatives:
- Two runs of the same brief on `sol:high`, which is the measured gain: in the paired Sol runs a single run found about 86% of the union, with the gain on C3 and E2 (`runs/review-effort-20261029`, `runs/review-argon-20261102/lean`). Rejected. The validator refuses a duplicate invocation, and a replica would drop F3's surface, which found real defects (review-trailer-repair's repaired-verdict bypass, `cf670532fd`).
- Keep F3 for `risky`. Rejected. It doubles the waves and deltas for a third pass on the same model family.

The gain of two different briefs on one model over a replica pair is unmeasured. It is a named residual.

### D4: Both lanes run on `auditor` pinned to `sol:high`, and a substituted model fails closed

`auditor.md` changes `model:` from `"@review"` to `onara/cx/gpt-6.1-sol:high`. Both invocations dispatch `auditor`, and `oracle` leaves the gate. The evidence:
- `review-pilot`: 16 validated blocker occurrences for sol against 8 for terra.
- `review-effort`: 12 occurrences for `sol:high` against 7 for `sol:medium`, at $0.87 per review.
- Today's new items: `sol:high` found every target blocker on E1 and D5, plus an extra real blocker on E2, with 0 unsupported.

The pin is the model and effort in `auditor.md`, read every time from the active agent directory. A model alone is not the measured configuration: effort is resolved separately (`packages/coding-agent/src/task/executor.ts:4732-4744`), and the trailer's `model_id` carries no effort. After each dispatch, the orchestrator reads the dispatch's session file, whose path `read history://<id>` prints, with the same `jq` as plan-review D10. It takes the provider and model of every assistant turn and the dispatch's `thinking_level_change` value, and compares both with the pin. A dispatch with any other model or effort, or a trailer `model_id` naming another model, does not count. Example: the retry chain's fallback to `claude-opus-5`, or `sol` at `medium`. The invocation then gets the bounded fresh retry of Phase 3, and stays INCONCLUSIVE when the retry does not count either.

A reply that does not count is kept verbatim as evidence, but its trailer is never the invocation's trailer. Fix waves step 3 submits a trailer for an INCONCLUSIVE invocation whose reply has one (SKILL.md:457), and `GC wave` checks each trailer's verdict against the outcome (`gate-convergence.mjs:557-558`, `trailer.mjs:167-168`), so a substituted PASS submitted as INCONCLUSIVE would be refused, and rewriting the verdict is forbidden (SKILL.md:304, :347). An invocation left INCONCLUSIVE by a mismatch is therefore recorded with `--outcome <invocation>=INCONCLUSIVE` and no `--trailer`, which GC already accepts (`:535-540`), and step 3's trailer bullet says so. A retry that counts supplies the invocation's trailer.

A `task.agentModelOverrides.auditor` entry wins over the definition (`packages/coding-agent/src/config/model-resolver.ts:1291-1293`). If it names another model or effort, or the definition names no model, the gate dispatches nothing and tells the user which setting conflicts. Plan review takes the override as its pin; this gate takes the definition, because the definition is the reviewed, team-owned choice that D4's evidence supports.

Detection alone is not the cheap half. In the plan-review loop measurement 9 of 26 fresh `sol:high` dispatches (35%) lost their pin: the provider stream ended with `stream_disconnected: stream closed before response.completed` and the runtime continued the same session on `claude-opus-5`, the failures concentrating on the largest inputs at $3.67-6.62 per lost attempt and consuming 45% of that run's spend (`.omp/team-config/evidence/gate/plan-review-loop-measurement/f1/replays.md`, committed on main). This change's own F1 recorded the same mechanism on a non-pinned dispatch (`f1/standard.md:36`). A `risky` gate on a large diff is exactly that shape of request, so the INCONCLUSIVE-and-retry rule above can double the cost of the most expensive lane. Two prevention levers exist outside this change's files and belong in the migration plan, not in its specs:
- the session runtime no longer switches models on such a cut: a mid-stream transport drop with streamed progress is retried once on the same model before the fallback chain is consulted (main `7c737ac11f`, `packages/coding-agent/src/session/turn-recovery.ts`). A deploy older than that commit still substitutes silently.
- the seed's own chain is the other source: `team-config/seed/config.yml:33-34` maps `gpt-6.1-sol` to `claude-opus-5`. Since main `ddbd95d024` the seed sets `retry.fallbackOn: usage-limit` (`:25`), which keeps the pin by construction on a fresh install; a profile config that predates the key still switches on any provider error until the key is merged into it (`team-config/README.md:112-114`).

With either lever in place the session check of this decision stays as the backstop it was meant to be. Neither lever is part of this change's cutover; the migration plan names them as a precondition for the measured cost of a `risky` gate.

Alternatives:
- terra plus oracle, as today. Rejected on the pilot data.
- `sol:xhigh`. Unmeasured and more expensive.
- `gemini-3.8-flash-high` as a second family. Rejected: with the original brief it found 0 target blockers on 6 of 6 reviews. Its pipeline found 3 of 4 target blockers at roughly 5 times the cost and 33-39 minutes per review, and it exhausted the account quota (`runs/review-argon-20261102/RESULT.md`, Addendum 3).

Changing `auditor` also changes its other uses (`delegation.md:15`). This is intended: it remains the finished-diff reviewer.

### D5: The budget counts fix rounds, and each round ends in a closing wave

A record needs PASS trailers bound to `reviewed_sha`. A fix after the last wave therefore needs a new wave, and a delta check alone cannot close the gate until Slice B. The budget is:
- `standard`: 1 fix round, so at most 2 waves;
- `risky`: 2 fix rounds, so at most 3 waves.

This is the same number of fix rounds that plan review allows per depth. A closing wave re-runs QA on the fixed tree and, when QA passes, every reviewer lane of the depth; a wave whose QA fails dispatches no reviewer, as Phase 1 already says, and counts as a failing wave. If it still fails, the wave is recorded, and the user is asked once before any edit or dispatch, with the open blockers and their disposition under `Blocker disposition`:
- one more fix round, then the ask again;
- re-plan;
- Stop;
- Override, only when every open blocker is eligible or covered. It is recorded through Phase 4 with `below-threshold`, `accepted-residual` or `out-of-scope` downgrades, never `frozen`, which belongs to a convergence STOP (SKILL.md:370).

An excluded blocker, which on a change of any class other than `none` is every blocker except a verification-only one below the threshold (SKILL.md:429), is never overridden here, even on the user's request (SKILL.md:433, :441). On most `risky` changes the budget ask therefore offers no Override. That is intended: those are the classes where the post-implementation defects were real.

A `gate-convergence` STOP that arrives earlier keeps its existing ask and `GC decide`, including its freeze. A budget ask records nothing in the ledger, because `decide` refuses without a STOP. Fix deltas stay one review per contiguous fix range, as Fix waves step 5 already says.

A closing wave with an INCONCLUSIVE invocation, for example a reviewer that ran off the pin on its dispatch and on its retry (D4), is incomplete, not failed: `Blocker disposition` already says an incomplete round never triggers an ask. It therefore gets no budget ask and no Override. It is recorded, the user is told which model and effort ran, no fix is committed, and the wave is repeated on the same tree once the pin resolves; the repeat spends no fix round, because nothing was fixed. A STOP keeps its ask, as above.

Alternatives:
- A product-tier cap inside `gate-convergence.mjs`. Rejected under D1; Slice B can move the budget into GC.
- No budget. Rejected, because waves are fresh samples: E1's wave-2 blockers were already in the code at wave 1.

### D6: No verifier triage after implementation

Plan review adopted the `blocker-verifier` because 85 of 106 later-round blockers were latent and per-reviewer recall was estimated at 0.19-0.43. The measurement that has since run puts one fresh `sol:high` reviewer at the bottom of that range (macro 19.0% before triage, micro 14.9%) and, more to the point here, shows the verifier removing almost nothing: across 20 trials and 100 findings it dropped no independently blocking ledger target (0/36 in the `sol:high` arm, 0/10 in the `terra:medium` arm) and refuted 1 of 25 blocking mechanisms outside the ledger (`.omp/team-config/evidence/gate/plan-review-loop-measurement/experiment/RESULT.md`). After implementation the blockers are mostly real: 87 of 126 were product defects, and the rest were verification, artifact or evidence gaps that the threshold already handles. The gate already demands substantiated blockers with line evidence, and `sol:high` reported 0 unsupported blockers across today's 6 reviews. A verifier would add one dispatch per blocker to confirm what usually holds. `Blocker disposition` and the user's Override remain the release valves.

The same figures weaken the verifier on the plan-review side, which plan-review-proportional kept. That is not this change's surface: it is listed as a follow-up measurement in tasks.md, to be decided on the plan-review corpus rather than inherited from this decision.

Alternative: verify only disputed blockers. Rejected, because nothing defines "disputed" without a second review.

### D7: F1 follows the depth, runs on the merged tree and re-runs only what a fix or merge can change

`standard` QA runs one row per requirement plus Phase 1's existing minimum. `risky` runs one row per scenario. SKILL.md:162's "a fix committed after a capture stales that capture" narrows: a fix stales a row only when its diff can change the behaviour that row observed. The orchestrator writes every carried row with a one-line reason. The fix-delta brief gets a `{CARRIED ROWS}` input, so the delta reviewer can object to a carry. This fits the validator, which binds QA artifacts by path and digest and does not care which wave a row came from.

Fix waves step 1 (SKILL.md:450) already merges the default branch before the first `GC baseline` and before each later snapshot, so every wave reviews the tree that will merge. F1 runs earlier, as its own final-verification task, so its rows can observe a tree without main's latest commits, and no rule says what a merge commit does to a capture. Narrowing staleness to fixes would let a merge carry every row silently. Two rules close that gap:
- the final verification wave starts by merging the default branch (the same `git merge-base --is-ancestor` check), before F1 captures any row; `plan-merge-gate.md` and the `omp-gated` tasks template say so in the F1 row;
- a later merge of the default branch stales rows like a fix, by its diff against the pre-merge head. Before the first F2 wave the carried rows and their reasons go into the wave's `{QA MATRIX}`, which both briefs receive. After the baseline the merge is reviewed with the round's fix delta, as step 1 already says, and its carries go into `{CARRIED ROWS}`.

Alternative: re-run everything per wave, as today. Rejected: plan-review-proportional's 4 F1 re-runs were mostly unchanged behaviour.

### D8: One change, one cutover

All edited files are instruction or configuration text of one gate flow: review-work, integration-review, plan-merge-gate, the delegation rule, the schema and its templates, `auditor.md` and the README. Splitting them would ship states that contradict each other:
- `plan-merge-gate.md` still requires F3 while `review-work` no longer briefs for it;
- `auditor` moves to `sol:high` while the briefs still assume `oracle`;
- `review-work` dispatches both lanes in one batch while `delegation.md:17-20` forbids a batch of items whose file-sets intersect.

They are one cutover, not separately shippable subsystems. The delegation rule gets one narrow sentence: read-only reviewers of the same committed inputs do not overlap, because none of them edits. Editing tasks keep the serialization rule unchanged. The `omp-gated` plan review already dispatches two read-only reviewers over one change folder in a single batch, so the sentence writes down existing practice.

### Build vs. adopt

The change introduces no mechanism the `Build vs. adopt` paragraph covers. It implements no published protocol, format or algorithm and no general-purpose infrastructure. It rewires project-specific review instructions and one agent's model pin.

## Risks / Trade-offs

- [The `strategic-risk-review` lane loses its cross-check of audit false positives once it runs in parallel] → `sol:high` reported no unsupported blockers in the measured runs. The Override path and `Blocker disposition` handle a false blocker. The fix-delta check sees every fix.
- [Two briefs on one model share blind spots: D2a, C3 and E1's wave-2 blockers were missed by every Sol run] → Named residual in `gate.md`. The budget ask shows the user what remains. A second family stays possible once one is measured as worth its cost.
- [Dropping a lane cuts breadth, the measured-weak axis: on plan review one fresh reviewer reached 14.9% of an 85-target ledger against 21.2% for three independent reviewers of the same model and brief, at 9.3% unsupported findings] → Named residual in `gate.md`. The cheap counter-measure, running one brief twice in parallel, is refused by `validate-gate-record.mjs:648-659`, which admits no duplicate invocation, so it belongs to Slice B. Until then the breadth bet rests on the pin, and the plan-review corpus bounds the mechanism only.
- [The pin makes the gate depend on one served model] → The review fails closed with a message instead of running on a substitute. Changing the pin is a one-line edit in `auditor.md`. Measured frequency on the largest inputs is 9 of 26 dispatches (D4), so the migration plan's prevention step decides whether failing closed costs a message or a second full lane.
- [A carried F1 row hides a regression the fix caused] → The carry reason is written down, and the delta reviewer sees the carried rows next to the fix diff.
- [`whole_diff` and the delta review before a closing wave remain as vestiges until Slice B] → Accepted. They are correct, only redundant.
- [Gates already in flight under the old text] → None: `openspec list --json` shows no active change. A plan-mode gate already baselined finishes under the text it started with, by a note in the README cutover entry.

## Migration Plan

1. Before the first `risky` gate runs under this text, make the pin hold instead of only being checked (D4): the deployed omp must contain main `7c737ac11f`, and every profile that runs gates carries `retry.fallbackOn: usage-limit` from the seed (main `ddbd95d024`, `team-config/seed/config.yml:25`) or drops the chain entry that maps `gpt-6.1-sol` to `claude-opus-5` (`:33-34`); the deploy seeds `config.yml` only where none exists, so an existing profile is merged by hand. Neither is a file of this change; skipping the step leaves the INCONCLUSIVE retry as the only defence and pays for it per large diff.
2. Merge, then run `scripts/deploy-local.sh` for this agent directory. For onara and weaver, rerun `install-openspec-workflow.mjs`.
3. Restart running sessions so they load the new `auditor.md` and skill text.
4. Rollback: revert the merge and redeploy. No record, ledger or trailer format changes, so records written under either text stay valid.

## Open Questions

- **Does the decomposed review help `sol:high`?** The candidate list, then one verification per candidate. Measure first: stage 1 only (`runs/review-argon-20261102/lean/prompts/stage1.md`, frozen) on `sol:high` for D2a, C3 and E1, 2 runs each. Count whether the targets every Sol run missed appear among the candidates. If they do, a later change can add it as an option for `risky`. It does not change this change's specs or tasks.
- **Slice B scope**: which validator and ledger fields to retire, and whether the budget and the model pin move into code. These are decided in their own change, after this one has run on real gates.
