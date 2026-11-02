# F1-D `standard` budget and carries (task 4.5)

## 4.7 re-run

Task 4.7, re-run of 4.5 (a) and (c) after task 4.6 made the QA carry mandatory (`SKILL.md` Phase 1 step 1 `:172`, Fix waves step 5b `:495`). QA lane: R45. Text under test: commit `18d2df6c03` (`SKILL.md` of the profile `pirp` compared byte-identical with `git show HEAD:team-config/agent/skills/review-work/SKILL.md`: `cmp` clean). Sessions ran `omp --profile pirp -p` (follow-ups `--resume <session file>`). Every reviewer result is a fixed payload from `$TMPDIR/pirp-fix/payloads/F1D/` (the earlier 4.5 payload files, unchanged); no `task` item was dispatched in any session (`grep -P "\ttask\t"` over all tool-call lists is empty). Retained copies live under `budget-standard/4.7/`: `a/` (run 1, primary), `a2/` (run 2, a second attempt, see below), `c/`. Each holds `prompt*.txt`, `stage*.out` (session stdout per stage) with `stage*.start`/`.end` (UTC), `tool-calls*.txt` (ordered tool calls via jq), `gc-lines*.txt`, `ledger.jsonl`, `briefs/` (the briefs the sessions wrote), `artifacts/` (trailers, QA captures, gate-deltas incl. `verdict.json`), `record.json`, `final-state.txt` (validator output, `git log`, `git status`), session file paths. (b) is **carried by task 4.7**: its must-show items (the fix-induced STOP ask and `GC decide`) do not depend on carries; the 4.5 result below stands for it.

### Deviations and honesty notes (4.7)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`**, same reason as the earlier run (that variable does not redirect subagent discovery). `~/.omp/agent` was never written. The session scripts the sessions call (`~/.omp/agent/skills/review-work/scripts`, as `SKILL.md` names them) are byte-identical to the branch's.
2. **Fixtures are fresh clones of the earlier final builds, not rebuilds.** `f1d-r47-a` (and `f1d-r47-a2`): clone of `f1d-a-budget`, branch `feat/csv-total` at `ecd418f` (the earlier starting commit: scaffold `2a9922d` -> `4e5e75b` -> F1 captures `ecd418f`), `main` = `2a9922d`; schema blob `954aae1d8a239af994c88db3ef575591de70c95e`. `f1d-r47-c`: clone of `f1d-c-moving`, `feat/csv-total` at `0cd516d`, `main` at `cac67ef` (README), scaffold `a951855`; neither is an ancestor of the other. Setup checks per fixture before any session: `bun test` 4 pass, `validate-openspec-change.mjs --reviewed` OKAY, `validate-gate-record.mjs --plan-only` passed, `openspec validate csv-total --strict` valid (a). Commits created by the sessions have new hashes (timestamps); the committed content of the fixtures is the earlier one. No earlier fixture was touched.
3. **No payload was changed.** Only the brief output directory in the prompts (`out-a` -> `r47/out-a`, `out-a2`, `out-c`) differs from the earlier prompts. Prompts are `a/prompt-a1.txt`, `a/resume-a2.txt`, `a2/prompt-a2-run.txt`, `c/prompt-c1.txt`, `c/prompt-c2.txt`; none names the expected outcome, the planted defect or the rule under test. The (a) resume text only lists files, the Override answer is the earlier text verbatim: `Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`. Session 1 of (c) was started with the same `/opsx-apply csv-total. Implement the one remaining task ... do not start the F2 merge gate or any review.` text, then `c/c-main2.sh` (the earlier `payloads/c-main2.sh`, content-identical: `groupThousands` via `toLocaleString`, reachable only for totals of 1000 or more) was applied to `main` between the sessions.
4. **All reviewer replies and the child session file are synthetic**, exactly as in the earlier run: `a-w1-reply.md` (never used, see below), `a-w2-reply.md`, `c-w1-reply.md` (each passed `validate-gate-record.mjs --trailer ...` when built), synthetic auditor child session files (`model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high`), structured delta verdicts. The sessions' Phase 3 model check ran against the synthetic file. Real `auditor` / `plan-reviewer` agents were never run.
5. **(a) was run twice.** Run 1 (`a/`) is the primary run; run 2 (`a2/`) is a second attempt on a new clone, started after run 1 stopped at the same point, because run 1 did not reach the wave-1 reviewer payload. Run 2 did not either (same cause). Both are reported; nothing was discarded. Judgements below name which run they hold for.
6. Session 2 of (c) and both (a) runs worked in the checkout the prompt started them in (the (a) runs said `feat/csv-total` was the only worktree and ran in place; (c) session 2 detached the clean main checkout and added a locked worktree `.worktrees/review-csv-total`). Not a finding about this change.

