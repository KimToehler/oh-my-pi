# Running subagent progress in `wait` and `jobs` output (upstream PR 1 of 2)

## Context

On 2026-10-23 subagent `AcpV2Surface-2` (Sonnet 5.5 via onara, ACP host) looped on reads for 5 h 07 min: 176 requests, 1.99M output tokens, 6 compactions, about $18. The orchestrator polled it with `wait` and only ever saw `` - `<id>` [task] — <label> `` under `## Still Running` (`packages/coding-agent/src/async/job-control.ts:337-342`). Requests, cost, context fill, duration and the self-reported stage already sit in the job's `latestDetails.progress` record (`AgentProgress`, `packages/tui/src/tools/task.ts:2338`). `snapshotJobs` (`job-control.ts:161-247`) reads only model, thinking level, advisor, completion percent and stage from it, and the text renderer drops all of them. The orchestrator model could not tell a loop from progress until Tim asked.

The change is host-independent (TUI, ACP, RPC and SDK all read the same tool result text), so it targets upstream and branches from `upstream/main`, not from the fork's `main`. Plan 2 (`.omo/plans/subagent-compaction-budget.md`) adds the automatic stop. The two plans touch disjoint code and ship as separate PRs; neither depends on the other.

Decisions (Tim, 2026-10-23): fix in core and propose upstream, not as a team-config extension (extensions receive no `AgentProgress` data); `task.maxRuntimeMs` is not part of the fix.

## Approach

### 0. Worktree and plan file

```
git -C /Users/tim/git/oh-my-pi fetch upstream
git -C /Users/tim/git/oh-my-pi worktree add .worktrees/upstream-wait-progress -b upstream-pr/subagent-wait-progress upstream/main
cd /Users/tim/git/oh-my-pi/.worktrees/upstream-wait-progress && bun install
```

Copy this plan to `.omo/plans/subagent-wait-progress.md` in the fork's main checkout (the gate reads it there; it is never committed to the upstream branch). Evidence goes to `/Users/tim/git/oh-my-pi/.omo/evidence/subagent-wait-progress/`, also outside the upstream branch.

Every source path below is relative to `/Users/tim/git/oh-my-pi/.worktrees/upstream-wait-progress`. A subagent briefed for this work MUST use absolute paths under that directory for every read, edit and write, and finish by checking that `git -C /Users/tim/git/oh-my-pi status --short --untracked-files=no` shows no stray `packages/` change.

### 1. Snapshot the progress fields

- `packages/tui/src/tools/wait.ts` `JobSnapshot` (line 49): add optional `requests`, `cost`, `contextTokens`, `contextWindow`, each with a one-line doc pointing at the `AgentProgress` field.
- `packages/coding-agent/src/async/job-control.ts` `snapshotJobs`: in the existing `latest.type === "task"` branch, read the four fields from `progressRecord` with the finite-number guard `completionPercent` uses (line 206-209). Emit them only while `latest.status === "running"`, like `completionPercent` (line 229); a settled job's final numbers are already in its result.

### 2. Render one progress suffix

Add `formatRunningTaskProgress(job: JobSnapshot): string` in `job-control.ts`. It joins the present parts with ` · ` in this order and returns `""` when the job has no progress record fields:

- `formatDuration(durationMs)` from `@oh-my-pi/pi-utils` (`packages/utils/src/format.ts:10`)
- `<requests> req` when `requests > 0`
- `$<cost.toFixed(2)>` when `cost > 0`
- `ctx <formatNumber(contextTokens)>/<formatNumber(contextWindow)>` when both are positive, `ctx <formatNumber(contextTokens)>` without a window (`formatNumber`: `packages/utils/src/format.ts:38`)
- `~<completionPercent>%` when present
- `stage: <stage>` when present, whitespace collapsed

Duration alone never makes a suffix: a task row with none of the other fields stays unchanged, so a task without a progress record keeps today's text.

Use it for `type === "task"` rows only, through one exported `runningTaskProgressSuffix(job, { duration })` in `job-control.ts`:
- `## Still Running` (`job-control.ts:337-342`): `` - `<id>` [task] — <label> — <suffix> ``.
- `op === "jobs"` rows (line 295-297) with status `running`: suffix appended after the label, before the existing ` — agent://…` part.
- `read proc://` listing rows (`internal-urls/proc-protocol.ts:179-185`): suffix without the duration, which the row already shows as `up <d>`; `read proc://<id>` header line: suffix with duration.

Deviation found during implementation (2026-10-23): `buildJobResult` has no production caller with `op: "jobs"` on `upstream/main` or the fork (only `wait` and `cancel`); the hub `jobs` op was removed in f89a6db15e. The model-facing job list is `read proc://`, so it gets the suffix too; the `op === "jobs"` branch keeps it for consistency and its test stays.

