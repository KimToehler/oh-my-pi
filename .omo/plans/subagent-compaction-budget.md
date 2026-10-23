# Soft compaction budget for subagents (upstream PR 2 of 2)

## Context

On 2026-10-23 subagent `AcpV2Surface-2` (Sonnet 5.5 via onara, ACP host) looped on reads for 5 h 07 min: 176 requests, 1.99M output tokens, 6 compactions, about $18, until Tim noticed and the orchestrator aborted it by hand. The only automatic guard, `task.softRequestBudget` (Tim: 150), sent its wrap-up notice at 06:52Z, 4 h 36 min into the run, because each request took 2-8 minutes of thinking. Tim's notice threshold of 150 would have triggered the forced stop only at request 225, which the run never reached.

Compactions separate the loop from productive runs. In the last 30 days of Tim's sessions (946 subagent transcripts), the 12 runs above 400k output tokens had 0-2 compactions, except three ACP v2 surface runs with 4, 4 and 6; these are the runs that circled. Output tokens do not separate them: productive runs reached 0.4-1.4M as well.

The new guard reuses the request budget's stop sequence (`packages/coding-agent/src/task/executor.ts:1497-1508`, `:1787-1818`, `driveSessionToResult` forced yield at `:2562-2600`): a steering notice, then a stop of the in-flight turn with one forced final `yield`, then a hard abort if the agent still does not yield within `BUDGET_STOP_GRACE_REQUESTS` (5) more requests. With a budget of 3, this run would have received the notice after compaction 3 (04:41Z) and been stopped after compaction 4 (05:34Z), with a partial report instead of a manual abort at 07:23Z.

The change is host- and provider-independent, so it targets upstream and branches from `upstream/main`. Plan 1 (`.omo/plans/subagent-wait-progress.md`) shows progress in `wait`; the two plans touch disjoint code and ship as separate PRs.

Decisions (Tim, 2026-10-23): fix in core and propose upstream; budget metric is compactions, not output tokens; `task.maxRuntimeMs` is not part of the fix.

## Approach

### 0. Worktree and plan file

```
git -C /Users/tim/git/oh-my-pi fetch upstream
git -C /Users/tim/git/oh-my-pi worktree add .worktrees/upstream-compaction-budget -b upstream-pr/subagent-compaction-budget upstream/main
cd /Users/tim/git/oh-my-pi/.worktrees/upstream-compaction-budget && bun install
```

The plan lives untracked at `.worktrees/fork-compaction-budget/.omo/plans/subagent-compaction-budget.md` (never committed to the upstream branch); the gate (`GC`, validator) runs with `--repo /Users/tim/git/oh-my-pi/.worktrees/fork-compaction-budget`, because the record binds the fork branch head. Evidence goes to `/Users/tim/git/oh-my-pi/.worktrees/fork-compaction-budget/.omo/evidence/subagent-compaction-budget/` (RED and mutation runs from the upstream worktree are copied there).

Every source path below is relative to `/Users/tim/git/oh-my-pi/.worktrees/upstream-compaction-budget`. A subagent briefed for this work MUST use absolute paths under that directory for every read, edit and write, and finish by checking that `git -C /Users/tim/git/oh-my-pi status --short --untracked-files=no` shows no stray `packages/` change.

### 1. Setting

`packages/coding-agent/src/task/settings.ts`, next to `cfgTaskSoftRequestBudgetNotice` (line 443): register `task.softCompactionBudget`, type number, default 3, tab `tasks`, group `Subagents`, label `Soft Subagent Compaction Budget`, options 0 (Disabled), 2, 3 (Default), 5. Description: after this many automatic compactions in one subagent run, a wrap-up notice is sent (when `task.softRequestBudgetNotice` is on); one more compaction stops the run and asks for a final report; 0 disables.

Normalization: move the clamp in `resolveSoftRequestBudget` (`executor.ts:193-203`; 0 disabled, negative or fractional normalized) into one exported `normalizeBudget(value: number): number` and use it for both budgets. The existing `resolveSoftRequestBudget` tests stay green unchanged.

### 2. Monitor: count compactions and share the stop

In `createSubagentRunMonitor` (`executor.ts:1338`):

