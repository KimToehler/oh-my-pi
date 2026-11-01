# Design

## Context

See proposal.md (Why). The plan-review loop lives in the `review` artifact instruction of `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` (steps 1-6): three fixed lenses per round, OKAY only on 3/3, Accept eligibility from the `Blocker disposition` section of `team-config/agent/skills/review-work/SKILL.md:417-443`, an early per-blocker ask, and from round 3 an approach question. Facts the design rests on:

- `plan-reviewer` (`packages/coding-agent/src/prompts/agents/plan-reviewer.md:5`) runs on `@advisor`, which the team seed sets to `onara/cx/gpt-6.1-terra:medium` (`team-config/seed/config.yml:11`). A model on the `task` item wins over `task.agentModelOverrides` and the agent's own model (`packages/coding-agent/src/config/model-resolver.ts:1286-1294`). The seed config is copied only when missing (`team-config/README.md:47`), so a seed edit does not reach existing installs.
- `plan-reviewer` already reports blockers with `area`, `defect`, `evidence` and `change` (`plan-reviewer.md:18-38`), and its blocking threshold (`plan-reviewer.md:90`) is the severity scale this design reuses.
- `validate-openspec-change.mjs --reviewed` checks five top-level bullets of `review.md` (`:374`), accepts `plan-reviewer` plus one or more distinct ids (`:388-400`), reads `## Blockers` up to the next heading (`:359-365`) and ignores other bullets and sections. `review.md` is outside the review digest (`:342-345`).
- `Blocker disposition` also governs F2, F2 delta reviews and F3 (`SKILL.md:419`, `:439-441`, `:478`), which this change leaves as they are.

## Goals / Non-Goals

**Goals:** a bounded plan review whose default outcome is "good enough" without a user decision; blocking reserved for confirmed, evidenced, threshold-meeting findings; review effort scaled by risk.

**Non-Goals:** changing F1, F2, F3, the gate record, trailers, `gate-convergence.mjs` or `validate-gate-record.mjs`; changing the bundled `plan-reviewer` prompt; measuring the new loop's recall (a follow-up on the existing corpus, not part of this change).

## Decisions

### D1. Depth is derived and recorded, not a gate.md field

`risky` when Mandatory class is not `none` or the change alters a review, gate or release mechanism (the predicate `SKILL.md:431` already uses); else `standard`. The planner records it as a `- **Depth**: <standard|risky> (<reason>)` bullet in `review.md`; reviewers can dispute it like any claim. Alternative: a new `gate.md` field. Rejected: `gate.md` is parsed by both validators and the gate record, the schema forbids a `Review tier` field, and the class already carries the risk.

Changes too small for OpenSpec never reach this artifact: the `openspec` skill keeps them in plan mode (`team-config/agent/skills/openspec/SKILL.md:19`). There is no third, review-free depth inside `omp-gated`.

### D2. Model pinned through agent configuration, not the task item

The `task` tool accepts a per-item `model` only for `seance` (it refuses any other agent), so the dispatch cannot carry the model. Resolution order is request model, then `task.agentModelOverrides`, then the agent's frontmatter `model:` (`packages/coding-agent/src/config/model-resolver.ts:1284-1310`), and patterns keep a thinking suffix (`:1240`). `blocker-verifier` is a team agent, so its frontmatter sets `model: onara/cx/gpt-6.1-sol:medium`. `plan-reviewer` is bundled upstream code (`model: "@advisor"`), so `team-config/seed/config.yml` adds `task.agentModelOverrides.plan-reviewer: onara/cx/gpt-6.1-sol:high` next to the existing `reviewer` entry. Alternatives: change `modelRoles.advisor` (it also drives the per-turn advisor), or ship a team `plan-reviewer.md` that shadows the bundled prompt (a fork of upstream text). The seed reaches new agent directories only; existing ones merge it by hand as the README already describes, which the workflow follow-up does for this machine. The review instruction does not name a model. Sol over terra and high over medium follow `runs/review-effort-20261029/RESULT.md` (high: 12 validated blocker occurrences and 7 mechanisms vs medium 7 and 4) and the review pilot's sol-only validated extras.

The override is per agent, not per lane: F2 fix-delta reviews also dispatch `plan-reviewer` (`team-config/agent/skills/review-work/SKILL.md:476`), so they move to sol:high too. Their briefs, convergence and disposition decisions stay unchanged; only the model they resolve to changes.

### D3. A dedicated read-only `blocker-verifier` agent

