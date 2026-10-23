## Must-fix

None established in the reviewed portions.

## Should-fix

- **`packages/utils/src/acp/transport.ts:262-267, 285-290, 321-330` — A batch drain timeout can resolve `responseWritten()` for an entry whose response has not been written.** Batch entries share one `ResponseContext`, and the first individual timeout response resolves that shared signal, including for sibling handlers. This is non-blocking for the current v2 prompt consumer because batched prompts are rejected before admission, but it violates the newly exported helper’s documented contract for other consumers.  
  **Fix:** Track response-written signals per batch entry, and resolve each only when the frame carrying that entry’s response has settled. Add a drain-timeout test with multiple batch entries.  
  **class:** Shared response-delivery signal across independently answered requests. **sites:** `ResponseContext`, batch admission, and timeout `#respond` in `packages/utils/src/acp/transport.ts`; consumer `AcpSurfaceV2.#echoAfterResponse`. Whole-tree `functions.grep` search: `rejectBatchedPrompt|inBatch\(|responseWritten\(|#echoAfterResponse|setTimeout\(tick\.resolve|Promise\.all\(entries` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface`.

- **`README.md:558-566` — The ACP tool-routing table is presented without a protocol-version qualification, although v2 does not install the client filesystem or terminal bridge.** A reader opting into v2 can reasonably expect `read`, `write`, and `bash` to use the listed client routes. This is documentation drift, not a demonstrated runtime failure.  
  **Fix:** Label those routes as v1 capability-dependent behavior and explain that v2 uses the permission bridge without client `fs/*` or `terminal/*` calls.  
  **class:** Protocol-version-dependent behavior documented as universal. **sites:** The README table and its introductory sentence; implementation evidence is `acp-agent.ts:734-739,1587-1590` and `acp-client-bridge.ts:40-76`. `functions.grep` search: `terminal/create|fs/read_text_file|fs/write_text_file|session/prompt must be sent|protocolV2` under the worktree’s `README.md`, `docs`, coding-agent changelog, and modes directory.

- **`packages/coding-agent/src/modes/acp/acp-foreground.ts:224-225` — Interaction counts are compared with running-tool counts without associating interactions with their originating tools.** Two concurrent interactions from one tool could mask a progressing sibling and report `requires_action` prematurely. The pinned plan records that no current tool opens concurrent interactions, so this does not meet the blocking threshold.  
  **Fix:** Associate interactions with tool identity if a consumer gains concurrent interactions; retain parallel-tool coverage.  
  **class:** Interaction count used as tool identity. **sites:** `isBlockedOnInteraction`, its tracking in `acp-surface-v2.ts:295-300,334-340`, and producers at `acp-agent.ts:1593,2458,2694`. Whole-tree `functions.grep` search: `trackInteraction\(|isBlockedOnInteraction\(|pendingInteractions|runningTools` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages`.

## Nit

None established.

## Checked

- **Previous wave’s blocker:** The listed echo site now awaits `responseWritten()`; the transport resolves that signal after the single response write. The v2 handler rejects a batched prompt before session lookup or admission, and the wire test checks the rejection and a subsequent single prompt. The separate batch-timeout signal limitation is noted above.
- **Duplication:** No additional instance established in the inspected portions.
- **Naming consistency:** Inspected foreground/work, submission/outcome, and interaction/state terminology; no additional instance established.
- **Uneven API surface:** The exported response-written contract has the batch-timeout limitation above.
- **Mixed conventions:** No additional instance established in the inspected portions.
- **Missing or premature abstractions:** The shared interaction predicate has the tool-identity limitation above; no additional candidate established.
- **Dead code:** No additional instance established. Searches were not exhaustive for every new symbol.
- **Doc drift:** The unqualified ACP routing table is noted above.
- **Surprise scope and plan:** Compared the supplied file inventory with the pinned plan’s named surfaces and read its out-of-scope list. No excluded implementation was established in the inspected portions; this was not an exhaustive touched-symbol or per-slice audit.
- **Verification checklist:** The wave-5 evidence records coding-agent and utils checks passing, 418 ACP tests passing, 238 RPC tests passing, and 28 utils ACP tests passing at the supplied HEAD. It records one agent-session failure and describes it as also failing on the merge base. F1 remains unchecked in the pinned plan; RED evidence for every checklist item and manual QA were not established.
- **i18n:** No locale files or i18n keys were identified in the supplied changed-file list; this was not an exhaustive locale audit.
- **Seams:** Inspected the v2 prompt/transport ordering, batch guard, version dispatch, client-bridge capability selection, mapper, and interaction-state seams. This was not a complete producer/consumer audit of every listed seam.
- **Simplification pass:** No additional cross-slice candidate established beyond the interaction-state note.
- **Review limitation:** The supplied patch is approximately 19,400 lines. Its initial read was truncated, and subsequent reads covered selected ranges rather than the whole diff end to end. This report does **not** certify the requested exhaustive whole-diff, seam, or verification walks.

PASS