- `RunMonitorArgs` (line 1216) gains `softCompactionBudget: number` (0 disables). `runSubprocess` (line 4256 area) reads it through `normalizeBudget(cfgTaskSoftCompactionBudget.get(settings))`; the two monitors that pass `softRequestBudget: 0` (irc wake turn, line 3341; revive, line 3791) also pass `softCompactionBudget: 0`.
- Count in the `attach` subscription (`session.subscribe`, line 2238, next to `auto_retry_start`). An `auto_compaction_end` counts as one completed compaction when `aborted === false`, `skipped !== true` and `errorMessage === undefined`, for every action. Against the real emitters in `packages/coding-agent/src/session/session-maintenance.ts` that rule gives:
  - counted: context-full with `result` (1896), threshold/overflow methods with `result` (5798), the snapcompact frame rescue with `result` (5012), and a reclaimed shake, which carries `result: undefined, skipped: false` and no `errorMessage` (5921, also with `willRetry: true`).
  - not counted: aborted ends (1777, 1801, 5075, 5107, 5577, 5668, 5855, 5974), skipped ends (4888, 4904, 5012 without rescue, 5921 when nothing was reclaimed, 1819/1843), and ends with an `errorMessage`: method fallbacks (shake 5907, handoff 5123, context 5601) and failures (1933, 5304, 5617, 5987). A fallback is followed by the next method's own end, so one logical compaction counts once.
  The rule lives in one exported predicate `isCompletedCompaction(event)` in `executor.ts`, documented with this table.
- After incrementing, call `evaluateCompactionBudget()`:
  - `compactionCount > budget` → `requestBudgetStop("compactions")`.
  - once a terminal `yield` is recorded (`yieldCalled`), later compactions neither steer nor stop: the run has delivered.
  - `compactionCount === budget` and `softRequestBudgetNotice` → steer the notice once (`compactionBudgetSteerSent`), with the same async boundary and `deliverAs: "steer", attribution: "agent"` as the request notice (lines 1803-1817).
- `requestBudgetStop(kind: "requests" | "compactions")` records `budgetStopKind` and `budgetStopAtRequests = progress.requests`. The grace check in `evaluateSoftRequestBudget` (line 1790-1797) becomes `progress.requests >= budgetStopAtRequests + BUDGET_STOP_GRACE_REQUESTS` and runs whenever a stop was requested, regardless of which budget stopped the run (today it returns early when `softRequestBudget <= 0`). For the request budget, the stop fires at `ceil(1.5 × budget)`, so the hard-abort request count is unchanged.
- `resolveAbortReasonText` (line 1579-1590): for `budgetStopKind === "compactions"`, `Soft compaction budget exceeded (<n> compactions; budget <b>)`, with the `— agent did not yield when force-stopped` suffix in the hard-abort case, mirroring the request texts.

### 3. Prompts

- New `packages/coding-agent/src/prompts/system/subagent-compaction-budget-notice.md` (Handlebars: `compactions`, `budget`): the run has been compacted `{{compactions}}` times (soft budget `{{budget}}`); repeated compaction usually means the task is circling; finish the current step and deliver the final report; one more compaction force-stops the run. Rendered with `prompt.render`, imported `with { type: "text" }`. The existing request notice stays as is.
- `packages/coding-agent/src/prompts/system/subagent-yield-reminder.md`: the two `budgetStop` branches say `Request budget crossed`. Pass `budgetStopKind` from `driveSessionToResult` (line 2594-2599) and render `Compaction budget crossed` for compactions; the rest of each branch stays the same.

### 4. Tests (write first, record RED)

In `packages/coding-agent/test/task/executor-soft-budget.test.ts`, a new `describe("runSubprocess soft compaction budget")` using the file's `createMockSession` (its `emit` reaches the monitor's `subscribe` listener) with `Settings.isolated({ "task.softRequestBudget": 0, "task.softCompactionBudget": 2 })`. Event fixtures copy the real emitter shapes listed in step 2, each named after its source line: `snapcompactDone` (5798 shape, with a minimal `result`), `shakeReclaimed` (5921, `result: undefined, skipped: false`), `shakeNothing` (5921, `skipped: true`), `shakeFallback` (5907, `skipped: false`, `errorMessage`), `abortedEnd` (5075), `failedEnd` (5987, `skipped: false`, `errorMessage`).

