## Must-fix

None found.

## Should-fix

None found.

## Nit

None found.

## Checked

1. **Duplication across slices/files:** No problematic instance found. Request and compaction budgets share the asynchronous notice sender and stop machinery.
2. **Naming inconsistency:** No problematic instance found. Checked *compaction budget*, *notice*, and *stop kind* across settings, executor, prompts, and documentation.
3. **Uneven API surface:** No instance found. All three monitor construction sites supply both the compaction budget and `structured`; wake and follow-up monitors disable the budget.
4. **Mixed conventions:** No problematic instance found. Compaction notices use the existing steering-delivery convention and shared prompt pluralization helper.
5. **Missing or premature abstractions:** No problematic instance found. The shared notice sender removes duplicated delivery logic.
6. **Dead code:** No instance found among the new setting, helpers, monitor state, and prompt variables. Searched the fork tree with `functions.grep` for `normalizeBudget|isCompletedCompaction|buildCompactionBudgetNotice|budgetStopKind|compactionBudgetSteerSent|softCompactionBudget|reportDelivered|unstructuredReportDelivered`; also searched the upstream source for monitor construction and delivery-predicate uses.
7. **Doc drift:** No new instance found. The prior changelog finding remains closed: both entries qualify the notice and say the agent is asked for a report. The singular notice uses `pluralize`.

- **Surprise scope and plan:** Both file lists contain the seven planned feature files. The supplied patches carry corresponding code and test changes; the changelog context differs. No implementation of the excluded compaction-threshold or token-accounting changes, main-session budgets, or the separate `wait` feature was found. No i18n keys were added.
- **Verification checklist:**
  - **RED and mutation:** `red-rows.txt` identifies the stop, reclaimed-shake, and hard-abort rows failing against the earlier executor; `mutation.txt` records the non-counting, disabled-budget, and grace negative controls. `row5-mutation.txt` records the new delivery-predicate regressions failing against the pre-fix executor and targeted mutations.
  - **GREEN:** `row5-verification.txt` records passing task-suite summaries and `check:ts` on both reviewed heads. It does not independently establish the plan’s complete `bun check` command on those heads.
  - **Real surface:** The notice, stop, shake, and disabled-budget artifacts record runs on fork commit `c309c364…`, not reviewed head `283ad9ca…`. The shake artifact reports zero shaken tool results and does not demonstrate a reclaimed shake counted beyond the compaction-entry count. Thus the plan’s final-head real-surface verification and its reclaimed-shake witness remain unproven by these artifacts.
- **Seams:** Reviewed the setting and monitor call sites; event type, producer shapes, predicate, and subscriber; shared stop and grace state; delivery predicate and forced-yield ladder; prompt variables and pluralization helper; documentation; and mock-session tests.
- **Previous classes:** No earlier class reopened. The plan records the decision to decline the self-derived expected-notice assertion finding; the singular notice wording is corrected.
- **Simplification pass:** No cross-slice simplification candidate found.
- **Residual risk:** The latest delivered-report fix has mock-session regression and mutation evidence, but its behavior on the real session surface has not been established on the reviewed head.

PASS