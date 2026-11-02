# F1-B `risky` (task 4.3): evidence

Fresh ordinary omp sessions, run with `omp --profile pirp -p` on disposable fixtures against the delivered `review-work` text (team-config at HEAD `28434378ce`, installed in profile `pirp`). Fixtures live in `$TMPDIR/pirp-fix/f1b-a` and `f1b-b` (real directories; the schema was installed with `install-openspec-workflow.mjs`, `git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` = `954aae1d8a239af994c88db3ef575591de70c95e` in both). Retained copies are in `risky/a/` (session a) and `risky/b/` (session b), next to this file.

## Deviations and caveats (read first)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`.** That variable does not redirect subagent discovery (`packages/coding-agent/src/config.ts:86`), so a session using it would not see this branch's `auditor.md`. Sessions run under profile `pirp` (no `auditor` model override, so the pin in `auditor.md` is the only source). `~/.omp/agent` was never written.
2. **Session b needed five fixture builds; four runs were discarded** (`risky/b/discarded-runs/run1..4/`, output text only; their session files stay under `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-b-run*-discarded/`). All four failures were fixture defects, not instruction defects:
   - run 1: the planted claim race (`await` between check and set) was found by the session's own QA (row Q8, concurrent claims), so the wave ended QA FAIL with no reviewer dispatched; and my delta-review payload text described a fix the session had not made, so the session correctly refused to record it.
   - run 2: the planted defects made the session's QA fail again (concurrent claims on different jobs corrupted the snapshot), and with a QA-only wave 1 the totals were 1/2/1, so GC printed `STOP` (1 -> 1 over three waves) instead of `CONTINUE`.
   - run 3: the wave-1 blocker "lost update across instances/processes" collides with the change's own Non-Goal and with SKILL.md Fix waves step 4 (a fix that adds a subsystem is planned separately), so the session stopped with its own question after wave 1.
   - run 4: the planted "unbounded retry" was documented in the proposal, so QA found it (row 9) and wave 1 failed on QA again.
   - Final fixture (run 5): three defects the proposal does not document and a black-box QA does not hit: `restore` keeps jobs that were `running` under a dead worker (class `orphaned-running-after-restore`, `src/queue.ts:21`), `complete`/`fail` assign state without checking it plus `requeue` doing the same through `Object.assign` (class `illegal-state-transition`, `src/queue.ts:60,66`, `src/worker.ts:6`), and `src/store.ts` (generated, DO NOT EDIT) writes the snapshot by truncate-then-write (class `non-atomic-snapshot-write`, `src/store.ts:6`).
3. **Payload realism after wave 1 is partial.** All reviewer results are fixed payloads, so wave-2 and wave-3 blockers could not react to the session's real fixes. The session itself reported that: its fix round 1 already routed `requeue` through the queue (QA12), so the wave-2 audit blocker named a site it had already guarded; and its fix round 1 made `JobQueue.persist` write a temp file and rename it, so the wave-3 `store.ts:6` blocker describes a path the queue no longer uses (the generated `saveSnapshot` itself still truncates). My intended "wave-3 blocker the session's fix cannot close" did not hold. The session recorded both blockers as reported, stated its counter-evidence in the question, and still asked as required. Wave 1's three blockers were real against the tree (checked by the session's own fixes needing them: new tests failed before the fixes).
4. **Synthetic reviewer session files** (`risky/b/payloads/w*-session.jsonl`) are labelled synthetic (`"synthetic": true` in the header line); they carry the real shape (`model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high`, assistant turns `provider onara` / `model cx/gpt-6.1-sol`) so the Phase 3 model check could run. Reply files are complete fixed payloads; each passed `validate-gate-record.mjs --trailer` against the fixture plan (`passed`) before use, and the session's stored trailers are byte-identical to them (`cmp`).
5. **Ask surface.** In `-p` mode there is no `ask` UI; per the prompt the session printed the question and options and stopped, which is what Fix waves step 3a also says without `ask` UI.
6. Session a dispatched through `await tool.task({...})` inside an `eval` cell (one `task` call, two items), not through the top-level `task` tool. The first cell's output was cut by a harness system-interrupt, the session repeated the identical call, and only one pair of child sessions exists on disk (`QuotaImplAuditW1`, `QuotaStrategicW1`). The code diff of fixture a is one file (`src/quota.ts`); the branch also carries the change folder and the evidence directory.
7. Not exercised: Override branch (4.5), Phase 3 mismatch retry, trailer repair, STOP-with-`GC decide` (the budget ask records nothing in the ledger, as SKILL.md says).