New `team-config/agent/agents/blocker-verifier.md`: tools `read, grep, glob`, `structured: true`, output `results[]` with `index`, `result` (`confirmed | refuted | undecided`), `blocking` (bool, meaningful for `confirmed`), `protected` (bool: the finding names a security path or a protected asset) and `reason` (with the `file:line` it checked). Its prompt states the four confirmation conditions (concrete failure scenario, evidence present at the cited location, why the plan's criteria and Verify commands miss it, blocking threshold) and restates the `plan-reviewer` threshold in one paragraph. Alternative: reuse `plan-reviewer` with a verify brief. Rejected: its schema has no per-finding result, and its notes are capped at five.

The verifier sees the plan files and the round's blockers verbatim (copied from the delivered payload, never retyped), numbered 1 to N across reviewers in reviewer order, with nothing from the planner. One verifier per round, not per finding: a round's findings share context and it keeps cost to one call. The orchestrator accepts the result only when it holds exactly one entry per index 1 to N; an omitted, repeated or unknown index makes it a result without structure (one retry, then the round is incomplete), because a missing entry is indistinguishable from an unprocessed finding and must never read as a refutation.

### D4. Residuals live in review.md

Every non-blocking finding goes under a new `## Residuals` section of `review.md` with the verifier's result and reason. `review.md` is outside the digest, so recording residuals never stales the review; writing them into `gate.md` would. Residuals do not reach F2 reviewers; by definition they block nothing.

### D5. Budget

- `standard`: round 1 with one reviewer (all-scopes paragraph). Confirmed blocking findings are fixed; then one fix-delta check: one fresh `plan-reviewer` with the schema's delta brief (fix entries plus the artifact diff since the reviewed digest, judged under PROCESS 4). Its findings go through the verifier like a round.
- `risky`: round 1 with scope A and scope B; confirmed blocking findings fixed; round 2 a full fresh two-reviewer round on the new digest.
- A round or delta check whose findings are all residuals ends the review OKAY.
- Confirmed below-threshold findings may be fixed together with confirmed blocking ones before the next check, never on their own (an edit without a following check stales the review).

Rationale: 80% of later-round blockers were latent in round 1, so a fresh full round mainly adds recall; `risky` buys one extra draw, `standard` only checks that fixes did not break the plan.

### D6. Exception asks

Asked only for: an unconfirmed finding with `protected` true or area review_scope item 4 / CHECK 1 (options Fix, keep as residual with the user's reason, Stop); a finding the verifier marks `undecided` whose stated consequence meets the threshold (same options); budget exhausted with a confirmed blocking finding open (D7); a fix that needs a scope decision the artifacts leave open (the alternatives and Stop).

A finding awaiting such an answer is recorded under `## Blockers` with REJECT before the ask, so `--reviewed` keeps failing while the answer is open, including after an interruption. The answer then rewrites the record on the same digest: "keep" moves the finding to Residuals with the user's reason and the verdict becomes OKAY when nothing else is open; Fix edits the artifacts and leads to the next check; Stop leaves the REJECT. This uses the unchanged validator contract (REJECT needs Blockers, OKAY needs none).

Interpretation recorded for review: the agreed trigger "verifier and reviewer disagree" is implemented as `undecided`, because every refutation is a disagreement by construction and escalating all of them would ask the user at nearly every round. A confirmed security finding is fixed without asking; only an unconfirmed one goes to the user, so no security finding is dropped by the verifier alone.

### D7. Override only at exhaustion

One ask quoting each open confirmed finding (area, defect, evidence verbatim, verifier reason) with Fix (then one more delta check), Override, Stop. Override writes the user's reason to `review.md` with the artifacts unchanged, as `--reviewed` already supports (`validate-openspec-change.mjs:404-431`). Never offered while an open finding is `protected` or in the security scope. This keeps the strongest exclusion of the old disposition without its full list.

### D8. Clean cutover of the old plan-review paths

Removed from the schema and specs: three lenses, early ask, approach question (Continue, Re-plan, Split, Stop), resume rule, plan-review Accept into `gate.md`. `SKILL.md` `Blocker disposition` drops plan review from its lane list, accept paths and explicit-request paths; the README review section is rewritten. A user who wants to re-plan or split answers Stop and edits the artifacts, which starts a fresh review.

### D9. Validator unchanged

The current `--reviewed` contract already accepts the new record (D1, D4, one or two ids). Alternative: enforce depth versus reviewer count and class. Rejected: part of the depth predicate is judgement, and the user asked for less machinery; the class-to-depth rule is checked by the reviewers and by F1.

### Scope check

Two independently testable parts: the schema's review instruction with its template, and the `blocker-verifier` agent. They share one contract (the verifier's output fields the instruction reads) and ship in one cutover. `SKILL.md` and README edits only remove plan-review references. No split.

## Risks / Trade-offs

- [Lower recall per change: one or two reviewers and at most two checks] → F2 and F3 unchanged behind it; sol:high replaces terra:medium; the corpus measurement follow-up quantifies the loss.
- [Verifier refutes a real defect] → refutations are recorded with reasons; security and protected findings never drop without the user; follow-up measures the false-drop rate.
- [Reviewers and verifier share a model family, so errors correlate] → accepted; both differ from the Opus planner. Revisit with the measurement.
- [Pinned model renamed by the router] → the task fails, the round is incomplete and the user is told; nothing passes silently. The retry fallback chain may swap the model on a stalled run → F1 checks the resolved model of each dispatch.
- [Threshold text duplicated in the verifier prompt] → accepted for now; `plan-reviewer.md` is upstream code this change does not edit.

## Migration Plan

1. Merge; `scripts/deploy-local.sh` installs the schema, the agent and SKILL.md into the agent directory.
2. Repositories with their own `omp-gated` copy (onara, weaver) run `node ~/.omp/agent/skills/review-work/scripts/install-openspec-workflow.mjs`.
3. In-flight changes: an existing `review.md` stays valid (`--reviewed` unchanged); a re-review after this change follows the new instruction.
4. Rollback: revert the merge and redeploy.

This change's own plan review (user decision, 2026-11-01): depth `risky`, `plan-reviewer` on `onara/cx/gpt-6.1-sol:high` (through the user's `task.agentModelOverrides`, added for this review), at most two rounds; blockers whose cited evidence the orchestrator confirmed at the named lines are fixed (the verifier agent does not exist before apply); after round 2 the user decides.
