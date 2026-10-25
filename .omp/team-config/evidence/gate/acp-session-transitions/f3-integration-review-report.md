INTEGRATION-REVIEW-REPORT-v1
PASS — no Must-fix findings.

## Must-fix

None.

## Should-fix

- **`packages/coding-agent/src/session/session-storage.ts:1349-1372` — carried-forward finding.** **What:** `FileSessionStorage.deleteSessionWithArtifacts()` unlinks the JSONL before removing its artifact directory, so an artifact-removal failure reports deletion failure after the transcript has already disappeared. **Why:** direct picker and TUI-selector consumers observe a partially completed deletion; this remains locally reversible, requires a local artifact-cleanup failure, and reaches no protected asset, so it is below the supplied blocker threshold. **Fix:** make the deletion outcome atomic from the caller’s perspective (for example, stage/rename the transcript until artifact removal succeeds, or explicitly commit the transcript deletion and downgrade the artifact cleanup to retriable cleanup).
  - **class:** non-atomic session-file/artifact deletion.
  - **sites:** sole production implementation at `packages/coding-agent/src/session/session-storage.ts:1349`; affected direct consumers are `packages/coding-agent/src/main.ts:222` and `packages/coding-agent/src/modes/controllers/selector-controller.ts:1836,2068`. `SessionManager.dropSession()` now compensates its current-file path at `packages/coding-agent/src/session/session-manager.ts:2454-2500`, but it does not make those direct storage consumers atomic. Exact whole-tree searches run: `functions.grep(pattern: "async deleteSessionWithArtifacts|deleteSessionWithArtifacts\\(", path: "packages/coding-agent/src/session", case: true, gitignore: true, skip: 0)` and `functions.grep(pattern: "deleteSessionWithArtifacts\\(", path: "packages/coding-agent/src;packages/coding-agent/test", case: true, gitignore: true, skip: 0)`.

## Nit

None.

## Checked

- **Whole diff:** read the supplied 2,481-line patch end to end, then traced each changed runtime seam into its current callers, shared types, docs, and tests.
- **Previous F3 classes:**
  - **`unsealed-current-session-deletion-race` — closed.** Its sole prior site, `SessionManager.dropSession()` at `packages/coding-agent/src/session/session-manager.ts:2448-2466`, now detaches `#sessionFile` before `deleteSessionWithArtifacts()`. The regression holds deletion after unlink and appends both an entry and a title during that window at `test/session-manager/drop-current-session.test.ts:154-171`; the success path leaves no JSONL.
  - **`unrelated backlog maintenance in feature diff` — closed.** `.omp/plans/ACP_TUI_PARITY_BACKLOG.md` is absent from the supplied changed-file list; the only patch references are the new OpenSpec plan’s explicitly deferred follow-up and scope rule, not edits to the backlog.
  - **`non-atomic session-file/artifact deletion` — remains Should-fix** as documented above; the F3 manager reattach path mitigates current-manager deletion failure but not direct `FileSessionStorage` consumers.
