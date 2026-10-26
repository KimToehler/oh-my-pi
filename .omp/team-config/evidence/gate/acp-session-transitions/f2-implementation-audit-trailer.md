PASS

## 1. Goal and behavioural contract

The implementation matches the three scoped decisions on the reviewed tree:

- D1 is confined to ACP extension wiring: `newSession`, `branch`, and `switchSession` synchronously return cancellation before invoking session-changing work; `navigateTree` and `reload` retain the existing goal-bracket path (`packages/coding-agent/src/modes/acp/acp-agent.ts:3156-3199`). The documentation states the ACP-only limitation and preserves TUI/RPC/print behavior (`docs/extensions.md:448-450`).
- D2 detaches the current persistence target before its first await, so the normal append and title paths—which both require `#sessionFile`—become in-memory during writer drain and deletion (`session-manager.ts:2464-2488`, `2492-2509`). Failed deletion restores through the existing authoritative full-file repair and preserves a concurrently chosen replacement target through `#targetGeneration` (`2520-2530`).
- D3 parks the ACP record synchronously, makes ordinary id lookup miss it, and retains only the deliberately required paths: surface delivery through `recordFor`, cancel, explicit close, and agent disposal (`acp-agent.ts:805-809`, `904-911`, `1358-1363`, `3360-3510`). The pending close is released only from the surface completion signal supplied by both v1 and v2 (`acp-foreground.ts:64-91`, `acp-surface-v1.ts:269-286`, `acp-surface-v2.ts:417-438`).

I found no contract violation or blocker.

## 2. Correctness, regressions, architecture, wire contracts

The request-admission boundary is correctly centralized: all normal ACP requests resolve through `#sessions`, while parked records are intentionally invisible to those lookups. This covers prompt/config/mode and the v1 load/fork paths, while `resume`/`load` cannot reopen a successfully deleted file because the stored-session lookup no longer finds it (`acp-agent.ts:967-1019`, `1800-1870`, `2057-2089`). The dedicated wire tests compare every in-window route against a never-issued id on both exposed protocol surfaces and exercise cancel, close, and agent-dispose exceptions (`test/acp-session-identity.test.ts:263-461`).

`ClosingSession.start()` is an idempotent close latch: repeated close, deferred delete completion, and agent disposal share its one `#runClose` promise (`acp-agent.ts:3359-3422`). `AgentSession.dispose()` itself is idempotent (`session/agent-session.ts:6411-6415`), which also makes the fatal-relocation repair safe where the session is immediately disposed while record cleanup completes through the shared ACP close path.

I did not re-derive the F3-closed deletion-race or unrelated-backlog classes. The supplied F3 report records both closed. Its remaining `non-atomic session-file/artifact deletion` item is explicitly a pre-existing/direct-storage-consumer residual and remains below this brief's blocking threshold; the changed current-manager path compensates deletion failure by authoritative repair.

## 3. Security and privacy delta

No security/privacy delta found. The diff does not add or weaken authentication, authorization, real credential handling, or third-party personal-data handling. The added warning includes an ACP session id and action name, not conversation content or a credential (`acp-agent.ts:3190-3201`), and uses the repository logger rather than console output.

## 4. Verification adequacy

The evidence reviewed is proportionate to the wire and persistence risk:

- The supplied real-process F1 manifest records all eight v1/v2 scenarios passing, including refusal, retained navigation/reload, delete confirmation plus post-delete unknown-session behavior, and the no-headerless-file scan (`.omp/team-config/evidence/gate/acp-session-transitions/f1-results.json`).
- The F1 driver is discriminating for the principal behavior: against main it reportedly observed only the intended navigation/reload guards pass; on the reviewed tree it checks id stability, no new file/session, persistence of the subsequent prompt, protocol-specific turn completion, equality with never-issued-id errors, and deleted-file absence (`f1-acp-qa.ts:330-489`).
- Store coverage uses real file storage and covers post-delete writes, new/switch recovery, other-file deletion, failed delete, deletion/drain races, close failure recovery, and concurrent target changes (`test/session-manager/drop-current-session.test.ts:48-356`).
- The focused ACP test exercises both v1 and v2 and covers the uniquely risky admission window by holding confirmation delivery rather than relying only on a post-turn assertion (`test/acp-session-identity.test.ts:209-461`).

Non-blocking note: the new evidence supports normal and adversarial delete paths. It does not directly instrument the additional repeated-`session/close` race below; the shared `ClosingSession.start()` latch makes the outcome statically supported, but a focused regression would make that ownership guarantee independently observable.

## 5. Final

No blocker found.

PASS

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Once an ACP record enters the closing map, concurrent repeated `session/close` requests and connection disposal share one teardown operation rather than independently disposing the same record.
  positive_witness: A second close and agent disposal both await the same parked record's close, with one session shutdown/exit sequence and no post-drain session frames.
  negative_control: A second lifecycle request starts a separate teardown, causing duplicate exit persistence, duplicated resource release, or a close response that overtakes a final queued update; this MUST fail.
  observable: Instrumented disposal-call count plus ordered v1/v2 frame capture for a delete followed by concurrent close and connection shutdown.
  boundary: AcpAgent `ClosingSession.start` / `#runClose` lifecycle boundary.
END-REVIEW-TRAILER