Bash and eval rows stay byte-identical. No new formatting helpers.

### 3. Tests (write first, record RED)

New `describe` in `packages/coding-agent/test/tools/wait-structured.test.ts`, reusing its `makeSession` / `AsyncJobManager` seam. A running task job is registered through `manager.register("task", label, async ({ reportProgress }) => { await reportProgress("running", { progress: [record] }); return pending.promise; }, { ownerId: SELF_ID })` (seam: `async/job-manager.ts:348-415`), where `pending` is a `Promise.withResolvers()` resolved in `afterEach`.

- `#given a running task job with progress #when wait renders #then the Still Running row carries duration, requests, cost, context and stage`: record `{ id, requests: 90, cost: 18.4, contextTokens: 160_000, contextWindow: 1_000_000, stage: "implementing acp surface" }`; the row contains `90 req`, `$18.40`, `ctx 160K/1M`, `stage: implementing acp surface`.
- `#given the same running task job #when jobs renders #then its row carries the same suffix`.
- `#given a running bash job and a running task job without a progress record #when wait renders #then both rows are exactly the id, type and label`.
- `packages/coding-agent/test/tools/proc-service.test.ts`: `#given a running task job with progress and a running bash job #when proc:// is listed and the task read #then the task rows carry the suffix and the bash row does not`.

Run the new tests against the unchanged source first and save the output to `.omo/evidence/subagent-wait-progress/red.txt`; the progress rows must fail, the bash/no-progress row may pass.

### 4. Docs and changelog

- The doc that describes `wait`/`jobs` output (check `docs/tools/` first; `docs/tools/task.md` otherwise): one sentence that running task rows show duration, requests, cost, context fill and stage.
- `packages/coding-agent/CHANGELOG.md` `## [Unreleased]` → `### Added`: `` `wait` and `read proc://` now show a running subagent's run time, request count, cost, context fill and stage ``. `docs/tools/read.md` `proc://` line gets one sentence too.

### 5. Verify and commit

`cd packages/coding-agent && bun test test/tools/wait-structured.test.ts test/async` and `bun check` from the worktree root. Commit only the named files: `feat(coding-agent): show running subagent progress in wait and jobs output`.

### 6. Fork integration and upstream PR

The gate covers the code the fork actually runs, so the fork merge happens before F2:

- After the step-5 commit: in a second worktree `git -C /Users/tim/git/oh-my-pi worktree add .worktrees/fork-wait-progress -b feat/fork-wait-progress main`, then `git merge --no-ff upstream-pr/subagent-wait-progress`. Resolve conflicts against the fork's `job-control.ts` / `wait.ts`, rerun the step-5 tests on the merge result, save them to `merge-tests.txt`.
- Deviation (2026-10-23): `git merge --no-ff upstream-pr/subagent-wait-progress` into the fork conflicted in 5 ACP files, because the branch sits on `upstream/main` 0b5c27ab24 and the fork `main` lacks 265 upstream commits; merging would have pulled a whole upstream sync into this change. The merge was aborted and the feature commit `1bf27a84c5` cherry-picked (`-x`) onto `feat/fork-wait-progress` instead (`c77947fc07`); its only textual difference is the CHANGELOG entry placed in the fork's own `## [Unreleased]` → `### Added`. The upstream sync stays the job of the regular fork sync.
- F1 runs on the fork merge head; F2 reviews both `upstream/main...upstream-pr/subagent-wait-progress` and `main...feat/fork-wait-progress` and binds the record to the fork merge head. A code change on either branch afterwards voids it and needs a delta review over `<last reviewed>...<head>`.
- After F2: fast-forward fork `main` to `feat/fork-wait-progress`.
- Push the upstream branch to `origin`. Draft the PR body from `.github/PULL_REQUEST_TEMPLATE.md` into `.omo/drafts/upstream-pr-wait-progress.md` with a `TODO(Tim)` placeholder for the contributor sentence `CONTRIBUTING.md` requires. Do NOT open the PR: Tim writes the sentence and confirms target and text first.

## Critical files & anchors

- `packages/coding-agent/src/async/job-control.ts:161-247` (`snapshotJobs`), `:282-298` (`jobs` rows), `:337-342` (`Still Running`)
- `packages/tui/src/tools/wait.ts:49-84` (`JobSnapshot`)
- `packages/tui/src/tools/task.ts:2338` (`AgentProgress`)
- `packages/coding-agent/src/async/job-manager.ts:348-415` (`register`, `reportProgress` sets `latestDetails`)
- `packages/coding-agent/test/tools/wait-structured.test.ts` (test seam)

