**Bottom line:** The change holds up architecturally: `RelocationAdmission` centralizes coordination at the registry boundary, callers retain tickets through the synchronous hand-off, and relocators retain leases through move, rescope, failure, and rollback. I found no realistic, substantiated blocker in the supplied diff; the remaining concerns are hardening opportunities around assumptions outside the admission state machine.

### 1. Architectural fit

Yes. `packages/coding-agent/src/registry/relocation-admission.ts` provides one coordination primitive per `AgentRegistry`, avoiding separate queues in IRC, lifecycle, task, RPC, and UI layers. The division of responsibility is coherent:

- Producers acquire tickets through `IrcBus.#deliver`, `AgentLifecycleManager.ensureLive`/`promptLive`, `handleRpcSteerSubagent`, and `runSubagentFollowUpTurn`.
- Relocation entry points acquire leases through `AgentSession.holdRelocationAdmission`, `CommandController.#withSessionMove`, and `relocateHeadlessSession`.
- `sessionTreeMembership` supplies shared topology semantics rather than duplicating path checks.
- `SessionManager.getMoveTargetSessionFile`, the hold-time ID snapshot, and source/current/target artifact directories collectively protect the descendant-ref rebasing interval.
- `createWarmSubagentReviver` follows the registry’s rebased `sessionFile`, closing the concrete post-move `ENOENT` found during real-surface QA.

The design also preserves the important hand-off distinction: admission ends when a prompt or continuation becomes visible to `findRunningSessionWork`, not after the entire provider turn. That avoids converting relocation admission into a turn-completion lock.

### 2. What a line-level audit structurally misses

The code is sound only while several system-level contracts remain true:

- **Registry-domain contract:** every relocation and producer for a tree must use the same `AgentRegistry`. The barrier is intentionally in-memory and cannot coordinate another registry or process.
- **Relocation serialization contract:** `RelocationAdmission.hold` coalesces equal `rootId` holds and makes later holds ready immediately. It supports intentional nesting but is not a mutex for independent, concurrently mutating relocations.
- **Operational restoration contract:** updating the rebased transcript path proves where JSONL is read and written, but the supplied diff does not expose enough of `SessionManager.open` and session construction to prove the first revived tool call receives the relocated cwd.
- **Identity-generation contract:** admission is keyed by agent ID. `IrcBus.#deliver` re-fetches the ref after waiting but does not repeat the advisor/messageability check, so correctness assumes IDs are not normally reused for a different agent kind during that wait.

These assumptions do not block because the supplied production paths and QA establish no ordinary trigger violating them.

### 3. Highest-impact failure mode

The most damaging plausible failure is split-brain session operation: a peer wake or parked revival starts during relocation, operates in the checkout being left, or appends through a transcript path that has already moved. That directly breaks the feature’s value proof and could leave reversible but confusing local state across two checkouts.

The change addresses that failure at all visible boundaries: admission starts before revival or submission, leases cover rollback and rescope, pre-hold work is drained and then inspected, root wakes claimed around the boundary are deferred, descendant membership spans source and destination paths, and warm revival follows the rebased registry ref. The TUI and ACP evidence additionally demonstrates same-tree waiting, unrelated-tree progress, refusal for active descendants, and revival from the relocated transcript.

The remaining cwd-sensitive revival question is a note rather than a blocker: transcript placement is proven, but the first revived child tool operation was not exercised, and the deciding unchanged reopen behavior is absent from the supplied diff.

### 4. Auditor finding assessment

The accepted latency finding is **not** a false positive on unchanged behavior: ticket acquisition was added to live chat, steering, and follow-up paths. The impact is nevertheless limited to matching relocation windows and was explicitly classified as non-blocking.

The claimed regression-proof gap in `packages/coding-agent/test/task/executor-subagent-reminders.test.ts` is a false positive. After `busyWaitStarted`, the test takes `firstLease`, releases the busy turn, drains continuations, and asserts `prompts === 1` while the lease remains held. It releases `firstLease` only afterward, at which point `retryStarted` and prompt two may proceed. Without retry-side reacquisition, prompt two would start while `firstLease` was held, so this sequence does discriminate the reacquisition behavior.

The gate-record SHA observation is factual process binding, not a runtime-behavior finding. The final record still needs to be regenerated against the final reviewed SHA before merge.

### Notes

- **Note N1:** Same-root lease coalescing does not serialize independent relocation bodies. This does not block because the supplied entry paths use existing move fences/gates or are invoked serially, and no normal concurrent direct-relocator trigger is established.
- **Note N2:** The real parked-descendant QA proves relocated transcript use but not a cwd-sensitive tool operation. This does not block because no incorrect cwd behavior is demonstrated.
- **Note N3:** `IrcBus.#deliver` does not repeat the advisor-kind check after waiting. This does not block because it requires same-ID unregister/reuse as another kind during relocation and produces only reversible local effects.

### Action plan

1. Accept the strategic review without a code fix wave.
2. Correct the audit record’s characterization of the retry-reacquisition test; its held `firstLease` is already a discriminating negative control.
3. Regenerate the final trailers and gate record against the final reviewed SHA before merge.
4. As optional hardening, add a parked-descendant post-move probe that runs a cwd-sensitive tool and verifies a marker appears only in the destination checkout.
5. If concurrent direct relocation becomes supported, add an explicit per-root relocation mutex rather than relying on nested lease counting.
6. If same-ID agent-kind reuse is supported, repeat the messageability/advisor check on the post-admission ref in `IrcBus.#deliver`.

**Effort:** Short (1–4h) for the optional hardening; no required remediation.

**Confidence:** Medium — the supplied diff and evidence cover the admission and relocation seams well, but unchanged relocation serialization and session-reopen cwd semantics were unavailable.

**Watch out for:**
- Independent same-root relocators bypassing the assumed outer serialization.
- A rebased transcript reopening with the source checkout as operational cwd.
- Agent IDs being reused for a different kind while an admission wait is pending.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Independent relocation bodies for the same root must never mutate the session file or operational cwd concurrently, even though nested admission holds for that root are immediately ready.
  positive_witness: A second relocation is refused or waits at the existing relocation gate before entering moveSession, while the first relocation settles to one coherent session file and cwd.
  negative_control: Two direct relocators obtain ready same-root holds and interleave transcript moves, rescoping, or rollback.
  observable: Maximum concurrent relocation-body count is one; the final session file and cwd identify the same destination; held peer delivery occurs exactly once after that state settles.
  boundary: Session relocation entry-point serialization before AgentSession.moveSession and SessionManager.moveTo.
END-REVIEW-TRAILER