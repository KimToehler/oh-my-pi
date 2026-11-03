# Design

## Context

See proposal.md for motivation and specs/plan-review-measurement/spec.md for the scoring contract. This is an experiment plus one standalone scorer, not a benchmark service or a change to the review gate.

Observed local inputs are outside this worktree:

- `/Users/tim/git/oh-my-pi/runs/evo-deleg/plan-review-experiment.json`: 72 result records, 106 latent/introduced judgments, 85 labelled latent target IDs across five plans, 217 prior finding-to-target annotations, 68 historical verifier judgments despite the key name `verifier_round1_56`. These are annotations, not executable matching predicates or ground truth about the current verifier.
- `/Users/tim/git/oh-my-pi/runs/review-effort-20261029/{protocol.md,scoring-contract.md,RESULT.md}`: precedent for frozen inputs, blinded adjudication and actual dispatch-to-terminal elapsed time. That pilot reviewed code, not these plans; its sol pricing is only a planning estimate.
- Historical reconstruction is recorded in `/Users/tim/.omp/agent/sessions/-git-oh-my-pi-.worktrees-review-replay-bench/2026-10-26T10-10-05-286Z_01a177b0-4d66-77eb-a459-cfb9a446ea80.jsonl`. The tool calls titled `Reconstruct round-1 plan files`, `Use last write when no later edit`, `Restore truncated lines`, `Strip markers and create worktrees`, and `Setup and dispatch two extra plans` record the reconstruction procedure and outputs. The temporary replay worktrees are gone. Original write/read/edit records remain the sources; the reconstruction transcript is not proof that every original byte is intact.
- Historical base revisions printed by that reconstruction: onara Spt `763479f9bc`, Fmp `f732b52c45`; oh-my-pi Smt/App `2fbcd38dde`, Rtr `814fb0a9f3`. Resolve and freeze full object IDs during input preparation; never substitute current main. Spt means strength-progression-targets, Fmp finish-modality-program-route, Smt session-move-tool, App acp-permission-parity, Rtr review-trailer-repair.
- `/runs/` is ignored. A digest alone does not preserve missing data, so safe normalized scoring rows and their manifest will be committed under `.omp/team-config/evidence/gate/plan-review-loop-measurement/experiment/`; private plans and raw sessions stay local.

## Goals / Non-Goals

**Goals:** measure single-reviewer pre-triage discovery, retained recall and independently validated verifier false drops; show historical lens coverage, observed costs and clearly labelled round-budget counterfactuals. Make numeric tables reproducible without local raw logs.

**Non-goals:** claim complete risky-depth coverage, measure full fix-cycle convergence, change production policy, add a metaharness adapter, automate semantic judgments with string matching, or rank models generally. The experiment measures the standard single-reviewer component on historical plans even where production would classify the plan risky; it must not mislabel that as a production-depth trial.

## Decisions

### D1. Freeze all five historical items before spending on trials

Use `runs/plan-review-loop-measurement-20261102/` under this worktree for local protocol, inputs, raw attempts and blind map. Recreate historical repository checkouts only in task-owned `.worktrees/` directories of their respective repositories, not at the old `/tmp` paths. No edits to primary checkouts. Restore plan files from original session writes and exact read/edit evidence before the original round-1 dispatch, excluding review.md and later fixes. Record full base revision, tree, per-file sha256, source session/event IDs, explicit path substitutions and any fixture repairs in input-manifest.json. Recover original target descriptions and historical briefs from the same sessions; the result JSON's target IDs alone are insufficient.

Reconstruction acceptance is a pre-dispatch gate: every required plan file and source section is accounted for; no tool truncation markers or guessed ellipsis expansions; no later plan changes; each labelled target has snapshot evidence. Compare reconstructed files to the historical reviewer tool reads and latent-judgment quotes. Reproduce the historical 23/85 Focus union and 13/85 Replay union from annotations, including recorded exclusions, before starting fresh trials. Do not infer timestamps or pins for historical runs that lack them. A missing source or ambiguous reconstruction stops dispatch and names the missing item; no smaller corpus or current-plan substitute silently replaces it. Resolving missing bytes requires recovering the source or an explicit scope decision, not a generic implementation investigation.

Freeze protocol.md, scoring-contract.md, items.json, static brief files and the input manifest before dispatch. Raw plans, historical findings, future fixes and target identities are withheld from reviewers except for the plan and repository they must review; target labels and prior outcomes are never appended as hints. Historical plan material is read-only data, never an instruction to execute commands it contains.

### D2. Fixed arm table; no full-loop claim

