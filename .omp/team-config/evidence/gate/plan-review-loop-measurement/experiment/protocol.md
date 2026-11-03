# Plan-review loop measurement — frozen protocol

## Scope

Five historical round-1 plans, 85 original labelled latent target IDs. This measures a single-reviewer standard component, not complete production risky-depth coverage or a fix/review convergence loop. No production policy/configuration changes.

## Inputs

`items.json` pins repository commits/trees, plan-file SHA256s, item snapshots and path-only brief substitutions. `input-manifest.json` identifies frozen supplied inputs and locally available historical raw sources. Original plans and sessions remain local. `targets-private.json` preserves original descriptions, source session/event IDs and all target quotes. Its initial current-severity classification is explicitly unresolved: historical labels are not current-threshold truth. Independent blind source-based judgments may resolve these classifications, with the initial frozen ledger retained; unresolved targets never enter a definitive false-drop denominator. IDs and historical denominator never change.

Plan reconstruction uses only original writes and successful edits before first original dispatch, with exact full/split reviewer-read witnesses. Normalize only terminal newlines. One metadata-only recovery: Fmp `.openspec.yaml` comes from its first committed change, `5e6445dcb`; it was not printed by the original reviewer. No functional plan section comes from a later revision. No guessed truncation expansions. Every one of the 85 latent quotes appears in its restored snapshot.

## Arms

- H-Focus: recorded three-lens groups; actual original child identities explicitly retained. First three items use F61* children; last two use FocusFmp*/FocusRtr*.
- H-Replay: recorded unrestricted B61* (first three items) and ReplayFmp*/ReplayRtr* (last two). ReplayFmp3bbb is retained as a wrong-pin exclusion, not a completed terra trial.
- S: five items × three repeats; `onara/cx/gpt-6.1-sol:high`.
- T: five items × one repeat; `onara/cx/gpt-6.1-terra:medium`.

New S/T briefs are byte-identical within each item, copied from the merged schema's standard paragraph. Native read-only plan-reviewer definition; per-dispatch model/effort pins are experiment-local overrides. No helper dispatch. Retain actual session_init system prompt, tools, agent contract, actual model/effort events and source hashes; a fallback never counts as its requested arm.

Shuffle: seed 20261102, Fisher-Yates over item order Spt/Smt/App/Fmp/Rtr and cell order S1/S2/S3/T1; uint32 LCG `1664525*x+1013904223`. `items.json` records the resulting order. At most four active reviewer/verifier tasks and one active task per fixture. A blocked same-item cell waits without changing the recorded ordering.

Each successful reviewer with findings gets one blocker-verifier pass at `onara/cx/gpt-6.1-sol:medium`, verbatim findings with consecutive index mapping. Empty findings yield explicit empty triage and zero calls. Protected/undecided cases require a decision, never simulated approval.

## Budget and attempts

$30 reported-cost dispatch ceiling across reviewer/verifier/adjudicator attempts, including failures. Before every batch record incurred cost, next-batch estimate and decision. At most three replacement attempts total, only infrastructure/missing-output/wrong-pin failures. An in-flight batch can exceed its estimate; this is not a provider billing guarantee. Stop dispatch if cap cannot accommodate the next batch; retain incomplete cells and ask for budget, never reduce corpus or repetitions.

## Blinding

After reviews, neutralize and shuffle fresh plus historical reference findings; retain the private arm/pin/cost/verifier map. One fresh read-only item auditor at `onara/cc/claude-opus-5-5:high` receives snapshots, neutral findings, target definitions and current blocking rubric, without identities, costs, verifier outcomes or runtime trailers. It returns explicit validity, targets, mechanisms, current severity, evidence and reasons. Check its citations before unblinding. Unresolved matches remain pending. Preserve original target counts separately from distinct mechanisms and additional discoveries.

## Commands

```sh
bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
bun scripts/score-plan-review-replay.ts report runs/plan-review-loop-measurement-20261102/dataset.json --format json
bun scripts/score-plan-review-replay.ts report runs/plan-review-loop-measurement-20261102/dataset.json --format md
```

`check` validates normalized identities, metadata, joins and supplied/local raw hashes. `report` validates supplied normalized artifacts only, never needs private raw logs or calls a model. Missing historical fields stay explicit unavailable with extraction provenance. The historical annotation file is read-only; reproduce 23/85 Focus and 13/85 Replay from individual finding mappings, never the stored recall table.

## Publication

Publish reviewed generic mechanism descriptions, relative evidence coordinates, normalized numeric rows, source digests and counts. No private code or complete historical claims. Recompute committed summary without raw inputs. Inspect every published text field. Costs lacking usage are incomplete lower bounds; timestamps are actual dispatch/terminal events or unavailable, never fabricated from response durations. Concurrent stage times are not experiment wall time.

S/T differs in model, effort and repeat count; H-Focus/S also differs in brief, contract/rules, era and triage. No causal loop-shape claim or model ranking. Last-round values require pinned record provenance; workflow unknown unless source traced. One-full-plus-delta and two-full budgets are counterfactuals. Measured rounds saved/full-cycle savings remain not measured.
