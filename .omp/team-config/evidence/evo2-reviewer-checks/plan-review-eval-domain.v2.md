---
description: Plan-review domain checks for evaluation, benchmark and metaharness work - environment contract, executed files, liveness, metric scope, replacement, run identity
agents: [plan-reviewer]
alwaysApply: true
---

# Domain checks: evaluation runs

Trigger for this whole rule: the plan or delta changes files under `packages/metaharness/`, or plans a run of an agent, verifier or benchmark inside a container, on a remote host, or through a runner or manager process. Otherwise ignore this rule entirely.

Labels are DOMAIN 1-6. Same form as CHECK n: each check fires only on its trigger; a triggered check without the required answer is a blocker naming the label and the plan slot. Blockers are ordered by severity; among equal severity, DOMAIN blockers follow CHECK 1-8.

On a fix delta, check the diff before the tables: for every removed or weakened line in a triggered area (a `DELETE`, cleanup, reset, guard, check, or refusal), state what it protected and whether the delta replaces it. A removal without a replacement is a correctness blocker that names the removed line and the concrete scenario it breaks; a missing table is a separate, lower blocker.

- **DOMAIN 1, environment contract.** Trigger: a command placed in a phase (build, agent, verifier, calibration, prod). Required: a table `Phase | Network | Runtime/Platform | Commands | Need met?`; a check that guards a phase runs in that phase's environment; a control that runs in the target environment, where a host-only success must fail.
- **DOMAIN 2, executing is a sink.** Trigger: a run in a foreign environment. Required: an inventory `Runtime file | origin | tracked/untracked/ignored/generated | in identity? | mounted?` that covers ignored, generated and built files (native addons, generated JS); a control that starts the real agent in the target environment, not fixtures.
- **DOMAIN 3, liveness is provenance.** Trigger: a runtime dependency (proxy, token, gateway, network) or a detached process. Required: `Dependency | lifetime | holder | check before | check after | phase on loss`; loss is an infrastructure failure, never the subject's result; state held only in a parent's memory does not survive the parent's restart; a control that removes the dependency mid-run, after which the trial must not count as a model outcome.
- **DOMAIN 4, one number, one scope.** Trigger: a compared or optimised metric. Required: `Metric | scope | source | deduplicated over | missing value =`; sibling metrics share one scope; a control where a variant shifts work into subagents and every metric moves alike.
- **DOMAIN 5, replacing means dominating.** Trigger: a record that replaces an earlier one (replay, snapshot, retry, upsert). Required: `Key | order | tie | conflict`; replace only when at least as rich in every component; a conflict keeps the old record and is counted; a control with a later replay missing a field and one with an equal total but a different split.
- **DOMAIN 6, run identity.** Trigger: any change to run naming, claim, upsert, cleanup or launch. Required: `Entry | may reuse an existing name? | deleted | kept`; only explicit resume re-enters an existing run; a control where a finished run has trials, a fresh launch reuses its name, and no old reward appears. Ask first: after this change, can a fresh launch under a used name read rows, files or rewards of the old run?