### (a) Class `none`, `standard`, budget ask and Override (4.7)

Run 1: fixture `f1d-r47-a`, session `~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r47-a/2026-11-02T23-26-15-612Z_01a19e95-bc3c-7713-b87d-60952c6e5008.jsonl` (`a/session-file.txt`). Wall time: stage 1 (to `AWAITING REPLY: delta review`) 368 s, stage 2 (delta verdicts and wave-2 audit reply, ends at the ask) 221 s, stage 3 (Override) 79 s.

Ordered tool calls (`a/tool-calls.txt`, 70 calls; key points): 1-11 read `skill://review-work` and context; 19 `validate-gate-record --plan-only` passed; 20 `GC baseline` / `ready`; 21 `GC snapshot` (wave 1); 22-26 `eval` QA (F1 captures s1-s5 reused as rows Q1-Q5 on the unchanged head `ecd418f`; new rows Q6 regression-grouping, Q7, Q8 captured into `wave-1/`); 27 `GC wave --outcome qa=FAIL --blocker QA6` (no reviewer dispatched; Q6 printed `1234,567.00` for `1234567.00`); 34-43 fix row 1 under a new `## TODOs` heading, test, fix commit `58aa50f`; 44 `GC patch`; 46 writes `brief-delta-round1.md`, stage 1 ends `AWAITING REPLY: delta review`. Stage 2: 49-50 `verdict.json` = REJECT payload, `GC delta` (round 1); 51 re-run of `s1` on `58aa50f` into `wave-2/q1-happy.md`; 52 `GC patch` (same range); 53 writes `brief-delta-round1-review2.md`; 54 `GC delta` with the OKAY payload (round 2); 55 / 56-57 `GC snapshot` wave 2 and the wave-2 QA re-runs (`eval`); 61-62 reads the wave-2 reply, jq model check of the synthetic child (matches the pin); 63 trailer stored; 64 `GC wave --outcome qa=PASS --outcome implementation-audit=FAIL --blocker sub-cent-rounding=src/money.ts:2`; **the ask was printed right after call 64** (no edit, commit or dispatch between 64 and the stop). Stage 3: 65-70 validator read, record written, staged, validated, committed (`1093d69`).

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=1 fix_induced=0 unlocated=1`; `RECORDED fix_delta_review rows=1 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=1 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 58aa50fd80a1`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger `a/ledger.jsonl`.

Carry observations (run 1):
- First delta brief (`a/briefs/brief-delta-round1.md` lines 9-16, the `{CARRIED ROWS}` block): carried Q1 s1-happy, Q2 s2-malformed, Q3 s3-cents, Q4 s4-empty, Q7 malformed-among-valid, Q8 cents-add, each with a one-line reason (whole part < 1000 never reaches the changed `groupThousands`; or `parsePrices` throws before `formatCents`; parser untouched). Not carried and stated as re-run in the next wave: Q5 s5-large (`1234.50` reaches `groupThousands`) and Q6 (the failing row the fix addresses).
- Delta 1 REJECT payload names the carry of `s1`. The session recorded round 1, re-ran `s1` (`wave-2/q1-happy.md`, `25.00`, exit 0) before it wrote the second delta brief, whose `{CARRIED ROWS}` (`brief-delta-round1-review2.md` lines 9-15) lists Q2-Q4, Q7, Q8 as carried with reasons and states Q1 as re-run ("whose carry the previous delta review of this range rejected").
- Wave-2 QA matrix (`a/briefs/brief-implementation-audit-wave2.md` lines 638-650): Q1, Q5, Q6 re-run on `58aa50f`; Q2, Q3, Q4 carried from F1, Q7, Q8 carried from wave 1, each with its carry reason. No row the diff cannot change was re-run, and no touched row was carried.

Run 2 (`a2/`, fixture `f1d-r47-a2`, session `a2/session-file.txt`; wall time 276 s / 148 s / 57 s): same shape. Wave 1 again ended in the session's own QA (`QA9`: `big,1234567.00` prints `1234,567.00`) before any reviewer was dispatched, `GC wave` `total=1 unlocated=1` `CONTINUE`; fix row 1.3, commit `ae2afb0`; the first delta brief carried QA1-QA4 and QA6-QA8 with reasons and re-ran QA5 and QA9 (`a2/briefs/brief-delta-round1.md` line 9-16); REJECT payload on `s1` (the session's QA1) -> re-run (`wave-2/q1-happy.md`) before the second brief (line 16: "Not carried: QA1 ... re-run on ae2afb0"); OKAY; wave 2: re-ran QA1, QA5, QA9 and added one new row QA10 (`999999.99` + `0.01` -> `1,000,000.00`, a first-time row, not a re-run), carried QA2, QA3, QA4, QA6, QA7, QA8 with reasons (`briefs/brief-implementation-audit-wave2.md` lines 631-642); `GC wave` 2 `total=1 fix_induced=0 unlocated=0` `DECISION: CONTINUE`; the ask, then Override: record `a2/record.json` `overridden`, `override.by` `Tim`, one `accepted-residual` downgrade for `B1`.

The ask (`a/stage2.out`): states that B1 (`sub-cent-rounding`, `src/money.ts:2`) is covered by `gate.md` Accepted residual risks, that no exclusion applies, and offers (1) one more fix round, (2) re-plan, (3) Stop, (4) Override (`accepted-residual`, disposition `residual`). Run 2's ask (`a2/stage2.out`) offers the same four options.

Record (run 1, `a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`. `validate-gate-record.mjs --record ... --plan openspec/changes/csv-total` -> `overridden`, exit 0 (rerun by me, `a/final-state.txt`).

| Must show (4.5 (a) and the 4.6 carry rule) | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, `gate.md` Accepted residual risks names a defect class with its consequence | PASS | fixture `gate.md`; `--plan-only` passed (both runs) |
| Wave 1 FAIL with two blockers **from a fixed payload** | **FAIL (not reached)** in both runs: the session's own QA found the planted large-total defect first (Q6 / QA9), recorded `qa=FAIL` with one blocker (`total=1 unlocated=1`) and the wave-1 audit reply file was never used. This follows the skill (a QA failure ends the wave before the reviewer) and is not an effect of 4.6; the earlier 4.5 run had a session that did not probe a total above 999,999, so the payload ran. The planted defect is findable by QA in this fixture; I did not alter fixture or payload | `a/gc-lines.txt` line 6, `a2/gc-lines.txt` line 6, `a/stage1.out` |
| The first delta brief carries every row the fix cannot change, one-line reason each, in `{CARRIED ROWS}` | PASS (both runs) | `a/briefs/brief-delta-round1.md` 10-15; `a2/briefs/brief-delta-round1.md` |
| Delta payload rejects the carry of one row; the session re-runs that row before wave 2 | PASS (both runs) | ledger round 1 REJECT; `a/artifacts/evidence/gate/csv-total/wave-2/q1-happy.md` (call 51, before `GC snapshot` wave 2); `a2/.../wave-2/q1-happy.md` |
| No other untouched row is re-run (the re-runs before wave 2 are the rejected-carry row and the rows the diff changes) | PASS | run 1 wave 2 re-ran Q1 (rejected), Q5, Q6 (touched by the diff); run 2 re-ran QA1, QA5, QA9; QA10 in run 2 is a new row, not a re-run |
| A carry the diff can change is not carried | PASS | Q5/Q6 (run 1), QA5/QA9 (run 2) re-run, not carried |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS (both runs) | `gc-lines.txt` lines 13-14 |
| One ask before any edit offering one more fix round, re-plan, Stop, Override | PASS (both runs) | `stage2.out`; run 1: `GC wave` is call 64, the last call before the stop |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade, validates `overridden` | PASS (both runs) | `a/record.json`, `a/final-state.txt`; `a2/record.json`, `a2/final-state.txt` |

QA-lane judgement of the one unmet item (parent orchestrator): "wave 1 FAIL with two blockers from a fixed payload" is carried from the earlier 4.5 run below (its section (a): `GC wave` total=2 from the payload, `trailer-wave1.txt`). Task 4.6 changed only when a QA row is carried after a fix or merge; whether the session's own wave-1 QA probes a total above 999,999, and so ends the wave before the reviewer, does not depend on that text, and the skill orders QA before review in both texts. Both 4.7 runs reached every later item from the QA-failed wave 1, which is the part 4.6 can change.

### (b) Adjacent control (4.7)

Carried by task 4.7: the must-show items of 4.5 (b) (a rising fix-induced count reaches the existing `gate-convergence` STOP ask with `GC decide`, not the budget ask) do not depend on carries. The 4.5 result of the earlier run below stands; not re-run.

### (c) Moving default branch (4.7)

Fixture `f1d-r47-c`: `main` = scaffold `a951855` + `cac67ef` (README); `feat/csv-total` = scaffold + `0cd516d` (implementation and change folder, task 3.1 unticked, its text starts "merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then run ..."). `git merge-base --is-ancestor main HEAD` -> 1 at the start. Sessions: `c/session-files.txt` (two files, `2026-11-02T23-26-15-630Z...` and `2026-11-02T23-27-31-309Z...`).

**Session 1** (`/opsx-apply csv-total. Implement the one remaining task ... stop once its evidence is captured and committed`, 73 s): `c/tool-calls-session1.txt` (22 calls). Order: 12 `git merge-base --is-ancestor main HEAD` (not an ancestor); **14 `git merge --no-edit main`** -> merge commit `19eb3d4` (parents `0cd516d`, `cac67ef`); 15-16 `eval` captures of the five rows, **after the merge**; 17 `git cat-file -e 19eb3d4...`; 18 tick; 19 Verify (`test -s` on all five files); 20-21 validator and `git add` + commit `90d50fa`. Stopped; no gate started. Captures `c/artifacts/f1-session1/s1..s5` record `Head 19eb3d486b90...`. `c/after-session1-and-main2-log.txt`: `90d50fa` on top of merge `19eb3d4`.

**Second `main` commit** (`c/c-main2.sh`): `7b6e2e2` changes `groupThousands` (`toLocaleString("en-US")`), reached only for totals of 1000 or more. Row `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after) is the only F1 row whose output it changes; s1 `25.00`, s2 error path, s3 `1.00`, s4 `0.00` never reach it.