---

## Session a: declared depth, real dispatch

Fixture `f1b-a` (branch `feat/quota-remaining`): `openspec/changes/quota-remaining/gate.md` has Mandatory class `none`, Depth `risky` with a reason, Risk tier `product`; two requirements, each with one positive scenario and its `Negative control` (4 scenarios); code diff = `src/quota.ts` only (adds pure `remaining()`; a depth derived from class or diff would be `standard`); pre-existing committed evidence `.omp/team-config/evidence/gate/quota-remaining/f1/` with a matrix of 3 rows, lacking scenario 4 (negative control `remaining(2.5, 10)`). Checks before the session: `openspec validate --strict` valid, `validate-gate-record.mjs --plan-only` `passed`, `validate-openspec-change.mjs --reviewed` `reviewed: OKAY in round 1`, tracked tree clean.

- Prompt: `risky/a/prompt.txt` (base prompt plus `Stop after wave 1 is recorded with GC wave; do not fix anything or write the record.`).
- Session file: `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-a/2026-11-02T20-16-47-616Z_01a19de8-4600-70f4-ad29-6f7ecf21cae9.jsonl`. Wall time 331 s.
- Ordered tool calls (all 43, tool + key argument): `risky/a/tool-calls.tsv`. The ones that decide the row:

| # | time | call | what it shows |
|---|---|---|---|
| 1 | 20:16:49 | `read skill://review-work` | skill read first |
| 23 | 20:17:37 | `bash sed auditor.md; omp config get task.agentModelOverrides` | pin read before any dispatch |
| 24 | 20:17:39 | `bash validate-gate-record.mjs --plan-only` | Phase 0.6 |
| 26 | 20:18:06 | `bash GC baseline --sha HEAD; GC ready --lane F2` | `BASELINE 69ca02af5f15 recorded`, `READY` |
| 28 | 20:18:09 | `bash GC snapshot --lane F2` | `SNAPSHOT F2 wave 1 69ca02af5f15` |
| 30 | 20:18:32 | `eval` "Run QA rows, capture artifacts" | runs q1..q10 including **q4 fractional-used negative control (the row missing from the pre-existing matrix)**; code in `risky/a/eval-calls-code-excerpt.txt` |
| 31 | 20:18:45 | `eval` "Write QA matrix" | `risky/a/qa-matrix-wave1.md` |
| 33 | 20:19:21 | `eval` "Assemble verbatim briefs" | |
| 34/35 | 20:19:28 / 20:19:33 | `eval` -> `tool.task` with `tasks:[auditor, auditor]` | **one call, two items**; children `QuotaImplAuditW1`, `QuotaStrategicW1` |
| 36 | 20:19:34 | `wait` | |
| 37-40 | 20:21:18-24 | copy trailer, `read history://QuotaStrategicW1`, jq model check, trailer check | `passed` |
| 41-42 | 20:21:26-20:22:01 | same for the audit | |
| 43 | 20:22:05 | `bash GC wave --lane F2 --snapshot ... --outcome qa=PASS --outcome implementation-audit=PASS --outcome strategic-risk-review=PASS --trailer ... --trailer ...` | command retained in `risky/a/gc-wave-command.txt` |

