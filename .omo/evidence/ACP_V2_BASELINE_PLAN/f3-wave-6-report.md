## Must-fix

None established in the portions reviewed. **This is not a certification of the requested whole-diff review:** several patch reads were truncated, so the full diff, every seam, and the complete verification checklist were not reviewed end to end.

## Should-fix

- **`packages/utils/src/acp/transport.ts:262-267, 285-290, 321-330` — A batch drain timeout can resolve `responseWritten()` before a sibling entry’s response is written.** Batch entries share one response context, and the first individually written timeout response resolves the signal for all of them. This is non-blocking for the current v2 prompt consumer because it rejects batched prompts before admission, but the exported helper’s documented contract is broader.  
  **Fix:** Track the signal per batch entry and resolve it when the frame carrying that entry’s response settles; add a multi-entry drain-timeout test.  
  **class:** Shared response-delivery signal across independently answered requests. **sites:** `ResponseContext`, batch admission and timeout `#respond` in `transport.ts`; consumer `#echoAfterResponse` in `acp-surface-v2.ts`. Search: `functions.grep` pattern `rejectBatchedPrompt|inBatch\(|responseWritten\(|#echoAfterResponse|Promise\.all\(entries` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface`.

- **`packages/coding-agent/src/modes/acp/acp-foreground.ts:224-225` — Aggregate interaction counts do not identify which tools are blocked.** Two simultaneous interactions from one tool could mask a progressing sibling and report `requires_action` prematurely. The pinned plan records that no current tool opens concurrent interactions, so this does not meet the blocking threshold.  
  **Fix:** Associate interactions with tool identity if a consumer gains concurrent interactions; retain parallel-tool coverage.  
  **class:** Interaction count used as tool identity. **sites:** `isBlockedOnInteraction`, state reevaluation and tool tracking in `acp-surface-v2.ts`, and interaction producers in `acp-agent.ts`. Search: `functions.grep` pattern `trackInteraction\(|isBlockedOnInteraction\(|pendingInteractions|runningTools` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages`.

- **`README.md:560` and `packages/coding-agent/CHANGELOG.md:12` — The descriptions imply that all v2 message IDs match the transcript or remain stable across resume.** The implementation preserves persisted user-message IDs, but generates fresh replay IDs for other roles and live-only IDs for locally handled commands (`acp-surface-v2.ts:240-247, 375-385`). This is non-blocking documentation drift; those limitations are accepted residual risks in the pinned plan.  
  **Fix:** Qualify the claim as applying to persisted user-prompt IDs and mention the command exception where appropriate.  
  **class:** Unqualified message-identity guarantee. **sites:** README and coding-agent changelog above. Search: `functions.grep` pattern `stable message ids|message ids that match|message ids.*resume|messageId.*replay` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface`.

## Nit

None established.

## Checked

- **Prior delta finding:** The README now labels the routing table v1, describes v2 local I/O and permission requests, and states the single-request prompt restriction. The prior `protocol-version-dependent-behavior-documented-as-universal` finding is closed at its listed sites.
- **Duplication:** No additional instance found in the inspected portions.
- **Naming inconsistency:** Examined foreground/work, submission/outcome, and interaction/state terminology; no additional instance found.
- **Uneven API surface:** The exported `responseWritten()` contract has the batch-timeout limitation above.
- **Mixed conventions:** No additional instance found in the inspected portions.
- **Missing abstractions:** The shared interaction predicate has the tool-identity limitation above; no additional instance found.
- **Dead code:** No additional instance found in targeted searches. Searches were not exhaustive for every new symbol.
- **Doc drift:** The message-identity descriptions are broader than the implementation, as noted above.
- **Surprise scope and plan:** Compared the changed-file inventory with the pinned plan’s named surfaces. Targeted searches found types and dispatch entries for excluded features but did not establish an excluded implementation; the touched-symbol and per-slice walks were not exhaustive.
- **Verification checklist:** The wave-5 artifact records passing coding-agent and utils checks, 418 ACP tests, 238 RPC tests and 28 utils ACP tests at `dc43e41b764d784419ce096c9b0ac30a5cd472b5`. It records one agent-session failure and says it also failed on the merge base. That artifact is not proof at the supplied later HEAD. F1 remains unchecked in the pinned plan; RED evidence for every checklist case was not established.
- **i18n:** No locale files or i18n keys were identified in the changed-file inventory; this was not an exhaustive locale audit.
- **Seams:** Inspected version dispatch, response ordering and batch guard, foreground interaction state, selected submission and replay paths, and configuration/documentation references. The full producer/consumer seam walk was not established.
- **Simplification pass:** No additional candidate established beyond the interaction-state note.
- **Review limitation:** Exact ranged patch reads were sometimes transformed and truncated by the reader; the behavior was reported through the issue reporter. The full 19,407-line patch was not read end to end.

PASS