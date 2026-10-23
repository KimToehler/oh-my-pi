## Must-fix

Blocker B1: **A delayed idle can overtake the next foreground** — `packages/coding-agent/src/modes/acp/acp-surface-v2.ts:245-268, 315-324, 377-405`. When a short foreground ends before its deferred `user_message` echo is sent, `onForegroundEnd` clears `record.foreground` immediately but schedules its idle behind the echo. If another prompt or wake starts before that echo completes, its `running` is suppressed because `lastEmittedState` is still `running`; the old idle is then emitted while the new foreground is active. The client can consequently hide active work or disable Stop. The state is recoverable by a subsequent transition, but it violates the foreground-state merge criterion. **Fix:** serialize state transitions with deferred echoes, preserving the old foreground’s idle before the next foreground’s running; cover back-to-back short work followed by a held turn.  
**class:** Deferred foreground transition overtakes successor. **sites:** The shared v2 `#afterEcho`/`onForegroundEnd` and `onForegroundStart` paths above; whole-tree `functions.grep` search: `echoAfterResponse|afterEcho|#echoes|onForegroundEnd\(|onForegroundStart\(` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface`.

Blocker B2: **Stop during skill-file preparation can still launch the skill afterward** — `packages/coding-agent/src/modes/acp/acp-agent.ts:1121-1145`; `packages/coding-agent/src/extensibility/skills.ts:671-676`. For a user-invoked skill, the v2 command is acknowledged before asynchronous skill-file reading finishes. If Stop arrives during that read, cancellation finishes, but the continuation unconditionally calls `promptCustomMessage`; it can start model work after Stop, with the v2 cancel latch preventing that work from being framed as a new foreground. The unwanted work and its effects depend on the skill and tools; session state is recoverable, but tool effects need not be reversible. This violates the cancellation criterion. **Fix:** bind skill preparation to the originating foreground and check its cancellation/ownership after the await, before dispatching the custom prompt; add a held-read Stop regression.  
**class:** Post-cancellation submission after asynchronous preparation. **sites:** The ACP skill preparation and dispatch above. Whole-tree `functions.grep` search: `buildSkillPromptMessage|promptCustomMessage\(` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages/coding-agent/src`; the RPC path at `modes/rpc/rpc-mode.ts:329-330` has an explicit currentness check.

## Should-fix

- `packages/coding-agent/src/modes/acp/acp-foreground.ts:222-225`: Aggregate blocked state compares interaction and running-tool counts rather than associating interactions with tools. Two concurrent interactions from one tool can mask a progressing sibling; the pinned plan records that no current tool opens concurrent interactions, so this is not a blocker under the stated threshold. **Fix:** associate interactions with their originating tool if a consumer gains concurrent interactions, retaining parallel-tool coverage.  
  **class:** Interaction count used as tool identity. **sites:** The shared `isBlockedOnInteraction` predicate and its interaction producers; whole-tree `functions.grep` search: `trackInteraction\(|onInteractionChanged|createElicitation\(` under `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface/packages`.

## Nit

None identified.

## Checked

- **Previous blocker — cancellation hook:** `cancel` now invokes `beforeCancel` before cleanup; the v2 hook sets the latch and cancellation flag and withdraws the interrupt queue.
- **Previous blocker — pre-registration admission:** The v2 surface tracks pending admissions and drops them at Stop; the two early returns also report a dropped outcome. The pinned plan explicitly accepts the remaining Goal-lane wait for a subsequent ordinary prompt.
- **Previous blocker — discarded capability:** v2 initialization retains the form capability, extension setup consumes it, and the surface sends v2-shaped elicitations. The adapter test exercises a tool question and the returned answer.
- **Duplication:** No additional instance established in the inspected code.
- **Naming inconsistency:** Examined foreground/work, submission/outcome and interaction/state terminology; no additional instance established.
- **Uneven API surface:** The previously reported v2 elicitation capability gap is wired. No additional instance established.
- **Mixed conventions:** The RPC skill path checks currentness after preparation, whereas ACP does not; B2.
- **Missing or premature abstractions:** The shared interaction predicate has the identity limitation reported above; no further candidate established.
- **Dead code:** The formerly unwired `beforeCancel` hook now has a caller. The search was not exhaustive for every new symbol.
- **Doc drift:** README and changelog are in the supplied changed-file list; no new locale files or i18n keys were identified there. This was not an exhaustive documentation audit.
- **Surprise scope and plan:** Compared the file list with the pinned plan’s named surfaces and tests. No excluded feature implementation was established in the inspected portions; types and dispatcher entries alone are not evidence that an excluded feature is implemented.
- **Plan walks:** Read the verification and out-of-scope sections. The wave-3 verification artifact records passing ACP, RPC and utils tests and checks, plus one agent-session failure it describes as pre-existing. It records a different HEAD (`c4551ab5…`) from the supplied review HEAD, so it is not proof of verification at `2b23e77ea1`. F1 manual QA remains unchecked in the pinned plan. RED evidence for every checklist item was not established.
- **Seams:** Inspected cancellation and admission, capability propagation, v2 state and echo ordering, dispatch, mapping and selected session outcome paths. This was not a complete producer/consumer audit of every listed seam.
- **Simplification pass:** No additional cross-slice simplification established beyond the interaction-state note.
- **Review limitation:** The supplied patch has 18,862 lines and the initial tool read was truncated. I cannot claim an end-to-end read of the whole diff, exhaustive changed-symbol search, or complete verification-checklist audit.

FAIL