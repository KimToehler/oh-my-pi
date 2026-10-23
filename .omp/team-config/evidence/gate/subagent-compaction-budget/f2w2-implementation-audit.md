## 1. Goal and behavioural contract

The compaction-budget path counts completed events, steers at the configured budget, and shares the existing forced-report machinery. The delivered-report guard covers both terminal yields and unstructured report turns. I found one regression in the shared request-budget grace calculation.

## 2. Correctness, regressions, architecture, wire contracts

Blocker B1: **Medium — request-budget hard-abort point can move later.** At `packages/coding-agent/src/task/executor.ts:1554-1557,1865-1872` on the fork, the change anchors grace to the *actual* request count when the stop fires instead of the existing request threshold. A realistic trigger is a pending nonterminal or rejected `yield` with parallel sibling tool completions: the existing deferred-check path can advance the count beyond 1.5× before it evaluates the budget (`executor.ts:2053-2059,2120-2125`; the parallel event ordering is exercised in `test/task/task-guards.test.ts:393-416`). With budget 2, for example, a deferred stop at count 5 previously hard-aborted on the next check at or beyond 8; it now waits until 10. This violates the explicit unchanged request-budget hard-abort criterion and can spend additional requests and money. The extra spending is not reversible. Fix by retaining the threshold-based grace deadline for request stops and using the recorded stop count for compaction stops; add a deferred-check regression that asserts the hard-abort count.

- **class:** request-budget grace deadline shifted by delayed budget evaluation.
- **sites:** the shared grace calculation in fork `executor.ts:1871` and upstream `executor.ts:1860`; both contain the same defect. Search: `BUDGET_STOP_GRACE_REQUESTS|budgetStopAtRequests|stopThreshold \+` across the fork `packages` tree, plus the supplied upstream patch. This class is **not closed** at either site.

## 3. Security and privacy delta

No security/privacy delta identified: the reviewed change does not touch a real credential, authentication or authorization path, or third-party personal data, nor weaken access to a protected asset.

## 4. Verification adequacy

The supplied RED and mutation artifacts exercise the main event predicate and delivery races; the head-bound QA artifacts show notice, forced unstructured report, post-report compaction, and disabled-budget behavior. `row5-bun-check.txt` and `row5-verification.txt` record successful checks and task/config tests on both heads.

**Note:** A reclaimed shake was not reproduced on the real surface; its counting is covered by the mock event test and RED evidence. This is a residual verification risk, not a blocker by itself.

**Note:** Existing request-budget tests exercise the ordinary threshold but do not discriminate the delayed-stop grace case in B1.

## 5. Final verdict

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A pending yield that defers request-budget evaluation must not extend the request-budget hard-abort deadline.
  positive_witness: With request budget 2 and a nonterminal yield whose sibling completions defer the stop until request count 5, an agent that continues without a terminal yield hard-aborts on the first subsequent budget check at or beyond count 8.
  negative_control: Anchoring the grace deadline to the delayed stop count allows the same run to continue until count 10 and MUST fail.
  observable: Recorded request count at the hard-abort event and the resulting abort reason.
  boundary: Subagent run monitor event handling and request-budget hard-abort decision.
END-REVIEW-TRAILER