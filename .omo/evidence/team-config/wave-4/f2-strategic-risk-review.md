Bottom line: The installer and staged deployment architecture is substantially hardened, but this branch should not pass the gate yet. The plan-time merge gate can validate one version of a plan and then approve different bytes because its “propose alone” boundary ignores mutation-capable tools outside `edit`, `write`, and `ast_edit`.

Action plan:

1. **Architecture:** The installer’s snapshot/plan/apply design, intent manifest, adopted-file tracking, exclusive backups, and pre-publication config sync form a coherent failure model in `scripts/install-team-config.ts` and `scripts/deploy-local.sh`. The supplied QA exercises the highest-risk installation and deployment transitions, subject to the owner-accepted same-user race limitations.

2. **Blocking issue — incomplete proposal isolation**
   - **class:** plan-approval TOCTOU through an incomplete capability boundary
   - **sites:** `team-config/agent/extensions/lib/plan-file.ts` (`MUTATING_TOOLS`, `classifyCall`); `team-config/agent/extensions/merge-gate.ts` (`tool_call` handler and `MessageCalls`); `team-config/tests/merge-gate.test.ts` (`propose-alone rule`)
   - **single instance:** all plan-proposal approval flows converge through this one classifier and handler; the test file is the corresponding coverage site.
   - `MUTATING_TOOLS` contains only `edit`, `write`, and `ast_edit`, and its comment explicitly excludes bash, eval, and subagents. An undefined classification returns from the handler without recording the call. The tests additionally treat the entire `lsp` tool as read-only even though mutation-capable actions such as an applied rename share that tool name.
   - Because omp prepares every tool call before executing them, a message can pair a mutation-capable unclassified call with `write xd://propose`. The hook validates the plan bytes currently on disk, then the other call can change the plan before the host resolves and approves it. This violates the extension’s stated guarantee that a proposal accompanied by any file-changing call is refused.
   - **Fix direction:** Make a proposal the only tool call in its assistant message. Track every call, not an enumerated set of mutator names; refuse a proposal after any earlier call and refuse every later call after an allowed proposal. This is simpler and safer than maintaining a capability allowlist.

3. **What the line-level audit structurally missed:** It reviewed the rule injection and completion-claim path, but not whether the plan gate’s isolation boundary is closed over all mutation capabilities. The existing tests prove routing variants of known write tools, not that an unknown or multi-action tool cannot mutate the approved plan.

4. **Highest-impact production failure:** Silent loss of locally modified agent configuration remains the greatest direct user impact. The installer addresses ordinary execution through backup-before-replace, adopted ownership state, intent/partial manifests, and filesystem QA; the remaining same-user path-substitution race is explicitly accepted. The highest unaddressed systemic failure is approval of an unvalidated plan through the proposal-isolation gap above.

5. **Auditor false positives:** Both count corrections are stale relative to this wave’s supplied matrix. QA row 1 already says 418 managed files, explicitly “417 + the shipped merge-gate-proof rule,” and row 5 already says 410 of 418 adopted. The auditor’s observation that the asserted-passed real-binary case demonstrated refusal/retraction rather than the canonical marker-backed path is accurate and non-blocking.

6. **Verification after the fix:** Add adversarial hook tests for a shell call, an applied LSP mutation, and a task/eval-like unknown call paired with a proposal; each must be refused without validating or approving the plan. Also update the existing test that currently allows read-only calls alongside a proposal, then rerun the gate review because the extension code will have changed.

Effort: Short (1–4h).

Confidence: high.

Watch out for:
- Do not replace the three-name mutator set with a larger denylist; another compound tool would reopen the same class.
- Preserve refusal of nested `xd://write` → `xd://propose` dispatches.
- Any extension fix changes reviewed code and invalidates the current wave’s verdicts.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A plan proposal is approved only when it is the sole tool call in its assistant message, so no capability can change plan bytes between validation and host approval.
  positive_witness: A message containing only write xd://propose validates and approves the same on-disk plan bytes.
  negative_control: A message combining a proposal with a shell command, applied LSP mutation, eval, task dispatch, or any other tool call must be refused before approval.
  observable: The proposal tool result is blocked and no plan-only validator invocation approves the mixed-call message.
  boundary: The merge-gate extension tool_call handler at the host plan-proposal boundary.
END-REVIEW-TRAILER
