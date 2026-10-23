## Must-fix

### High — A stale plan-proposal response can undo a later mode selection

**`packages/coding-agent/src/modes/acp/acp-agent.ts:2426–2442, 2458–2465`; `packages/coding-agent/src/modes/acp/acp-goal.ts:470–473`**

The proposal handler retains Plan state across the awaited client approval, but neither its rejection write nor its approved `exitPlan` verifies that the same Plan transition still owns the response.

[INFERENCE] Await sequence: start a proposal in Plan with a different proposed path → hold `#requestAcpPlanApprovalChoice` → select Goal, which clears Plan and arms Goal → return a rejection. The rejection restores the captured enabled Plan state, leaving Plan enabled alongside the Goal selection; the next objective is then rejected by the Plan/Goal exclusivity check. Similarly, if the client selects Goal and then selects a *new* Plan while the approval is pending, an approval of the old proposal calls `exitPlan` and clears the new Plan.

**Fix:** Reserve plan-proposal ownership before requesting approval and validate it before applying either response, including after `adoptApprovedPlan`. Add gated rejection and approval tests in which later mode requests win.

- **class:** Stale plan-proposal completion overwrites a newer mode decision.
- **sites:** ACP rejection’s captured-state write and ACP approval’s `exitPlan` call, cited above. Whole-tree `functions.grep` search: `requestAcpPlanApprovalChoice|setPlanModeState\(\{ \.\.\.state|exitPlan\(|planFilePath !== planFilePath`. The other matches read live Plan state before their path update.

## Should-fix

None substantiated.

## Nit

None.

## Checked

- **Round 6 restoration class:** The fenced entry’s check, swap, re-check, and commit/undo now share `#exitTask`; stamped pause restores and event exits also use that chain. The row 22 discrimination artifact records failures when the entry ordering guard is removed.
- **Deadlock walk:** Inspected `#ordered`, `#exitTask`, reconciliation, and the real tool-registry mutation path. No direct `#exitTask` task awaiting itself was found; tool swaps do await registry and prompt-rebuild work, so this is a static assessment, not an exercised deadlock test.
- **1. Duplication across slices/files:** No instance found.
- **2. Naming inconsistency:** No instance found for *admission*, *stamp*, or *reconcile*.
- **3. Uneven API surface:** No unintended instance found; the runtime gate and host stamps are optional for ungated hosts.
- **4. Mixed conventions:** No additional instance found.
- **5. Missing or premature abstractions:** No additional instance found.
- **6. Dead code:** No instance found among the reviewed actor, admission, stamp, gate, and restoration symbols.
- **7. Doc drift:** No instance found in this delta; the changed-file inventory contains no locale or OpenAPI files.
- **Surprise scope and plan walks:** The changed files are within the Goal, ACP, session, and test surfaces described by rows 10–22. No implementation of the excluded ACP modes or `/goal drop` was identified. The plan has no per-slice “Files modified” lists or new i18n keys.
- **Verification checklist:** Reviewed the RED/discrimination artifacts and QA matrix. The full-suite artifact identifies `fc293833cb`, and the recorded GUI/stdio scenarios predate the reviewed head; the plan accepts the older IDE evidence as a residual risk. No tests or manual QA were run in this read-only review.
- **Seams:** Inspected prompt admission, Stop/abort stamps, mode transitions and plan approval, stale config, reconciliation and session changes, runtime commit fencing, tool-origin drop, host restoration, optional RPC/TUI gating, and the fake gate additions.
- **Simplification pass:** No additional substantiated cross-slice simplification candidate found.
- **Input limitation:** The supplied patch contains compacted sections, so its full textual diff could not be inspected end to end; relevant current source and tests were read separately.

FAIL