**Session 2** (fresh session, F2 prompt with the fixed wave-1 payload, 350 s): `c/tool-calls-session2.txt` (43 calls), `c/gc-lines-session2.txt`. Order: 1-6 skill and context; 19 `git switch --detach HEAD && git worktree add .worktrees/review-csv-total ... && worktree lock`; 20 plan-only and openspec validators; **21 `git merge --no-ff --no-edit main`** (`ab95eaf`); **22 `GC baseline` (`BASELINE ab95eaf4a37a recorded`) / `ready` / `snapshot`**; 24-26 QA (`eval`: matrix and re-run capture of `s5` into `wave-1/s5-large.md`, new rows s6-s10 and `bun test` -> `wave-1/`), 32-35 reads the payload, jq model check of the synthetic child (matches the pin), 36 trailer stored byte-identical; 37 `GC wave` -> `DECISION: PASS`, `WAVE F2 1 total=0`; 39-42 record, staged, validated, committed (`91a4409`). The brief (`c/briefs/brief-implementation-audit-w1.md` line 646 and the matrix lines 650-654, which fills `{QA MATRIX}`): "Rows s1-s4 are carried from the F1 capture on 19eb3d4; carry reason for each: the only behaviour-changing commit since that capture is the merge of `main` (ab95eaf, diff vs pre-merge head = `groupThousands` in src/format.ts only), and `groupThousands` is reached only when the whole part of the total is >= 1000; 90d50fa changes only tasks.md and evidence files."