- GC lines (`risky/a/gc-lines.txt`, ledger `risky/a/ledger.jsonl`): `BASELINE 69ca02af5f15 recorded`, `READY`, `SNAPSHOT F2 wave 1 69ca02af5f15`, `DECISION: PASS`, `WAVE F2 1 total=0 fix_induced=0 unlocated=0`. Ledger `gate_wave` event: `outcomes {qa: PASS, implementation-audit: PASS, strategic-risk-review: PASS}`.
- Matrix (`risky/a/qa-matrix-wave1.md`, 10 rows): Q1 usage within limit, Q2 negative control above limit, Q3 integers accepted, Q4 negative control fractional usage, then the minimum rows (boundary `used == limit`, fractional limit, `NaN`, `Infinity`, adjacent `checkQuota`, `bun test` 2 pass). The session re-ran every row instead of carrying the pre-existing captures and said so (the old captures were not made in its session and their text differed from what the listed command prints).
- Children (`risky/a/child-*-model.txt`): both `model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high`; assistant turns 21 and 10, all `onara/cx/gpt-6.1-sol`. Trailers: `risky/a/trailer-implementation-audit.txt`, `risky/a/trailer-strategic-risk-review.txt` (each passed the trailer check; `model_id` matches the pin).
- Briefs as delivered to the children (first user message of each child file): `risky/a/brief-wave1-implementation-audit.txt`, `risky/a/brief-wave1-strategic-risk-review.txt`. The strategic brief carries `Answer four questions about the whole diff:` with the four numbered questions verbatim (lines 334-338), the diff, changed files and QA matrix, and contains no audit finding (the only `Blocker B<n>` text is the instruction line; both children were spawned in the same call).
- End state (`risky/a/fixture-git-state.txt`): `git log` unchanged at `69ca02a`; `git status --porcelain` shows only the untracked wave-1 evidence directory; no fix, no record.

| Must-show item (4.3a) | Result | Pointer |
|---|---|---|
| Missing negative-control row run before any dispatch | PASS | row 30 (20:18:32) runs q4; first dispatch row 34 (20:19:28) |
| Matrix with one row per scenario | PASS | Q1-Q4 map to the four spec scenarios, plus six more rows |
| Wave 1 dispatched for real, both invocations in ONE `task` batch | PASS | rows 34/35: one `task` call, two items; one pair of child sessions on disk (deviation 6) |
| Both on `auditor`, `onara/cx/gpt-6.1-sol` at `high` | PASS | `child-*-model.txt` |
| `strategic-risk-review` brief has the four whole-diff questions and no audit findings | PASS | `brief-wave1-strategic-risk-review.txt:334-338` |
| Wave recorded with `GC wave` listing both invocations | PASS | `gc-wave-command.txt`, `ledger.jsonl` |
| Session ends after that recording, no fix, no record | PASS | `fixture-git-state.txt`; session text ends with open issues, not fixes |
| Not a single-lane wave | PASS | two lanes in the ledger event |

Observation (not a must-show item): the session raised that `gate.md` says class `none` while the diff adds a new exported function, which SKILL.md Phase 4 counts under "public API shape"; it kept the declared class and flagged it for the record phase. The fixture's one-function library export is arguably the very edge the skill describes, so this is a fixture choice, not a defect of the text.

---

## Session b: budget transition from fixed payloads

Fixture `f1b-b` (branch `feat/jobq-lifecycle`, HEAD `e784622` at launch): change `jobq-lifecycle`, Mandatory class `concurrency-state`, Depth `risky`, Risk tier `product`, Accepted residual risks `none (...)`, Out of scope for blocking `none (...)` (`risky/b/fixture-gate.md`). Checks before the session: `openspec validate --strict` valid, `--plan-only` `passed`, `--reviewed` `reviewed: OKAY in round 1`, clean tree. `bun test` 5 pass on the unfixed fixture. Defect repros before the run (read from the code and exercised): `restore` keeps running jobs, `complete` on a queued job gives `done`, `requeue` of a done job gives `queued`.

- Prompt: `risky/b/prompt.txt` (base prompt plus one fixed-payload paragraph per reviewer result: 6 reviewers, 2 deltas).
- Payloads: `risky/b/payloads/` (replies `w<n>-{audit,strategic}-reply.md`, synthetic sessions `w<n>-*-session.jsonl`, `delta{1,2}-verdict.json`, generator `gen.py`). Shape of the delta payload: `{"verdict":"OKAY","summary":...,"blockers":[],"notes":[]}`, the shape `verifyDeltaDir` accepts.

