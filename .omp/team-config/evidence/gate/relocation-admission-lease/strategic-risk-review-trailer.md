Bottom line: The change holds together architecturally: one per-registry admission primitive mediates both relocation holders and turn/revival producers, while hold-time snapshots plus source/current/target membership protect the transcript-rebase window. I found no substantiated blocker in the supplied diff; confidence is medium because the brief intentionally excludes unchanged implementations that determine descendant cwd restoration and relocation serialization.

### 1. Architectural fit

Yes. `RelocationAdmission` in `packages/coding-agent/src/registry/relocation-admission.ts` is the right ownership level: it is attached to `AgentRegistry`, rather than duplicated in IRC, lifecycle, or UI code. Producers take short-lived tickets at the hand-off boundary (`IrcBus.#deliver`, `AgentLifecycleManager.ensureLive`/`promptLive`, `handleRpcSteerSubagent`, and `runSubagentFollowUpTurn`), while relocation entry points own the longer lease (`AgentSession.holdRelocationAdmission`, `CommandController.#withSessionMove`, and `relocateHeadlessSession`).

The design also composes with the existing mutable transcript topology. `SessionManager.getMoveTargetSessionFile` publishes the destination before rebasing, and `AgentSession.holdRelocationAdmission` combines a hold-time ID snapshot with source, current, and target artifact directories. That is materially safer than deriving membership from one live path during a rename. Ticket release at synchronous prompt submission, rather than at turn completion, also preserves the existing refusal model: the running-work check can observe work without forcing relocation to wait for an entire provider turn.

### 2. What the line-level audit structurally misses

A caller inventory cannot prove the system-level assumptions on which this barrier depends:

- All relevant actors must share the same `AgentRegistry` instance. The barrier is deliberately in-memory and per registry; it cannot coordinate a producer routed through a different registry or process.
- Independent relocation operations for one root must already be serialized. `RelocationAdmission.hold` treats every later hold with the same `rootId` as nested and makes it ready immediately; it is an admission barrier, not a relocation mutex.
- Safe revival requires more than moving the JSONL. `createWarmSubagentReviver` now follows `expectedAgentRef.sessionFile`, but the supplied diff does not show whether reopening that transcript also restores the relocated operational cwd for the descendant's first real tool call.
- Agent IDs act as logical identities across an asynchronous wait. `IrcBus.#deliver` rejects an advisor before admission, then re-fetches the ref after waiting but checks only existence, not that the new ref is still messageable.

These are architectural contracts and generation/liveness concerns; they are not exposed by checking each changed call site in isolation.

### 3. Highest-impact production failure mode

The worst plausible failure is split-brain session state: a peer wake or parked revival starts while the parent is moving, reads or writes in the checkout being left, and appends to a transcript path that has already been renamed. The change addresses that failure at the important boundaries: admission begins before revival/submission, relocation owns the lease through rollback/rescope, dynamic membership spans the rename, and the warm reviver follows the rebased registry ref. The ACP evidence further demonstrates that a held parked descendant resumes from the moved transcript and leaves no old artifact directory.

The remaining evidence gap is narrower: the real parked-descendant QA proves transcript location and message completion, but not a cwd-sensitive tool operation by that revived child. That is worth a hardening test, not a blocker, because no contrary behavior is established in the supplied code and the relevant unchanged `SessionManager.open`/rebase semantics are outside the diff.

### 4. Auditor finding assessment

There is no auditor blocker to overturn. The residual latency observation is not a false positive on unchanged behavior: ticket acquisition is newly added at human chat, steer, and follow-up paths. However, “unconditional” should not be read as unconditional waiting—`tryAdmit` preserves the synchronous fast path, and user-visible delay occurs only while a matching relocation lease is active, which is the intended behavior.

### Findings

- Note N1: Same-root holds are coalesced and later holds receive immediate readiness; this does not block because the shown mode/session paths are designed to serialize or intentionally nest relocation, but direct concurrent relocator calls must remain outside the supported contract.
- Note N2: The evidence proves a rebased parked transcript but not the revived child's cwd-sensitive tool behavior; this does not block because no defect is shown, and the deciding unchanged reopen/rebase implementation was not supplied.
- Note N3: `IrcBus.#deliver` does not repeat the advisor-kind rejection after an admission wait; this does not block because it requires unregistering and reusing the same ID for a different agent kind during relocation, with only reversible local impact and no ordinary trigger established.

### Action plan

1. Accept the strategic review without a required fix wave.
2. As non-blocking hardening, add one real parked-descendant post-move probe that runs `pwd` and creates a marker, asserting the target checkout and moved transcript are both used and the source checkout remains untouched.
3. Keep independent same-root relocation serialized; if direct relocator concurrency is a supported API, add an explicit relocation mutex rather than relying on nested-hold counting.
4. If same-ID agent-kind reuse is supported, repeat the messageability/advisor check on the post-wait ref in `IrcBus.#deliver`.

Effort: Short (1–4h) for the optional hardening; no required remediation.

Confidence: medium — the supplied diff and evidence cover the intended race boundaries well, but unchanged session reopen and relocation-gate implementations could not be inspected under this brief.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: After a parent relocation settles, a parked descendant revived from its rebased transcript must execute cwd-sensitive tools in the relocated checkout, not merely append to the relocated JSONL.
  positive_witness: A held peer message revives the child after release; the child reports the target cwd, creates a marker only in the target checkout, and records the turn under the moved artifacts directory.
  negative_control: The child opens the moved transcript but retains the source cwd and creates the marker in the checkout that was left.
  observable: Reported pwd, source/target marker existence, and the registry plus SessionManager transcript paths after the first revived tool call.
  boundary: createWarmSubagentReviver and SessionManager.open through the revived AgentSession's first real tool execution.
END-REVIEW-TRAILER