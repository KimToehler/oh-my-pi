## Must-fix

1. **High — stale approval effects continue after Plan exit** — `packages/coding-agent/src/modes/acp/acp-agent.ts:2473-2515`; `acp-goal.ts:475-484,575-584`  
   **What:** Approval checks proposal ownership before installing the reference and exiting Plan, but its subsequent model switch and stale-config recording are not ownership-fenced.  
   **Why:** [INFERENCE] An approval can exit Plan, await `autosaveApprovedPlan`, then a user can select Goal or switch transcripts before the old approval resumes. The old completion can then apply its execution model and compare its old `configBeforeApproval` against the new state; for a pinning client, it can record `plan` as stale and cause a later deliberate Plan selection to be ignored. A switch during `applyRoleModel` also leaves its post-await thinking-level write exposed.  
   **Fix:** Carry a post-exit ownership token through autosave, model application and config recording; ensure each state-changing step, including the model helper’s post-await write, is ordered or fenced against later mode and transcript decisions. Add gated tests for both await sequences.  
   **class:** Stale asynchronous proposal effects writing after ownership changes.  
   **sites:** ACP approval’s model application and config recording at `acp-agent.ts:2484-2515`; model application’s post-await thinking write at `session/model-controls.ts:391-395`. Whole-tree searches using `functions.grep`: `planProposalSupersededResult|reservePlanProposal|#handleAcpPlanProposal|autosaveApprovedPlan\(|recordAgentConfigOverrides\(` and `async applyRoleModel\(|applyRoleModel\(`.

2. **High — a superseded proposal can throw before reaching the supersession guard** — `packages/coding-agent/src/modes/acp/acp-agent.ts:2434-2444`; `packages/coding-agent/src/session/agent-session.ts:1765-1771`  
   **What:** The ACP handler checks whether Plan is currently enabled before checking the proposal’s reserved ownership.  
   **Why:** [INFERENCE] If resolution awaits while the client selects Goal or Default, `submitPlanProposal` resumes and invokes the captured handler; that handler throws “Plan mode is not active” rather than returning the required superseded result. The existing resolution test re-enters Plan before releasing the gate, so it does not cover this branch.  
   **Fix:** Check `owns()` before inspecting current Plan state or resolving handler-specific paths, and add a gated resolution test that switches directly from Plan to Goal or Default without re-entering Plan.  
   **class:** Superseded proposal rejected before ownership is evaluated.  
   **sites:** The captured handler dispatch at `agent-session.ts:1765-1771` and its ACP handler guard at `acp-agent.ts:2434-2444`; whole-tree `functions.grep` search: `planProposalSupersededResult|reservePlanProposal|#handleAcpPlanProposal|autosaveApprovedPlan\(|recordAgentConfigOverrides\(`.

3. **High — new regression tests pin natural-language prompt prose** — `packages/coding-agent/test/acp-agent.test.ts:1317,1338,1367,1395,1417,1450`; `packages/coding-agent/test/plan-review.test.ts:859`  
   **What:** Seven new assertions match the wording of the superseded-proposal prompt.  
   **Why:** They fail on harmless prompt rewrites while proving no machine-consumed routing contract; the programming review guidance expressly forbids such prose assertions.  
   **Fix:** Remove the prose pins and assert observable effects and a machine-consumed structured outcome where one exists; retain the gated state, handler-call and journal assertions.  
   **class:** Natural-language prompt assertions.  
   **sites:** All seven locations above. Whole-tree `functions.grep` search: `to(?:Match|Contain|Be)\([^\n]*(?:approval was pending|Plan proposal discarded|session mode changed)`.

## Should-fix

None.

## Nit

None.

## Checked

- **Round 8 classes:** The dispatch-time reservation, review guard, reference-after-snapshot check and removal of rollback address the specifically tested paths. They do **not** close all proposal-completion sites: the two remaining paths are Must-fix findings 1 and 2. The supplied round-8 report path and the corresponding evidence-path report both contained only “Checked / clean — nothing to commit”; the plan’s row 24 and discrimination artifact supplied the class descriptions.
- **Duplication:** No actionable cross-slice duplicate found.
- **Naming:** Checked *ownership/stamp*, *admission/entry*, and *transcript/session change* across the actor, runtime and host controller; no actionable inconsistency found.
- **Uneven API surface:** Checked optional mutation gates and plan-proposal ownership against ACP and non-ACP callers; no additional actionable inconsistency found.
- **Mixed conventions:** No actionable instance found.
- **Missing or premature abstractions:** No actionable cross-slice instance found.
- **Dead code:** No actionable instance found in the searched ownership and proposal paths.
- **Doc drift:** No actionable instance found in this delta. The new superseded-plan prompt is not an i18n key; no locale or OpenAPI changes were identified in the supplied changed-file list.
- **Surprise scope and plan walks:** Reviewed the changed-file inventory against rows 10–24 and the plan’s feature boundaries; no additional out-of-scope feature found. The plan has no separate “Files modified” lists or “Out of Scope” section: its Context, assumptions and merge-gate out-of-scope bullet name the exclusions. Verification evidence inspected is for earlier heads: `suites-head.txt` names `fc293833cb`, and the QA matrix names `74ed09437d`; it does not establish that the full checklist ran on `1b93defc39`. The plan explicitly accepts the stated IDE-evidence limitations.
- **Seams:** Reviewed actor admission, Stop, mode and session-change contracts; runtime ownership gate and tool origin; host-controller stamped entry and ordered restore; per-transcript stale config; test fakes; abort stamp propagation; and proposal ownership/snapshot installation. The proposal seam has the blockers above.
- **Simplification pass:** No actionable cross-slice simplification found.
- **Verification performed:** Read-only review only; no tests, builds or manual QA were run.

FAIL