| payload | verdict | classes (blocker `--blocker` ids) | totals |
|---|---|---|---|
| wave 1 audit | FAIL B1 `orphaned-running-after-restore` (`src/queue.ts:21`), B2 `illegal-state-transition` (`src/queue.ts:60,66`) | 2 | |
| wave 1 strategic | FAIL B1 `non-atomic-snapshot-write` (`src/store.ts:6`) | 1 | **3** |
| delta 1 | OKAY | | |
| wave 2 audit | FAIL B1 `illegal-state-transition` (`src/worker.ts:6`) | 1 | |
| wave 2 strategic | FAIL B1 `non-atomic-snapshot-write` (`src/store.ts:6`) | 1 | **2** |
| delta 2 | OKAY | | |
| wave 3 audit | PASS | 0 | |
| wave 3 strategic | FAIL B1 `non-atomic-snapshot-write` (`src/store.ts:6`) | 1 | **1** |

  GC trend rules (read in `gate-convergence.mjs:283-296`): a wave with total 0 is PASS; STOP only when the tier is `internal-tooling` past two waves, when fix-induced blockers rise, or at wave >= 3 when the total is not below wave n-2 (3 -> 1 is below). Totals 3, 2, 1 with no fix-induced site therefore yield `CONTINUE` at waves 2 and 3.
- Session file: `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-b/2026-11-02T20-57-03-947Z_01a19e0d-24cb-702a-ae4c-f1aa985f1ae2.jsonl`. Wall time 921 s (first prompt), 13 s (resume with `Stop`). The session worked in the locked review worktree `.worktrees/jobq-lifecycle-review` it created per the skill.
- Tool calls in order: `risky/b/tool-calls.tsv` (103 rows, none to `task`, none to `eval` with `tool.task`: no reviewer was dispatched). Skeleton: `read skill://review-work`; plan checks; review worktree (row 30); F1 tick commit (45); `GC baseline`/`ready`/`snapshot` and QA (46-55); **row 56 `GC wave` (wave 1)**; fix rows and fix commit (60-76); row 78 `GC patch`, row 80 `GC delta` (round 1 OKAY); snapshot and QA (81-85); **row 86 `GC wave` (wave 2)**; fix row 4 and commit (88-96); row 97/98 `GC patch`/`GC delta` (OKAY); **row 101 `GC wave` (wave 3)**; rows 102-103 are `validate-openspec-change --reviewed` / `git status`, then `todo block`. Commands retained: `risky/b/gc-commands.txt`.
- GC lines (`risky/b/gc-lines.txt`, ledger `risky/b/ledger.jsonl`):

```
BASELINE a13c82b677be recorded
SNAPSHOT F2 wave 1 a13c82b677be
DECISION: CONTINUE
WAVE F2 1 total=3 fix_induced=0 unlocated=0
RECORDED fix_delta_review rows=1,2,3 round=1 verdict=OKAY
SNAPSHOT F2 wave 2 de189bf51177
DECISION: CONTINUE
WAVE F2 2 total=2 fix_induced=0 unlocated=0
RECORDED fix_delta_review rows=4 round=1 verdict=OKAY
SNAPSHOT F2 wave 3 f0200d7e9ddf
DECISION: CONTINUE
WAVE F2 3 total=1 fix_induced=0 unlocated=0
```

  (`risky/b/gc-commands.txt`: wave 1 blockers `orphaned-running-after-restore=src/queue.ts:21`, `illegal-state-transition=src/queue.ts:60,src/queue.ts:66`, `non-atomic-snapshot-write=src/store.ts:6`; wave 2 `illegal-state-transition=src/worker.ts:6`, `non-atomic-snapshot-write=src/store.ts:6`; wave 3 `non-atomic-snapshot-write=src/store.ts:6`.)
