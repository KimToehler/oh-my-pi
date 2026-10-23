## Must-fix

None found.

## Should-fix

None found in the implementation delta.

## Nit

None found.

## Checked

1. **Duplication across slices/files:** No problematic instance found. Both budgets share the stop and asynchronous notice-delivery machinery.
2. **Naming inconsistency:** No problematic instance found across *compaction budget*, *notice*, and *stop kind* in settings, executor, prompts, and docs.
3. **Uneven API surface:** No problematic instance found. All three monitor construction sites supply the new arguments; wake and follow-up monitors disable the compaction budget.
4. **Mixed conventions:** No problematic instance found. The new notice uses the existing steering options and pluralization helper.
5. **Missing or premature abstractions:** No problematic instance found. The shared notice sender avoids duplicating delivery and error handling.
6. **Dead code:** No instance found among the new setting, helpers, monitor state, and prompt variables. Searched the fork tree with `functions.grep` for `normalizeBudget|isCompletedCompaction|buildCompactionBudgetNotice|budgetStopKind|compactionBudgetSteerSent|softCompactionBudget|reportDelivered|unstructuredReportDelivered`.
7. **Doc drift:** No instance found in the revised guarantee. The setting description now says the agent is **asked** for a final report, matching the changelog; the task documentation also names the grace-window hard abort. The wave-6 class is closed on both branches, and no earlier class was found reopened.

- **Surprise scope and plan walks:** Both file lists contain the planned feature surface and tests, including the request-guard regression test. The supplied patches carry corresponding changes with different changelog context. No implementation of the excluded compaction-threshold/token-accounting changes, main-session budgets, or separate `wait` feature was found. No i18n keys were added.
- **Verification checklist:** The recorded RED and mutation artifacts cover the counting, disabled-budget, grace-anchor, and delivered-report regressions. `row6-7-verification.txt` records passing `bun check` and task suites on both listed pre-row-8 heads. The recorded notice and stop real-surface runs show their intended behavior. Two requested real-surface witnesses remain unproven in the latest recorded artifacts: `f1-row6-7-a0c36fc/qa-shake.txt` shows zero shaken tool results, and its `qa-control.txt` captures only one compaction. An earlier control captured seven compactions without a notice or stop, but at an earlier commit. The artifacts reviewed do not establish real-surface QA on the supplied final fork head.
- **Seams:** Reviewed the setting and its monitor callers; event shape, shake emitter, counting predicate and subscriber; shared stop and grace state; delivery predicate and forced-yield ladder; prompt rendering; docs; and mock-session tests. Request stops anchor grace at the original threshold; compaction stops anchor it at the observed request count.
- **Simplification pass:** No cross-slice simplification candidate found.

Residual risk is principally the incomplete real-surface shake and final-head control evidence above; the mock-session tests and recorded mutations cover the corresponding logic but do not replace those witnesses.

PASS