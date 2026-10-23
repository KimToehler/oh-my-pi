## Must-fix

None found.

## Should-fix

- **`packages/coding-agent/src/task/settings.ts:452` — The setting description says the agent “must hand back its partial findings,” while the stop path can hard-abort without a report.** This can give users a stronger expectation than the implementation guarantees; it is non-blocking because it does not change runtime behavior.
  - **Fix:** Say that the stopped agent is *asked* for a final report, consistent with the changelog, and optionally mention the grace-window hard abort.
  - **class:** Overstated report guarantee. **sites:** The changed setting description on both branches. Search: `functions.grep` for `one more compaction|compaction.*partial findings|compaction.*final report` over the fork worktree’s `packages` and `docs`; the supplied upstream patch contains the same description.

## Nit

None found.

## Checked

1. **Duplication across slices/files:** No problematic instance found. The two budgets share the notice-delivery and stop machinery.
2. **Naming inconsistency:** No problematic instance found. Checked *compaction budget*, *notice*, and *stop kind* across settings, executor, prompts, and docs.
3. **Uneven API surface:** No problematic instance found. The three monitor construction sites supply `softCompactionBudget` and `structured`; the wake and follow-up monitors disable the compaction guard.
4. **Mixed conventions:** No problematic instance found. The new notice uses the existing steering convention and prompt pluralization helper.
5. **Missing or premature abstractions:** No problematic instance found. The shared asynchronous notice sender avoids duplicating delivery and error handling.
6. **Dead code:** No instance found among the new setting, helpers, monitor state, and prompt variables. Searched the fork tree with `functions.grep` for `normalizeBudget|isCompletedCompaction|buildCompactionBudgetNotice|budgetStopKind|compactionBudgetSteerSent|softCompactionBudget|reportDelivered|unstructuredReportDelivered`.
7. **Doc drift:** The setting-description wording is noted above. The previous changelog guarantee finding remains closed; the notice uses singular and plural rendering.

- **Surprise scope and plan:** The eight changed paths are the planned feature files and tests, including `task-guards.test.ts` for row 6. The supplied patches show corresponding feature changes on both branches, with different changelog context. No implementation was found for the excluded compaction-threshold/token-accounting changes, main-session budgets, or the separate `wait` feature. No i18n keys were added.
- **Verification checklist:** The recorded RED and mutation artifacts exercise the counting, disabled-budget, grace-anchor, and delivered-report regressions. `row6-7-verification.txt` records `bun check` passing on both named heads and the fork task suite at 727 pass, 0 fail; it does not show a final-head upstream task-suite summary. The recorded real-surface artifacts are from fork commit `283ad9ca…`, not the reviewed head `a0c36fc3…`. The shake artifact records zero shaken tool results and does not demonstrate the requested reclaimed-shake count beyond compaction entries. Thus final-head real-surface QA and that shake witness remain unproven by the artifacts reviewed.
- **Seams:** Reviewed the setting and monitor call sites; event type, emitter shapes, predicate, and subscriber; shared stop and grace state; delivery predicate and forced-yield ladder; notice and reminder rendering; documentation; and mock-session tests. The row-6 request stop anchors grace to the original threshold, while a compaction stop anchors it to the observed request count. The row-7 ladder restores the prior request-stop behavior.
- **Previous classes:** No earlier class was found reopened. The plan records the decision to decline the self-derived expected-notice assertion finding; the singular notice wording is corrected.
- **Simplification pass:** No cross-slice simplification candidate found.
- **Residual risk:** The latest changes have targeted regression and mutation evidence, but the reviewed head lacks the recorded real-surface witnesses described above.

PASS