- `#given compaction budget 2 #when a third completed compaction ends #then the turn is stopped and a forced final yield returns the partial report`: prompt 1 emits two assistant messages with a `snapcompactDone` after each, then a third `snapcompactDone`; prompt 2 answers with a terminal `yield`. Assert exactly one compaction notice, steered after compaction 2 and not after compaction 1; one abort before the reminder; prompt 2 synthetic with `toolChoice` yield and containing `Compaction budget crossed`; `result.aborted === false`, `exitCode === 0`, output is the report.
- `#given compaction budget 2 #when reclaimed shakes end #then they count like any compaction`: two `shakeReclaimed` ends give the notice, a third gives the stop.
- `#given compaction budget 2 #when one non-counting end and then one completed compaction end #then no notice is sent`, one row per fixture `shakeNothing`, `shakeFallback`, `abortedEnd`, `failedEnd`: each row emits that fixture followed by one `snapcompactDone` and asserts no compaction notice and no stop. If the fixture were counted the count would reach 2 and the notice would fire, so every row discriminates on its own. Each row then emits one more `snapcompactDone` and asserts the notice arrives exactly then.
- `#given compaction budget 0 #when five compactions end #then no notice and no stop`.
- `#given a compaction stop #when the agent keeps answering without yield #then the run hard-aborts after 5 more requests with the compaction abort reason`: `result.aborted === true`, `abortReason` matches `Soft compaction budget exceeded (3 compactions; budget 2) — agent did not yield`.

RED: run the file against the unchanged source and save to `.omo/evidence/subagent-compaction-budget/red.txt`. The stop, reclaimed-shake and hard-abort rows must fail there (no notice, no stop). The non-counting rows and the budget-0 row already hold on unchanged source because nothing counts; they are green baselines, not RED evidence. Their negative control is a mutation run after implementation: (a) replace `isCompletedCompaction` with `() => true`, so every non-counting row must fail; (b) ignore budget 0 by falling back to 3, so the budget-0 row must fail. Save both runs to `.omo/evidence/subagent-compaction-budget/mutation.txt` and revert the mutations (`git diff` empty for `executor.ts` afterwards). The existing request-budget tests in the file are the regression guard for the shared grace change and must stay green.

### 5. Docs and changelog

- `docs/tools/task.md` (soft request budget line 175): one sentence for `task.softCompactionBudget` (default 3, notice at the budget, forced report after one more, 0 disables).
- `packages/coding-agent/CHANGELOG.md` `## [Unreleased]` → `### Added`: `Subagents that keep compacting are now wrapped up automatically: after task.softCompactionBudget compactions (default 3) they get a wrap-up notice, and one more compaction stops them with a final report`.

### 6. Verify and commit

`cd packages/coding-agent && bun test test/task/executor-soft-budget.test.ts test/task` and `bun check` from the worktree root. Commit only the named files: `feat(coding-agent): stop subagents that keep compacting with a forced final report`.

### 7. Fork integration and upstream PR

The gate covers the code the fork actually runs, so the fork integration happens before F3/F2, not after:

- After step 6 on the upstream branch: in a second worktree `git -C /Users/tim/git/oh-my-pi worktree add .worktrees/fork-compaction-budget -b feat/fork-compaction-budget main`, then `git cherry-pick -x` the upstream commit(s). Not `merge --no-ff`: fork `main` and `upstream/main` diverged by 265 upstream commits since their merge base, so a merge would drag all of them into this branch and conflicts in `packages/utils/src/acp/transport.ts` and `test/issue-2750-subagent-runtime-fallback.test.ts` unrelated to this feature (tried 2026-10-23). The cherry-pick applies cleanly against the fork's `executor.ts`. Rerun the step-6 tests and the step-4 mutation runs on the fork branch and save them to `merge-tests.txt`.
- F3 and F2 review both heads: the upstream branch (`upstream/main...upstream-pr/subagent-compaction-budget`) and the fork branch (`main...feat/fork-compaction-budget`). The gate record binds the fork branch head. Fixes land on the upstream branch first and are cherry-picked onto the fork branch; a code change on either branch after review voids it and needs a delta review over `<last reviewed>...<head>`.
- After F2: fast-forward fork `main` to `feat/fork-compaction-budget` and copy this plan back to `.omo/plans/` in the main checkout. Tim's `config.yml` needs no change: the default 3 applies.
- Push the upstream branch to `origin`. Draft the PR body from `.github/PULL_REQUEST_TEMPLATE.md` into `.omo/drafts/upstream-pr-compaction-budget.md` with a `TODO(Tim)` placeholder for the contributor sentence. Do NOT open the PR: Tim writes the sentence and confirms target and text first.

## Critical files & anchors