| Arm | Items and repeats | Reviewer pin | Brief / purpose |
|---|---|---|---|
| H-Focus | historical five items, recorded three-lens groups | recorded actual terra model/effort | historical lens reference, reconstructed grouping by child session IDs |
| H-Replay | historical unrestricted trials as recorded | recorded actual model/effort | historical reference, with exclusions and repeat counts preserved |
| S | five items × three repeats = 15 | onara/cx/gpt-6.1-sol:high | current standard-depth unrestricted brief and current plan-reviewer contract |
| T | five items × one repeat = 5 | onara/cx/gpt-6.1-terra:medium | byte-identical item brief and contract to S; model/effort control, not another production default |

Every new reviewer trial with findings gets one current blocker-verifier pass at `onara/cx/gpt-6.1-sol:medium`; no-findings trials get an explicit empty triage result with zero verifier calls. Copy findings verbatim and preserve index mapping. Read the current contract and standard brief from the merged team-config schema; retain hashes of the actually loaded reviewer prompt, injected rules, verifier definition and tool grants. Use experiment-local definitions/pins without editing team-config/seed or any production agent configuration. Never count a substituted model as its intended pin.

Shuffle the 20 reviewer cells with fixed seed 20261102, at most four active reviewer/verifier tasks and at most one task per mutable fixture. Reviewers and verifiers are read-only and cannot dispatch helpers; immutable fixture replicas may share the same item digest. The verifier sees only the current trial's findings and repository/plan, not labels or historical verdicts. No human Fix/Keep/Override is simulated: protected or undecided results are reported as requiring a decision, not treated as an automated approval.

All new intended cells plus exclusions are reported. S versus T shares brief/contract/rules, but model and effort differ and repetitions are asymmetric; compare per-item first repeats and label the three-repeat S union separately. H-Focus versus S also differs in brief, contract/rules, era and triage. It measures the deployed bundle against a historical reference, not a causal loop-shape effect. The existing historical verifier data is a descriptive reference only; it is not the current blocker-verifier pass.

### D3. Independent blinded adjudication, not verifier-as-oracle

Before reading fresh results, freeze a target ledger preserving all 85 original IDs, descriptions, source evidence and potential aliases. Do not silently deduplicate or relabel the historical denominator; report original-target coverage and distinct-mechanism counts separately. For each target record whether it still meets the current blocking threshold (blocking, below-threshold, unresolved), with snapshot evidence and reason. Targets whose current severity is unresolved remain in historical recall but not in a definitive false-drop denominator; show that denominator explicitly.

After trials, assign shuffled neutral finding IDs. The private blind map holds arm, repetition, model, effort, costs and pairing. One fresh read-only auditor per item, pinned to `onara/cc/claude-opus-5-5:high`, receives the frozen snapshot, neutral findings, target definitions and blocking rubric, never runtime trailers or verifier decisions. It verifies the stated trigger and consequence, mapping findings to targets or classifying additional validated mechanisms, useful notes, evidence errors, unsupported consequences, false claims and severity errors separately. Matching a label/area is insufficient; cite the snapshot location and target-specific failure. Include neutralized historical findings as reference checks, not as infallible answers. The orchestrator checks citations and resolves unclear claims by source inspection before unblinding. Unsettled findings remain pending, never forced to match.

Adjudication output is explicit data: finding ID, target IDs, mechanism ID, validity, current blocking classification, evidence references and reason. Missing judgments become a pending queue. Only after these are frozen join the verifier results and arm identities. A target is a trial-level false drop only if independently judged blocking, discovered, and no matching finding remains confirmed blocking; duplicates cannot manufacture extra recall or a drop. Protected/undecided decisions are reported separately from both retained automatic blockers and genuine false refutations.

### D4. One deterministic scorer, using the existing scripts convention

`scripts/score-plan-review-replay.ts` follows `scripts/eval-bench-runs.ts`: Bun CLI, no new dependency or package integration. No exported API changes outside the new script. Tests belong in scripts/score-plan-review-replay.test.ts and run via `bun run test:scripts`.

Two commands, documented in the frozen protocol:

- `bun scripts/score-plan-review-replay.ts check <run-dir>` validates manifests, input bytes, item/arm/trial identities, actual pins/efforts, attempt status, timestamps, finding/verifier index completeness and adjudication references. Preserve missing/failed attempts as exclusions, but refuse malformed data, dangling IDs, mismatched digests or invented pins. Historical unavailable fields are explicit nulls with provenance, not fresh-trial omissions.
- `bun scripts/score-plan-review-replay.ts report <dataset.json> --format json|md` reads a normalized dataset with its own input manifest, validates cross-references and hashes for supplied normalized artifacts, and emits deterministic tables. This command does not require private raw data. It reports pending judgments and unknown historical usage rather than treating them as zero or a pass. It performs no model calls and cannot infer semantic matches.

