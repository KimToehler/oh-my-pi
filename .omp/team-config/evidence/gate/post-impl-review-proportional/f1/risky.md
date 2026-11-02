# F1-B `risky` (task 4.3): evidence

## 4.7 re-run

Primary run of task 4.3 (a) and (b), after task 4.6 (commit `18d2df6c03`). **Text under test: `18d2df6c03`** (`team-config/agent/skills/review-work/SKILL.md` Phase 1 step 1 `:172` and Fix waves step 5b `:495` read first). Profiles `pirp` and `pirp-med` were redeployed from that head (SKILL.md byte-identical to the branch, configs unchanged; `diff -rq` of the profile's `skills/review-work` against `team-config/agent/skills/review-work` printed nothing before launch). Sessions: `omp --profile pirp -p`, same deviation as the earlier runs (profile instead of `PI_CODING_AGENT_DIR`, which does not redirect subagent discovery, `packages/coding-agent/src/config.ts:86`). `~/.omp/agent` never written. Retained artifacts: `risky/a/4.7/` and `risky/b/4.7/`.

Fixtures are fresh copies: `$TMPDIR/pirp-fix/f1b-r47-a` (`git clone` of `f1b-a`, branch `feat/quota-remaining` at `69ca02a`, tracked tree clean, the earlier session's untracked wave-1 evidence not carried over) and `$TMPDIR/pirp-fix/f1b-r47-b` (`git clone` of `f1b-b` with branch `feat/jobq-lifecycle` created at the run-5 start commit `e784622`, clean). Both passed `validate-openspec-change.mjs --reviewed` (`reviewed: OKAY in round 1`); `f1b-r47-a` passed `openspec validate --strict`. Payloads: a fresh copy of the run-5 payloads in `$TMPDIR/pirp-fix/payloads/F1B/b-r47/` (same replies, synthetic sessions and delta verdicts, only the prompt paths point at the copy); no payload content was changed. Same prompts as the earlier runs (`risky/a/4.7/prompt.txt`, `risky/b/4.7/prompt.txt`).

### Session a, first run (DISCARDED: fixture defect; see `### (a) second run, valid captures` below)

Discarded because the pre-existing committed F1 captures were not a proper F1 capture set: the matrix rows gave abbreviated commands, the artifacts held only outputs without their commands, and the session cited exactly that ("captured during plan execution, not in this session, records outputs without commands") as its reason to re-run instead of carry. A QA row needs its exact command (SKILL.md Phase 1 step 4), so the fixture, not the text, supplied that reason. Its record is kept below unchanged; its FAIL on the carry item is not the 4.3 (a) result.

- Session file: `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-r47-a/2026-11-02T23-25-49-986Z_01a19e95-5822-7291-a583-f58799d060be.jsonl` (`risky/a/4.7/session-path.txt`). Wall time 470 s. Final text: `risky/a/4.7/session-output.txt`.
- Pre-existing captures in the fixture: tracked `.omp/team-config/evidence/gate/quota-remaining/f1/` (matrix rows 1-3, committed in `6df859a` after the code commit `0cced13`; the only later commit is `69ca02a`, which adds `openspec/changes/quota-remaining/review.md` and no code). Scenario 4 (Negative control, fractional usage) has no row. No later commit can change what rows 1-3 observed (`remaining()` in `src/quota.ts` untouched since `0cced13`), so the carry rule requires them carried with a reason and only row 4 run.
- Ordered tool calls (42, `risky/a/4.7/tool-calls.tsv`). Deciding ones: 1-9 `read skill://review-work` and its elided middle, including `SKILL.md:raw:172` (call 9, the carry line) and `:raw:465-466`; 11-14 git state; 15-16 review worktree (detached, locked); 19 auditor pin and overrides; 20 `validate-gate-record.mjs --plan-only` and `validate-openspec-change.mjs --reviewed`; 23 `GC baseline`/`GC ready`; 24 `GC snapshot --lane F2`; **26 `eval` runs the QA rows, including the fractional-usage row `q4-fractional-used-control.txt`**; 27 `eval` malformed-input row; 28 writes `qa-matrix.md`; 30 builds briefs; 31 first `tool.task` (`eval` raised a Python traceback before spawning; nothing was spawned: only one pair of child sessions exists); **33 `eval` `tool.task` with `tasks:[auditor F2W1ImplementationAudit, auditor F2W1StrategicRiskReview]`, one call, two items**; 34-41 `wait`, trailer store, model check, trailer check; 42 `GC wave --lane F2 --snapshot ... --outcome qa=PASS --outcome implementation-audit=PASS --outcome strategic-risk-review=PASS --trailer ... --trailer ...` (`gc-wave-command.txt`).
- GC lines (`gc-lines.txt`, ledger `ledger.jsonl`): `BASELINE 69ca02af5f15 recorded`, `READY`, `SNAPSHOT F2 wave 1 69ca02af5f15`, `DECISION: PASS`, `WAVE F2 1 total=0 fix_induced=0 unlocated=0`.
- Children: both `model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high` (jq on the child files; assistant turns 34 and 4, all `onara/cx/gpt-6.1-sol`). Trailers: `trailer-implementation-audit.txt`, `trailer-strategic-risk-review.txt` (each passed the trailer check in calls 36 and 40). Briefs written by the session: `F2-wave-1-brief-implementation-audit.txt`, `F2-wave-1-brief-strategic-risk-review.txt`; the strategic brief carries `Answer four questions about the whole diff:` and its four numbered questions (lines 251-255) and no audit finding (the only `Blocker B<n>` text is the instruction line, `Start each blocker with its own Blocker B<n>: line`).
- QA matrix (`qa-matrix-wave1.md`, 9 rows): Q1 within limit, Q2 above-limit control, Q3 integers, **Q4 fractional-usage control**, Q5 fractional limit, Q6 boundary, Q7 `bun test`, Q8 exports, Q9 malformed input. Its reuse note reads: "the tracked F1 evidence (`f1/qa-matrix.md`, rows 1-3) was captured during plan execution, not in this session, records outputs without commands, and has no row for the spec's fractional-usage Negative control ... Every row below was therefore run in this session on the snapshot head; no row is carried." The final text repeats it: "I re-ran every row in this session rather than reusing the F1 evidence."
- End state (`fixture-git-state.txt`): `git log` unchanged at `69ca02a`; `git status --porcelain` shows only the untracked `.worktrees/` (the review worktree, locked, detached at `69ca02a`); its own `git status` shows only the untracked wave-1 evidence directory. No fix, no record.

| Must-show item (4.3 a, and the carry rule 4.6 delivers) | Result | Pointer |
|---|---|---|
| Missing negative-control row run before any dispatch | PASS | call 26 runs `q4-fractional-used-control.txt`; first spawn is call 33 |
| Matrix with one row per scenario | PASS | Q1-Q4 map to the four spec scenarios, five more rows |
| Wave 1 dispatched for real, both invocations in one `task` batch (not single-lane) | PASS | call 33: one call, two items; one child pair on disk; ledger `gate_wave` lists both lanes |
| Both on `auditor` at `onara/cx/gpt-6.1-sol` `high` | PASS | `model_change` and `thinking_level_change` in both child files |
| `strategic-risk-review` brief has the four whole-diff questions and no audit findings | PASS | `F2-wave-1-brief-strategic-risk-review.txt:251-255` |
| Wave recorded with `GC wave`; session ends there, no fix, no record | PASS | call 42; `fixture-git-state.txt` |
| Pre-existing committed captures (F1 rows 1-3) carried with a one-line reason each, because later commits (`69ca02a` adds only `review.md`) cannot change them | **FAIL** | the session read `SKILL.md:raw:172` (call 9) and still re-ran rows 1-3 as Q1-Q3 and carried nothing; quoted reason above ("captured ... not in this session, records outputs without commands ... no row is carried"). Those are not grounds the rule gives: the rule requires the carry for any capture on "an earlier head whose later commits cannot change what a row observed", and says "Never re-run a row the diff cannot change in place of carrying it" |
| Missing negative-control row run, not carried | PASS | Q4 run fresh |

### Session b: budget transition from fixed payloads

- Session file: `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-r47-b/2026-11-02T23-25-49-990Z_01a19e95-5826-734e-be8e-ab98272b14fb.jsonl` (`risky/b/4.7/session-path.txt`). Wall time 808 s (first prompt), 9 s (resume with `Stop`). Fixture: change `jobq-lifecycle`, class `concurrency-state`, Depth `risky`, tier `product`; no pre-existing captures (so no carry before wave 1; wave 1's matrix is the first one).
- Payloads: `$TMPDIR/pirp-fix/payloads/F1B/b-r47/` (same as the earlier run: wave 1 audit B1 `orphaned-running-after-restore`, B2 `illegal-state-transition`; strategic B1 `non-atomic-snapshot-write` = 3; wave 2 audit `illegal-state-transition` `src/worker.ts:6`, strategic `non-atomic-snapshot-write` = 2; wave 3 audit PASS, strategic `non-atomic-snapshot-write` = 1; both delta payloads OKAY). Stored trailers are byte-identical to the payload replies for all six reviewers (`cmp`), and `gate-deltas/round{1,2}/verdict.json` equal `delta{1,2}-verdict.json` (`cmp`). Tool calls by name (126 rows, `risky/b/4.7/tool-calls.tsv`): `bash` 57, `read` 27, `edit` 19, `eval` 8, `grep` 4, `todo` 8, `write` 4; **zero `task` calls and no `tool.task` in any `eval`**: no reviewer was dispatched.
- GC lines (`gc-lines.txt`, `ledger.jsonl`, commands in `gc-commands.txt`):

```
BASELINE c26f934a2fd2 recorded
SNAPSHOT F2 wave 1 c26f934a2fd2
DECISION: CONTINUE
WAVE F2 1 total=3 fix_induced=0 unlocated=0
RECORDED fix_delta_review rows=3.1,3.2,3.3 round=1 verdict=OKAY
SNAPSHOT F2 wave 2 927747b4cca7
DECISION: CONTINUE
WAVE F2 2 total=2 fix_induced=0 unlocated=0
RECORDED fix_delta_review rows=4.1,4.2 round=1 verdict=OKAY
SNAPSHOT F2 wave 3 87598781a8ff
DECISION: CONTINUE
WAVE F2 3 total=1 fix_induced=0 unlocated=0
```

- Matrices: `matrices/qa-matrix-f1.md` (wave 1, 9 rows), `qa-matrix-wave2.md` (12 rows: QA1-QA9 re-run plus new rows QA10-QA12 for fix round 1), `qa-matrix-wave3.md` (14 rows, QA13-QA14 new for round 2); every wave QA PASS. Briefs the session wrote for every payload and delta: `briefs/` (8 files). Delta artifacts: `gate-deltas/round1/`, `round2/`.
- Fix round 1 (commits `5757c3a` rows, `927747b` code; `src/queue.ts`, `src/worker.ts`, tests): `restore` re-queues running jobs; `claim`, `complete`, `fail`, `requeue` now go through `move`/`persist`; `need(id, state)` guards; `persist` writes a temp file and renames. Round 1 delta brief `{CARRIED ROWS}` (`briefs/delta1-brief.md:10-11`): "none: every row re-run. The range rewrites JobQueue.claim (now through move/persist), complete, fail, restore, requeue and the snapshot write (temp file + rename); every QA row (QA1-QA9) exercises at least one of them, so no row's observed behaviour is unchanged by this range." Wave 2's matrix header states the same reason ("Every F1 row re-run: the range rewrites claim, complete, fail, requeue, restore and the snapshot write, and each row reaches at least one of them"). Checked against `git diff 5757c3a 927747b -- src`: QA1/2/7 reach `claim`+`persist`, QA3/4 `complete`+`need`, QA5/6 `persist`, QA8 `restore`, QA9 `fail`/`requeue`; every row reaches rewritten code, so a carry would have been the error.
- Fix round 2 (commits `5b33a70` rows, `8759878` code; diff `src/queue.ts` only: `add` throws on a duplicate id and returns a copy, `get` returns a copy). Round 2 delta brief `{CARRIED ROWS}` (`briefs/delta2-brief.md:9-10`): "none: every row re-run. The range changes JobQueue.add (duplicate ids throw, returns a copy) and JobQueue.get (returns a copy); every QA row (QA1-QA12) adds its jobs through add and reads the state it observes through get, so every row's observation reaches the changed code." Wave 3's matrix header gives the same reason; confirmed in `wave-3/qa-run.ts`: every scenario calls `add` and most log `get`. Every row reaches the changed code, so re-running all and carrying none matches what the diff can change.
- The ask (`session-output.txt`, before `Stop`): after wave 3 `CONTINUE` the session made no edit and no dispatch, then printed one question: "Fix round budget spent: F2 wave 3 printed `DECISION: CONTINUE` with 1 open blocker (... 2 of 2 fix rounds used at depth `risky`)", the open blocker strategic-risk-review B1 `non-atomic-snapshot-write` `src/store.ts:6` with its consequence and disposition **excluded** (class `concurrency-state`, names a gate criterion), options `one more fix round`, `re-plan`, `Stop`, and "Override is therefore not offered".
- `Stop`: `omp --profile pirp -p --resume <session file> "Stop"` (`session-final-text-after-stop-answer.txt`). The resumed turn made one read-only `bash` call (`git status --porcelain --untracked-files=no | wc -l`, `git log --oneline -1`, `tail -1 ledger`) and no edit, no dispatch. `before-stop.txt` vs `after-stop.txt`: identical except the session-file line count (374 -> 381, the resumed turn's own lines): `git log`, both HEADs (`e784622` on the main checkout, `87598781` on the review worktree, branch `8759878`), `git status --porcelain`, `git diff HEAD --stat` (empty), ledger lines (6) and child list unchanged. No `GC decide` (the budget ask records nothing, as SKILL.md says).

| Must-show item (4.3 b, and the carry rule 4.6 delivers) | Result | Pointer |
|---|---|---|
| Every reviewer result from fixed payloads, both lanes per wave and each delta | PASS | zero `task` calls; trailers `cmp`-identical; `verdict.json` = payload |
| Class `concurrency-state` at Depth `risky` | PASS | both lanes of every wave were payloads (6 reviewers) |
| Wave 1 FAIL with three distinct blocker classes | PASS | `WAVE F2 1 total=3` |
| Fix round 1 with its delta review | PASS | `RECORDED fix_delta_review rows=3.1,3.2,3.3 round=1 verdict=OKAY` |
| Wave 2 FAIL with two; fix round 2 with its delta review | PASS | `WAVE F2 2 total=2`; `RECORDED ... rows=4.1,4.2 ... OKAY` |
| Wave 3 FAIL with one, none fix-induced | PASS | `WAVE F2 3 total=1 fix_induced=0` (as in run 5, the session itself reported the wave-2/3 blockers contradict its code; see caveats) |
| `GC wave` prints `CONTINUE` at waves 2 and 3 | PASS | `gc-lines.txt` |
| Before any edit or dispatch, one ask with the open blocker and its disposition | PASS | `session-output.txt`; no tool call after the wave-3 `GC wave` apart from read-only checks |
| Options one more fix round, re-plan, Stop; no Override | PASS | same text |
| `Stop`: no tracked file change, `git log` unchanged, no reviewer dispatched | PASS | `before-stop.txt` vs `after-stop.txt` |
| After fix round 1, `{CARRIED ROWS}` and wave 2 re-run set match what the diff can change | PASS | every F1 row reaches rewritten code; `none: every row re-run` with the per-row reason; matrix QA1-QA9 re-run plus new rows QA10-QA12 |
| After fix round 2, `{CARRIED ROWS}` and wave 3 re-run set match what the diff can change | PASS | every row calls `add`/`get`; `none: every row re-run` with that reason; wave 3 re-ran QA1-QA12 plus QA13-QA14 |

Caveat on item 11/12: both fixes in this fixture reach every row, so this session cannot show a partial carry; it shows only that no row was carried that the diff could change and that the reason was stated. The carry itself (a row carried because the diff cannot change it) is exercised only by session a, where it FAILED.

### (a) second run, valid captures

Fixture `$TMPDIR/pirp-fix/f1b-r47b-a` (built from `f1b-a`'s starting commits: `git clone -b main f1b-a`, branch `feat/quota-remaining` created at `0cced13`, origin removed; same change folder, same gate.md `Depth: risky` / class `none` / tier `product`, same code). Commit history: `0cced13` (code: `remaining()` in `src/quota.ts`), `c1848ea` (F1 evidence, rebuilt), `58c6cf0` (`review.md` only, cherry-picked from `69ca02a`; OKAY still binds the folder). Text under test `18d2df6c03` (`risky/a/4.7b/deploy-check.txt`: `diff -rq` of the profile's `skills/review-work` against the branch printed nothing; branch HEAD printed). Same prompt as the first run (`risky/a/4.7b/prompt.txt`, stop after wave 1 with `GC wave`). Checks before launch: `validate-openspec-change.mjs --reviewed` `reviewed: OKAY in round 1`, `validate-gate-record.mjs --plan-only` `passed`, `openspec validate --strict` valid, schema blob `954aae1d8a239af994c88db3ef575591de70c95e`, clean tree.

Proper F1 capture set (`risky/a/4.7b/pre-existing-f1-captures/`, committed in `c1848ea`): `qa-matrix.md` in the Phase 1 format (#, scenario, exact command, expected, observed, verdict, artifact; states head `0cced13999e9e7f199ee821d3c591981c7d6ea0d`) and one artifact per row (`s1-within-limit.txt`, `s2-above-limit-control.txt`, `s3-integers-accepted.txt`), each opening with `# Capture on implementation head 0cced13999e9e7f199ee821d3c591981c7d6ea0d`, then `$ <exact command>`, the verbatim output and `[exit 0]`. Rows 1-3 only; the scenario-4 negative control (`remaining(2.5, 10)`) has no row. Commits after the capture change no code: `git diff 0cced13 HEAD --stat -- src test package.json` is empty (`fixture-git-state.txt`).

- Session file: `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1b-r47b-a/2026-11-02T23-43-08-634Z_01a19ea5-315a-70ff-8715-eafe0eacf57f.jsonl` (`risky/a/4.7b/session-path.txt`). Wall time 472 s (`wall-seconds.txt`). Final text `session-output.txt`. Tool calls in order (37, `tool-calls.tsv`): 1-5 read skill and `SKILL.md` line 172 and others whole; 17-18 `git show --stat` of the three commits and `git diff --stat 0cced13 HEAD -- src test package.json` (empty); 19 `GC baseline`/`ready`/`snapshot`; **22 `eval` runs the new rows, including the fractional-usage control (`wave-1-qa/s4-fractional-used-control.txt`)**; 24 writes the matrix; 26 builds briefs; 27 first `tool.task` in `eval`; 28 `read proc://`; 29 identical retry; 30-36 results, trailers, model checks; 37 `GC wave`.
- The first `eval` `tool.task` (call 27) launched nothing (the session says a rule stopped it; `proc://` listed nothing at call 28); the retry (call 29) is the only spawn: one pair of child sessions on disk (`ImplAuditW1`, `StrategicRiskW1`), one call, two items.
- GC lines (`gc-lines.txt`, `gc-commands.txt`, `ledger.jsonl`): `BASELINE 58c6cf0fa183 recorded`, `READY`, `SNAPSHOT F2 wave 1 58c6cf0fa183`, `DECISION: PASS`, `WAVE F2 1 total=0 fix_induced=0 unlocated=0`; ledger `gate_wave` outcomes `qa`, `implementation-audit`, `strategic-risk-review` all PASS.
- Children (`child-*-model.txt`): both `model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high`, every assistant turn `onara cx/gpt-6.1-sol` (36 and 10 turns). Trailers `trailer-*.txt`: `model_id: onara/cx/gpt-6.1-sol`, `verdict: PASS`. Delivered briefs: `F2-wave-1-delivered-brief-{implementation-audit,strategic-risk-review}.txt`; the strategic brief carries `Answer four questions about the whole diff:` with questions 1-4 (lines 261-266) and the only `Blocker B<n>` text is the instruction line (259, 269): no audit finding.
- End state (`fixture-git-state.txt`): `git log` unchanged at `58c6cf0`; `git status --porcelain` shows only untracked wave-1 QA, brief, trailer and ledger files; no fix, no record. The session reported it ran in the main checkout rather than a separate locked review worktree (it judged a second worktree on the same branch impossible without `--force`); no tracked file changed.

The session's matrix (`qa-matrix-wave1.md`, 8 rows), quoted: "Rows 1-3 are carried from the F1 capture on implementation head `0cced13999e9e7f199ee821d3c591981c7d6ea0d`. Carry reason (each row): the only later commits, `c1848ea` (adds the `f1/` evidence files only) and `58c6cf0` (adds `review.md` only), leave `src/quota.ts`, `test/` and `package.json` byte-identical (`git diff --stat 0cced13 HEAD -- src test package.json` is empty), and no default-branch merge followed the capture (`main` is the merge-base), so nothing can change what these rows observed. Rows 4-8 were missing from the reused F1 matrix and were run on the snapshot head." Rows: 1 within limit (carried), 2 above-limit control (carried), 3 integers (carried), **4 fractional-`used` negative control (new: `threw RangeError true quota values must be integers`)**, 5 fractional `limit`, 6 boundary `1 0 0 0`, 7 `NaN`/`Infinity` inputs, 8 `checkQuota` regression plus `bun test` (`2 pass 0 fail`); every row PASS with an artifact. Rows 1-3 each read "... - carried, reason above" and cite the tracked `f1/` artifacts. The final text repeats the reason: "The later commits `c1848ea` and `58c6cf0` touch only evidence and `review.md`; `git diff 0cced13 HEAD -- src test package.json` is empty, so they can't change what those rows observed."

| Must-show item (4.3 a, and the carry rule 4.6 delivers) | Result | Pointer |
|---|---|---|
| Missing negative-control row run before any dispatch | PASS | call 22 runs `s4-fractional-used-control.txt`; first spawn call 27/29 |
| Matrix with one row per scenario | PASS | rows 1-4 map to the four spec scenarios, rows 5-8 the minimum rows |
| Wave 1 dispatched for real, both invocations in one `task` batch (not single-lane) | PASS | one `tool.task` call with two items (call 29); one child pair on disk; ledger lists both lanes |
| Both on `auditor` at `onara/cx/gpt-6.1-sol` `high` | PASS | `child-*-model.txt` |
| `strategic-risk-review` brief has the four whole-diff questions and no audit findings | PASS | `F2-wave-1-delivered-brief-strategic-risk-review.txt:261-266` |
| Wave recorded with `GC wave`; session ends there, no fix, no record | PASS | call 37; `fixture-git-state.txt` |
| Pre-existing captures (rows 1-3) carried, one-line reason each, because later commits change no code | PASS (caveat) | the matrix header gives one reason for all three (later commits `c1848ea` and `58c6cf0` change only evidence and `review.md`; the session ran `git diff --stat 0cced13 HEAD -- src test package.json`, empty, call 18) and each row says "carried, reason above" instead of repeating the sentence; no capture was re-run |
| Missing negative-control row run, not carried | PASS | row 4 new |

Unexercised by this run: Phase 4 override, a Phase 3 mismatch, a fix round (stopped after wave 1 by the prompt).

### 4.7 verdict and findings

| Row | Result |
|---|---|
| 4.3 (a), first run | discarded (fixture defect: F1 captures lacked their commands); its carry FAIL is not the result |
| 4.3 (a), second run, valid captures | all 8 items PASS; carry item PASS with the one-shared-reason caveat |
| 4.3 (b) | all items PASS (carry rows judged: none carried, reasons stated; every fix reached every row) |

Instruction-text finding from the first (a) run, superseded by the second run (the first run's fixture was defective, see its heading): with `18d2df6c03` in the deployed profile the session read Phase 1 step 1 (`SKILL.md:172`) and still re-ran tracked, pre-existing captures that a later commit (`review.md` only) cannot change, writing "no row is carried". The text makes the carry mandatory for "an earlier head whose later commits cannot change what a row observed", but the session treated "captured in plan execution, not in this session; commands abbreviated; one scenario missing" as grounds for re-running. Those grounds were the fixture's defect (captures without their commands), not an instruction defect.

Resolution of that finding: the first (a) run is discarded as a fixture defect (the committed captures held outputs without their commands, so they were not a valid F1 capture set; the session's reason was the fixture's). On a fixture whose captures are a proper capture set, the same text (`18d2df6c03`) made the session carry rows 1-3 with the later-commit reason and run only the missing and minimum rows; see `### (a) second run, valid captures`. No instruction defect remains from 4.3 (a).

Caveat shared with the earlier runs: reviewer synthetic session files carry cwd `.../pirp-fix/f1b-b` (the original fixture), so the session noted reviewers "were not looking at this worktree"; it recorded every verdict as delivered and did not act on it. The session also noted `origin/feat/jobq-lifecycle` holds five commits from the earlier run (the clone's origin is `f1b-b`); no push was made.

---

## Earlier runs (superseded by the 4.7 re-run above)

Everything below is the run at HEAD `28434378ce`, kept for the record. Its session a re-ran all ten matrix rows and carried nothing, and its session b read the same pre-4.6 text; judge 4.3 by the `## 4.7 re-run` section.

(Earlier title: F1-B `risky` (task 4.3): evidence)

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
