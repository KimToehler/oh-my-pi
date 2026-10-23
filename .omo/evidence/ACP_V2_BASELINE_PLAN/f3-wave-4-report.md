## Must-fix

Blocker B1: **Batched prompts can emit their `user_message` before their response** — `packages/coding-agent/src/modes/acp/acp-surface-v2.ts:241-250`; `packages/utils/src/acp/transport.ts:249-253`. **Trigger and preconditions:** a v2 client batches a prompt with another request that takes longer than one timer tick. The prompt schedules its echo with `setTimeout(0)`, but the transport waits for *all* batch entries before writing the batch response. **Impact:** the client receives the `user_message` before the response containing its `messageId`, contrary to the plan’s response-then-echo contract; subsequent ordered content can also arrive before that response. The ordering error is reversible by a later reconnect or replay, but it breaks the wire-contract criterion. **Fix:** provide a transport-level signal that the response frame containing the prompt result has been queued, and release the echo only after that signal; cover a batch containing a prompt and a deliberately held second request.

  **Class:** response-dependent notification scheduled by timer rather than response delivery. **Sites:** the v2 echo at `acp-surface-v2.ts:241-250`, with the batch response barrier at `transport.ts:249-253`. Whole-tree search: `functions.grep` with pattern `Promise\.all\(.*answer|#answer\(|#echoAfterResponse|setTimeout\(tick\.resolve` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages`.

## Should-fix

- **Interaction counts do not identify which tool is blocked** — `packages/coding-agent/src/modes/acp/acp-foreground.ts:224-225`. Two interactions from one tool can make a progressing sibling appear blocked, causing `requires_action` to be reported prematurely. This does not block under the pinned plan’s stated assumption that no current tool opens concurrent interactions. **Fix:** associate interactions with their originating tool if that assumption changes.  
  **Class:** interaction count used as tool identity. **Sites:** `isBlockedOnInteraction`, the lifecycle tracking in `acp-surface-v2.ts:289-329`, and the interaction producers in `acp-agent.ts:1590,2455,2691`. Whole-tree search: `functions.grep` with pattern `trackInteraction\(|isBlockedOnInteraction\(|pendingInteractions|runningTools` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages`.

## Nit

- **Stale negotiation comment** — `packages/coding-agent/src/modes/acp/acp-agent.ts:648`. The comment says only v1 is negotiable until the v2 surface exists, although the v2 surface is now present. This does not affect behavior. **Fix:** describe this as the v1 initialize handler rather than a limitation of the connection.  
  **Single instance:** search for `Only v1 is negotiable|v2 surface exists` across `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface` found this comment and an unrelated test description.

## Checked

- **Previous blocker, deferred transitions:** the listed v2 start, end and echo sites now enqueue states and echoes in one record-local order, with dedup against the queued state. The new tests cover a short command followed by a held foreground. B1 is a separate ordering gap at the transport response boundary.
- **Previous blocker, post-cancel skill submission:** `#tryRunSkillCommand` now checks the stable originating turn after the skill read and before `promptCustomMessage`; the new held-read test covers Stop. The shared ACP path covers v1 and v2.
- **Duplication:** no additional instance established in the inspected portions.
- **Naming:** inspected foreground/work, submission/outcome and interaction/state terminology; no additional instance established.
- **Uneven API:** no additional instance established in the inspected portions.
- **Mixed conventions:** the v2 timer-based response ordering conflicts with the transport’s batch-response barrier; B1.
- **Missing or premature abstractions:** the interaction-count limitation is recorded above.
- **Dead code:** no additional instance established; the search was not exhaustive for every new symbol.
- **Doc drift:** README, changelog and setting references were inspected; the stale source comment is recorded above. No locale changes were identified in the supplied file list.
- **Surprise scope and plan walks:** compared the supplied file list with the pinned plan’s named surfaces. Searches found v2 types and a dispatcher entry for excluded features, but I did not establish an excluded implementation. This was not an exhaustive touched-symbol or per-slice file-list audit.
- **Verification:** the wave-4 artifact records checks and ACP, RPC and utils suites passing at `dd9aece8244430c60be4ae8b35cf02ced3df933a`; it records one agent-session failure and describes it as also failing on the merge base. F1 remains unchecked in the pinned plan. I did not establish RED evidence for every checklist item.
- **Seams:** inspected the prior-fix state and cancellation seams, batch transport, v2 prompt admission and echo, configuration references, mapper, and selected session-outcome paths. This was not a complete producer/consumer audit of every listed seam.
- **Simplification pass:** no additional cross-slice candidate established beyond the interaction-state note.
- **Review limitation:** the supplied patch is approximately 19,000 lines and the initial read was truncated; subsequent reads covered selected ranges, not the entire diff end to end. This report therefore cannot certify the requested exhaustive whole-diff and verification walks.

FAIL