# F1-D `standard` budget and carries (task 4.5)

## 5.14 F1-D (d)

Task 5.14, new row F1-D (d): exercises the two fixes of commit `975c6b217d` in `team-config/agent/skills/review-work/SKILL.md`: (1) Fix waves step 3a (`:483`): a closing wave with an INCONCLUSIVE invocation is incomplete, not failed; when `GC wave` printed `CONTINUE` it gets no budget ask and no Override, is recorded, the user is told model and effort, no fix is committed, the wave is repeated on the same tree once the pin resolves; (2) Phase 1 step 1 (`:172`) plus Fix waves step 4 (`:490`): a carried QA row's command is not executed again, but fix verification (the changed module's tests, the full suite once per fix round) still runs when a carried row has the same command, and its output never replaces or refreshes that row's capture. Artifacts: `budget-standard/5.14/d/`. Judged against the transcript below; the 5.11 method (ordered tool calls, full call code, GC lines, ledger) is reused.

### Setup and deviations (5.14)

1. **Profile `pirp`, not `PI_CODING_AGENT_DIR`**, as in 5.11. `cmp ~/.omp/profiles/pirp/agent/skills/review-work/SKILL.md team-config/agent/skills/review-work/SKILL.md` -> identical (checked before the first session, at `975c6b217d`). `gate-convergence.mjs`, `validate-gate-record.mjs`, `validate-openspec-change.mjs`, `trailer.mjs` under `~/.omp/agent/skills/review-work/scripts/` are `cmp`-identical to the branch's; `diff -rq` of the whole skill dirs (session call 20) lists `SKILL.md`, the schema, two templates and `validate-gate-record.test.mjs` as differing between `~/.omp/agent` and the profile (the sessions read the profile's `SKILL.md`, the version under test).
2. **Deviation: profile `config.yml` has `retry.fallbackOn: usage-limit`** (`~/.omp/profiles/pirp/agent/config.yml:20`). No session hit a usage limit or a fallback.
3. **Fixture `$TMPDIR/pirp-fix/f1d-r514-d`** (builder `d/fixture-build.sh`, derived from `f1d-build.sh` mode `ab` with the three changes below; `install-openspec-workflow.mjs` run from this worktree's `team-config/agent/skills/review-work/scripts`). OpenSpec change `csv-total`, Mandatory class `none`, Depth `standard`, schema `omp-gated`; `main` = scaffold `1cdbf10`, `feat/csv-total` = `63687cd` (F1 captured, task 3.1 ticked); `merge-base --is-ancestor main HEAD` = 0; `git init`, so **no remote and no earlier-gate ref exists**; reflog expired and `git gc --prune=now` run before the first session; only non-destructive git. Differences from (a): (i) **no defect the session's own QA finds**: `groupThousands` is `whole.toLocaleString("en-US")` from the start (the planted large-total grouping defect is absent; `formatCents(123456789)` -> `1,234,567.89`, `bun test` 4 pass); (ii) the delivered CLI has one planted defect the matrix does not reach: `src/cli.ts:15`, a read failure with `EACCES` prints `error: cannot read FILE: no such file` (wrong cause, a behaviour change); (iii) the QA matrix has a `bun test` command (below). The accepted residual risk (sub-cent rounding, `src/money.ts`) is unchanged.
4. **Fixed payloads** (new directory `payloads/F1D-d/`, `payloads/F1D/` untouched; copies in `d/payloads/`): `w1-reply.md` (implementation-audit FAIL, exactly one blocker `wrong-read-error-message`, `src/cli.ts:15`, valid `REVIEW-TRAILER-v1`, `model_id: onara/cx/gpt-6.1-sol`) with `sess-w1.jsonl` (synthetic child session on `onara/cx/gpt-6.1-sol`, `thinkingLevel` `high`); `delta1-ok.json` (OKAY); `w2-reply.md` and `w2-retry-reply.md` (PASS replies, trailer `model_id: onara/cc/claude-opus-5`) with `sess-w2.jsonl` and `sess-w2-retry.jsonl` (synthetic child sessions, assistant turns on `onara/cc/claude-opus-5`, `thinkingLevel` `high`). Session files made with `payloads/F1D/mk-session.sh`. Reviewer replies and child sessions are synthetic, as in 5.11; no real `auditor` / `plan-reviewer` ran. Prompts `d/prompt-d1.txt` (the 5.11 (a) F2 gate prompt, paths pointed at `F1D-d`, only the wave-1 reply named) and `d/resume-d2.txt` (the delta verdict and both wave-2 replies, retry named "if the skill calls for one"). No payload or prompt names the expected outcome, the budget rule or the carry rule.
5. **Deviation: no standalone full-suite row.** The session folded `bun test` into QA row 5 ("Regression on adjacent behaviour": the `formatCents` main-vs-head script **and** `bun test`), not into a row of its own. The row's command list contains `bun test` (wave-1 brief row 5), so the carry rule still applies to a row with the same command as the fix verification; this is the row judged below.
6. Not findings: the session adds row 4.1 under `## 4. F2 fixes` to `tasks.md`, which makes `review.md`'s digest stale for `validate-openspec-change.mjs --reviewed` (it said so in its report; same friction as 5.7); the review worktree `.worktrees/review-csv-total` (branch `review/csv-total`, locked) holds both fix commits, `feat/csv-total` stays at `63687cd`.

### Run (5.14)

Session `d/session-file.txt` (`~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r514-d/2026-11-03T14-08-00-987Z_01a1a1bd-01db-7328-946b-14e1ff68cc22.jsonl`). Stage 1 (to `AWAITING REPLY: delta review`) 451 s, stage 2 (delta verdict and both wave-2 replies, ends after recording wave 2) 104 s (`d/stage{1,2}.wall`). 69 tool calls (`d/tool-calls.txt`, full code `d/calls-full.txt`): 1-60 stage 1, 61-69 stage 2.

Ordered tool calls (key points): 20 pin check (`auditor.md` model `onara/cx/gpt-6.1-sol:high`, `omp config get task.agentModelOverrides` -> only `reviewer` and `plan-reviewer` entries) before any dispatch; 21 `validate-gate-record --plan-only`; 24 `GC baseline` / `ready`; 25 `GC snapshot` (wave 1); 26-29 QA captures in the review worktree incl. `bun test` and the `formatCents` parity script (wave-1 row 5 artifact `wave-1/r5-regression-format.md`, `4 pass`, written 15:12:00); 32 wave-1 brief (the five-row matrix, `bun test` inside row 5; the reviewer is **not dispatched**); 34 model check of `sess-w1.jsonl` (assistant turns, `model_change`, `thinking_level_change`); **36 `GC wave --outcome qa=PASS --outcome implementation-audit=FAIL --trailer ... --blocker wrong-read-error-message=src/cli.ts:15`** (`CONTINUE`, `total=1 unlocated=0`); 43-50 fix row 4.1, `test/cli.test.ts` on a mode-000 file, fix in `src/cli.ts`; **51 fix commit `f93afea` followed by the full `bun test` (`5 pass 0 fail`, `Ran 5 tests across 2 files`)**; 55 docs commit `12d38d8` (row 4.1 wording); 56 `GC patch`; 57 delta brief `brief-delta-round1.md` (stage 1 ends, call 60 blocks on the reply). Stage 2: 61 delta verdict stored, `GC delta` round 1 (`OKAY`); 62 `GC ready` / `GC snapshot` (wave 2, `12d38d8843e3`); **63-64 one new row-6 capture (mode-000 file and a missing file) via the CLI, no other CLI run**; 65 wave-2 brief; **66 Phase 3 model check of `sess-w2.jsonl` and the reply's trailer `model_id`** (mismatch); **67 fresh retry: the same brief copied to `brief-implementation-audit-wave2-retry.md`, then the retry reply and `sess-w2-retry.jsonl` checked** (mismatch again); both replies kept as ignored evidence (`git check-ignore` -> `ignored`), never submitted as a trailer; **68 `GC wave --outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE`, no `--trailer`** (`CONTINUE`, `total=1 unlocated=1`); 69 the final report. No commit after call 55.

GC lines (`d/gc-lines.txt`, ledger `d/ledger.jsonl`, 4 events):

```
BASELINE 63687cd82a15 recorded
READY
SNAPSHOT F2 wave 1 63687cd82a15
DECISION: CONTINUE
WAVE F2 1 total=1 fix_induced=0 unlocated=0
RECORDED fix_delta_review rows=4.1 round=1 verdict=OKAY
READY
SNAPSHOT F2 wave 2 12d38d8843e3
DECISION: CONTINUE
WAVE F2 2 total=1 fix_induced=0 unlocated=1
```

Call 68 command line, verbatim (no `--trailer`): `node .../gate-convergence.mjs --repo "$PWD" --plan openspec/changes/csv-total wave --lane F2 --snapshot .omp/team-config/gate-deltas/F2-ec58e3fc1718-wave-2.snapshot.json --outcome qa=PASS --outcome implementation-audit=INCONCLUSIVE`; ledger event 4: `"outcomes":{"qa":"PASS","implementation-audit":"INCONCLUSIVE"},"unlocated":["implementation-audit-inconclusive"],"decision":"CONTINUE"`.

Wave 1 reached the reviewer payload (the session's own QA found nothing; `w1-reply.md` read in call 33, `total=1`), as the fixture design required.

**Carried row and fix verification.** The delta brief (`d/briefs/brief-delta-round1.md`, carried-rows block) carries rows 1-5 with a one-line reason each; row 5 ("Regression on adjacent behaviour ... `bun test`"): "`src/format.ts` and `test/csvtotal.test.ts` are untouched, so the formatter comparison and the four existing tests cannot change; the range adds `test/cli.test.ts`, which the fix verification ran (`bun test`: 5 pass, 0 fail after f93afea) and which the wave-2 QA covers through a new real-surface row for the read-error messages, not through row 5". The wave-2 matrix (`d/briefs/brief-implementation-audit-wave2.md` lines 668-673) cites row 5 as "PASS (carried: captured at 63687cd ... the fix verification ran the grown suite, `bun test` 5 pass 0 fail after f93afea; the delta review saw this carry)" with its observed text unchanged (`bun test 4 pass 0 fail`) and the original artifact `wave-1/r5-regression-format.md`; `wave-2/` holds only `r6-read-errors.md` (`d/artifacts/evidence/gate/csv-total/wave-2/`), so the row-5 capture was neither replaced nor refreshed. After the fix commit the only CLI executions are call 63 (row 6) and, as `bun test`, call 51; the carried rows' inputs appear in no post-fix script.

Final report of stage 2 (`d/stage2.out`): states the gate has not passed and no record was written; "Which model ran: both sessions ... show `onara/cc/claude-opus-5` at effort `high`, and both trailers report `model_id: onara/cc/claude-opus-5`. The reviewer (`auditor`) is pinned to `onara/cx/gpt-6.1-sol:high` ..."; "Because the wave is incomplete rather than failed, the skill offers no budget question and no override. It also commits no fix and doesn't spend the remaining fix round"; next step: repeat the wave on `12d38d8` once the reviewer runs on the pin, from Fix waves step 1, waiting for a new reply file. It asks nothing and offers no option list.

End state (`d/final-state.txt`): fixture `git log --oneline --all`: `12d38d8` docs(openspec) row 4.1 wording, `f93afea` fix(cli), `63687cd`, `5b0f706`, `1cdbf10`; both fix commits predate the wave-2 snapshot (`SNAPSHOT F2 wave 2 12d38d8843e3`); nothing after it. Review worktree `status --short`: untracked wave-1, wave-2 QA files and the `evidence/csv-total/` replies only. No gate record was written (none expected: the wave is incomplete).

| Must show | Result | Pointer |
|---|---|---|
| (s1) The full-suite row is carried with its reason in the delta brief's carried rows | PASS (the `bun test` command sits in row 5, which also holds the `formatCents` script; no standalone full-suite row, deviation 5) | `d/briefs/brief-delta-round1.md` carried-rows block, row 5 |
| (s2) The full suite is executed after the fix as fix verification (tool call), and the wave-2 matrix row still cites its earlier capture | PASS | call 51 (`bun test` after `f93afea`, `5 pass`); wave-2 brief lines 672; `wave-2/` has no `r5-*` file; wave-1 `r5-regression-format.md` shows `4 pass` |
| (s3) The closing wave is recorded with `--outcome implementation-audit=INCONCLUSIVE` and no `--trailer` for it | PASS | call 68, `d/gc-lines.txt` lines 9-10, ledger event 4 |
| (s4) No budget ask and no Override is offered | PASS (`GC wave` printed `CONTINUE`, so step 3's ask is not permitted and none was made) | `d/stage2.out`; `DECISION: CONTINUE` |
| (s5) The user is told which model and effort ran | PASS (`onara/cc/claude-opus-5`, `high`; trailer `model_id` too; the pin `onara/cx/gpt-6.1-sol:high`) | `d/stage2.out` |
| (s6) No fix is committed after the closing wave | PASS | `d/final-state.txt`: head `12d38d8`, committed 15:14:43, wave-2 recorded 15:17:08 (ledger), nothing after |
| Phase 3 reviewer dispatch (not dispatched), off-pin detection, retry | PASS | pin read from `auditor.md` and overrides checked before any dispatch (call 20); calls 34/66/67 compare assistant-turn model, `model_change`, `thinking_level_change` and trailer `model_id` with the pin; one fresh retry on the same brief, a second mismatch left INCONCLUSIVE; neither reply submitted as trailer |

### Result and instruction defects (5.14)

Every must-show item (s1)-(s6) is observed PASS; (s1) with the deviation that the full-suite command is part of row 5, not a row of its own. Both fixes of `975c6b217d` were followed on first read: the INCONCLUSIVE closing wave was recorded without trailer, ended without an ask or an Override and without a commit, and the carried row's command was neither executed again nor had its capture refreshed, while the fix verification (`bun test` on the grown suite) ran. No instruction defect found in `SKILL.md` `:172`, `:483`, `:490`. Frictions (not changing a verdict): the stale `review.md` digest after adding fix row 4.1 (also in 5.7); `GC wave` records an INCONCLUSIVE-invocation wave as `unlocated=1` (`implementation-audit-inconclusive`) without a blocker, which is the `Unclear means blocking` bookkeeping, not a rejection. Not exercised: the repeat of the wave after the pin resolves (the session stops and awaits a reply file; no further reply was delivered), and a `STOP` print on an INCONCLUSIVE wave.

## 5.11 re-run

Task 5.11, re-run of 4.5 (a) and 4.5 (c) after the F2 fix commit `bd1f21e33d`, which changed two things in `team-config/agent/skills/review-work/SKILL.md`: Phase 1 step 3 (`:181`) now adds after the fold sentence "Every capture that file cites is already tracked in the reviewed tree, or the file carries that capture's observed output verbatim: the record binds only the row's own artifact, and a capture committed after the review voids the record."; fix-waves step 3a (`:483`) now says a closing wave re-runs QA and, when QA passes, every reviewer lane, and that a closing wave whose QA fails dispatches no reviewer and is a failing wave. Earlier fixes still apply (`:172` a carried row's command is not executed again; `:181` a requirement row covers its scenarios in one row; `:535,:544` `whole_diff.reason` is the parenthesized reason). QA lane: R511D. Profile `pirp`, already deployed from `bd1f21e33d`: `cmp ~/.omp/profiles/pirp/agent/skills/review-work/SKILL.md team-config/agent/skills/review-work/SKILL.md` printed nothing (identical), checked before the sessions. Sessions ran `omp --profile pirp -p` (follow-ups `--resume <session file>`), launched by `r511run/run.sh`, the 5.7 runner with `r57run` replaced by `r511run`. Every reviewer result is a fixed payload; no reviewer was dispatched.

**4.5 (b) is carried by task 5.11**: its must-show items (the fix-induced STOP ask and `GC decide`) depend on neither the `standard` matrix nor carries; the 4.5 result of the earlier run (section "Earlier 4.5 run" below) stands, not re-run.

### Deviations and honesty notes (5.11)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`**, same reason as before. The sessions call the scripts under `~/.omp/agent/skills/review-work/scripts/`; I checked after the sessions that `gate-convergence.mjs`, `validate-gate-record.mjs`, `validate-openspec-change.mjs`, `folder-plan.mjs`, `plan-contract.mjs`, `trailer.mjs` and `gate-layout.mjs` there are `cmp`-identical to the branch's `team-config/agent/skills/review-work/scripts/`. The rest of `~/.omp/agent/skills/review-work` is NOT identical to the profile (`diff -rq`, (a) call 17, listed `SKILL.md`, the schema, two templates and `validate-gate-record.test.mjs` as differing); the sessions read `SKILL.md` from the profile, the version under test.
2. **Profile `config.yml` has `retry.fallbackOn: usage-limit`** (`~/.omp/profiles/pirp/agent/config.yml:20`). It was hand-edited at 11:22 to match main's seed change, not by this task; sessions started after it. No session hit a usage limit or a fallback.
3. **Fresh fixtures `f1d-r511-a` and `f1d-r511-c` from the 5.7 starting commits**, never an advanced fixture. (a): `git clone --no-checkout` of `f1d-a-budget`, then `feat/csv-total` created at `ecd418f` (`git branch feat/csv-total ecd418f`, `symbolic-ref HEAD`, `read-tree HEAD` plus `checkout-index -a`), `main` = `2a9922d`, `merge-base --is-ancestor main HEAD` = 0. **I removed the `origin` remote before any session** (`git remote remove origin`, which also drops `origin/feat/csv-total` and the earlier gate's record, 5.7 deviation 2) and additionally expired the reflog and ran `git gc --prune=now` so the earlier gate's commits (`e4e3052`, `aa9b7e1`, `2e85d9d`) no longer exist in the object store (`git cat-file -t e4e3052` -> not a valid object). The 5.7 session read that record through the remote; this one could not. (c): `git init -b main` plus `git fetch` of `f1d-c-moving` into temporary refs `refs/tmpsrc/*`; `feat/csv-total` = `0cd516d`, `main` = `cac67ef`, `--is-ancestor` = 1 (diverged); the temporary refs were deleted, reflog expired and `git gc --prune=now` run before any session (`e1c4b54` and later: not a valid object). Schema blob `954aae1d8a239af994c88db3ef575591de70c95e` in both. Setup checks before any session (both): `bun test` 4 pass; `validate-openspec-change.mjs --reviewed` OKAY; `validate-gate-record.mjs --plan-only` passed; `openspec validate csv-total --strict` valid. Fixtures were created with non-destructive git (no reset, clean or forced checkout).
4. **No payload and no fixture was changed.** Prompts are the 5.7 prompts with the brief directory `r57/` replaced by `r511/` (`a/prompt-a1.txt`, `a/resume-a2.txt`, `c/prompt-c1.txt`, `c/prompt-c2.txt`; `grep -c r57` over them: 0); `a/answer-a3.txt` is the earlier Override text verbatim (`Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`); `c/main2.sh` is `cmp`-identical to `payloads/F1D/c-main2.sh` (commit `d5da87c` on `main`; run as `bash c-main2.sh <fixture>`). None names the expected outcome, the planted defect or the rule under test. (c): session 1 `/opsx-apply csv-total. Implement the one remaining task ...`, then `c/main2.sh`, then session 2.
5. **All reviewer replies and child session files are synthetic**, as before; real `auditor` / `plan-reviewer` agents were never run. The Phase 3 model check ran against the synthetic files (`onara/cx/gpt-6.1-sol:high`).
6. Not findings: (a) worked in place (`feat/csv-total` is checked out only there) and left four untracked wave-1 QA files uncommitted (`wave-1/qa1-parse-strict.md`, `qa3-happy-path.md`, `qa4-boundary-large-totals.md`, `qa5-regression-adjacent.md`; the record validates `overridden`); the (a) session wrote its first QA helper into the shared `/tmp/csvtotal-qa/` (outside the fixture; it says it may have overwritten an earlier run's `run.sh` there) and then moved its inputs to `/tmp/csvtotal-qa-r511a/`, removed at the end. (c) session 2 added a locked worktree `.worktrees/review-csv-total` and committed the record there. In (c) `c/main2.sh` ends with `main` checked out in the fixture root (as in 5.7).

### (a) Class `none`, `standard`, budget ask and Override (5.11)

Fixture `f1d-r511-a`, session `a/session-file.txt` (`~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r511-a/2026-11-03T12-41-09-344Z_01a1a16d-7be0-766d-ac3e-a58fe3da6544.jsonl`). Wall time: stage 1 (to `AWAITING REPLY: delta review`) 496 s, stage 2 (delta verdicts, wave-2 audit reply, ends at the ask) 293 s, stage 3 (Override) 76 s (`a/stage{1,2,3}.wall`). 85 tool calls (`a/tool-calls.txt`; full code `a/calls-full.txt`): 1-57 stage 1, 58-79 stage 2, 80-85 stage 3.

Ordered tool calls (key points): 16-17 `validate-gate-record --plan-only` passed and the `diff -rq` of the skill dirs (`SAME`); 20 `GC baseline` / `ready`; 21 `GC snapshot` (wave 1); 22-29 QA helper and captures (wave-1 head `ecd418f`); 38-39 `bun test` and `formatCents` parity on `main` vs head; **42 `GC wave --outcome qa=FAIL --blocker QA4`** (`CONTINUE`, `total=1 unlocated=1`); 43-51 fix row 4.1 under `## 4. F2 fix round 1`, RED test, fix, `bun test`; 52 fix commit `ddc134e`; 53 `GC patch`; 55 `eval` writes `brief-delta-round1.md` (stage 1 ends, call 57 blocks on the reply). Stage 2: 58-60 REJECT payload, `GC delta` round 1; **61 one CLI run of `s1-happy` plus the CRLF input** (the rejected carry, written to `wave-2/qa3-happy-path.md` by call 63); 64-65 `GC patch`, second delta brief `brief-delta-round1-review2.md`; 66 `GC delta` round 2 (OKAY); 67 `GC snapshot` wave 2 (`ddc134eacefc`); **68 QA4 and QA5 re-runs** (`e-999` ... `e-12345678`, `s5-large`, parity, usage, missing file, `bun test`); 69-71 artifacts and `brief-implementation-audit-wave2.md`; 72-76 reply, model check, trailer; **77 `GC wave`** (`qa=PASS`, `implementation-audit=FAIL`, `CONTINUE`, `total=1`); 78-79 `todo` only (the ask is the last output). Stage 3: 80-83 record `2c554dc` and validator, 84 `rule://merge-gate-proof`, 85 cleanup.

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=1 fix_induced=0 unlocated=1`; `RECORDED fix_delta_review rows=4.1 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=4.1 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 ddc134eacefc`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger `a/ledger.jsonl` (5 events).

**Wave 1 did not reach the payload (the 3a rule, observed).** The session's own QA row QA4 (`1234567.89` -> `1234,567.89`, `wave-1/qa4-boundary-large-totals.md`, verdict FAIL) failed, so the session recorded `qa=FAIL --blocker QA4` (call 42) and **dispatched no reviewer**: no wave-1 brief exists in `a/briefs/` and `a-w1-reply.md` appears in no tool call (`grep -c a-w1-reply a/calls-full.txt` = 0). It states so in its stage-1 report ("F2 wave 1 failed in manual QA, so I dispatched no reviewer and left the wave-1 implementation-audit reply file unused"). Wave 2 (closing wave) re-ran the QA rows, QA passed (`qa=PASS`), and then the reviewer lane ran (`implementation-audit` FAIL, B1 `sub-cent-rounding`); that is the `:483` text, both halves, in one run.

**(m) The `standard` QA matrix** (wave 2, `a/briefs/brief-implementation-audit-wave2.md` lines 644-650; wave 1 used the same five rows, artifacts `wave-1/qa1-parse-strict.md`, `qa2-exact-cents.md`, `qa3-happy-path.md`, `qa4-boundary-large-totals.md`, `qa5-regression-adjacent.md`). The spec has two requirements; the gate has no further criterion; expected shape 2 requirement rows + 3 minimum rows = 5:

| Row | Item | Scenarios inside the row | Wave 1 | Wave 2 |
|---|---|---|---|---|
| QA1 | Requirement "Price lines are parsed strictly" | valid lines (carried F1 s1), malformed line 1 (carried F1 s2), negative control (malformed line among valid lines), blank lines, every malformed line named; one artifact `qa1-parse-strict.md` | captured + carried F1 s1/s2 | scenario 1 re-run (carry rejected), the rest carried (wave-1 file embedded verbatim in `wave-2/qa1-parse-strict.md`) |
| QA2 | Requirement "Totals are exact in cents" | `0.10 + 0.20`, empty file (carried F1 s4), ten x 0.10 (carried F1 s3); one artifact `qa2-exact-cents.md` | captured + carried | carried |
| QA3 | Happy path | LF and CRLF input | carried F1 s1 + CRLF capture | re-run (carry rejected) |
| QA4 | Riskiest edge: totals across the thousands boundary | 999.99 ... 12,345,678.90 | FAIL | re-run, PASS |
| QA5 | Adjacent regression (`formatCents` parity, usage, missing file, `bun test`) | - | captured | re-run (the fix changes `src/format.ts` and the test file) |

Five rows: one per requirement and the three minimum rows; no requirement is split into scenario rows (reused F1 captures s1-s4 sit inside QA1/QA2, s1 once more as the happy-path row's carried capture, as the minimum rows require). **(m) PASS.**

Carry observations:
- First delta brief (`a/briefs/brief-delta-round1.md` lines 40-45, the carried-rows block): QA1, QA2, QA3 carried with one-line reasons (totals below 1,000.00 or exit 2 never reach `groupThousands`; `price.ts`, `cents.ts`, `money.ts`, `cli.ts` untouched); QA4 and QA5 stated as not carried.
- REJECT payload (`a-delta1-reject.json`) names the carry of the F1 s1 happy-path row; the session recorded round 1, re-ran that row on `ddc134e` (call 61, `25.00` exit 0) and wrote the second delta brief (`brief-delta-round1-review2.md` lines 40-45: QA1 scenario 1 and QA3 re-run, QA2 carried, QA4/QA5 re-run).
- **(i) no carried row's command executed after the fix.** After the fix commit (call 52) the CLI is executed in call 61 (`s1-happy` and the CRLF input, the rejected-carry row) and call 68 (QA4's seven inputs, `s5-large`, QA5's parity script, usage, missing file and `bun test`, both rows the fix changes). `bun test` in calls 46 and 51 (before the commit) verifies the fix itself, not a matrix row. The carried rows' inputs (QA1 `r1-mixed`, `r1-multi-blank`, `r1-blank-only-valid`, `widget,abc`; QA2 `r2-cents`, ten x 0.10, the empty file) appear in no post-fix script; every other call after 52 invokes no CLI (the only matches of those names in calls 63, 69, 71, 80 are artifact or brief text). Method: ordered tool calls plus `grep` over `a/calls-full.txt` from call 52 on. **PASS.**
- **(ii) record `whole_diff.reason`.** `a/record.json`: `"whole_diff":{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `gate.md` line 7: `Whole-diff review: not needed (whole-diff surface reviewed in F2)`; the reason equals the parenthesized text. `validate-gate-record.mjs --repo . --record .omp/team-config/evidence/gate/csv-total.json --plan openspec/changes/csv-total` -> `overridden`, exit 0 (rerun by me, `a/final-state.txt`). **PASS.**

The ask (`a/stage2.out`): B1 (`sub-cent-rounding`, `src/money.ts:2`) is covered by `gate.md` Accepted residual risks, no exclusion applies; offers (1) one more fix round, (2) re-plan, (3) Stop, (4) Override. Call 79 is the last call of stage 2 (`todo`); the Override answer is the third user message, no edit or commit before it. Record (`a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`, `mandatory_class: none`, `reviewed_sha: ddc134eacefc3ada4e7cb21962f3846be52ae3c9`.

**(r) every capture a folded `standard` requirement-row artifact cites is tracked in the reviewed tree or carried verbatim.** Reviewed head `ddc134e` (`reviewed_sha`). Rows folding captures: QA1 (`wave-2/qa1-parse-strict.md`, the record's artifact) and QA2 (`wave-1/qa2-exact-cents.md`). `git ls-tree -r --name-only ddc134e .omp` lists exactly `f1/s1-happy.md`, `s2-malformed.md`, `s3-cents.md`, `s4-empty.md`, `s5-large.md` (all under `.omp/team-config/evidence/gate/csv-total/`). Check (each cited `f1/`/`wave-N/` path of each artifact, looked up in that tree; an untracked cited file must appear verbatim inside the artifact):

```
artifact wave-2/qa1-parse-strict.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
  UNTRACKED        .omp/team-config/evidence/gate/csv-total/wave-1/qa1-parse-strict.md   verbatim in artifact: True
artifact wave-1/qa2-exact-cents.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
```

The untracked wave-1 `qa1-parse-strict.md` is cited by the wave-2 artifact and is never committed (`git status --short`: four untracked wave-1 files); the session folded its text into `wave-2/qa1-parse-strict.md` ("Carried from wave 1, verbatim") exactly as the new `:181` sentence allows. The artifact contains the whole file text, `body.strip() in artifact` = True. **(r) PASS.**

| Must show (4.5 (a), the carry rule, 5.x observables, (m), (i), (ii), (r)) | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, `gate.md` Accepted residual risks names a defect class with its consequence | PASS | fixture `gate.md` lines 4, 8-9; `--plan-only` passed (setup check; call 16) |
| Wave 1 FAIL with two blockers **from a fixed payload** | **FAIL (not reached)**: the session's own QA found the planted large-total defect first (QA4), recorded `qa=FAIL` with one blocker (`total=1 unlocated=1`) and never read `a-w1-reply.md`. This is the `:483` rule (a closing/failing wave whose QA fails dispatches no reviewer); the same outcome as the 4.7, 5.3 and 5.5 runs; fixture and payload not altered; carried from the earlier 4.5 run | `a/gc-lines.txt` lines 5-6; call 42; `a/stage1.out` |
| First delta brief carries every row the fix cannot change, one-line reason each, in the carried-rows block | PASS | `a/briefs/brief-delta-round1.md` 40-45 |
| Delta payload rejects the carry of one row; the session re-runs that row before wave 2 | PASS | ledger round 1 REJECT; call 61 before `GC snapshot` wave 2 (call 67); `a/artifacts/evidence/gate/csv-total/wave-2/qa3-happy-path.md` |
| No other untouched row is re-run; a carry the diff can change is not carried | PASS | wave 2 re-ran the rejected row (QA3, QA1 scenario 1) and QA4, QA5 (the fix changes their code or tests); QA2 carried |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS | `a/gc-lines.txt` lines 13-14 (`qa=PASS`, `implementation-audit=FAIL`) |
| One ask before any edit offering one more fix round, re-plan, Stop, Override | PASS | `a/stage2.out`; call 79 is the last of stage 2 |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade, validates `overridden` | PASS | `a/record.json`, `a/final-state.txt` |
| (m) `standard` matrix: one row per requirement plus the three minimum rows, no requirement split into scenario rows, reused captures folded into their requirement row | PASS | table above; brief lines 644-650 |
| (i) no carried row's command executed after the fix | PASS | see above |
| (ii) `whole_diff.reason` equals the parenthesized `gate.md` reason, record validates | PASS | see above |
| (r) every capture a folded requirement-row artifact cites is tracked in the reviewed tree or carried verbatim | PASS | check output above |
| New `:483` rule: a wave whose QA fails dispatches no reviewer; a QA-passing closing wave runs the reviewer lane | PASS (observed, not a 4.5 item) | wave 1 no brief, wave 2 brief and `implementation-audit` result |

### (b) Adjacent control (5.11)

Carried by task 5.11 (see the opening paragraph); not re-run.

### (c) Moving default branch (5.11)

Fixture `f1d-r511-c`: `main` = scaffold `a951855` + `cac67ef` (README); `feat/csv-total` = scaffold + `0cd516d` (task 3.1 unticked). `git merge-base --is-ancestor main HEAD` -> 1 at the start. Sessions: `c/session-files.txt` (`2026-11-03T12-41-09-344Z_01a1a16d-7be0-733d-...`, `2026-11-03T12-49-38-549Z_01a1a175-40f5-7357-...`).

**Session 1** (`/opsx-apply ...`, 103 s): `c/tool-calls-s1.txt` (23 calls). Call 12 `git merge-base --is-ancestor main HEAD` (`ancestor=1`); **16 `git merge --no-edit main`** -> merge commit `d0c56d3` (parents `0cd516d`, `cac67ef`) and `bun test` (4 pass); 17-18 `eval` captures of the five rows (each with a negative-control mutant) after the merge; 21 tick; 20 Verify (`test -s` on all five files); 22 commit `a56d6c1` (explicit paths). No gate started (no `gate-convergence` call: `grep -c gate-convergence c/calls-full-s1.txt` = 0). The five F1 captures record `Head: d0c56d3...` (5 of 5, `git grep -c Head:` at `a56d6c1`).

**Second `main` commit** (`c/main2.sh`): `d5da87c` changes `groupThousands` (`toLocaleString("en-US")`), reached only for totals of 1000 or more; of the five F1 rows only `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after) is changed by it.

**Session 2** (fresh session, F2 prompt with the fixed wave-1 payload, 493 s): `c/tool-calls-s2.txt` (53 calls), `c/gc-lines-session2.txt`. Order: 1-17 skill and context (the skill is read from the profile); 23 `git switch main && git worktree add .worktrees/review-csv-total feat/csv-total && worktree lock`; **24 `git merge --no-ff --no-edit main`** (merge `f09ecef`, parents `a56d6c1`, `d5da87c`); **25 `GC baseline`** (`BASELINE f09ecefde27c recorded`) / `ready`; 26 `GC snapshot`; **29-30 `eval`: CLI executions on the reviewed head** (`s5-large`, the new `a,0.10` + `b,0.20`, three edge inputs `a,999.99`, `a,999.99`+`b,0.01`, `a,1234567.89`, each also on a scratch mutant); 31-34 artifacts; 35 `bun test`; 38-42 diff and brief; 43-45 reads the reply payload and the synthetic child (model check, matches the pin); 47 trailer copy; **49 `GC wave` -> `DECISION: PASS`**, `WAVE F2 1 total=0`; 50-52 record and commit `4600a88` in the review worktree; validator `passed`. Final message carries the Gate proof block (`reviewed_sha f09ecefde27c`, `override: none`).

Wave-1 `{QA MATRIX}` (`c/briefs/brief-implementation-audit-wave-1.md` lines 787-793, quoted verbatim; the long carry paragraph is not part of it):

```
| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Requirement "Price lines are parsed strictly" (valid lines summed; malformed price rejected with line number; negative control) | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01`, and on `widget,abc`; mutants on scratch copies | `25.00` exit 0; stderr names line 1, no stdout, exit 2; zero-counting mutant fails | `25.00` exit 0; `error: line 1: malformed price` exit 2, empty stdout; mutant prints `0.00` (NO MATCH) | PASS (CARRIED from F1 on d0c56d3: the merge of `main` touches only `groupThousands`, which these outputs never reach - whole part 25 < 1000, s2 throws before formatting) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa1-r1-parse-strict.md` (folds `f1/s1-happy.md`, `f1/s2-malformed.md`) |
| QA2 | Requirement "Totals are exact in cents" (cents add exactly; empty file; negative control ten lines of `x,0.10`) | `bun src/cli.ts total FILE` on `a,0.10`+`b,0.20` (new, on f09ecefde27c); empty file and ten `x,0.10` lines (F1); float-sum mutant | `0.30`; `0.00` exit 0; `1.00`, never `0.9999999999999999`/`1` | `0.30` exit 0 (mutant `0.30.000000000000004`, NO MATCH); `0.00`; `1.00` (mutant `0.99.99999999999999`, NO MATCH) | PASS (`0.30` re-observed on reviewed head; s3/s4 CARRIED from d0c56d3: totals 1 and 0 never reach `groupThousands`) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa2-r2-exact-cents.md` (cites `f1/s3-cents.md`, `f1/s4-empty.md`) |
| QA3 | Happy path the goal names | `bun src/cli.ts total FILE` on `widget,19.99`+`gadget,5.01` | `25.00`, exit 0 | `25.00`, exit 0; decimal-dropping mutant `24.00` | PASS (CARRIED from F1 on d0c56d3, same reason as QA1) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` |
| QA4 | Riskiest edge: the 1000 grouping boundary introduced by the merged `main` change | `bun src/cli.ts total FILE` on `a,999.99`; `a,999.99`+`b,0.01`; `a,1234567.89`; `de-DE` locale mutant | digits with `,` removed equal `999.99`, `1000.00`, `1234567.89`; two decimals; exit 0 | `999.99`, `1,000.00`, `1,234,567.89`, exit 0; mutant `1.000.00`, `1.234.567.89` (NO MATCH at and above 1000) | PASS (new on f09ecefde27c) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa4-edge-grouping-boundary.md` |
| QA5 | Regression on adjacent behaviour: F1 s5 large amount, re-run because the merge changed the code it reaches | `bun src/cli.ts total FILE` on `big,1234.50`; fixed-two-decimals mutant | digits `1234.50`, separators allowed, exit 0 | `1,234.50`, exit 0; mutant `1234.5` (NO MATCH) | PASS (RE-RUN on f09ecefde27c; `f1/s5-large.md` printed `1234.50` on d0c56d3 and is stale) | `.omp/team-config/evidence/gate/csv-total/wave-1/qa5-s5-large-rerun.md` |
```

Five rows: one per spec requirement (QA1, QA2), the three minimum rows (QA3 happy path, QA4 riskiest edge, QA5 adjacent regression), no further stated criterion counted separately; neither requirement is split into scenario rows, and the reused per-scenario F1 captures (`s1`, `s2` in QA1; `s3`, `s4` in QA2) are folded into their requirement row, each requirement row with one artifact (`qa1-r1-parse-strict.md`, `qa2-r2-exact-cents.md`) that cites the F1 captures by path and states the carry reason. QA3 reuses `s1` a second time as the happy-path minimum row. **(m) PASS** (the 5.5 run produced eight rows, 5.7 five).

- **(i) no carried row's command executed after the merge.** After the merge (call 24) the session executed the CLI only in calls 29 and 30: `s5-large` (`big,1234.50`, the row the merge changes, re-run), `a,0.10` + `b,0.20` (a first-time capture, no F1 row held it), the three QA4 edge inputs (new), and each of those on a scratch mutant (`format.ts`, `price.ts` or locale mutants). `bun test` in call 35. The carried captures `s1`-`s4` (`widget,19.99`..., `widget,abc`, ten x 0.10, empty file) were not executed; they are cited by path. Method: ordered tool calls plus the full code of calls 24-52 (`python` scan of `c/calls-full-s2.txt` for `cli.ts|bun test|subprocess`; the inputs of calls 29-30 listed above are the only ones). **PASS.**
- Observable (ii) was not asked for (c) (plain PASS record); for the record: `c/record.json` `whole_diff` is `{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `validate-gate-record.mjs --repo . --record .omp/team-config/evidence/gate/csv-total.json --plan openspec/changes/csv-total` (cwd the review worktree) -> `passed`, exit 0 (`c/final-state.txt`).

**(r) every capture a folded `standard` requirement-row artifact cites is tracked in the reviewed tree or carried verbatim.** Reviewed head `f09ecef` (`reviewed_sha`; the record commit `4600a88` adds only the record, the trailer and the `wave-1/qa*` artifacts). `git ls-tree -r --name-only f09ecef .omp` (review worktree, `c/final-state.txt`):

```
.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
.omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
.omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
.omp/team-config/evidence/gate/csv-total/f1/s5-large.md
```

Check (each cited `f1/` / `wave-N/` path of the row artifacts QA1 `wave-1/qa1-r1-parse-strict.md` and QA2 `wave-1/qa2-r2-exact-cents.md`, looked up in that tree):

```
== c reviewed head f09ecef
artifact .omp/team-config/evidence/gate/csv-total/wave-1/qa1-r1-parse-strict.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s1-happy.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md
artifact .omp/team-config/evidence/gate/csv-total/wave-1/qa2-r2-exact-cents.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s3-cents.md
  TRACKED at head  .omp/team-config/evidence/gate/csv-total/f1/s4-empty.md
```

Every cited capture is tracked at the reviewed head; nothing cited is untracked, so no verbatim copy was needed (QA2's one new capture, `0.30`, sits inside its own artifact). `git status --short` in the review worktree after the commit is empty. **(r) PASS.**

| Must show (4.5 (c), the carry rule, 5.x (i), (m), (r)) | Result | Pointer |
|---|---|---|
| At start the default branch and the work branch have diverged; a real merge commit is needed | PASS | `--is-ancestor` -> 1 (session 1 call 12); `d0c56d3` has two parents |
| Session 1 merges `main` and commits the merge before capturing the first F1 row | PASS | call 16 merge (`d0c56d3` is the head recorded in all five captures), calls 17-18 captures |
| Session 1 stops after F1 is captured and committed | PASS | `a56d6c1`; no gate started |
| Second `main` commit changes the behaviour of exactly one row | PASS | only `s5` (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | call 24 merge `f09ecef`, call 25 baseline `f09ecefde27c` |
| Re-runs exactly the touched row before wave 1's review starts | PASS | `s5` re-run in calls 29-30 before the reply is read (call 43); the `0.30` and edge captures are first-time captures of scenarios no F1 row held |
| Every other F1 row is carried with a one-line reason in the `{QA MATRIX}` of the wave-1 brief | PASS | QA1-QA3 above, each with its carry reason in the Verdict column and in each artifact |
| Carry rule: no row the merge cannot change is re-run, no touched row is carried | PASS | `s1`-`s4` carried, `s5` re-run |
| 5.x (i): no carried row's command executed after the merge | PASS | see above |
| (m) `standard` matrix: one row per requirement plus the three minimum rows, no requirement split into scenario rows, reused captures folded into their requirement row | PASS | five rows, quoted above; brief lines 787-793 |
| (r) every capture a folded requirement-row artifact cites is tracked in the reviewed tree or carried verbatim | PASS | check output above |

### Result and instruction defects (5.11)

Every must-show item of 4.5 (a) and 4.5 (c), (m), (i), (ii) and (r) is met except the carried (a) item "wave 1 FAIL with two blockers from a fixed payload", which was not reached (FAIL (not reached), as in 4.7, 5.3 and 5.5): the session's own QA fails first and the payload is never read; this is the correct behaviour under `:483`, and it is the first run in which the skill text says so (a QA-failed wave dispatches no reviewer), observed in (a) wave 1 and followed by a reviewer-lane closing wave 2. No instruction defect found in `SKILL.md` `:172`, `:181` (including the new capture-tracking sentence, followed by both sessions: (a) embedded the untracked wave-1 file verbatim, (c) cited only tracked captures) or `:483`, `:535`, `:544`. Differences from 5.7: the (a) fixture could not read the earlier gate's record (origin removed, objects pruned); (a) wave 2 QA1 now carries its untracked wave-1 artifact verbatim. Unexercised: the real `auditor` / `plan-reviewer`; a mismatching child (substitution path); (b) (carried).

QA-lane judgement (orchestrator, after R511D): the (a) item "wave 1 FAIL with two blockers from a fixed payload" is carried from the 5.7 run, which observed it PASS on `fbdb0d6473` (`GC wave` `total=2` from `a-w1-reply.md`, section "(a) ... (5.7)" below). Fixes 5.9 and 5.10 (`bd1f21e33d`) change the closing-wave wording and which captures a folded artifact may cite; neither changes how a wave-1 reviewer payload is read and counted, so the 5.7 observation stands. Every other item of 5.11 is observed in this run. 5.11 is judged PASS.

## 5.7 re-run (superseded by 5.11)

Task 5.7, re-run of 4.5 (a) and 4.5 (c) after 5.6 (commit `fbdb0d6473`: `SKILL.md` Phase 1 step 3 `:181` also says reused captures, step 1, that split a `standard` requirement by scenario are folded into that requirement's row, whose artifact is one file citing them). Earlier fixes still apply: `:172` (a carried row's command is not executed again), `:181` (a requirement row covers its scenarios in one row), `:535,:544` (`whole_diff.reason` is the parenthesized reason). QA lane: R57D. Profile `pirp` (already redeployed from `fbdb0d6473`; `cmp ~/.omp/profiles/pirp/agent/skills/review-work/SKILL.md team-config/agent/skills/review-work/SKILL.md`: identical, checked before the sessions). Sessions ran `omp --profile pirp -p` (follow-ups `--resume <session file>`). Every reviewer result is a fixed payload from `$TMPDIR/pirp-fix/payloads/F1D/` (unchanged); no `task` item was dispatched. Retained artifacts: `budget-standard/5.7/{a,c}/` (per session: prompts, tool-call lists `tool-calls*.txt` and full call code `calls-full*.txt`, briefs, GC lines, ledger, record, final state, `artifacts/evidence`).

**4.5 (b) is carried by task 5.7**: its must-show items (the fix-induced STOP ask and `GC decide`) depend on neither the `standard` matrix nor carries; the 4.5 result of the earlier run (section "Earlier 4.5 run" below) stands, not re-run.

### Deviations and honesty notes (5.7)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`**, same reason as before. `~/.omp/agent` was never written; the scripts the sessions call there are byte-identical to the branch's.
2. **Fresh fixtures `f1d-r57-a` and `f1d-r57-c` from the 5.5 starting commits**, never an advanced fixture. (a): `git clone --no-checkout` of `f1d-a-budget`, `feat/csv-total` at `ecd418f`, `main` at `2a9922d` (`merge-base --is-ancestor main HEAD` = 0); (c): `git init` + fetch of `f1d-c-moving`, `feat/csv-total` = `0cd516d`, `main` = `cac67ef` (`--is-ancestor` = 1, diverged; the temporary remote refs to the advanced source branch were deleted before any session). Schema blob `954aae1d8a239af994c88db3ef575591de70c95e` in both. Setup checks before any session (both): `bun test` 4 pass; `validate-openspec-change.mjs --reviewed` OKAY; `validate-gate-record.mjs --plan-only` passed; `openspec validate csv-total --strict` valid. Side effect of cloning (a), as in 5.3 and 5.5: the clone keeps `origin/feat/csv-total` (`e4e3052`, the earlier 4.5 run's commits, including its overridden record). **This time the session looked at it** (call 14 `git show e4e3052:.omp/team-config/evidence/gate/csv-total.json | jq ...` and `git show 2e85d9d`), read it as history and did not pull it; it said so in its report. The wave-1 reviewer reply is the fixed payload either way, but a session that knows the earlier gate's blockers is not blind; recorded, not altered (fixture property of the clone, the same one 5.3/5.5 had).
3. **No payload and no fixture was changed.** Prompts are the 5.5 prompts with the brief directory `r55/` replaced by `r57/` (`a/prompt-a1.txt`, `a/resume-a2.txt`, `c/prompt-c1.txt`, `c/prompt-c2.txt`); `a/answer-a3.txt` is the earlier Override text verbatim (`Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`); `c/main2.sh` is `cmp`-identical to `payloads/F1D/c-main2.sh`. None names the expected outcome, the planted defect or the rule under test. (c): session 1 `/opsx-apply csv-total. Implement the one remaining task ...`, then `c/main2.sh` (commit `066253a` on `main`), then session 2.
4. **All reviewer replies and child session files are synthetic**, as before (`a-w1-reply.md`, `a-w2-reply.md`, `c-w1-reply.md`, `a-sess.jsonl`, `c-sess.jsonl`, structured delta verdicts); real `auditor` / `plan-reviewer` agents were never run. The Phase 3 model check ran against the synthetic files.
5. Not findings: (a) worked in place (the session said `feat/csv-total` is checked out only there and the git-consent rule restricts moving it off, so no review worktree) and left three untracked QA files uncommitted (`wave-1/q4-riskiest-edge.md`, `wave-1/q6-task-verifies.md`, `f2/wave-1/`; the record validates `overridden`); (c) session 2 added a locked worktree `.worktrees/review-csv-total` and committed the record there. The fixture session also reported that `groupThousands` grouping is optional per `tasks.md` s5; not a finding.

### (a) Class `none`, `standard`, budget ask and Override (5.7)

Fixture `f1d-r57-a`, session `a/session-file.txt` (`~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r57-a/2026-11-03T09-23-51-310Z_01a1a0b8-d98e-77b1-ac3a-fc7ec5b8339e.jsonl`). Wall time: stage 1 (to `AWAITING REPLY: delta review`) 481 s, stage 2 (delta verdicts, wave-2 audit reply, ends at the ask) 199 s, stage 3 (Override) 86 s (`a/stage{1,2,3}.wall`). 67 tool calls (`a/tool-calls.txt`; full code `a/calls-full.txt`): 1-50 stage 1, 51-62 stage 2, 63-67 stage 3.

Ordered tool calls (key points): 17 `validate-gate-record --plan-only` passed; 18 `GC baseline` / `ready`; 19 `GC snapshot` (wave 1); 22-23 `eval` QA (wave-1 head `ecd418f`); 26-27 briefs; 29-30 read the wave-1 reply and child session; 31 trailer copy and check; **32 `GC wave`** (`CONTINUE`, `total=2`); 38-39 fix rows 4.1, 4.2 added under `## TODOs`; 40 commit `bdadbc9`; 44 fix; 46 `bun test` and fix commit `b64d965`; 47 RED check in a throwaway copy; 48 `bun test` and `GC patch`; 49 `eval` writes `brief-delta-round-1.md` (stage 1 ends). Stage 2: 51-53 REJECT payload, `GC delta` round 1; **54 `eval` one-row re-run of Q3** (`wave-2/q3-happy.md`); 55 second delta; 56 `brief-delta-round-1-rereview.md`; 57 `GC delta` round 2 (OKAY); 58 `GC snapshot` wave 2; 59 `eval` re-run of Q4 and Q6; 60 brief; 61 wave-2 reply; 62 `GC wave` (`CONTINUE`). Stage 3: 64 record, 65-66 add and commit `dd6dceb`.

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=2 fix_induced=0 unlocated=0`; `RECORDED fix_delta_review rows=4.1,4.2 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=4.1,4.2 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 b64d9652e387`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger `a/ledger.jsonl` (5 events).

**Wave 1 reached the payload this time.** The session's own QA recorded the large-total probe `big,1234567.89` -> `1234,567.89` in Q4 and judged it PASS (the F1 criterion allows grouping separators with or without, digits and two decimals right), so no `qa=FAIL`; the reviewer reply `a-w1-reply.md` (B1 misgrouped-large-total, B2 large-total-branch-untested) was read at call 29 and `GC wave` counted `total=2`. In 5.3 and 5.5 the session's QA failed first and the payload was never read.

**(m) The `standard` QA matrix** (wave 1, `a/briefs/brief-implementation-audit-wave-1.md` lines 625-632; wave 2, `brief-implementation-audit-wave-2.md` lines 651-656 has the same six rows). The spec has two requirements (two or three scenarios each, one a Negative control); the gate has no further criterion; `tasks.md` names Verify commands for 1.1, 1.2, 2.1; expected shape 2 requirement rows + 3 minimum rows (+ a row for the stated Verify commands) = 5-6. Rows (first column cells abridged only where marked):

| Row | Item | Scenarios inside the row | Wave 1 | Wave 2 |
|---|---|---|---|---|
| Q1 | Requirement "Price lines are parsed strictly" | valid lines summed (carried F1 s1), malformed line 1 (carried F1 s2), negative control with malformed lines among valid, blank lines ignored, line without comma; one artifact `wave-1/q1-req-parse-strict.md` | first-time capture + carried F1 s1/s2 | carried |
| Q2 | Requirement "Totals are exact in cents" | 0.10 + 0.20, ten x 0.10 (carried F1 s3), empty file (carried F1 s4), 3 x 0.1; one artifact `wave-1/q2-req-exact-cents.md` | captured + carried | carried |
| Q3 | Happy path (`widget,19.99` + `gadget,5.01`) | - | carried F1 s1 | re-run (carry rejected) |
| Q4 | Riskiest edge (CRLF, header row, 999.99, 1000.00, total above one million, three decimals, F1 s5) | - | captured | re-run (fix changes its code) |
| Q5 | Adjacent regression (usage errors, missing file, sub-1000 total) | - | captured | carried |
| Q6 | `tasks.md` Verify commands (`bun test`, `grep -q two design.md`) | - | captured | re-run (test file and tasks changed) |

Six rows: one per requirement, the three minimum rows, and one for the stated Verify commands; neither requirement is split into scenario rows (all its scenarios, reused F1 captures included, sit inside the requirement row and its one artifact). (a) reuses F1 captures s1-s5 but folds s1, s2, s3, s4 into Q1/Q2 and uses s1 once more as the happy-path row Q3, as the three minimum rows require. **(m) PASS.**

Carry observations:
- First delta brief (`a/briefs/brief-delta-round-1.md` lines 41-46, the carried-rows block): Q1, Q2, Q3, Q5 carried, one line of reason each (observed totals below 1,000 or the error path exits before formatting, so `groupThousands` is not reached); Q4 and Q6 stated as re-run in wave 2.
- REJECT payload (`a-delta1-reject.json`) names the carry of the F1 s1 happy-path row; the session recorded round 1, re-ran that row on `b64d965` (call 54, `wave-2/q3-happy.md`, `25.00`, exit 0) before the second delta brief (`brief-delta-round-1-rereview.md` line 45: "Q3 ... re-run on b64d965 after the first delta review of this range rejected its carry").
- Remark, not a failure of an item: wave-2 Q1 still carries its own wave-1 capture of the same `25.00` valid-sum scenario (first-time capture at `ecd418f`, not the `s1` capture the payload named). The payload rejected one row (Q3 here); the session re-ran exactly that row.
- **(i) no carried row's command executed after the fix.** After the fix commit (call 46) the CLI is executed in call 54 (the one-row Q3 script, the rejected-carry row) and call 59 (Q4's nine inputs and Q6 `bun test` + `grep -q two design.md`, both stale rows); plus `bun test` in calls 46, 47 (RED check, throwaway copy) and 48, which verify the fix itself (not a matrix row). The carried rows' commands (Q1 inputs `bad,abc`, blank-line, no-comma; Q2 `0.10 + 0.20`, ten x 0.10, empty file, `3 x 0.1`; Q5 usage, `sum`, missing file, `12.35`) appear in no post-fix script (`a/calls-full.txt` from the line of the fix commit on; every other eval and bash call after 46 invokes no CLI and no `bun test`). Method: ordered tool calls plus `grep -nE "cli\.ts|bun test|subprocess"` over the full code of every post-fix call. **PASS.**
- **(ii) record `whole_diff.reason`.** `a/record.json`: `"whole_diff":{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `gate.md` line 7: `Whole-diff review: not needed (whole-diff surface reviewed in F2)`; the reason equals the parenthesized text. `validate-gate-record.mjs --repo . --record .omp/team-config/evidence/gate/csv-total.json --plan openspec/changes/csv-total` -> `overridden`, exit 0 (rerun by me, `a/final-state.txt`). **PASS.**

The ask (`a/stage2.out`): B1 (`sub-cent-rounding`, `src/money.ts:2`) is covered by `gate.md` Accepted residual risks, no exclusion applies; offers (1) one more fix round, (2) re-plan, (3) Stop, (4) Override. Calls 62 (`GC wave`) is the last call of the stage; the Override answer is the third user message, no edit or commit before it. Record (`a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`, class `none`.

| Must show (4.5 (a), the carry rule, 5.x observables, (m), (i), (ii)) | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, `gate.md` Accepted residual risks names a defect class with its consequence | PASS | fixture `gate.md`; `--plan-only` passed (setup check; call 17) |
| Wave 1 FAIL with two blockers **from a fixed payload** | PASS | `GC wave` `total=2` from `a-w1-reply.md` (read at call 29); `a/gc-lines.txt` lines 4-5 |
| First delta brief carries every row the fix cannot change, one-line reason each, in the carried-rows block | PASS | `a/briefs/brief-delta-round-1.md` 41-46 |
| Delta payload rejects the carry of one row; the session re-runs that row before wave 2 | PASS | ledger round 1 REJECT; call 54 before `GC snapshot` wave 2 (call 58); `a/artifacts/evidence/gate/csv-total/wave-2/q3-happy.md` |
| No other untouched row is re-run; a carry the diff can change is not carried | PASS | wave 2 re-ran Q3 (rejected), Q4, Q6 (the fix changes their code or files); Q1, Q2, Q5 carried (see the Q1 remark) |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS | `a/gc-lines.txt` lines 11-12 |
| One ask before any edit offering one more fix round, re-plan, Stop, Override | PASS | `a/stage2.out`; call 62 is the last of stage 2 |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade, validates `overridden` | PASS | `a/record.json`, `a/final-state.txt` |
| (m) `standard` matrix: one row per requirement plus the three minimum rows (and a row per other stated criterion), no requirement split into scenario rows, reused captures folded into their requirement row | PASS | table above; brief lines 625-632 |
| (i) no carried row's command executed after the fix | PASS | see above |
| (ii) `whole_diff.reason` equals the parenthesized `gate.md` reason, record validates | PASS | see above |

### (b) Adjacent control (5.7)

Carried by task 5.7 (see the opening paragraph); not re-run.

### (c) Moving default branch (5.7)

Fixture `f1d-r57-c`: `main` = scaffold `a951855` + `cac67ef` (README); `feat/csv-total` = scaffold + `0cd516d` (task 3.1 unticked). `git merge-base --is-ancestor main HEAD` -> 1 at the start. Sessions: `c/session-files.txt` (`2026-11-03T09-23-51-310Z...`, `2026-11-03T09-24-43-197Z...`).

**Session 1** (`/opsx-apply ...`, 47 s): `c/tool-calls-s1.txt` (20 calls). Call 11 `git merge-base --is-ancestor main HEAD` (`ANC=1`); **16 `git merge --no-edit main`** -> merge commit `03369ba` (parents `0cd516d`, `cac67ef`) and `bun test` (4 pass); 17 `eval` captures of the five rows after the merge; 18 tick; 19 Verify (`test -s` on all five files); 20 commit `55e3e3b` (explicit paths). No gate started (no `gate-convergence` call). The five F1 captures record `Head: 03369ba...` (5 of 5, `git grep -c Head:` at `55e3e3b`).

**Second `main` commit** (`c/main2.sh`): `066253a` changes `groupThousands` (`toLocaleString("en-US")`), reached only for totals of 1000 or more; of the five F1 rows only `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after) is changed by it.

**Session 2** (fresh session, F2 prompt with the fixed wave-1 payload, 399 s): `c/tool-calls-s2.txt` (42 calls), `c/gc-lines-session2.txt`. Order: 1-20 skill and context; 21 `git switch main && git worktree add .worktrees/review-csv-total feat/csv-total && worktree lock`; 22 setup eval; **23 `git merge --no-edit main`** (merge `60d5644`, parents `55e3e3b`, `066253a`); **24 `GC baseline`** (`BASELINE 60d56444ecce recorded`) / `ready`; 25 `GC snapshot`; **26 `eval`: one CLI execution, `s5` (`big,1234.50`) into `wave-1/s5-large.md`**; 27 matrix evidence; **28 `eval`: one CLI execution of a first-time capture (`a,0.10` + `b,0.20` -> `0.30`, `wave-1/r2-exact-cents.md`)**; 29-32 diff and brief; 33 reads the reply payload and the synthetic child (model check, matches the pin); 36 trailer; 37 `GC wave` -> `DECISION: PASS`, `WAVE F2 1 total=0`; 39-41 record and commit `5f9e557` in the review worktree; validator `passed`.

Wave-1 `{QA MATRIX}` (`c/briefs/brief-implementation-audit-1.md` lines 670-676, quoted; abridged only in the long carry paragraph below it):

```
| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
| 1 | Requirement "Price lines are parsed strictly" (valid lines summed; malformed price rejected with its line; negative control) | `bun src/cli.ts total s1-happy.csv` (`widget,19.99`,`gadget,5.01`); `bun src/cli.ts total s2-malformed.csv` (`widget,abc`) | `25.00` exit 0; stderr names line 1, no stdout total, exit 2 | `25.00` exit 0; stderr `error: line 1: malformed price`, stdout empty, exit 2 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/wave-1/r1-parsed-strictly.md` |
| 2 | Requirement "Totals are exact in cents" (cents add exactly; empty file; negative control) | `bun src/cli.ts total s3-cents.csv` (ten `x,0.10`); `bun src/cli.ts total s4-empty.csv` (0 bytes); new: `bun src/cli.ts total r2-cents-030.csv` (`a,0.10`,`b,0.20`) | `1.00`; `0.00` exit 0; `0.30` | `1.00` exit 0; `0.00` exit 0; `0.30` exit 0 (new capture at 60d56444ecce) | PASS (s3, s4 carried; 0.30 captured this wave) | `.omp/team-config/evidence/gate/csv-total/wave-1/r2-exact-cents.md` |
| 3 | Happy path the goal names | `bun src/cli.ts total s1-happy.csv` | `25.00`, exit 0 | `25.00`, stderr empty, exit 0 | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s1-happy.md` |
| 4 | Riskiest edge: malformed price line | `bun src/cli.ts total s2-malformed.csv` | exit 2, stderr names line 1, no total | exit 2, stderr `error: line 1: malformed price`, stdout empty | PASS (carried) | `.omp/team-config/evidence/gate/csv-total/f1/s2-malformed.md` |
| 5 | Regression on adjacent behaviour: total of 1000 or more through the formatter changed by the merged default branch (066253a) | `bun src/cli.ts total s5-large.csv` (`big,1234.50`) | digits `1234.50`, grouping separators allowed, exit 0 | stdout `1,234.50`, stderr empty, exit 0 | PASS (re-run this wave) | `.omp/team-config/evidence/gate/csv-total/wave-1/s5-large.md` |
```

Five rows: one row per spec requirement (rows 1, 2), the three minimum rows (3 happy path, 4 riskiest edge, 5 adjacent regression), no further stated success criterion counted separately; neither requirement is split into scenario rows, and the reused per-scenario F1 captures (`s1`, `s2` in row 1; `s3`, `s4` in row 2) are folded into their requirement row, each requirement row with one artifact (`r1-parsed-strictly.md`, `r2-exact-cents.md`) that cites the F1 captures by path and sha256 and states the carry reason. Row 3 and row 4 reuse the `s1` and `s2` captures a second time as the minimum rows; that is the minimum rows' own scenario, not a split of a requirement. **(m) PASS** (the 5.5 run produced eight rows).

- **(i) no carried row's command executed after the merge.** After the merge (call 23) the session executed the CLI exactly twice: call 26 (`s5`, the row the merge changes, re-run) and call 28 (`a,0.10` + `b,0.20`, a scenario no F1 capture covered, a first-time capture, not a carried row's command). No `bun test` after the merge. The carried captures `s1`-`s4` (`widget,19.99`..., `widget,abc`, ten x 0.10, empty file) were not executed; they are cited by path and sha256. Method: ordered tool calls plus `grep -nE "cli\.ts|bun test|bun "` over `c/calls-full-s2.txt` (CLI invocations only at call 26 and call 28). **PASS.**
- Observable (ii) was not asked for (c) (plain PASS record); for the record: `c/record.json` `whole_diff` is `{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `validate-gate-record.mjs` (cwd the review worktree) -> `passed`, exit 0 (`c/final-state.txt`).

| Must show (4.5 (c), the carry rule, 5.x (i), (m)) | Result | Pointer |
|---|---|---|
| At start the default branch and the work branch have diverged; a real merge commit is needed | PASS | `--is-ancestor` -> 1 (session 1 call 11); `03369ba` has two parents |
| Session 1 merges `main` and commits the merge before capturing the first F1 row | PASS | call 16 merge (merge commit `03369ba` is the head recorded in all five captures), call 17 captures |
| Session 1 stops after F1 is captured and committed | PASS | `55e3e3b`; no gate started |
| Second `main` commit changes the behaviour of exactly one row | PASS | only `s5` (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | call 23 merge `60d5644`, call 24 baseline `60d56444ecce` |
| Re-runs exactly the touched row before wave 1's review starts | PASS | `wave-1/s5-large.md` (call 26) is the only F1 row executed, before the reply is read (call 33); call 28 is a new capture of a scenario no F1 row held |
| Every other F1 row is carried with a one-line reason in the `{QA MATRIX}` of the wave-1 brief | PASS | rows 1-4 above, each with its carry reason in the matrix's Carries paragraph (one shared reason: the merge changes only `groupThousands`, reached only for totals >= 1000) and in each artifact |
| Carry rule: no row the merge cannot change is re-run, no touched row is carried | PASS | rows 1-4 carried, row 5 re-run |
| 5.x (i): no carried row's command executed after the merge | PASS | see above |
| (m) `standard` matrix: one row per requirement plus the three minimum rows, no requirement split into scenario rows, reused per-scenario captures folded into their requirement row | PASS | five rows, table above; `c/briefs/brief-implementation-audit-1.md` 670-676 |

### Result and instruction defects (5.7)

Every must-show item of 4.5 (a) and 4.5 (c), (m), (i) and (ii) is met; the matrix of 5.6 holds in both sessions (5.5 (c) had eight rows). No instruction defect found in `SKILL.md` `:172`, `:181`, `:535`, `:544`. Differences from 5.5: (a) wave 1 reached the fixed reviewer payload (the session's QA accepted the ungrouped-separator output under the F1 criterion), so the earlier carried item "wave 1 FAIL with two blockers from a fixed payload" is observed (PASS) here; (a)'s session read the earlier run's record through the clone's `origin` remote (deviation 2). Unexercised: the real `auditor` / `plan-reviewer`; a mismatching child (substitution path); (b) (carried).

## 5.5 re-run (superseded by 5.7)

Task 5.5, re-run of 4.5 (a) and 4.5 (c) after 5.4 (commit `e7f9bd4ce1`: `SKILL.md` Phase 1 step 3 `:181` says a `standard` requirement row exercises that requirement's scenarios inside the one row, one artifact for the row, never one row per scenario). Earlier fixes still apply: `:172` (a carried row's command is not executed again), `:182` (the matrix has one row per item step 3 lists), `:535,:544` (`whole_diff.reason` is the parenthesized reason). QA lane: R55D. Profile `pirp` (already redeployed from `e7f9bd4ce1`; `cmp` of its `SKILL.md` with `team-config/agent/skills/review-work/SKILL.md` of the worktree: identical, checked before the sessions). Sessions ran `omp --profile pirp -p` (follow-ups `--resume <session file>`). Every reviewer result is a fixed payload from `$TMPDIR/pirp-fix/payloads/F1D/` (unchanged); no `task` item was dispatched (`a/tool-calls.txt`, `c/tool-calls-session*.txt` hold no `task` call). Retained copies under `budget-standard/5.5/`: `a/` (stage outputs, prompts, ordered tool calls, full `eval` code `eval-calls-full.txt`, GC lines, ledger, briefs, record, final state, artifacts incl. delta verdicts) and `c/` (same shape; `evals.txt` holds sessions 2's full `eval`/`edit` code).

**4.5 (b) is carried by task 5.5**: its must-show items (the fix-induced STOP ask and `GC decide`) depend on neither the `standard` matrix nor carries; the 4.5 result of the earlier run (section "Earlier 4.5 run" below) stands, not re-run.

### Deviations and honesty notes (5.5)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`**, same reason as before. `~/.omp/agent` was never written; the scripts the sessions call there are byte-identical to the branch's.
2. **Fresh fixtures `f1d-r55-a` and `f1d-r55-c` from the 5.3 starting commits**, never an advanced fixture. (a): `git clone --no-checkout` of `f1d-a-budget`, `feat/csv-total` at `ecd418f`, `main` at `2a9922d` (`merge-base --is-ancestor main HEAD` = 0); (c): `git init` + fetch of the two commits from `f1d-c-moving`, `feat/csv-total` = `0cd516d`, `main` = `cac67ef` (`--is-ancestor` = 1, diverged). Schema blob `954aae1d8a239af994c88db3ef575591de70c95e` in both. Setup checks before any session: `bun test` 4 pass; `validate-openspec-change.mjs --reviewed` OKAY; `validate-gate-record.mjs --plan-only` passed; `openspec validate csv-total --strict` valid. Side effect of cloning (a): the clone keeps `origin/feat/csv-total` (`e4e3052`, the earlier 4.5 run's commit); the session saw it and said it ignored it. Not a finding.
3. **No payload and no fixture was changed.** Prompts are the 5.3 prompts with the brief directory `r53/` replaced by `r55/` (`a/prompt-a1.txt`, `a/resume-a2.txt`, `c/prompt-c1.txt`, `c/prompt-c2.txt`); `a/answer-a3.txt` is the earlier Override text verbatim (`Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`). None names the expected outcome, the planted defect or the rule under test. (c): session 1 `/opsx-apply csv-total. Implement the one remaining task ...`, then `c/main2.sh` (`cmp`-identical to `payloads/F1D/c-main2.sh`; commit `1e88cd0` on `main`), then session 2.
4. **All reviewer replies and child session files are synthetic**, as in 5.3 (`a-w2-reply.md`, `c-w1-reply.md`, `a-sess.jsonl`, `c-sess.jsonl`, structured delta verdicts); real `auditor` / `plan-reviewer` agents were never run. The Phase 3 model check ran against the synthetic files (`onara` / `cx/gpt-6.1-sol` / `high`).
5. **(a) was run once.** Wave 1 again ended in the session's own QA before any reviewer was dispatched (QA5 `a,1234567.89` printed `1234,567.89`); recorded as in the 5.3 run, fixture and payload not altered (item carried from the earlier 4.5 run).
6. Not findings: (a) worked in place (no review worktree; the session said `feat/csv-total` is checked out only there); (c) session 2 added a locked worktree `.worktrees/review-csv-total` and committed the record there. In (a) calls 49 and 50 are the same one-row script (`s1`, the row whose carry was rejected), run twice (49 printed, 50 is the corrected script); both are executions of that row alone.

### (a) Class `none`, `standard`, budget ask and Override (5.5)

Fixture `f1d-r55-a`, session `a/session-file.txt` (`~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r55-a/2026-11-03T08-46-31-333Z_01a1a096-aba5-7413-8ea8-221f8077cb76.jsonl`). Wall time: stage 1 (to `AWAITING REPLY: delta review`) 315 s, stage 2 (delta verdicts, wave-2 audit reply, ends at the ask) 179 s, stage 3 (Override) 60 s. 70 tool calls in total: calls 1-45 stage 1, 46-63 stage 2, 64-70 stage 3 (`a/tool-calls.txt`).

Ordered tool calls (key points): 18 `GC baseline` / `ready`; 19 `GC snapshot` (wave 1); 22-24 `eval` QA captures (the QA rows below; wave-1 head `ecd418f`); **27 `GC wave --outcome qa=FAIL --blocker QA5`** (no reviewer dispatched; `a-w1-reply.md` is not named in any tool call argument: 0 mentions); 34-35 fix row 4.1 added to `tasks.md`; 36 `bun test` (RED); 38-39 fix, `bun test` plus one CLI run on `1234567.89` (verification of the fix, before the commit); 41 fix commit `c9b007a`; 42 `GC patch`; 44 `eval` writes `brief-delta-round1.md` (stage 1 ends there). Stage 2: 47-48 `verdict.json` = REJECT payload, `GC delta` round 1; **49-51 `eval` re-run of the one rejected-carry row** (`s1`, written to `wave-2/qa1-strict-parse.md` and `qa3-happy.md`); 52 `GC patch` again; 54 `GC delta` round 2 OKAY; 55-56 `eval` the six QA5 inputs and `bun test` (5 pass); 58 `eval` writes `brief-implementation-audit-wave2.md`; 60 jq model check of the synthetic child; 61 trailer stored; 62 `GC wave` (wave 2); 63 `todo`; the ask is the last output of stage 2 (no edit or commit between call 62 and the stop). Stage 3: 64-66 read the validator and snapshot, 67 `eval` writes the record, 68-69 `git add` by explicit path and commit `f754eda`, 70 read `rule://merge-gate-proof`.

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=1 fix_induced=0 unlocated=1`; `RECORDED fix_delta_review rows=4.1 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=4.1 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 c9b007ab1e49`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger `a/ledger.jsonl` (5 events).

**(m) The `standard` QA matrix (wave 2, `a/briefs/brief-implementation-audit-wave2.md` lines 637-641; the wave-1 QA used the same five rows: artifacts `wave-1/qa1-strict-parse.md`, `qa2-exact-cents.md`, F1 `s1-happy.md`, `wave-1/qa4-riskiest-edge.md`, `qa5-formatter-regression.md`). The spec has two requirements (each with two or three scenarios, one a Negative control); the gate has no further success criterion; so the expected shape is 2 requirement rows + 3 minimum rows = 5:**

| Row | Item | Scenarios inside the row | Disposition (wave 2) |
|---|---|---|---|
| QA1 | Requirement: price lines are parsed strictly | valid sum, malformed line, negative control (one artifact `wave-2/qa1-strict-parse.md`) | valid-sum scenario re-run on `c9b007a`; the other two carried inside the row |
| QA2 | Requirement: totals are exact in cents | 0.30, empty `0.00`, ten x 0.10 = `1.00` (one artifact `wave-1/qa2-exact-cents.md`) | carried |
| QA3 | Happy path (`widget,19.99` + `gadget,5.01` -> `25.00`) | - | re-run (carry rejected) |
| QA4 | Riskiest edge (CRLF, blank line, malformed lines 3 and 5) | - | carried |
| QA5 | Regression on adjacent behaviour (`formatCents`/`groupThousands`, 999.99 ... 1,234,567.89) | - | re-run (failed in wave 1, fix changes its code) |

Five rows, one per requirement plus the three minimum rows; neither requirement is split into scenario rows (every scenario of a requirement is inside its row and artifact). **(m) PASS.**

Carry observations:
- First delta brief (`a/briefs/brief-delta-round1.md` lines 9-14, the carried-rows block): QA1, QA2, QA3, QA4 carried, one line of reason each (no total reaches the changed `groupThousands`, which runs only for a whole part of 1000 or more; or `parsePrices` throws before `formatCents`); QA5 stated as not carried (re-run in wave 2).
- REJECT payload names the carry of the `s1` happy-path row; the session recorded round 1, re-ran that row on `c9b007a` (`25.00`, exit 0; calls 49-51) before writing the second delta brief (`brief-delta-round1-review2.md` lines 9-14: QA3 and the valid-sum scenario of QA1 re-run, QA2 and QA4 carried, QA5 re-run).
- **(i) no carried row's command executed after the fix.** After the fix commit (call 41) the only executions of `src/cli.ts` are the one-row `s1` script (calls 49 and 50, the row whose carry was rejected) and the six QA5 inputs (call 55, a stale row); the only other post-fix execution is `bun test` inside call 56 (unit suite, not a matrix row). The carried QA2 cases (0.10 + 0.20, empty file, ten x 0.10), the carried QA4 CRLF case and the carried malformed-line / negative-control scenarios of QA1 appear in no post-fix script (`a/eval-calls-full.txt` lines 120-215; calls 43, 46, 48, 52, 54, 59-70 invoke no CLI). Method: ordered tool calls plus the full code of every `eval` and every script run (`bash` calls matching `cli.ts|bun test`: only 36 and 39, both before the commit). **PASS.**
- **(ii) record `whole_diff.reason`.** `a/record.json`: `"whole_diff":{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `gate.md` line 7: `Whole-diff review: not needed (whole-diff surface reviewed in F2)`; the reason equals the parenthesized text. `validate-gate-record.mjs --repo . --record .../csv-total.json --plan openspec/changes/csv-total` -> `overridden`, exit 0 (rerun by me, `a/final-state.txt`). **PASS.**

The ask (`a/stage2.out`): B1 (`sub-cent-rounding`, `src/money.ts:2`) is covered by `gate.md` Accepted residual risks, no exclusion applies; offers one more fix round, re-plan, Stop, Override. Record (`a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`, class `none`.

| Must show (4.5 (a), the carry rule, 5.x observables, (m), (i), (ii)) | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, `gate.md` Accepted residual risks names a defect class with its consequence | PASS | fixture `gate.md`; `--plan-only` passed (setup check; `a/tool-calls.txt` call 14) |
| Wave 1 FAIL with two blockers **from a fixed payload** | **FAIL (not reached)**: the session's own QA found the planted large-total defect first (QA5), recorded `qa=FAIL` with one blocker (`total=1 unlocated=1`) and never read `a-w1-reply.md`. Follows the skill (QA before review); the same outcome as the 4.7 and 5.3 runs; fixture and payload not altered; carried from the earlier 4.5 run | `a/gc-lines.txt` lines 5-6; `a/tool-calls.txt` call 27 |
| First delta brief carries every row the fix cannot change, one-line reason each, in the carried-rows block | PASS | `a/briefs/brief-delta-round1.md` 10-14 |
| Delta payload rejects the carry of one row; the session re-runs that row before wave 2 | PASS | ledger round 1 REJECT; calls 49-51 before `GC snapshot` wave 2 (`a/gc-lines.txt` line 11); `a/artifacts/evidence/wave-2/qa3-happy.md` |
| No other untouched row is re-run; a carry the diff can change is not carried | PASS | wave 2 re-ran the rejected row (QA3 / QA1 valid-sum) and QA5; QA2 and QA4 carried |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS | `a/gc-lines.txt` lines 13-14 |
| One ask before any edit offering one more fix round, re-plan, Stop, Override | PASS | `a/stage2.out`; call 62 `GC wave`, 63 `todo`, no edit or commit until the answer |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade, validates `overridden` | PASS | `a/record.json`, `a/final-state.txt` |
| (m) `standard` matrix: one row per requirement plus the three minimum rows, no requirement split into scenario rows | PASS | table above; brief lines 637-641 |
| (i) no carried row's command executed after the fix | PASS | see above |
| (ii) `whole_diff.reason` equals the parenthesized `gate.md` reason, record validates | PASS | see above |

### (b) Adjacent control (5.5)

Carried by task 5.5 (see the opening paragraph); not re-run.

### (c) Moving default branch (5.5)

Fixture `f1d-r55-c`: `main` = scaffold `a951855` + `cac67ef` (README); `feat/csv-total` = scaffold + `0cd516d` (task 3.1 unticked). `git merge-base --is-ancestor main HEAD` -> 1 at the start. Sessions: `c/session-files.txt` (`2026-11-03T08-46-31-320Z...`, `2026-11-03T08-48-04-711Z...`).

**Session 1** (`/opsx-apply ...`, 89 s): `c/tool-calls-session1.txt` (23 calls). Call 13 `git merge-base --is-ancestor main HEAD` (not an ancestor); **16 `git merge --no-edit main`** -> merge commit `ec36fb4` (parents `0cd516d`, `cac67ef`) and `bun test`; 19 `eval` captures of the five rows after the merge; 21 Verify (`test -s` on all five files); 22 tick; 23 `git add` by explicit path, commit `e28acf5`. No gate started (no `gate-convergence` call). The five F1 captures record `Head: ec36fb4e6026...` (5 of 5). The session also reported `groupThousands` returns the number ungrouped (grouping optional in s5); not a finding.

**Second `main` commit** (`c/main2.sh`): `1e88cd0` changes `groupThousands` (`toLocaleString("en-US")`), reached only for totals of 1000 or more; of the five F1 rows only `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after) is changed by it.

**Session 2** (fresh session, F2 prompt with the fixed wave-1 payload, 363 s): `c/tool-calls-session2.txt` (49 calls), `c/gc-lines-session2.txt`. Order: 1-27 skill and context; 29 `git switch --detach HEAD && git worktree add .worktrees/review-csv-total ... && worktree lock`; first `eval` (call 30): `merge-base --is-ancestor` -> 1, then **`git merge --no-edit main`** (merge `8662301`, parents `e28acf5`, `1e88cd0`) then **`GC baseline`** (`BASELINE 86623019d0de recorded`) / `ready`; 31 `GC snapshot`; 32-41 `eval`/`edit`: the wave-1 QA (CLI executions only for the rows below); 42 reads the reply payload; 43 jq model check of the synthetic child; 44-48 brief, `GC wave` -> `DECISION: PASS`, `WAVE F2 1 total=0`, record, commit `2814962` in the review worktree, validator; 49 `rule://merge-gate-proof`.

Wave-1 `{QA MATRIX}` (`c/briefs/brief-implementation-audit-w1.md` lines 680-687):

| Row | Item (as stated in the brief) | Disposition |
|---|---|---|
| QA1 | Requirement `Price lines are parsed strictly`, Scenario `Valid lines are summed` (minimum happy path) | CARRIED (F1 `s1`, `ec36fb4`; reason: only `groupThousands` changed, reached only for totals >= 1000) |
| QA2 | Requirement `Price lines are parsed strictly`, Scenarios `Malformed price ...` and `Negative control` (minimum riskiest edge) | CARRIED (F1 `s2`, same reason) |
| QA3 | Requirement `Totals are exact in cents`, Scenario `Negative control` (ten lines of `x,0.10`) | CARRIED (F1 `s3`) |
| QA4 | Requirement `Totals are exact in cents`, Scenario `Empty file` | CARRIED (F1 `s4`) |
| QA5 | `tasks.md` 3.1 `s5`, total of 1000 or more | RE-RUN (`wave-1/s5-large.md`, `1,234.50`; reaches the merged `groupThousands`) |
| QA6 | Requirement `Totals are exact in cents`, Scenario `Cents add exactly` | captured new (`wave-1/r2-cents-add.md`) |
| QA7 | Riskiest edge for `Price lines are parsed strictly`: several malformed lines among valid and blank lines | captured new (`wave-1/edge-multi-malformed.md`) |
| QA8 | Regression: usage and unreadable-file exits, `bun test` | captured new (`wave-1/regression-cli-errors.md`) |

**(m) FAIL.** The spec has two requirements; the expected matrix is two requirement rows plus the happy-path, riskiest-edge and adjacent-regression rows (plus a row for the `s5` success criterion in `tasks.md` 3.1, if counted as a stated criterion): five to six rows. The session built eight, with `Totals are exact in cents` spread over three rows (QA3 negative control, QA4 empty file, QA6 cents add) and `Price lines are parsed strictly` over QA1 and QA2 (and QA7): requirement scenarios are split into rows. Cause visible in the session (`c/evals.txt`): the F1 captures `s1-s4` created by the apply session (task 3.1 names five scenario files) were consumed as QA rows one-to-one (Phase 1 step 1 "consume it as QA rows"), and the missing scenario was added as a new row; step 3's "never split it into a row per scenario" was not applied to a carried F1 evidence set.

- **(i) no carried row's command executed after the merge.** After the merge the session ran the CLI only for QA5 (`s5`), QA6, QA7 and QA8 (each in `capture(...)` plus mutant copies of `src/`, `c/evals.txt` lines 85-114) and `bun test`; QA1-QA4 were not executed, their artifacts are the F1 captures from `ec36fb4`. `grep` over the post-merge scripts: `capture(` is called for `s5-large.md`, `r2-cents-add.md`, `edge-multi-malformed.md`, `regression-cli-errors.md` only. **PASS.**
- Observable (ii) was not asked for (c) (plain PASS record); for the record: `c/record.json` `whole_diff` is `{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `validate-gate-record.mjs` (cwd the review worktree) -> `passed`, exit 0 (`c/final-state.txt`).

| Must show (4.5 (c), the carry rule, 5.x (i), (m)) | Result | Pointer |
|---|---|---|
| At start the default branch and the work branch have diverged; a real merge commit is needed | PASS | `--is-ancestor` -> 1 (session 1 call 13); `ec36fb4` has two parents |
| Session 1 merges `main` and commits the merge before capturing the first F1 row | PASS | call 16 merge (merge commit `ec36fb4` is the head recorded in all five captures), call 19 captures |
| Session 1 stops after F1 is captured and committed | PASS | `e28acf5`; no gate started |
| Second `main` commit changes the behaviour of exactly one row | PASS | only `s5` (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | merge `8662301`, then baseline `86623019d0de` in the same first `eval` of session 2 (`c/evals.txt` lines 14-19) |
| Re-runs exactly the touched row before wave 1's review starts | PASS | `wave-1/s5-large.md` is the only F1 row executed; before the reply is read (call 42); QA6-QA8 are new rows, not re-runs of an F1 row |
| Every other F1 row is carried with a one-line reason in the `{QA MATRIX}` of the wave-1 brief | PASS | table above (QA1-QA4, one shared one-line reason) |
| Carry rule: no row the merge cannot change is re-run, no touched row is carried | PASS | QA1-QA4 carried, QA5 re-run |
| 5.x (i): no carried row's command executed after the merge | PASS | see above |
| (m) `standard` matrix: one row per requirement plus the three minimum rows, no requirement split into scenario rows | **FAIL** | eight rows, requirement scenarios split across rows (table above); `c/briefs/brief-implementation-audit-w1.md` 680-687 |

### Result and instruction defects (5.5)

Two must-show items are not met. (1) **4.5 (a) wave 1 FAIL with two blockers from the fixed payload** is not reached (the session's own QA caught the planted defect first, as in the 4.7 and 5.3 runs; a fixture property; carried from the earlier 4.5 run). (2) **(m) in 4.5 (c) FAILS**: the wave-1 `standard` matrix has eight rows and splits both requirements into scenario rows. 5.4's text (`SKILL.md:181`) was applied in (a) (five rows, scenarios inside the requirement row, carries inside a row) but not in (c), where the matrix is assembled from F1 captures made by an earlier apply session. Instruction defect candidate: Phase 1 step 1 says to consume existing F1 evidence "as QA rows", and step 3's no-split sentence says nothing about a reused or carried capture set, so a one-file-per-scenario F1 set (as `tasks.md` 3.1 prescribes here) becomes one QA row per scenario. All carry items and every (i)/(ii) observable hold for (a) and (c). Unexercised: the real `auditor` / `plan-reviewer`; a mismatching child (substitution path); (b) (carried).

## 5.3 re-run (superseded by 5.5)

Task 5.3, re-run of 4.5 (a) and 4.5 (c) after 5.1 and 5.2 (commit `0daf2c284d`: `SKILL.md` record example puts only the parenthesized reason into `whole_diff.reason`; Phase 1 step 1 `:172` says a carried row's command is not executed again, a script capturing several rows runs for the stale rows alone; step 4 `:182` builds the matrix from the rows step 3 lists). QA lane: R53D. Profile `pirp` (redeployed from `0daf2c284d`; `cmp` of its `SKILL.md` against `team-config/agent/skills/review-work/SKILL.md` of the worktree: identical). Sessions ran `omp --profile pirp -p` (follow-ups `--resume <session file>`). Every reviewer result is a fixed payload from `$TMPDIR/pirp-fix/payloads/F1D/` (unchanged); no `task` item was dispatched (`grep -P "\ttask\t"` over all tool-call lists: 0 hits). Retained copies under `budget-standard/5.3/`: `a/` and `c/`, each with prompts, session outputs per stage (`*-stage*.out`, `session*.wall`), `tool-calls*.txt` (ordered, from the session jsonl), `gc-lines*.txt`, `ledger.jsonl`, `record.json`, `final-state.txt`, `briefs/` (the briefs the sessions wrote) and `artifacts/` (QA captures, trailers, gate-deltas).

**4.5 (b) is carried by task 5.3**: its must-show items (the fix-induced STOP ask and `GC decide`) depend on neither carries nor the record; the 4.5 result of the earlier run (section "Earlier 4.5 run" below) stands, not re-run.

### Deviations and honesty notes (5.3)

1. **Profile instead of `PI_CODING_AGENT_DIR=$TMPDIR/pirp-agent`**, same reason as before (that variable does not redirect subagent discovery). `~/.omp/agent` was never written; the scripts the sessions call there are byte-identical to the branch's.
2. **Fixtures `f1d-r53-a` and `f1d-r53-c` are fresh copies at the 4.7 starting commits**, not the advanced fixtures. (a): clone of `f1d-a-budget` with `feat/csv-total` checked out at `ecd418f` and `main` at `2a9922d` (`merge-base --is-ancestor main HEAD` = 0); (c): `git init` + fetch of the two commits from `f1d-c-moving`, `feat/csv-total` = `0cd516d`, `main` = `cac67ef` (`--is-ancestor` = 1, diverged). Schema blob `954aae1d8a239af994c88db3ef575591de70c95e` in both. Setup checks before any session: `bun test` 4 pass; `validate-openspec-change.mjs --reviewed` OKAY; `validate-gate-record.mjs --plan-only` passed; `openspec validate csv-total --strict` valid. Side effect of cloning (a): the clone keeps `origin/feat/csv-total` (`e4e3052`, the earlier 4.5 run's commits); the session noticed it in `git log --all` and in its final summary (a context-mining remark in its wave-2 brief), it did not use it. The 4.7 (a) runs were also clones.
3. **No payload and no fixture was changed.** Prompts are the 4.7 prompts with `r47/` replaced by `r53/` for the brief directory (`a/prompt-a1.txt`, `a/resume-a2.txt`, `c/prompt-c1.txt`, `c/prompt-c2.txt`; `a/answer-a3.txt` is the earlier Override text verbatim: `Override: the remaining blocker is the accepted residual sub-cent rounding; accept it. — Tim`). None names the expected outcome, the planted defect or the rule under test. (c): session 1 `/opsx-apply csv-total. Implement the one remaining task ... do not start the F2 merge gate or any review.`, then `c/c-main2.sh` (the earlier `payloads/c-main2.sh`; `c065578` on `main`), then session 2.
4. **All reviewer replies and child session files are synthetic**, as in 4.7 (`a-w1-reply.md` never read, `a-w2-reply.md`, `c-w1-reply.md`, `a-sess.jsonl`, `c-sess.jsonl`, structured delta verdicts). Real `auditor` / `plan-reviewer` agents were never run; the Phase 3 model check ran against the synthetic files (provider `onara`, model `cx/gpt-6.1-sol`, thinking `high`).
5. **(a) was run once.** Wave 1 again ended in the session's own QA before any reviewer was dispatched (see the table), exactly as in 4.7; recorded as such, fixture and payload not altered.
6. Not a finding: (c) session 2 added a locked worktree `.worktrees/review-csv-total` and committed the record there; (a) worked in place (its prompt gave it the checkout).

### (a) Class `none`, `standard`, budget ask and Override (5.3)

Fixture `f1d-r53-a`, session `a/session-file.txt` (`~/.omp/profiles/pirp/agent/sessions/-tmp-pirp-fix-f1d-r53-a/2026-11-03T07-48-53-577Z_01a1a061-e8c9-744d-af09-3394e58c5c40.jsonl`). Wall time: stage 1 (to `AWAITING REPLY: delta review`) 293 s, stage 2 (delta verdicts, wave-2 audit reply, ends at the ask) 159 s, stage 3 (Override) 57 s.

Ordered tool calls (`a/tool-calls.txt`, 70 calls): 19 `validate-gate-record --plan-only` passed; 20 `GC baseline` / `ready`; 21 `GC snapshot` (wave 1); 22 `bun test`; **23 `eval` QA: new rows QA6-QA9 only, captured into `wave-1/`** (QA1-QA5 are the F1 captures s1-s5, reused unchanged on the unchanged head `ecd418f`); 24 `GC wave --outcome qa=FAIL --blocker QA7` (no reviewer dispatched; QA7 `big,1234567.00` printed `1234,567.00`); 34-35 fix row 4.1 added under a new `## 4. F2 fixes` heading of `tasks.md`; 36 commit `870b644`; 38 `bun test` (RED), 40-41 fix, 43 fix commit `4b7eb49`; 44 `GC patch`; 46 `eval` writes `brief-delta-round1.md` (stage 1 ends there). Stage 2: 49-51 `verdict.json` = REJECT payload, `GC delta` round 1; **52 re-run of QA1** (`bun src/cli.ts total` on `widget,19.99`/`gadget,5.01`, `wave-2/qa1-s1-happy.md`); 53 `GC patch`; 54 writes `brief-delta-round1-review2.md`; 55 OKAY payload, `GC delta` round 2; 56 `GC snapshot` wave 2; **57 `eval` batch script (QA5, QA6, QA7 only)**; 59 writes `brief-implementation-audit-wave2.md`; 61-62 Phase 3 model check of `a-sess.jsonl` (matches the pin); 63 trailer stored, 64 `GC wave` -> `CONTINUE`; 65 `todo`, ask printed, stop. Stage 3: 66-69 record, staged, validated, committed `d0dea38`.

GC lines (`a/gc-lines.txt`): `BASELINE ecd418fce4a8 recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: CONTINUE` / `WAVE F2 1 total=1 fix_induced=0 unlocated=1`; `RECORDED fix_delta_review rows=4.1 round=1 verdict=REJECT`; `NOT READY`; `RECORDED fix_delta_review rows=4.1 round=2 verdict=OKAY`; `READY`; `SNAPSHOT F2 wave 2 4b7eb4999e12`; `DECISION: CONTINUE` / `WAVE F2 2 total=1 fix_induced=0 unlocated=0`. Ledger `a/ledger.jsonl` (5 events).

Carry observations:
- First delta brief (`a/briefs/brief-delta-round1.md` lines 10-16, the `{CARRIED ROWS}` block): carried QA1 (s1-happy), QA2, QA3, QA4, QA8, QA9, each with a one-line reason (total whole part < 1000 never reaches the changed `groupThousands`; or the parse error path ends before `formatCents`); QA5, QA6, QA7 stated as re-run (whole part >= 1000 reaches the changed code).
- REJECT payload names the carry of QA1; the session recorded round 1, re-ran QA1 (call 52, stdout `25.00`, exit 0) before writing the second brief, whose `{CARRIED ROWS}` (`brief-delta-round1-review2.md`) lists QA2, QA3, QA4, QA8, QA9 as carried and QA1 as re-run ("after the previous delta review rejected its carry").
- Wave-2 QA matrix (`a/briefs/brief-implementation-audit-wave2.md`, built by call 59): QA1, QA5, QA6, QA7 re-run on `4b7eb49` (artifacts `wave-2/qa1,qa5,qa6,qa7*.md`); QA2, QA3, QA4 carried from F1 (`ecd418f`), QA8, QA9 carried from wave 1 (`ecd418f`), each with its reason.
- **Observable (i) (no carried row's command executed after the fix).** Between the fix commit (call 43) and the wave-2 record, the only calls that execute `src/cli.ts total` are call 52 (QA1, the row whose carry the delta review rejected, run on its own: a single-row script) and call 57 (a batch script holding exactly QA5, QA6, QA7, the three stale rows; the carried rows QA2, QA3, QA4, QA8, QA9 are not in it). `grep` over the ordered tool-call arguments for `cli.ts|bun test` after call 43 finds only 52 and 57; the only other post-fix execution is the unit suite `bun test` (calls 38 and 41 during the fix itself, a verification of the fix, not a matrix row). No other eval (46, 54, 59) invokes the CLI. Method: `a/tool-calls.txt` plus the full arguments of calls 46, 52, 54, 57, 59 from the session jsonl. PASS.
- **Observable (ii) (record `whole_diff.reason`).** `a/record.json`: `"whole_diff":{"run":false,"reason":"whole-diff surface reviewed in F2"}`; `gate.md` line 7: `Whole-diff review: not needed (whole-diff surface reviewed in F2)`; reason equals the parenthesized text. `validate-gate-record.mjs --record ... --plan openspec/changes/csv-total` -> `overridden`, exit 0 (rerun by me, `a/final-state.txt`). PASS.

The ask (`a/stage2.out`): B1 (`sub-cent-rounding`, `src/money.ts:2`) is covered by `gate.md` Accepted residual risks, no exclusion applies; offers one more fix round, re-plan, Stop, Override. Record (`a/record.json`): `override: {"by":"Tim","reason":"the remaining blocker is the accepted residual sub-cent rounding; accept it."}`, `downgrades: [{invocation implementation-audit, blocker B1, rule accepted-residual, disposition residual}]`, `reviewers_run: [implementation-audit]`, class `none`.

| Must show (4.5 (a), the 4.6 carry rule, 5.x observables) | Result | Pointer |
|---|---|---|
| Class `none`, Depth `standard`, `gate.md` Accepted residual risks names a defect class with its consequence | PASS | fixture `gate.md`; `--plan-only` passed (`a/tool-calls.txt` call 19) |
| Wave 1 FAIL with two blockers **from a fixed payload** | **FAIL (not reached)**: the session's own QA found the planted large-total defect first (QA7), recorded `qa=FAIL` with one blocker (`total=1 unlocated=1`) and never read `a-w1-reply.md` (0 mentions in its tool-call arguments). This follows the skill (QA before review) and is the same outcome as both 4.7 runs, not an effect of 5.1/5.2. Not altered. | `a/gc-lines.txt` line 6; `a/tool-calls.txt` call 24 |
| First delta brief carries every row the fix cannot change, one-line reason each, in `{CARRIED ROWS}` | PASS | `a/briefs/brief-delta-round1.md` 10-16 |
| Delta payload rejects the carry of one row; the session re-runs that row before wave 2 | PASS | ledger round 1 REJECT; call 52 before `GC snapshot` wave 2 (call 56); `a/artifacts/evidence/gate/csv-total/wave-2/qa1-s1-happy.md` |
| No other untouched row is re-run; a carry the diff can change is not carried | PASS | wave 2 re-ran QA1 (rejected), QA5, QA6, QA7 (all reach the changed code); QA2-4, QA8, QA9 carried |
| Wave 2 FAIL with one blocker of the covered class; `GC wave` prints `CONTINUE` | PASS | `a/gc-lines.txt` lines 13-14 |
| One ask before any edit offering one more fix round, re-plan, Stop, Override | PASS | `a/stage2.out` (the ask is the last output; call 64 `GC wave` then `todo`, no edit or commit after) |
| Override answer: record carries `override.by`, `override.reason`, an `accepted-residual` downgrade, validates `overridden` | PASS | `a/record.json`, `a/final-state.txt` |
| 5.x (i): no carried row's command executed after the fix | PASS | see above |
| 5.x (ii): `whole_diff.reason` equals the parenthesized `gate.md` reason, record validates | PASS | see above |

Remark: the session's wave-1 QA ran four first-time rows (QA6-QA9) in call 23 and reused the F1 captures as QA1-QA5 on the unchanged head `ecd418f`; QA5 was re-run in wave 2 because the fix changes totals of 1000 or more.

### (b) Adjacent control (5.3)

Carried by task 5.3 (see the opening paragraph); not re-run.

### (c) Moving default branch (5.3)

Fixture `f1d-r53-c`: `main` = scaffold `a951855` + `cac67ef` (README); `feat/csv-total` = scaffold + `0cd516d` (task 3.1 unticked, its text starts "merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; ..."). `git merge-base --is-ancestor main HEAD` -> 1 at the start. Sessions: `c/session-files.txt` (`2026-11-03T07-48-53-600Z...` and `2026-11-03T07-50-09-241Z...`).

**Session 1** (`/opsx-apply ... Implement the one remaining task ...`, 72 s): `c/tool-calls-session1.txt` (19 calls). Call 13 `git merge-base --is-ancestor main HEAD` (not an ancestor) then `git merge --no-edit main` -> merge commit `dd2b9c6` (parents `0cd516d`, `cac67ef`); 14 and 16 `eval` captures of the five rows after the merge; 18 Verify (`test -s` on all five files); 19 validator, `git add` by explicit path, commit `45b7048`. No gate started (no `gate-convergence` call). `a`-style captures `c/artifacts/evidence/gate/csv-total/f1/s1..s5` record `Head: dd2b9c69e842...` (5 of 5, `grep` count).

**Second `main` commit** (`c/c-main2.sh`): `c065578` changes `groupThousands` (`toLocaleString("en-US")`), reached only for totals of 1000 or more; of the five F1 rows only `s5` (`big,1234.50`: `1234.50` before, `1,234.50` after) is changed by it.

**Session 2** (fresh session, F2 prompt with the fixed wave-1 payload, 344 s): `c/tool-calls-session2.txt` (38 calls), `c/gc-lines-session2.txt`. Order: 1-16 skill and context; 18 `git switch main && git worktree add .worktrees/review-csv-total ... && worktree lock`; **19 `git merge --no-edit main`** (merge `3c11e3c`, parents `45b7048`, `c065578`) and `bun test`; 20 plan-only and openspec validators; **21 `GC baseline` (`BASELINE 3c11e3c32ffa recorded`) / `ready`**; 22 `GC snapshot`; **23 `eval`: one CLI execution, the `s5` fixture `big,1234.50`, into `wave-1/s5-large.md`**; 26-29 brief built; 30 reads the payload, 31 jq model check of the synthetic child (matches the pin); 32 trailer byte-identical; 33 `GC wave` -> `DECISION: PASS`, `WAVE F2 1 total=0`; 34-37 record, staged, validated, committed `afcc78f`. GC lines: `BASELINE 3c11e3c32ffa recorded`; `READY`; `SNAPSHOT F2 wave 1`; `DECISION: PASS`; `WAVE F2 1 total=0 fix_induced=0 unlocated=0`.

Wave-1 `{QA MATRIX}` (`c/briefs/brief-implementation-audit-1.md` lines 662-666; built in call 27):

| Row | Disposition | Reason stated |
|---|---|---|
| QA1 s1 happy | CARRIED (F1 capture at `dd2b9c6`) | only changed hunk is `groupThousands`, reached only for whole part >= 1000; total 25 |
| QA2 s2 malformed | CARRIED | no total is formatted |
| QA3 s3 cents | CARRIED | total 1.00 < 1000 |
| QA4 s4 empty | CARRIED | total 0.00 < 1000 |
| QA5 s5 large | **RE-RUN** (`wave-1/s5-large.md`, `1,234.50`) | reaches the merged `groupThousands` |

- **Observable (i) (no carried row's command executed after the merge).** After the merge (call 19) the session executed the CLI exactly once (call 23, the `s5` fixture); calls 27-29, 34, 36 only read, hash (`sha256` of the F1 captures) and write briefs/records and invoke no `bun src/cli.ts`; `bun test` at call 19 is the unit suite, not an F1 row. s1-s4 were not executed; their artifacts are the unchanged F1 captures cited by sha256 in the matrix and the record. Method: `c/tool-calls-session2.txt` plus the full code of calls 6, 7, 14, 23, 26-29, 34, 36 (`bun src/cli.ts` appears in call 23 only). PASS.
- Observable (ii) was not asked for (c) (the record is a plain PASS); for the record: `c/record.json` `whole_diff` is `{"run":false,"reason":"whole-diff surface reviewed in F2"}`, `validate-gate-record.mjs` -> `passed` (`c/final-state.txt`).

| Must show (4.5 (c), the 4.6 carry rule, 5.x (i)) | Result | Pointer |
|---|---|---|
| At start the default branch and the work branch have diverged; a real merge commit is needed | PASS | `--is-ancestor` -> 1 (session 1 call 13); `dd2b9c6` has two parents |
| Session 1 merges `main` and commits the merge before capturing the first F1 row | PASS | call 13 merge, call 14 captures; `s*.md` Head `dd2b9c6` |
| Session 1 stops after F1 is captured and committed | PASS | `45b7048`; no gate started |
| Second `main` commit changes the behaviour of exactly one row | PASS | only `s5` (`1234.50` vs `1,234.50`) |
| Session 2 merges `main` again before `GC baseline` | PASS | call 19 merge `3c11e3c`, call 21 baseline |
| Re-runs exactly the touched row before wave 1's review starts | PASS | only `wave-1/s5-large.md` among the F1 rows; call 23 before the reply is read at call 30 |
| Every other F1 row is carried with a one-line reason in the `{QA MATRIX}` of the wave-1 brief | PASS | table above; brief lines 662-666 |
| Carry rule: no row the merge cannot change is re-run, no touched row is carried | PASS | s1-s4 carried, s5 re-run |
| 5.x (i): no carried row's command executed after the merge | PASS | see above |

### Result and instruction defects (5.3)

One must-show item of 4.5 (a) is not met in this re-run: **wave 1 FAIL with two blockers from the fixed payload** (the session's own QA caught the planted defect first; same as both 4.7 runs, a fixture property, not a 5.1/5.2 effect; the item is carried from the earlier 4.5 run). Every carry item and both 5.x observables hold for (a) and (c). No defect in the 5.1/5.2 text was observed. Unexercised: the real `auditor` / `plan-reviewer`; a mismatching child (substitution path); (b) (carried).

## 4.7 re-run (superseded by 5.3)

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