- `packages/coding-agent/src/task/executor.ts`: `resolveSoftRequestBudget` 193, `BUDGET_STOP_GRACE_REQUESTS` 206, `RunMonitorArgs` 1216, `createSubagentRunMonitor` 1338, `requestBudgetStop` 1497, `resolveAbortReasonText` 1579, `evaluateSoftRequestBudget` 1787, `attach`/`subscribe` 2238, forced yield reminder 2594, disabled monitors 3341 and 3791, budget resolution 4256
- `packages/coding-agent/src/task/settings.ts:396-454` (request budget settings)
- `packages/coding-agent/src/session/agent-session-events.ts:38-46` (`auto_compaction_end` shape)
- `packages/coding-agent/src/prompts/system/subagent-yield-reminder.md`
- `packages/coding-agent/test/task/executor-soft-budget.test.ts`

Line numbers are from the fork; on `upstream/main` 0b5c27ab24 the executor anchors sit about 11-24 lines earlier (`requestBudgetStop` 1486, `evaluateSoftRequestBudget` 1776, `auto_retry_start` 2219).

## Verification

1. RED: step-4 RED rows on unchanged source (`red.txt`); mutation runs for the baseline rows (`mutation.txt`).
2. GREEN: step-6 commands, on the upstream branch and on the fork branch (`merge-tests.txt`).
3. Real surface, notice: run `bun packages/coding-agent/src/cli.ts -p` from the fork worktree with `PI_CODING_AGENT_DIR` set to a fresh copy of `~/.omp/agent` (sessions, blobs and backups left out) whose `config.yml` sets `task.softCompactionBudget: 1`, `compaction.thresholdTokens: 30000`, `compaction.modelThresholdsEnabled: false` (Tim's `modelThresholds` would otherwise override the token limit) and `compaction.methodOrder: [snapcompact, soft]`. The main agent spawns one synchronous `task` subagent that reads two large files in explicit 250-line pages (an unranged `read` of a large file returns an outline, which never fills the context). Save to `qa-run.txt`: the subagent transcript's `compaction` entries, the notice after compaction 1 and the task result. The default `task` agent is unstructured and has no `yield` tool: it ends with prose, and an agent that obeys the notice ends the run itself before a second compaction.
3b. Real surface, stop: the same run with `task.softRequestBudgetNotice: false`, so the agent keeps reading; save to `qa-stop.txt` the compaction entries, the forced wrap-up prompt (`Compaction budget crossed`) after compaction 2 and the task result (completed with a report, not aborted).
4. Real surface, shake: the notice run with `compaction.methodOrder: [shake, soft]`; save to `qa-shake.txt` the transcript's compaction entries, the shaken tool results and the notice. A notice whose count exceeds the number of `compaction` entries shows that reclaimed shakes count; fallbacks to `soft` count once.
5. Control: the stop run with `task.softCompactionBudget: 0` compacts at least twice with no notice and no stop (`qa-control.txt`).

## TODOs

- [x] 1. Fork branch only: the cherry-pick `ba4a8457cd` applied the `CHANGELOG.md` hunk with upstream's context and inserted 28 unrelated upstream `[Unreleased]` lines (two Added entries, a whole `### Fixed` block) into the fork's changelog. Restore `packages/coding-agent/CHANGELOG.md` to `main`'s bytes plus only the feature's one `### Added` line. Acceptance: `git diff main -- packages/coding-agent/CHANGELOG.md` shows exactly one added line; every other file's added/removed lines equal the upstream branch's.
- [x] 2. F3 wave 1 Should-fix (class: unconditional user-facing budget guarantees; site: the feature's `### Added` line in `packages/coding-agent/CHANGELOG.md` on both branches). The entry promises a notice and a final report unconditionally; the notice depends on `task.softRequestBudgetNotice`, and a run that does not yield within the grace is hard-aborted. Reword to: the agent is asked to wrap up (when `task.softRequestBudgetNotice` is on) and one more compaction stops the run and asks for a final report. Acceptance: both branches carry the same reworded line, nothing else changes. The second F3 Should-fix (test expectations built with `buildCompactionBudgetNotice`) is declined: an independent expected string would pin prompt wording, which the repo's testing guidance bans, the request-budget test at line 289 uses the same convention, and F1 checks the delivered notice on the real surface.
- [x] 3. F1 finding (single instance: `subagent-compaction-budget-notice.md` is the only template rendering the count): with budget 1 the notice reads "compacted 1 times". Render the count with the existing `pluralize` helper (`{{pluralize compactions "time" "times"}}`) on both branches. Acceptance: the notice reads "compacted 1 time" for 1 and "compacted 3 times" for 3; `test/task` stays green.
- [x] 4. F1 finding (QA shake run, `qa-shake.txt`): an unstructured subagent obeyed the notice and ended its turn with its final report; the post-turn maintenance then compacted again (count 2), the stop fired on an idle session, and `runYieldLadder` sent the forced wrap-up prompt, so the run spent one more request and its output became the second report instead of the delivered one. Class: forced wrap-up after a delivered report; sites: the `budgetStop` branch of `runYieldLadder` in `task/executor.ts`, shared by both stop kinds (the request budget reaches it when the report turn itself crosses 1.5x; searched `budgetStopRequested()` callers in `task/executor.ts`). Fix on both branches: after `waitForBudgetStop()`, an unstructured run whose last assistant message ended with `stopReason: "stop"` and a report turn (`monitor.lastReportTurnText()`) has delivered; break out of the ladder instead of prompting. A stop that lands mid-turn leaves an aborted or `toolUse` last message and still gets the forced wrap-up. Regression test in `executor-soft-budget.test.ts`, RED on the unfixed source: unstructured run, budget 1, a tool turn, compaction 1, a final text report, compaction 2 → one prompt, `aborted` false, `exitCode` 0, output equals the first report.
- [x] 5. F2 wave 1 blocker B1 (both reviewers; class: post-delivery compaction steering; site: `evaluateCompactionBudget` in `task/executor.ts`, the only compaction-budget steering decision, on both branches). An unstructured subagent ends its turn with its report and post-turn maintenance brings the count exactly to the budget: the monitor only knows `yieldCalled`, so it queues the notice, and `AgentSession.#scheduleCompactionContinuation` starts another turn for the queued message, which spends a request and replaces the delivered report. Fix on both branches: the monitor owns one delivery predicate, `reportDelivered()`: a terminal `yield`, or for an unstructured run (`structured` becomes a required `RunMonitorArgs` field) a last assistant message that ended with `stopReason: "stop"` and report text and started no further work; it is recomputed at every assistant `message_end`, so a later continuation that starts work re-arms the budget. `evaluateCompactionBudget` neither steers nor stops while it holds (the count still advances), the queued notice re-checks it inside its microtask before `sendUserMessage`, and `runYieldLadder`'s row-4 check uses the same predicate. Request-budget steering is unchanged. Regression test, RED on the current source: unstructured run, budget 1, a tool turn, the final report, then compaction 1 → no steer after the microtask settles, one prompt, output equals the report.
- [x] 6. F2 wave 2 blocker B1 (both reviewers; class: request-budget grace deadline shifted by delayed budget evaluation; site: `requestBudgetStop` in `task/executor.ts`, the only writer of `budgetStopAtRequests`, on both branches). `budgetStopAtRequests = progress.requests` anchors the grace window at the count when the stop fires; when a pending `yield` defers the request-budget check, the stop fires above 1.5x and the hard abort moves later (budget 2, deferred stop at request 5: abort at 10 instead of 8), so the request budget's hard-abort point changes, against the third Feature-specific criterion. Fix on both branches: a request stop anchors grace at its threshold (`softRequestBudget * 1.5`, the pre-change `stopThreshold`), a compaction stop at the observed request count. Regression test in `test/task/task-guards.test.ts`, RED on the current source: budget 2, a pending `yield` while four streamed steps run, a nonterminal yield, then three more steps → hard-aborted with the request budget's "did not yield" reason at request 8.
- [x] 7. F2 wave 2 blocker B2 (strategic; class: cross-budget semantic expansion; site: the delivered-report break in `runYieldLadder`'s `budgetStop` branch, added by row 4, the only request-budget consumer of the unstructured delivery state). Decision (Tim, 2026-10-23): the request budget keeps upstream behaviour; the delivered-report exception is for compaction stops only. Row 5's evaluator guard already keeps a compaction stop from firing after delivery (the row 4 scenario), so the ladder break is removed instead of narrowed: the ladder returns to upstream's `if (monitor.yieldCalled() || abortSignal.aborted) break;`, and the `LastWordScout` request-budget test that pinned the expanded behaviour is deleted. Acceptance: `git diff upstream/main` shows no change to `runYieldLadder` except the `budgetStopKind`-specific reminder rendering; the row-4 test (`ObedientScout`) stays green through the evaluator guard and fails when that guard is reverted to `yieldCalled`.
- [x] 8. F3 wave 6 Should-fix (class: unconditional user-facing budget guarantees, reopened at a second site after row 2; site: the `task.softCompactionBudget` description in `packages/coding-agent/src/task/settings.ts` on both branches; searched `docs/`, `packages/coding-agent/src` and the changelog for `compaction.*(partial findings|final report|hand back)`: `docs/tools/task.md` names the grace hard abort and the changelog says "asks for", so the setting description is the only overstated instance). It says the stopped agent "must hand back its partial findings", but a run that does not yield within the grace is hard-aborted without a report. Reword to match the changelog: one more compaction force-stops the run and asks the agent for a final report. Acceptance: both branches carry the same reworded description; no other file changes.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over `upstream/main...upstream-pr/subagent-compaction-budget` and `main...feat/fork-compaction-budget` (waves 1-7 PASS, reports under `.omo/evidence/gate/subagent-compaction-budget/`)
- [x] F1. Manual QA on the real surface: Verification 3-5 transcripts under `.worktrees/fork-compaction-budget/.omo/evidence/subagent-compaction-budget/f1-final/`, on the fork branch head after F3's last code commit (`7874761cdf`)
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated on the fork branch head

## Merge gate
- Author's risk assessment: the guard ends subagent runs. A wrong count (counting skipped or aborted compactions, or every speculative pass) stops productive runs early; a broken stop path aborts without a report and loses hours of work; the shared grace change could shift when the request budget hard-aborts. The stop aborts the turn right after a mid-run compaction event, a new transition in the run monitor's stop state machine.
- Mandatory class: concurrency-state
- Risk tier: product
- Whole-diff review: needed (settings registry, run monitor and forced-yield driver in the task executor, two system prompts, on two branches: upstream and the fork cherry-pick)
- Accepted residual risks: a productive run that needs more than 3 compactions gets stopped with a report and must be resumed via `irc` or rerun with a higher budget; with a 1M window and no `compaction.modelThresholds`, compaction starts near 800k, so the guard fires late there; compactions in an `irc` wake turn or revive are not counted (those monitors disable both budgets, as today)
- Out of scope for blocking: the compaction threshold itself and how local and provider token counts differ; the main session (budgets apply to subagents only); plan 1's `wait` output
- Feature-specific criteria:
  - Invariant: a subagent run is stopped with one forced final `yield` after one compaction more than `task.softCompactionBudget`, and finishes as a normal completion with that report
    Positive witness: budget 2, three counted compactions, a terminal `yield` on the forced prompt: notice steered once after compaction 2, prompt 2 synthetic with `toolChoice` yield and `Compaction budget crossed`, `aborted` false, `exitCode` 0, output equals the report
    Negative control: the same test on the unchanged source fails (no notice, no stop, run ends without the forced prompt)
    Observable: `runSubprocess` result, mock session prompts, steered messages, abort count
    Boundary: `task/executor.ts` `createSubagentRunMonitor` and `driveSessionToResult`
  - Invariant: an `auto_compaction_end` counts exactly when it is not aborted, not skipped and carries no `errorMessage`, for every compaction action including a reclaimed shake; budget 0 disables the guard
    Positive witness: two reclaimed-shake ends (`result: undefined`, `skipped: false`) send the notice and a third stops the run; each of a nothing-to-drop shake, a shake fallback, an aborted end and a failed end followed by one completed compaction leaves the run without a notice, and one further completed compaction sends it
    Negative control: with `isCompletedCompaction` replaced by `() => true`, every non-counting row sends the notice one compaction early and fails; with budget 0 treated as 3, the budget-0 row fails; the reclaimed-shake row fails on unchanged source
    Observable: steered messages, prompt count, `result.aborted`, `mutation.txt`
    Boundary: `isCompletedCompaction` and the monitor's `auto_compaction_end` handler, against the emitter shapes in `session-maintenance.ts`
  - Invariant: a stopped agent that does not yield is hard-aborted after `BUDGET_STOP_GRACE_REQUESTS` more requests, with the abort reason naming the budget that stopped it; the request budget's hard-abort point is unchanged
    Positive witness: compaction stop at request n, the agent keeps answering: aborted at n + 5 with `Soft compaction budget exceeded (3 compactions; budget 2) — agent did not yield`; the existing request-budget hard-abort test stays green
    Negative control: the grace check gated on `softRequestBudget > 0`, as today, never hard-aborts the compaction-stopped run with request budget 0, which fails the test
    Observable: `result.aborted`, `result.abortReason`, request count at abort
    Boundary: `task/executor.ts` `evaluateSoftRequestBudget` grace and `resolveAbortReasonText`
