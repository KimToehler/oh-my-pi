## Must-fix

None found.

## Should-fix

None found.

## Nit

None.

## Previous finding classes

- **Unconditional changelog guarantees:** Closed at both listed sites. The fork and upstream entries now qualify the notice and say the agent is *asked* for a report rather than promising one.
- **Self-derived expected notice content:** The three assertions remain at `executor-soft-budget.test.ts:842`, `:858`, and `:894` on both branches. The pinned plan records the decline and its rationale: avoid pinning prompt wording, follow the existing request-budget test convention, and check the delivered notice during F1.

## Checked

1. **Duplication across slices/files:** No problematic instance found. The request and compaction paths share notice delivery and stop machinery.
2. **Naming inconsistency:** No problematic instance found. Checked *compaction budget*, *notice*, and *stop kind* across the setting, monitor, prompts, and docs.
3. **Uneven API surface:** No instance found. All three monitor construction sites supply the new budget.
4. **Mixed conventions:** No problematic instance found. The compaction path uses the existing steering and forced-yield conventions.
5. **Missing or premature abstractions:** No problematic instance found. The shared notice sender removes duplicated delivery logic.
6. **Dead code:** No instance found among the new helpers, setting, state, and prompt variable. Searched both worktrees with `functions.grep` for `createSubagentRunMonitor\(|softCompactionBudget|isCompletedCompaction|buildCompactionBudgetNotice|budgetStopKind|compactionBudgetSteerSent|normalizeBudget`.
7. **Doc drift:** No remaining instance found in the changed user-facing descriptions; the previous changelog class is closed.

- **Surprise scope and plan:** The seven changed files match the planned feature surface. The patches carry the same feature changes on both branches, with different changelog context; the fork changelog diff adds only the feature line. The diff does not implement the excluded threshold/token-accounting changes, main-session budgets, or the separate `wait` feature. No i18n keys were introduced.
- **Verification checklist:** `red.txt` records the stop, reclaimed-shake, and hard-abort tests failing on the unchanged source; the recorded mutation runs show the non-counting, disabled-budget, and grace negative controls failing as intended. `merge-tests.txt` records 722 passing tests, one skipped, and zero failing, plus the fork mutation results. The available artifacts do not establish the full GREEN commands and `bun check` on **both** branches. The three real-surface QA artifacts are absent and remain scheduled for F1.
- **Seams:** Traced the setting and monitor call sites; event type, producer shapes, predicate, and subscription; shared stop/grace state and abort reason; forced-yield prompt variable; notice template; docs; and mock-session tests. Also inspected the real session abort and compaction-completion ordering. Real-surface behavior has not been exercised in this review.
- **Simplification pass:** No cross-slice simplification candidate found.
- **Residual risk:** The mock tests do not establish the real session’s compaction-to-abort-to-forced-yield transition; the planned F1 scenarios remain the evidence for that surface.

PASS