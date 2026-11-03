# Spec Delta

## Purpose

Sets how deep the post-implementation merge gate (F1 manual QA and the F2 `review-work` lanes) reviews a change: which lanes run on which model, how many fix rounds it allows, when the user decides, and which QA rows run and re-run.

## ADDED Requirements

### Requirement: Gate depth follows the change's risk

The F2 gate SHALL take its depth from the change's `gate.md` `Depth` bullet. For a plan-mode plan, Phase 0.5 SHALL derive it by the same rule: `risky` when the Mandatory class is not `none` or the plan changes a review, gate or release mechanism, otherwise `standard`. The orchestrator MAY raise the depth on the final diff, recording why in `decision_reason`, and SHALL NOT lower it.

#### Scenario: Standard change

- **WHEN** a change with Depth `standard` reaches F2
- **THEN** exactly one `implementation-audit` invocation runs in each wave whose QA passes, and a wave whose QA fails dispatches no reviewer

#### Scenario: Risky change

- **WHEN** a change with Depth `risky` reaches F2
- **THEN** `implementation-audit` and `strategic-risk-review` are dispatched in one `task` batch, and the `strategic-risk-review` brief carries no audit findings

#### Scenario: Plan-mode plan that changes a gate mechanism

- **WHEN** a plan-mode plan with Mandatory class `none` changes how a review gate decides
- **THEN** Phase 0.5 derives `risky` and both invocations run

#### Scenario: Internal-tooling plan at risky depth

- **WHEN** a plan with Risk tier `internal-tooling` derives or is raised to `risky`
- **THEN** before any reviewer is dispatched the user is asked to re-tier it to `product`; on agreement the plan says `- Risk tier: product` before the gate's first `GC baseline`, or, when a baseline already records `internal-tooling`, `GC retier` records the agreement; on refusal the gate dispatches nothing and stops, and never runs at `standard`

#### Scenario: Negative control

- **WHEN** an orchestrator runs only `implementation-audit` for a change whose `gate.md` says Depth `risky`, because the final diff looks small
- **THEN** that gate MUST fail

### Requirement: The whole-diff surface is reviewed inside F2

A gated plan SHALL have no separate F3 lane. At `standard` depth the `implementation-audit` brief SHALL carry the whole-diff surface (cross-module seams, consistency, duplication, simplification) as hints in its correctness section. At `risky` depth the `strategic-risk-review` brief SHALL ask four numbered questions covering that surface.

#### Scenario: Gate field for a folded whole-diff review

- **WHEN** a planner writes `gate.md` or a plan's `## Merge gate`
- **THEN** `Whole-diff review` reads `not needed (whole-diff surface reviewed in F2)`, and the final verification wave lists F1 and F2 only

#### Scenario: On-demand integration review

- **WHEN** the user asks for `integration-review` on a branch outside a merge gate
- **THEN** it runs as before, and its report is not a gate lane of any plan

#### Scenario: Negative control

- **WHEN** a `risky` gate's `strategic-risk-review` brief asks only for line-level correctness and names no cross-module seam, consistency or simplification question
- **THEN** review of that instruction MUST fail

### Requirement: Gate reviewers run on their pinned model

Both F2 invocations SHALL dispatch the `auditor` agent. Its pin SHALL be the model and effort in its definition. A dispatch SHALL count only when every assistant turn in its session file ran on the pinned provider and model at the pinned effort, and its trailer `model_id` names that model. Otherwise the invocation SHALL be INCONCLUSIVE and get the one bounded fresh retry.

#### Scenario: Fallback model

- **WHEN** the retry chain moves a stalled `implementation-audit` dispatch to another model and it returns PASS
- **THEN** that reply is kept as evidence and never submitted as the invocation's trailer, and one fresh retry runs on the pinned model

#### Scenario: Same model, lower effort

- **WHEN** an `implementation-audit` dispatch ran on the pinned model at effort `medium` while the pin says `high`
- **THEN** that invocation is INCONCLUSIVE, whatever it returned

#### Scenario: Configuration overrides the pin

- **WHEN** `task.agentModelOverrides.auditor` names a model or effort other than the `auditor` definition, or the definition names no model
- **THEN** the gate dispatches nothing, and tells the user which setting conflicts with the pin or that the pin is missing

#### Scenario: Retry also substituted

- **WHEN** the fresh retry also runs on a model other than the pin
- **THEN** the invocation stays INCONCLUSIVE and `GC wave` records it without its trailer, both replies are kept verbatim as evidence, the gate does not pass, and the user is told which model ran

#### Scenario: Negative control

- **WHEN** a gate record carries a PASS verdict for an invocation whose trailer names a model other than the `auditor` pin
- **THEN** that gate MUST fail

### Requirement: Fix rounds are bounded by depth

After a failing wave the gate SHALL allow one fix round at `standard` depth and two at `risky` depth. Each fix round SHALL end in a closing wave on the fixed tree that re-runs QA and, when QA passes, every reviewer lane of the depth; a closing wave whose QA fails is a failing wave. A `gate-convergence` STOP before the budget is spent SHALL keep its existing ask.

#### Scenario: Standard fix round

- **WHEN** a `standard` gate's first wave fails, and its fixes are delta-reviewed and committed
- **THEN** a second wave re-runs QA on the fixed tree and, when QA passes, `implementation-audit`, and no third wave starts without the user, except the repeat of an incomplete closing wave

#### Scenario: Risky budget

- **WHEN** a `risky` gate's second wave fails
- **THEN** a second fix round and a third wave run, with both reviewer lanes when its QA passes