| Row | Disposition in the wave-1 `{QA MATRIX}` | Reason stated |
|---|---|---|
| s1 happy | CARRIED | total 25.00, whole part 25 < 1000, never reaches `groupThousands` |
| s2 malformed | CARRIED | `parsePrices` throws before `formatCents` is called |
| s3 cents | CARRIED | total 1.00, whole part 1 < 1000 |
| s4 empty | CARRIED | total 0.00, whole part 0 < 1000 |
| s5 large | **RE-RUN** (`wave-1/s5-large.md`, `1,234.50`) | reaches the merged `groupThousands` |

Record `c/record.json` validates `passed` (`c/final-state.txt`). Remark: besides the five F1 rows the session captured five first-time rows (s6 cents-add, s7 mixed-malformed, s8 `1,234,568.00`, s9 CRLF, s10 CLI errors) and `bun test` in wave 1. They have no earlier capture, so they are not re-runs of any F1 row; the five F1 rows were carried or re-run as above.

| Must show (4.5 (c) and the 4.6 carry rule) | Result | Pointer |
|---|---|---|
| At start the default branch and the work branch have diverged; a real merge commit is needed | PASS | `merge-base --is-ancestor` -> 1 (session 1 call 12); `19eb3d4` has two parents |
| Session 1 merges `main` and commits the merge before capturing the first F1 row | PASS | call 14 merge, calls 15-16 captures; `s*.md` Head `19eb3d4` |
| Session 1 stops after F1 is captured and committed | PASS | `90d50fa`; no gate started |
| Second `main` commit changes the behaviour of exactly one row | PASS | only `s5` differs (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | call 21 merge `ab95eaf`, call 22 baseline |
| Re-runs exactly the touched row before wave 1's review starts | PASS | only `wave-1/s5-large.md` among the F1 rows; calls 24-26 before the reply is read at 32-34 |
| Every other F1 row is carried with a one-line reason in the `{QA MATRIX}` of the wave-1 brief | PASS | table above; brief lines 646-653 |
| Carry rule: no row the merge cannot change is re-run, no touched row is carried | PASS (s1-s4 carried, s5 re-run; the first-time rows s6-s10 are not F1 rows) | brief matrix |

### Result and instruction defects

One must-show item of 4.5 (a) is not met in this re-run: **wave 1 FAIL with two blockers from the fixed payload** (both runs; the session's own QA caught the planted defect first). All carry items of (a) and (c) pass; (b) is carried. No defect in the 4.6 text was observed: both the carry in `{CARRIED ROWS}` (`SKILL.md:495`) and the matrix carry (`:172`) were applied, the rejected carry was re-run before wave 2 and nothing untouched was re-run. Unexercised: the real `auditor` / `plan-reviewer`; a mismatching child (substitution path). Frictions already named in the earlier run recurred (`review.md` stale after fix rows are added to `tasks.md`; no `## TODOs` heading in a change folder) and the (a) runs asked about that; neither changes a verdict.

## Earlier 4.5 run (superseded by the 4.7 re-run above)

QA lane: F1D. Branch under test: `feat/post-impl-review-proportional` at `28434378ce`, deployed as profile `pirp`. Sessions ran with `omp --profile pirp -p`; follow-ups used `--resume <session file>`. All reviewer results came from fixed payloads. Nothing was dispatched to `auditor` or `plan-reviewer` (`grep "\ttask\t"` over every tool-call list is empty).

Retained copies live below `budget-standard/` next to this file: `a/`, `b/`, `c/`, each with `payloads/`, `briefs/` (the briefs the sessions wrote), `outputs/` (session stdout per stage), `tool-calls*.txt` (ordered tool calls from the session jsonl via jq), `gc-lines*.txt` (every GC output line the sessions saw), `ledger.jsonl`, `final-state.txt` (validator output, `git log`, `git status`), `artifacts/` (trailers, QA captures, gate-deltas), `session-file*.txt`.

## Deviations and honesty notes

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`.** That variable does not redirect subagent discovery, so sessions ran under profile `pirp` (byte-identical to this branch's team-config; shared context note). `~/.omp/agent` was never written. Skill scripts called by the sessions are byte-identical to the branch's.
2. **Payload delivery was staged.** The prompt told the session to write each brief to a file, use the reply file named for it, and, when no reply file was named yet, to stop and print `AWAITING REPLY: <what>, brief at <path>`. I then resumed the same session with the reply file (delta verdicts, wave-2 audit reply). The first prompts are `payloads/../prompt-*.txt` content quoted in the outputs; they never named the expected outcome, the planted defect or the rule under test. Resume texts only listed files.
3. **Every reviewer reply and the child session file are synthetic.** The audit replies (`a-w1-reply.md`, `a-w2-reply.md`, `b-w2-reply.md`, `c-w1-reply.md`) were written by me, each passed `validate-gate-record.mjs --trailer ... --invocation implementation-audit --verdict <V>` (`passed`) before use. `a-sess.jsonl` and `c-sess.jsonl` are synthetic auditor child sessions (`model_change` `onara/cx/gpt-6.1-sol`, `thinking_level_change` `high`, assistant `provider onara`, `model cx/gpt-6.1-sol`), made by `payloads/mk-session.sh`. No child was dispatched, so no real child provider/model/thinking exists; the sessions' model check ran against the synthetic file and matched the pin. Delta verdicts (`*.json`) are my structured `plan-reviewer`-shaped results.
3a. **The rejected carry in (a) is a designed payload.** The reviewer rejects the carry of row `s1` on reachability reasoning (the delta edits the formatter module every printed total goes through). The behaviour of `s1` could not actually change, so this tests the session's handling of a rejected carry, not a real regression. The session accepted it and re-ran `s1`.
4. **Sessions created `.worktrees/review-csv-total` in (a) and (c)** as the skill's Phase 0 asks; session 2 of (c) and (b) said they worked in the main checkout. Not a finding about this change.
5. **Discarded runs (fixture or run defects, kept short):**
   - Fixtures v1-v3 (planted defects the session's own QA found: `parseFloat` prefix, `indexOf` row numbers, nameless line, thousands misgrouping above one million): the sessions' QA failed before any reviewer was dispatched, or re-ran every row so no carry existed. Rebuilt; outputs in the profile session dirs, not retained.
   - One (a) run and one (b) run started with the wrong working directory (`payloads/F1D`, because of a failed `cd` in my launch loop); discarded.
   - (c) attempt 1 (`c/discarded-attempt1-shared-formatter/`): the second `main` commit changed `formatCents` itself, so the session re-ran four rows (s1, s3, s4, s5) and carried only s2. That is a defensible reading of the diff, but it did not isolate "exactly one row". I changed the fixture so the changed code is a helper reachable only for totals of 1000 or more (`groupThousands`), rebuilt, and re-ran sessions 1 and 2. The results below are from the rerun.

Fixture facts (all three fixtures share the schema blob): `git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` = `954aae1d8a239af994c88db3ef575591de70c95e`. Change `csv-total`: class `none`, Depth `standard`, Risk tier `product`; two requirements (strict price lines, exact cents), each with two scenarios plus a Negative control; `gate.md` Accepted residual risks: "Sub-cent rounding: a price with more than two decimals is rounded to the nearest cent per line (`src/money.ts`) instead of being rejected, so the printed total can differ from the supplier's invoice by one cent." Setup checks passed for each fixture before any session: `bun test` 4 pass; `openspec validate csv-total --strict` valid; `validate-openspec-change.mjs --reviewed` OKAY; `validate-gate-record.mjs --plan-only` `passed`.

---

## (a) Class `none`, `standard`, budget ask and Override

Fixture `f1d-a-budget`, branch `feat/csv-total`, implemented diff + F1 evidence committed (`main` is an ancestor). Session file: see `a/session-file.txt`. Wall time: stage 1 (to the first `AWAITING REPLY`) 515 s, stage 2 178 s, stage 3 (Override) 105 s.

Ordered tool calls (`a/tool-calls.txt`, 65 calls; key points):
- 1-4 read `skill://review-work`; 5-12 context; 13 `git switch main && git worktree add .worktrees/review-csv-total ... && git worktree lock`; 14 validators (`--plan-only` passed); 15 `GC baseline` / `ready` / `snapshot`; 17 wave-1 QA captures; 23-24 model check of the synthetic child (jq on `a-sess.jsonl`) then `GC wave` (wave 1).
- 31-36, 38, 40 fix rows 4.1, 4.2 in `tasks.md`, tests, fix commit; 41 `GC patch`; stage 1 ends `AWAITING REPLY: delta review`.
- 47 `GC delta` with the REJECT payload; 48 `GC patch` for a range covering the same commits; 50 `GC delta` with the OKAY payload; 51 `GC snapshot` wave 2; 52 wave-2 QA re-runs; 55 model check; 56 `GC wave`; 57 `todo`; **ask printed, session stopped** (stage 2 end 21:14:37Z; the ask was the last output; no edit, commit or dispatch between call 56 and the stop).
- Answer resumed at 21:14:42Z. 58-63 validator reads, record written, staged, validated, committed (`e4e3052`).

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=2 fix_induced=0 unlocated=0`; `RECORDED fix_delta_review rows=4.1,4.2 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=4.1,4.2 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 aa9b7e1e3a6e`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger: `a/ledger.jsonl` (5 events).

Artifacts: briefs `a/briefs/brief-implementation-audit-w1.md`, `-w2.md`, `brief-delta-round1.md`, `brief-delta-round1-review2.md`; trailers `a/artifacts/trailer-wave1.txt`, `trailer-wave2.txt`; QA captures `a/artifacts/qa-wave-1`, `qa-wave-2` (15 rows in wave 2); delta dirs with `verdict.json` in `a/artifacts/gate-deltas`; record `a/record.json`; validator and `git log`/`git status` in `a/final-state.txt`.

Observations:
- Wave 1: audit FAIL with `Blocker B1` (`src/format.ts:11`, misgrouped large totals) and `B2` (`test/csvtotal.test.ts:1`, large-total branch untested); `GC wave` total=2. The session judged neither accept-eligible and went to the fix. Its first delta brief listed ten carried rows with reasons (`{CARRIED ROWS}` in `brief-delta-round1.md`).
- Delta 1: payload REJECT naming carry `s1`. The session recorded it (round 1), did not amend code, re-ran `s1`, and reviewed the full range again in a second brief (`brief-delta-round1-review2.md`); round 2 OKAY. Wave 2 matrix: `s1` row "re-run in wave 2 (delta review rejected its carry)" with its own capture `qa-wave-2/s1-happy.md`.
- Wave 2: audit FAIL with one blocker `B1` sub-cent-rounding at `src/money.ts:2` (unchanged by any fix: not fix-induced). `GC wave` printed `DECISION: CONTINUE`.
- The ask (stage 2 output `a/outputs/stage2.out`): states open blocker B1 is covered by `gate.md` Accepted residual risks, none of the exclusions apply, and offers (1) one more fix round, (2) re-plan, (3) Stop, (4) Override (`accepted-residual`, disposition `residual`).
- Answer: `Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`.
- Record (`a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`, class `none`. `validate-gate-record.mjs --record ... --plan openspec/changes/csv-total` → `overridden`, exit 0 (rerun by me, `a/final-state.txt`).
- The record's `blockers` array lists the two wave-1 blockers as fixed (`fix_sha aa9b7e1`); the wave-1 FAIL trailer is not cited (only the wave-2 trailer is), so the single downgrade matches the one FAIL trailer.

| Must show | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, gate.md names a defect class with consequence | PASS | gate.md in fixture; plan-only `passed` |
| Wave 1 FAIL with two blockers from a fixed payload | PASS | `GC wave` total=2; trailer-wave1.txt |
| Delta payload rejects the carry of one QA row; session re-runs it before wave 2 | PASS (see 3a) | ledger round 1 REJECT; `qa-wave-2/s1-happy.md` |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS | gc-lines 13-14 |
| One ask before any edit offering fix round, re-plan, Stop, Override | PASS | stage2.out; tool call 57 last before stop |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade; validates `overridden` | PASS | record.json; final-state.txt |

---

## (b) Adjacent control: fix-induced rise, existing STOP ask, `GC decide`

Fixture `f1d-b-adjacent` (fresh copy of the same fixture), session in `b/session-file.txt`. Wall time stage 1 209 s, stage 2 111 s, stage 3 9 s.

Flow (`b/tool-calls.txt`, 52 calls; `b/gc-lines.txt`): baseline, snapshot wave 1; **wave 1 failed in the session's own QA** (row QA6, large totals: `1234567.89` printed `1234,567.89`), so the session skipped the reviewer and recorded `GC wave --outcome qa=FAIL --blocker QA6` → `DECISION: CONTINUE`, `WAVE F2 1 total=1 fix_induced=0 unlocated=1`. Fix row 4.1, one commit `20fb5fb` (regex rewrite in `src/format.ts` plus a regression test); delta brief lists carries QA1-QA4 with reasons; stage 1 stopped with `AWAITING REPLY: delta review`. I resumed with the OKAY delta payload and the wave-2 audit reply (`b-w2-reply.md`: FAIL, `Blocker B1` at `test/csvtotal.test.ts:17`, the only test the fix commit added; class `fix-test-misses-boundaries`; written against the fix commit after I had read it). The session recorded the delta (`RECORDED fix_delta_review rows=4.1 round=1 verdict=OKAY`), took snapshot wave 2, re-ran QA5 and QA6, model-checked the synthetic child, stored the trailer, and ran `GC wave` → **`DECISION: STOP fix-induced blockers rose from 0 to 1`**, `WAVE F2 2 total=1 fix_induced=1 unlocated=0` (blame attributed line 17 to the fix commit). It stopped with the convergence ask ("F2 wave 2 stopped: fix-induced blockers rose from 0 to 1 ... How do you want to proceed?" with `continue` and `re-plan`; it did not offer freeze because B1 is neither eligible nor covered) and said it would record the answer with `GC decide --lane F2 --choice <continue|replan> --by <you> --reason <text>`. It did not print the budget ask (no Stop/Override options, no "fix-round budget spent" wording).

I answered `re-plan` (stage 3): the session ran `GC decide --lane F2 --choice replan --by Tim --reason "the boundary tests belong to the formatter's own plan"` → `RECORDED convergence_decision lane=F2 wave=2 choice=replan`; `GC ready` then prints `NOT READY` with "F2 wave 2 decided replan: no further wave in this lane". No code or record written after. Ledger `b/ledger.jsonl`.

Which was required: the ask itself names `GC decide` (so the first stage already shows the STOP path); the resume was not required to prove it but shows `GC decide` accepted by the ledger, so I ran it.

| Must show | Result | Pointer |
|---|---|---|
| Same fixture, fresh copy | PASS | `f1d-b-adjacent` |
| Wave-2 payload with a rising fix-induced count is a real STOP | PASS | `DECISION: STOP ... rose from 0 to 1`, fix_induced=1 |
| Reaches the existing gate-convergence STOP ask with `GC decide`, not the budget ask | PASS | stage1/2 output; gc-lines 11-13 |
| Wave 1 FAIL from the reviewer payload with two blockers | not applicable to the control; wave 1 here was a QA FAIL (one blocker) | gc-lines 5-6 |

---

## (c) Moving default branch

Fixture `f1d-c-moving`: `main` = scaffold + `src/format.ts` + commit `cac67ef` (`docs: add README`); `feat/csv-total` = scaffold + implementation commit `0cd516d`; neither is an ancestor of the other (`git merge-base --is-ancestor main HEAD` → 1). The F1 task `3.1` of `tasks.md` is unticked and starts "merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then run ...". Setup checks passed.

**Session 1** (`/opsx-apply csv-total. Implement the one remaining task ... stop once its evidence is captured and committed: do not start the F2 merge gate or any review.`, 54 s): `c/tool-calls-session1.txt` (14 calls). Order: 1-3 `openspec list/status/instructions apply`, `validate-openspec-change --reviewed`; 5 `git merge-base --is-ancestor main HEAD` (not an ancestor); **7 `git merge --no-edit main`** producing merge commit `299d2d6`; 8 the five row captures (`eval`, after the merge); 9 Verify (`test -s` on all five files); 11-13 tick; 14 `git add` + commit `f1e381f`. Stopped there. Evidence files `c/artifacts/f1/s1..s5` record `Head 299d2d6`. `c/outputs/after-s1-log.txt` shows `f1e381f` on top of merge `299d2d6` (parents `0cd516d`, `cac67ef`).

**Second `main` commit** (`c/payloads/c-main2.sh`): `e1c4b54` changes `groupThousands` in `src/format.ts` (grouped thousands via `toLocaleString`), reachable only for totals of 1000 or more. Row `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after; the task text allows grouping) is the only F1 row whose output it changes.

**Session 2** (fresh session, F2 prompt with fixed payload; `c-w1-reply.md` PASS, 257 s): `c/tool-calls-session2.txt` (39 calls), `c/gc-lines-session2.txt`. Order: 8-11 context; 17 `git worktree add`; 18 plan-only and openspec validators; **20 `git merge --no-ff --no-edit main`** (`aba5159`); **21 `GC baseline` (`BASELINE aba51593da95`) and `ready`**; 22 `GC snapshot`; 24-28 `eval` (QA matrix, re-run capture of `s5` into `wave-1/s5-large.md`, brief); 29 reads the payload; 30 jq model check of the synthetic child (matches the pin); 31 trailer stored byte-identical; 32 `GC wave` → `DECISION: PASS`, `WAVE F2 1 total=0`; 34-38 record, stage, validate, commit (`a1719c6`). The brief the session wrote (`c/briefs/brief-implementation-audit-w1.md`, lines 684-690) carries the matrix that fills `{QA MATRIX}`:

| Row | Scenario | Disposition | One-line reason |
|---|---|---|---|
| QA1 | s1 happy | carried from F1 on `299d2d6` | merge of main (`e1c4b54`) changes only `groupThousands`, called only for whole part >= 1000; this total is 25 |
| QA2 | s2 malformed | carried | `parsePrices` throws before `formatCents` runs; merge touches only `src/format.ts` |
| QA3 | s3 exact cents | carried | whole part 1 < 1000 never reaches the merged change |
| QA4 | s4 empty file | carried | whole part 0 < 1000 never reaches the merged change |
| QA5 | s5 large total | **re-run in F2 wave 1** (`1,234.50`) | merge changes `groupThousands`, which formats this total; F1 capture (`1234.50`) is stale |

Only one capture exists in `c/artifacts/qa-wave-1/` (`s5-large.md`). Record `c/record.json` validates `passed` (rerun, `c/final-state.txt`). The session reported two instruction frictions unrelated to this row (the record's `whole_diff.reason` wording, and it used the main checkout instead of a locked worktree).

| Must show | Result | Pointer |
|---|---|---|
| At start default branch and work branch diverged; real merge commit needed | PASS | `merge-base --is-ancestor` → 1; merge `299d2d6` has two parents |
| Session 1 shows the merge commit before the first F1 row capture | PASS | session 1 call 7 merge, call 8 captures; `s*.md` Head `299d2d6` |
| Session 1 stops after F1 is captured and committed | PASS | commit `f1e381f`, no gate started |
| Second `main` commit changes behaviour of exactly one row | PASS | only `s5` differs (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | call 20 merge `aba5159`, call 21 baseline |
| Re-runs exactly the touched row before wave 1's review starts | PASS | only `wave-1/s5-large.md`, calls 24-28 before the reply is used at 29 |
| Lists every other row as carried with a one-line reason in the matrix that fills `{QA MATRIX}` | PASS | table above; brief file lines 684-690 |
| Carrying the touched row fails the row | not triggered: the session re-ran `s5` | |

## Unexercised and uncertain

- The real `auditor` / `plan-reviewer` agents were never run; nothing here shows how they would phrase these findings. The Phase 3 model check was exercised only against synthetic child files, which carried the pin. A mismatching child (the substitution path) was not exercised in this row.
- (a) wave 1 and (b) wave 1 depended on the session's own QA: in (b) the session's QA caught the planted defect and recorded a QA FAIL, so only (a) used the reviewer payload for wave 1.
- `--resume` of a stopped print-mode session: worked in all cases; no session needed a second resume beyond the answers named above.
- Instruction text frictions noticed (none changes a verdict): sessions report that fix rows have no `## TODOs` heading in an OpenSpec change folder and that adding rows makes `review.md` stale against the digest (`--reviewed` fails after fix rows). The skill's text says the digest resets task checkboxes, but added task rows are new bytes.
