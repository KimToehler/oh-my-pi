## Must-fix

None established in the portions reviewed. **This is not a completed whole-diff certification:** the patch reader transformed and truncated several ranged reads, including reads requested as raw. I reported that tool behaviour. The supplied previous report was also explicitly incomplete.

## Should-fix

- **`packages/coding-agent/CHANGELOG.md:24–25` — The unreleased background-work entries describe v1 behaviour without qualifying it.** They say the reply stays open and later steering enters that reply, whereas v2 deliberately ends the foreground before a pending background job and frames its later wake separately. This is documentation drift, not a blocker.  
  **Fix:** Qualify those entries as v1 behaviour and distinguish the v2 wake lifecycle.  
  **class:** Protocol-version-dependent lifecycle documented as universal. **sites:** The two changelog entries above. Search: `functions.grep` pattern `background job.*(reply|prompt|turn)|reply now stays open|prompt.*background|background.*prompt` across the worktree README, coding-agent changelog, and `docs/`.

- **`packages/coding-agent/src/modes/acp/acp-event-mapper-v2.ts:102–107` and `acp-surface-v2.ts:140–144` — The same available-command conversion is implemented twice.** A future field or mapping change can make setup responses and subsequent updates disagree; this is a maintainability issue, not a blocker.  
  **Fix:** Extract one conversion function and use it at both sites.  
  **class:** Duplicated wire DTO conversion. **sites:** Both sites above. Search: `functions.grep` pattern `command\.input\.hint|availableCommands: .*map\(command` across `/Users/tim/git/oh-my-pi/.worktrees/acp-v2-surface`.

- **`packages/utils/src/acp/transport.ts:262–267, 285–290, 323–330` — A batch drain timeout can resolve `responseWritten()` for a sibling before that sibling’s individual timeout response is written.** Batch entries share a response context; this does not block the current v2 prompt consumer because batched prompts are rejected before admission.  
  **Fix:** Track delivery per entry when timeout responses are written independently, and cover multiple timed-out entries.  
  **class:** Shared delivery signal for independently answered requests. **sites:** `ResponseContext`, batch admission and `#respond`; current consumer `acp-surface-v2.ts:257–258`. Search: `functions.grep` pattern `responseWritten\(|inBatch\(|#respond\(|#answerFrame` under the worktree’s `packages/`.

- **`packages/coding-agent/src/modes/acp/acp-foreground.ts:224–225` — Aggregate interaction counts do not identify which tools are blocked.** One tool opening multiple simultaneous interactions could mask a progressing sibling; the pinned plan records that current tools do not do this, so it is non-blocking.  
  **Fix:** Associate interactions with tool identities if concurrent interactions per tool become supported.  
  **class:** Interaction count used as tool identity. **sites:** `isBlockedOnInteraction`, state reevaluation and interaction producers. Search from the previous report: `functions.grep` pattern `trackInteraction\(|isBlockedOnInteraction\(|pendingInteractions|runningTools` under the worktree’s `packages/`.

## Nit

None established.

## Checked

- **Prior delta finding:** Closed at its listed sites. `README.md:560` and `packages/coding-agent/CHANGELOG.md:12` now distinguish persisted prompt IDs from agent replies and locally handled commands.
- **Duplication:** Available-command conversion is duplicated, as noted.
- **Naming inconsistency:** Examined foreground/work, submission/outcome and interaction/state terminology; no additional instance found in the inspected portions.
- **Uneven API surface:** The exported `responseWritten()` contract has the batch-timeout limitation above.
- **Mixed conventions:** No instance found in the inspected portions.
- **Missing abstractions:** The command-conversion helper is a cross-slice simplification candidate; the interaction predicate has the limitation above.
- **Dead code:** No instance found in targeted inspection; searches were not exhaustive for every new symbol.
- **Doc drift:** Unqualified background-work changelog entries are noted above.
- **Surprise scope and plan:** Compared the changed-file inventory against the pinned plan’s named surfaces. Targeted excluded-feature searches found type and dispatch declarations, not an established excluded implementation. The touched-symbol and per-slice file walks were not exhaustive.
- **Out of scope:** Targeted searches covered terminal updates, tool-content streaming, notices, compaction updates, delete, additional directories and fork; no excluded implementation was established. JSON-RPC batch transport was separately planned, while this diff adds its response-delivery seam.
- **Verification checklist:** The wave-5 artifact records passing coding-agent and utils checks, 418 ACP tests, 238 RPC tests and 28 utils ACP tests at `dc43e41b764d784419ce096c9b0ac30a5cd472b5`; it records one agent-session failure and says that failure also occurred on the merge base. This is not proof at the supplied later HEAD. F1 is unchecked in the pinned plan, and RED evidence for every checklist case was not established. No checks were run in this review.
- **i18n:** No locale files or i18n keys appeared in the changed-file inventory; no exhaustive locale audit was established.
- **Seams:** Inspected version dispatch, response ordering and batch guard, foreground interaction state, selected submission and replay paths, and configuration/documentation references. The complete producer–consumer seam walk was not established.
- **Simplification pass:** The duplicated available-command conversion is the candidate above. Further whole-diff candidates cannot be ruled out because of truncated reads.

PASS