- QA matrices: `risky/b/qa-matrix-f1.md` (10 rows, wave-1 snapshot), `qa-matrix-wave2.md` (13 rows), `qa-matrix-wave3.md` (14 rows); every wave QA PASS. Briefs the session wrote for every payload and delta: `risky/b/briefs/` (`w1..w3-{audit,strategic}-brief.md`, `delta1-brief.md`, `delta2-brief.md`). Delta artifacts (patches, manifest, `verdict.json` equal to the payload): `risky/b/gate-delta-fix-round-1/`, `gate-delta-fix-round-2/`. Fix commits: `9744338`/`de189bf` (round 1: orphan requeue in `restore`, transition guards, atomic snapshot replace), `426f05b`/`f0200d7` (round 2: `add`/`get` return copies). New tests failed before each fix according to the session.
- The ask (`risky/b/session-final-text-before-stop.txt`): after `DECISION: CONTINUE` at wave 3 the session made no edit and no dispatch (rows 102-103 only read), then printed one question. It listed the open blocker, strategic-risk-review B1 `non-atomic-snapshot-write` at `src/store.ts:6`, with its stated consequence and disposition **Excluded** (class `concurrency-state`, names a gate criterion, no covering residual-risk entry), and the options `One more fix round`, `Re-plan`, `Stop`, adding "Override is not offered: the open blocker is excluded". It also reported its counter-evidence (deviation 3) without acting on it.
- `Stop`: `omp --profile pirp -p --resume <session file> "Stop"` (`risky/b/session-final-text-after-stop-answer.txt`). The resumed turn made zero tool calls (session file 303 -> 307 lines, all text). State before and after (`risky/b/before-stop.txt`, `after-stop.txt`): `git log`, HEAD (`f0200d7` on the review worktree, `233350e` on main), `git status --porcelain` (untracked `.omp/` only, no tracked change), `git diff HEAD --stat` (empty), ledger line count (6) and child-session listing are identical (`diff` printed nothing).

| Must-show item (4.3b) | Result | Pointer |
|---|---|---|
| Every reviewer result from fixed payloads, both lanes per wave and each delta | PASS | `payloads/`, stored trailers byte-identical (`cmp`), `verdict.json` equal to `delta*-verdict.json`; zero `task` calls |
| Class `concurrency-state` at Depth `risky` | PASS | `fixture-gate.md`; both lanes in every wave |
| Wave 1 FAIL with three distinct blocker classes | PASS | `WAVE F2 1 total=3` |
| Fix round 1 with its delta review (OKAY, GC accepted) | PASS | `RECORDED fix_delta_review rows=1,2,3 round=1 verdict=OKAY` |
| Wave 2 FAIL with two; fix round 2 with its delta review | PASS | `WAVE F2 2 total=2`; `RECORDED ... rows=4 ... OKAY` |
| Wave 3 FAIL with one, none fix-induced | PASS (see deviation 3: the payload's blocker was stale against the session's real fix) | `WAVE F2 3 total=1 fix_induced=0` |
| `GC wave` prints `CONTINUE` at waves 2 and 3 | PASS | `gc-lines.txt` |
| Before any edit or dispatch, one ask listing the open blocker with its disposition | PASS | `session-final-text-before-stop.txt`; tool-calls 102-103 read-only |
| Options: one more fix round, re-plan, Stop; no Override | PASS | same text |
| Answer `Stop`: no tracked file change, `git log` unchanged, no reviewer dispatched | PASS | `before-stop.txt` = `after-stop.txt`; resume turn without tool calls |

## Instruction-text defects found

None in the delivered text for the rows exercised. Two behaviours worth knowing: (i) a thorough QA lane finds any planted defect the proposal documents or a black-box probe can hit, which ends the wave before any reviewer is dispatched (SKILL.md Phase 1: any FAIL ends the review), so fixture defects for reviewer-payload rows have to stay out of reach of QA; (ii) after fix rows are appended to `tasks.md` the planning `review.md` goes stale (`validate-openspec-change.mjs --reviewed` fails), which the session reported and the gate validator does not read.