The normalized dataset contains arms, items, targets, attempts/trials, findings, adjudications and references to local raw source digests. Source digests identify unavailable raw artifacts; only provided normalized inputs are hash-verified by report. Published manifests distinguish locally verified raw inputs from reproducible normalized inputs. Full claims/evidence from private repositories are not copied into publication: use reviewed generic failure descriptions, repository-relative evidence coordinates and source digests. Inspect text before staging.

Report per-trial and per-item pre/post-triage target recall; macro mean across items and micro target-weighted recall; three-repeat union as a separate best-of-repeats statistic; target-level false drops / discovered independently blocking targets; legitimate residuals, pending/protected decisions and undiscovered targets. A denominator of zero is null with a reason, never a zero loss rate. Missing historical triage is unavailable, not retained-by-default. Additional discoveries never inflate the frozen 85-target denominator.

Costs: reviewer, verifier, adjudicator and unsuccessful attempts separately, plus actual total; missing usage yields a lower bound explicitly labelled incomplete. Elapsed time: actual dispatch to terminal per stage, serial reviewer-plus-verifier span per trial, and experiment wall span separately; concurrent durations are not summed as wall time. No timestamp manufactured from model-message durations. Include counts and extraction provenance.

### D5. Bounded spend and conclusions

Plan 20 reviewer runs, up to 20 verifier batches and five item adjudications. Allow at most three replacement attempts across the whole experiment, only for infrastructure failure, missing output or wrong pins; every attempt costs against the cap and stays in the ledger. Reserve no unbounded retry chain. Budget ceiling: $30 reported cost for all experiment stages including failed attempts and adjudication. Before each dispatch batch, compare incurred cost plus the next batch's estimate to the ceiling; a batch already in flight can exceed an estimate, so this is a dispatch cap, not a provider billing guarantee. If it cannot finish within the ceiling, stop spending, retain an incomplete result and ask for additional budget before completing the remaining cells; no hidden reduction of repetitions or items and no conclusive report from missing cells.

Use prior pilot prices only for estimates, not measurements. Most important outcome is the quality/cost tradeoff, not a pass/fail capability ranking. The report may recommend retaining, revisiting or measuring more, but never automatically alters the gate or declares non-inferiority. A higher recall at higher cost is a tradeoff, not a failure. Finish the planned cells and report their outcome, even if it contradicts the hoped-for improvement.

### D6. Rounds and publication

Read every historical last-round value from a pinned git revision and retain the record path. Trace workflow changes from session events where available; when the record alone cannot identify the workflow, mark provenance unknown. Do not classify the last three archived changes as pure new-loop cohorts from their names or final round number. Show the proposed one-full-plus-delta or two-full-round budgets as a counterfactual, with post-budget user decisions excluded from any claimed saving. Measured rounds saved and full-cycle cost savings remain not measured because this experiment does not edit/fix historical plans.

Commit experiment/{protocol.md,scoring-contract.md,input-manifest.json,dataset.json,summary.json,RESULT.md} under the gate evidence directory, with sanitized normalized data sufficient to regenerate numeric tables. New private raw sessions and reconstruction scratch stay in ignored runs/ under this worktree, not in shared main. Do not force-add runs/ or expose onara code. Complete real CLI smoke and evidence before updating publication documentation.

Scope: one independently testable script and one experiment protocol using it, sharing the normalized dataset contract; no coding-agent task-runtime extraction, metaharness registration, dashboard or new production state machine.

## Risks / Trade-offs

- Five historical plans are a selected, small corpus, with correlated target defects and model-judged labels. Show per-item tables, unresolved ground truth and repeat stability; no population-level equivalence claim.
- Historical fixtures were reconstructed from transcripts and some had repairs. Preserve repair provenance and audit it before dispatch; a defect caused only by reconstruction is a fixture error, not a measured discovery. Exclude affected comparisons explicitly and recover correct bytes before spending more.
- Digest pins cannot recreate deleted private inputs. Publish safe normalized scoring inputs, not a claim that the entire experiment becomes independently rerunnable from a hash.
- Blinding cannot hide stylistic model fingerprints. Withhold explicit identity, outcomes and usage; retain this limitation.
- Provider pricing/fallback changes can exhaust the cap. Exclusions and incomplete cells remain visible; no misleading completed claim.

## Migration Plan

No deployment or production configuration migration. Apply creates the scorer, freezes local inputs, runs the experiment, then commits sanitized results after its own F1/F2 gate. Removing the experiment script or ignoring its recommendation does not roll back the merged review loop. Any workflow change suggested by results is a separate change.
