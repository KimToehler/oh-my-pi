## Must-fix

None found.

## Should-fix

None found.

## Nit

None found.

## Checked

1. **Duplication across slices/files:** No problematic instance found. Request and compaction budgets share the steering and stop machinery.
2. **Naming inconsistency:** No problematic instance found. Checked *compaction budget*, *notice*, and *stop kind* across settings, executor, prompts, and documentation.
3. **Uneven API surface:** No instance found. All three monitor construction sites supply the compaction budget; the wake and follow-up monitors disable it.
4. **Mixed conventions:** No problematic instance found. The compaction notice uses the existing steering delivery convention and shared pluralization helper.
5. **Missing abstractions:** No problematic instance found. The shared notice sender avoids duplicating the asynchronous delivery sequence.
6. **Dead code:** No instance found among the new setting, helpers, monitor state, and prompt variables. Searched the fork tree with `functions.grep` for `normalizeBudget|isCompletedCompaction|buildCompactionBudgetNotice|budgetStopKind|compactionBudgetSteerSent|softCompactionBudget`; the supplied upstream patch contains corresponding uses.
7. **Doc drift:** No new instance found. The previous unconditional-changelog-guarantee finding remains closed; both branches qualify the notice and say the agent is *asked* for a report.

- **Surprise scope and plan:** Both changed-file lists contain the seven planned feature files. The patches carry corresponding code and test changes, with different changelog context. No change to compaction thresholds or token accounting, main-session budgets, or the separate `wait` feature was found. No i18n keys were added.
- **Verification checklist:**
  - **RED and mutation:** The recorded mutations demonstrate the non-counting, disabled-budget, and grace negative controls. `red.txt` does not identify its failing rows, so it does not independently establish all specified original RED rows. `row4-red.txt` records the delivered-report regression failing before its fix; `row4-mutation.txt` also records the mid-turn negative control.
  - **GREEN:** `row4-verification.txt` records passing task-suite summaries and type checks on both supplied heads. The available excerpts do not independently establish the complete planned `bun check` commands on both current heads.
  - **Real surface:** The `f1-prefix` artifacts record notice, stop, shake, and disabled-budget runs on an earlier fork commit, not the reviewed head. The shake artifact records zero shaken tool results and does not demonstrate a reclaimed shake counted beyond the number of compaction entries. The plan’s F1 real-surface wave remains pending on the final head.
- **Seams:** Reviewed the setting and monitor call sites; event type, producer inventory, predicate, and subscriber; shared stop and grace state; the unstructured delivered-report early exit; forced-yield prompt variables; notice template; documentation; and mock-session tests.
- **Previous classes:** No earlier class reopened. The pinned plan records the decision to decline the self-derived expected-notice assertion finding; singular notice wording is corrected in the template.
- **Simplification pass:** No cross-slice simplification candidate found.
- **Residual risk:** The latest delivered-report fix is covered by mock-session regression and mutation evidence, but its real-session behavior has not yet been established on the reviewed head.

PASS