- **1. Duplication across slices/files:** no instance found. The three ACP refusals share `#refuseTranscriptReplacement`; pending/started close lifecycle is centralized in `ClosingSession`; both protocol surfaces use the shared `ForegroundWork.ended`/`markEnded` contract.
- **2. Naming inconsistency:** no instance found. The nouns **session**, **transcript**, and **foreground work** are used consistently across `acp-agent.ts`, `acp-foreground.ts`, both surfaces, slash runtime, tests, docs, and changelog.
- **3. Uneven API surface:** no instance found. The extension API retains its existing `Promise<{ cancelled: boolean }>` shape (`src/extensibility/extensions/types.ts:2207-2215`); `endSessionAfterTurn` is deliberately optional and ACP-only; v1 and v2 each satisfy the same foreground-settlement producer contract.
- **4. Mixed conventions:** no instance found. Both surfaces call `work.markEnded()` from `onForegroundEnd` (`acp-surface-v1.ts:269-286`, `acp-surface-v2.ts:417-438`), while only `AcpAgent` parks and closes sessions.
- **5. Missing or premature abstractions:** no instance found. `#refuseTranscriptReplacement` has exactly its three real action consumers, and `ClosingSession` represents the shared lifecycle needed by delete settlement, explicit close, and agent disposal.
- **6. Dead code:** no instance found. `DetachedSessionFile`, `#detachSessionFile`, and `#reattachSessionFile` are all consumed by `dropSession`; `ClosingSession`, `#parkForClose`, `#runClose`, and `#endSessionAfterTurn` are connected to close/cancel/dispose; `ForegroundWork.ended` is produced by both surfaces and consumed by the deferred close. Exact whole-tree searches run: `functions.grep(pattern: "#detachSessionFile|#reattachSessionFile|DetachedSessionFile", path: "packages/coding-agent/src;packages/coding-agent/test", case: true, gitignore: true, skip: 0)`, `functions.grep(pattern: "ClosingSession|#parkForClose|#runClose|#endSessionAfterTurn", path: "packages/coding-agent/src;packages/coding-agent/test", case: true, gitignore: true, skip: 0)`, and `functions.grep(pattern: "ForegroundWork|markEnded|\\.ended", path: "packages/coding-agent/src/modes/acp;packages/coding-agent/test/acp-session-identity.test.ts", case: true, gitignore: true, skip: 0)`.
- **7. Doc drift:** no instance found. `docs/extensions.md:442-451` documents the ACP-only refusal and retained non-ACP behavior; `packages/coding-agent/CHANGELOG.md:22-29` records both the refusal and delete-close behavior. The diff adds no i18n key, locale-backed string, or OpenAPI API contract.
- **Surprise-scope walk:** every changed source/test/documentation file is named by D1–D3 or the task list, and the OpenSpec bundle is the declared plan artifact. No changed file implements a backlog item outside this feature.
- **Plan walks:** no session-map re-keying, agent-to-client replacement/close notification, non-ACP presentation change, or handling of externally deleted ACP sessions was added. Tasks 1–3 have corresponding code and test artifacts. Their listed test/type-check commands and RED evidence were not supplied as command output and were not run in this read-only review. F3 is this review; F1 remains explicitly unchecked in the pinned plan.
- **Slice/file checks:** the supplied changed-file list is limited to the planned ACP agent/foreground/surfaces/goal guard, slash command contract, session manager, named tests and harness, extension docs, changelog, and change-folder artifacts.
- **Seams:**
  - **D2:** `dropSession` detaches before storage, reattaches and full-rewrites on non-ENOENT failure, and releases the claim only on success. All production callers were checked (`builtin-session.ts:282`, `agent-session.ts:11158`, `session-manager.ts:4629`, `task/executor.ts:5208`); none consumes the deleted path after a successful drop.
  - **D1:** `#configureExtensions` refuses exactly `newSession`, `branch`, and `switchSession`, does not invoke `#goalSessionChange` for them, and matches the unchanged extension return types plus docs. The obsolete ACP Goal-mode action tests are absent: `functions.grep(pattern: "ctx\\.(newSession|switchSession|branch)\\(|createCommandContext\\(\\)\\.(newSession|switchSession|branch)\\(", path: "packages/coding-agent/test/acp-agent.test.ts", case: true, gitignore: true, skip: 0)` returned no matches.
  - **D3:** the hook is invoked only after successful `dropSession`; ACP parks the record synchronously, leaving normal request lookups on `#sessions` to reject it, while `cancel`, `closeSession`, and `dispose` deliberately reach the parked record. The new wire tests cover both protocol versions, normal post-delete rejection, failed delete, every stated in-window route, cancel, explicit close, and agent dispose (`test/acp-session-identity.test.ts:263-461`).
- **Simplification pass:** no additional cross-slice simplification candidate found.

PASS