#### Scenario: Negative control

- **WHEN** a `standard` gate starts a third wave after its second wave failed, without asking the user
- **THEN** that gate MUST fail

### Requirement: A spent budget asks the user once

When a closing wave fails with the budget spent, the gate SHALL first record the wave. Then, before any fix or dispatch, it SHALL ask the user once, showing each open blocker with its disposition under `Blocker disposition`. The options SHALL be one more fix round, re-plan and Stop, plus Override where the requirement "Override at the budget follows Blocker disposition" allows it.

#### Scenario: Stop after the budget

- **WHEN** the user answers Stop
- **THEN** no tracked file changes, no reviewer is dispatched, and the gate stays failed

#### Scenario: Nothing is fixed before the answer

- **WHEN** the budget is spent and the ask is open
- **THEN** no tracked file changes and no reviewer is dispatched until the user answers

#### Scenario: Negative control

- **WHEN** a gate with a spent budget commits a fix for an open blocker and starts another wave before the user has answered
- **THEN** that gate MUST fail

### Requirement: An incomplete closing wave is repeated, not asked about

A closing wave with an INCONCLUSIVE invocation is incomplete, not failed. It SHALL get no budget ask and no Override. The gate SHALL record it, tell the user why the invocation is INCONCLUSIVE (for a pin mismatch, which model and effort ran), commit no fix, and repeat the wave on the same tree once that cause is resolved; the repeat SHALL spend no fix round and SHALL NOT count as a budget wave.

#### Scenario: Incomplete closing wave

- **WHEN** the budget is spent and a closing wave's reviewer runs off the pin on its dispatch and on its fresh retry
- **THEN** the wave is recorded with that invocation INCONCLUSIVE, no budget ask and no Override is offered, the user is told which model and effort ran, and no fix is committed before the repeated wave

#### Scenario: Negative control

- **WHEN** a gate offers the budget ask or an Override after a closing wave with an INCONCLUSIVE invocation, or commits a fix before that wave is repeated
- **THEN** that gate MUST fail

### Requirement: Override at the budget follows Blocker disposition

The budget ask SHALL offer Override only when every open blocker is eligible or covered under `Blocker disposition`. An Override SHALL be recorded through Phase 4 with one `downgrades` entry per blocker of every FAIL trailer, using `below-threshold`, `accepted-residual` or `out-of-scope`, never `frozen`. A budget ask SHALL NOT override an excluded blocker, even on the user's request.

#### Scenario: Covered blocker at the budget

- **WHEN** the only open blocker after a `standard` closing wave is covered by an `Accepted residual risks` entry, and the user answers Override with a reason
- **THEN** the record carries `override.by`, `override.reason` and an `accepted-residual` downgrade for that blocker, and validates as overridden, not as passed

#### Scenario: Excluded blocker at the budget

- **WHEN** the open blocker after a `risky` closing wave of a class-`concurrency-state` change names a delivered defect
- **THEN** the ask offers one more fix round, re-plan and Stop, and no Override

#### Scenario: Negative control

- **WHEN** a budget ask offers Override for an excluded blocker, or records a budget Override with a `frozen` downgrade
- **THEN** that gate MUST fail

### Requirement: QA rows follow the depth

F1 at `standard` depth SHALL run one row per requirement, plus a row for the happy path, one for the riskiest edge and one for an adjacent regression. At `risky` depth it SHALL run one row per scenario. Each row SHALL keep its artifact under the record's evidence directory.

#### Scenario: Standard QA matrix

- **WHEN** a `standard` change has three requirements with nine scenarios
- **THEN** F1 runs at least three requirement rows and the three minimum rows, not one row per scenario

#### Scenario: Negative control

- **WHEN** a `risky` change's QA matrix has no row for a requirement's negative-control scenario
- **THEN** that gate MUST fail

### Requirement: A fix or a merge re-runs only the QA rows it can change

The final verification wave SHALL merge the default branch into the work branch before F1 captures any row. A fix, or a later merge of the default branch, SHALL stale a QA row only when its diff can change the behaviour that row observed. Every other row SHALL be carried with a one-line reason, listed in the fix-delta brief or, before the first F2 wave, in its QA matrix, so a reviewer can object to a carry.

#### Scenario: Fix outside a row's behaviour

- **WHEN** a fix only changes an error message that no QA row observes
- **THEN** every row is carried with its reason, and the delta brief lists them

#### Scenario: Fix verification beside a carried row

- **WHEN** a fix cannot change what a carried full-suite QA row observed
- **THEN** the row stays carried with its earlier capture, and the fix round's full suite still runs as fix verification without replacing that capture

#### Scenario: Default branch integrated before F1

- **WHEN** the final verification wave starts and the default branch is not an ancestor of the work branch
- **THEN** it is merged and committed before F1 captures any row, so F1 observes the tree that will merge

#### Scenario: Default branch moves after F1

- **WHEN** the default branch moves after F1 and is merged before the gate's first `GC baseline`
- **THEN** before any reviewer is dispatched, every row whose behaviour the merged diff can change is re-run, and every other row is carried with its reason in the wave's QA matrix

#### Scenario: Objected carry

- **WHEN** the delta reviewer rejects a carry because the fix touches the carried row's behaviour
- **THEN** that row is re-run before the next wave

#### Scenario: Negative control

- **WHEN** an orchestrator carries a row whose observed transition the diff of a fix or of a merged default-branch change rewrites, and neither the delta brief nor the QA matrix lists that carry
- **THEN** that gate MUST fail