Line numbers are from the fork; the anchors exist on `upstream/main` 0b5c27ab24 (`Still Running` at `job-control.ts:338`).

## Verification

1. RED: step-3 tests on unchanged source (`red.txt`).
2. GREEN: step-5 commands, on the upstream branch and on the fork merge (`merge-tests.txt`).
3. Real surface: run `bun packages/coding-agent/src/cli.ts -p --mode json` from the fork merge worktree with `PI_CODING_AGENT_DIR=/tmp/swp-agent` (a copy of `~/.omp/agent` without sessions, blobs, caches and memories). The model spawns a short and a long async `task` subagent and calls `wait`; the first wait returns the short one and lists the long one under `Still Running` with the suffix (`qa-wait.txt`). A second run reads `proc://` and `proc://<id>` while a subagent runs (`qa-run.txt`). A third run with an async `bash` job shows its `proc://` row and settled `wait` output unchanged (`qa-bash.txt`). `jobs` has no production caller (see step 2), so it is covered by its unit test only.

## TODOs

1. F2 wave 1 B1 (progress-record identity): `snapshotJobs` picks the progress record by job id, but a batch job's `progress` array holds every spawn of the call keyed by agent id, and a job id that collided is suffixed (`Foo-2`) while its agent id stays `Foo`; the match misses and falls back to record 0, another agent's numbers. Select by `current?.agentId ?? latest.id` (the id `agentUrlId` already uses). Regression test in `wait-structured.test.ts`: two-record batch, the second job's id collides; its `wait` row must show its own requests/stage, not the first record's. RED on the pre-fix source.
2. F2 wave 1 note (non-blocking, sub-cent cost): a positive cost below half a cent rendered as `$0.00`, which reads as "no spend". Render `<$0.01` instead. Test in `wait-structured.test.ts`, RED on the pre-fix source. A zero completion estimate keeps rendering `~0%`: it is a reported value, not a missing one.

## Final verification wave
- [x] F3. Whole-diff review: not needed (one suffix helper in `job-control.ts` used by the `wait`/`cancel` renderer and the `proc://` renderer, plus optional `JobSnapshot` fields; two packages, one layer)
- [x] F1. Manual QA on the real surface: Verification 3 transcripts under `.omo/evidence/subagent-wait-progress/`, on the fork merge head after the last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated on the fork merge head

## Merge gate
- Author's risk assessment: model-facing `wait`/`jobs` text grows by one suffix per running task row. A wrong guard prints `NaN`/`undefined` into the orchestrator's context or changes bash/eval rows that prompts expect. No persisted state and no wire field another process reads; `JobSnapshot` only gains optional fields.
- Mandatory class: none
- Risk tier: product
- Whole-diff review: not needed (one suffix helper in `job-control.ts` used by the `wait`/`cancel` renderer and the `proc://` renderer, plus optional `JobSnapshot` fields; two packages, one layer)
- Accepted residual risks: the TUI wait card does not render the new fields (it already draws a live widget); completed rows keep their shape; the suffix is as fresh as the last coalesced progress report
- Out of scope for blocking: ACP live display of running jobs; the completion probe; plan 2's compaction budget
- Feature-specific criteria:
  - Invariant: a running task row in `wait`, `jobs` and `read proc://` output shows the subagent's duration, requests, cost, context fill and stage from its latest progress record
    Positive witness: a running task job reporting requests 90, cost 18.4, context 160000 of 1000000 and stage "implementing acp surface" renders `90 req`, `$18.40`, `ctx 160K/1M` and `stage: implementing acp surface` in `wait` and `jobs`; the `proc://` listing and `proc://<id>` rows render `90 req · $18.40 · ctx 160K/1M`
    Negative control: the same tests on the unchanged source fail because the row is only the id, type and label
    Observable: `buildJobResult(...).content[0].text`, `ProcProtocolHandler.resolve(...).content`
    Boundary: `async/job-control.ts` `buildJobResult`/`snapshotJobs`, `internal-urls/proc-protocol.ts` `resolve`
  - Invariant: rows without task progress keep their current text
    Positive witness: a running bash job and a running task job without a progress record render exactly the id, type and label in `wait`; the bash row in `proc://` ends with its label
    Negative control: any suffix on either row (a duration, `0 req`, `$0.00`, `undefined`, `NaN`) fails the test
    Observable: `buildJobResult(...).content[0].text`, `ProcProtocolHandler.resolve(...).content`
    Boundary: `async/job-control.ts` `runningTaskProgressSuffix`
