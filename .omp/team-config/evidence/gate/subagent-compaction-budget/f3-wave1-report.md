## Must-fix

None found.

## Should-fix

- **`packages/coding-agent/CHANGELOG.md:13` — The entry says agents get a notice and a final report unconditionally.** The notice can be disabled with `task.softRequestBudgetNotice`, and the forced-yield attempt can fail or hit the hard-abort grace limit. This can give users a stronger guarantee than the implementation provides; it does not block because `docs/tools/task.md:176` describes the notice condition and grace limit.
  - **Fix:** Say the agent is *asked* to wrap up when notices are enabled, then is force-stopped and asked for a final report after one more completed compaction.
  - **class:** unconditional user-facing budget guarantees.
  - **sites:** The changed changelog entry on both branches; the task documentation and setting description qualify the notice. Search: `functions.grep` with pattern `softCompactionBudget|compaction budget` over each supplied worktree’s `docs` and `packages/coding-agent` paths. The diff contains no other changed user-facing description of this guarantee.

- **`packages/coding-agent/test/task/executor-soft-budget.test.ts:841-842` — The notice assertion builds its expected text with the same production helper that builds the actual text.** A template that renders an empty or misleading notice can therefore satisfy the equality assertion; this is a non-blocking verification gap because real-surface notice checks remain planned for F1.
  - **Fix:** Assert independently on the delivered notice’s count, budget and wrap-up instruction, in addition to its delivery options.
  - **class:** self-derived expected notice content.
  - **sites:** The three new notice equality assertions at lines 841–842, 857–858 and 893–894. Search: `functions.grep` with pattern `buildCompactionBudgetNotice` over `/Users/tim/git/oh-my-pi/.worktrees/fork-compaction-budget`; the upstream patch contains the same assertions.

## Nit

None.

## Checked

- **Duplication across slices/files:** No problematic instance found. The two budget paths share notice delivery and stop machinery; there is one feature slice.
- **Naming inconsistency:** No problematic instance found. Checked *compaction budget*, *notice* and *stop kind* across the setting, monitor, prompts and documentation.
- **Uneven API surface:** No instance found in the changed monitor inputs or its three construction sites.
- **Mixed conventions:** No problematic instance found. The compaction notice follows the existing asynchronous steering convention, and the stop uses the shared budget-stop path.
- **Missing or premature abstractions:** No cross-slice simplification candidate found. The shared notice sender removes the duplicated delivery sequence rather than introducing a second one.
- **Dead code:** No instance found among the new setting, helpers, state and prompt variables; production uses were found in the executor. Searched for `normalizeBudget|isCompletedCompaction|buildCompactionBudgetNotice|softCompactionBudget|budgetStopKind|compactionBudgetSteerSent` across the fork worktree.
- **Doc drift:** The unconditional changelog wording is recorded under Should-fix.
- **Surprise scope:** The seven changed files match the plan’s feature surface. The supplied patches show the same feature changes on both branches, with different changelog context; the fork changelog patch adds only the feature line.
- **Plan walks:** The stated out-of-scope areas—compaction thresholds/token accounting, main-session budgets and the separate `wait` feature—were not changed by the supplied diff. No i18n keys were introduced. The changed-file lists match the plan’s named files and test. The recorded mutation evidence shows the named negative controls failing; `merge-tests.txt` records 722 passing tests, one skipped and zero failing. The available evidence does **not** establish both branches’ `bun check` and GREEN runs. The three real-surface QA artifacts are absent and are explicitly scheduled for F1 after this review; they remain pending, not proven here.
- **Seams:** Reviewed the setting and all monitor call sites; event type, producer shapes and predicate; shared stop/grace state and abort-reason rendering; forced-yield prompt variable; notice template; documentation; and the mock-session tests. The real session abort and continuation paths were also traced, but have not been exercised in this review.
- **Simplification pass:** No cross-slice simplification candidate found. The self-derived test expectation is recorded above as a verification improvement.

PASS