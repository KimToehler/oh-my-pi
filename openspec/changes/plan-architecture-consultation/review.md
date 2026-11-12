# Review

- **Verdict**: REJECT
- **Reviewed digest**: 74019f0dff6f4722b517c148223d581908ad7dd0c43a3bd5ede9cafc8a33ff1e
- **Depth**: risky
- **Reviewer**: plan-reviewer, PacRevA4, PacRevB4
- **Verifier**: blocker-verifier, none
- **Models**: PacRevA4 onara/cx/gpt-6.1-sol; PacRevB4 onara/cx/gpt-6.1-sol
- **Round**: 4
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PacRevA4)

1. **CHECK 4 / CHECK 7 — Counted-report contract**
   - Defect: D5 counts an attempt when the extraction command prints any JSON object, but D9 imposes stronger requirements. A pinned attempt can therefore count even though its report cannot be recorded. For example, the proposed agent schema permits an empty counterevidence string, while D9 rejects it. A failed yield submission followed by interruption also leaves extractable tool-call arguments without an accepted structured result. The author cannot edit the copied report, and neither retry nor the two-failure ask applies once the attempt has counted. This reversibly blocks completion of an otherwise ordinary consultation.
   - Evidence: design.md:42-47 defines string-valued report fields; design.md:89-90 makes a JSON object plus the pin sufficient to count; design.md:123-129 extracts tool-call arguments without checking their acceptance; design.md:170 requires nonempty finding strings and a complete report schema. packages/coding-agent/src/tools/jtd-to-json-schema.ts:58-63 converts a JTD string to an unconstrained JSON Schema string. packages/coding-agent/src/tools/yield.ts:686-698 explicitly rejects invalid submissions, which the planned extraction command does not distinguish from successful ones.
   - Change: Define one report-acceptance contract shared by counting/recovery and record validation. Count only a completed, usable report satisfying that contract; classify an unusable report as a failed attempt eligible for the existing retry and skip-or-stop flow. Align the agent's declared contract with the record requirements.
   - Verifier: not triaged: the verifier has not returned

2. **CHECK 6 — Risky delta admission**
   - Defect: The consultation admission check exists only at the full-round dispatch in step 3. The existing workflow also dispatches delta checks directly after an exhaustion Fix, whatever the resulting depth. A standard change can finish its first delta, receive an exhaustion Fix that introduces a state machine, and become risky on the successor delta without ever entering the consultation step. Even if that delta returns OKAY, the new --reviewed presence check refuses it. This is a normal, user-authorized workflow path, not a manually corrupted state; the resulting apply blockage is reversible but breaks the automatic consultation goal.
   - Evidence: design.md:24 restricts admission to a full risky round or an explicitly requested standard consultation; tasks.md:15 implements that restriction at step 3. The existing openspec/schemas/omp-gated/schema.yaml:584-585 updates depth after fixes, while :598-601 sends an exhaustion Fix directly to another delta check 'whatever the depth'. specs/plan-architecture-consultation/spec.md:143 nevertheless requires a consultation record for every risky --reviewed check.
   - Change: Cover the direct delta-dispatch path when its updated classification becomes risky and no completed or skipped record exists. Specify how consultation edits join that authorized delta and preserve its budget and recording base; retain the no-consultation rule for genuinely standard deltas.
   - Verifier: not triaged: the verifier has not returned

3. **CHECK 2 / CHECK 8 — Fixed consultant identity**
   - Defect: The consultation reuses a pin check whose expected model comes from task.agentModelOverrides before the agent definition. An ordinary configured architecture-oracle override to Sol or another model therefore changes both the dispatched model and the expected comparison value. Its report passes the check instead of being retried or offered for skip, despite the requirement that no other model substitute for Fable. This reversibly invalidates the consultation's fixed-model value proof.
   - Evidence: design.md:7 explicitly describes override-first pin lookup; design.md:89 and tasks.md:15 reuse that existing check. openspec/schemas/omp-gated/schema.yaml:464-476 reads the configured override before the definition. packages/coding-agent/src/task/structured-subagent.ts:635-638 supplies that override to selection, and packages/coding-agent/src/config/model-resolver.ts:1357-1359 selects it before the agent model. This conflicts with design.md:41 and specs/plan-architecture-consultation/spec.md:77,91.
   - Change: For architecture-oracle, compare every observed model with the fixed required Fable identity, not an override that can redefine success. Detect an incompatible configured override and handle it explicitly through the failed-attempt or prerequisite flow. Leave other agents' configurable-pin behavior unchanged.
   - Verifier: not triaged: the verifier has not returned

4. **CHECK 2 / CHECK 6 — Attempt name versus allocated id**
   - Defect: D5 defines an attempt's id as the task item's requested name, persists it, and then resolves history:// using that id. The runtime can allocate a different id by adding a collision suffix or parent prefix. For example, two worktrees consulted at the same commit in one parent session request the same name; the second dispatch receives a suffixed id, while the recorded unsuffixed id refers to the first dispatch. The normal path can then read and count the other change's pinned report because only recovery checks the brief's change directory. The plan explicitly anticipates the name collision but does not resolve this distinction. Misapplied consultation advice and consumed attempt budget are reversible, but break the per-change consultation contract.
   - Evidence: design.md:87 states that the attempt id is the task item's name and acknowledges identical names for two changes at the same commit; :88 resolves history://<id>; :89 checks only the model and extracted JSON on the normal path; :90 adds change-directory binding only on recovery. packages/coding-agent/src/task/output-manager.ts:4-8 documents suffixes and parent prefixes, and packages/coding-agent/src/task/index.ts:1282-1283 obtains the actual id from outputManager.allocate(item.name...).
   - Change: Distinguish the pre-dispatch attempt key/requested name from the actual allocated subagent id. Persist the returned id and its exact session file before consuming a result, and apply the same change-directory/session binding on both normal completion and recovery. Preserve the conservative interruption behavior when no returned id or session file was durably recorded.
   - Verifier: not triaged: the verifier has not returned

## Residuals

none
