# F1-E: seeded reviewer results, four transitions on one plan

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head, plus one new leg (d) for
row 5.31. All four legs ran on the fixed text of this head, the blob below. Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into each fixture and committed there:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

## Why the reviewer results are seeded

Legs (a)-(c) use one plan and one digest and differ only in what the reviewers return. A live
dispatch cannot be steered that way. The prompts replace **only** the `plan-reviewer` dispatch with
a payload file of verbatim reviewer results; the validator, the digest, `git`, the
`blocker-verifier` dispatch, the fixes, the record and `--reviewed` all run for real. The record
says so: the Models line marks those ids `unverified (result supplied by payload file; no session
file to check against the pin)`. Leg (d) uses payloads the same way, on its own fixture.

Legs (a)-(c): `$TMPDIR/prp-fix/repo-f1e{a,b,c}`, change `f1e`, Mandatory class `concurrency-state`,
Depth `risky`, digest `102212f2bd367462037dd99c5b7abf5c62b4e1b7fe2a44fef5aae628634162ac`.

## (a) Both findings refuted — OKAY in round 1 (123 s)

- Two seeded REJECTs; `760616c` records them **before the verifier**, Awaiting `triage`, each
  `not triaged`.
- The live verifier `F1eTriageR1` (on the pin) refuted both.
- `3dd2b12`: Verdict **OKAY**, Round 1, Awaiting `none`, both findings under `## Residuals`.
  `--reviewed` exit 0.
- Shows: a round whose every finding is refuted ends the review in round 1 — the reviewer's verdict
  does not survive the verifier.

## (b) A twice-failed verifier, then the exhaustion ask twice (1962 + 176 + 2015 + 263 + 1289 + 67 s)

- `778e92c` pre-triage record; both verifier attempts (`ShrillHummingbird`,
  `ProgressiveSwordfish`) left the pin mid-run, so neither counted.
- `d8ac2f3` records exactly that: Awaiting `triage`, Verifier `none`, the blocker marked
  `not triaged: the verifier failed twice`, and the session **stopped** instead of inventing a
  triage (row 5.25).
- Resumed (176 s): `2e4873e` the resumed pre-dispatch record, then `2220a0b` the triage record with
  the finding confirmed, Awaiting `scope`, and the scope ask printed verbatim.
- Answered (`failed` state): `755a369` carries the fix; round 2 ran and its verifier again failed
  twice (`7fd58c4`, `86d2c30`, Awaiting `triage`), and a second resume (263 s) produced `980d9bc`:
  the round-2 finding confirmed, budget spent, **Awaiting `exhaustion`**.
- **The ask is left unanswered.** That session ended there. A fresh ordinary session was started
  on a copy of the fixture at `980d9bc` (`$TMPDIR/prp-fix/repo-f1eb-ask`), with the plain
  instruction and **no answer in the prompt** (33 s). It re-asked the same exhaustion question
  from the record, quoting the finding, the verifier's reason and the three options verbatim, and
  added `Override is offered because the finding is not in the security scope and is not
  protected.` It dispatched nothing, edited nothing and committed nothing:
  `git diff --exit-code -- openspec/changes/f1eb` exits 0 and `git log --oneline -1` is still
  `980d9bc`.
- Answered **Override** on that fixture (47 s): `dc67dcf`, `git diff --stat 980d9bc` shows
  `openspec/changes/f1eb/review.md | 6 +++---` and nothing else, and `--reviewed` printed
  `REJECT overridden by the user: this fixture plan is a throwaway review fixture, …`, exit 0.
- Back on the first fixture, the same ask was instead answered **Fix** and then a second time, to
  witness the other two branches:
- Answered **Fix** (1289 s): `b926c55` edits `tasks.md` only (4 insertions, 3 deletions), then
  exactly one **live** delta check ran. It found a new confirmed blocking finding (the new test
  task describes the two-refresh sequence from the opposite end to the requirement), so `b3498d9`
  and `22813e8` record it and the exhaustion ask is put **again** — the budget stays spent, and
  every further edit needs another answer.
- Answered **Override** (67 s): `2671dce` records the reason verbatim with the artifacts
  unchanged; `--reviewed` printed `REJECT overridden by the user: …` and exited 0.
- Shows: a twice-failed verifier is a recorded, resumable state, not a silent pass; Fix on a spent
  budget buys exactly one delta check and no more; and when that delta check finds something, the
  loop is bounded by a user answer each time, never by the session.

## (c) An undecided finding on a spent budget, answered Keep (1064 + 53 s)

- Seeded round 1 contains one finding whose evidence lives in a private monorepo
  (`../timesheet-sync/src/lease.ts:48`).
- `6ccd5f8` pre-triage record; the live verifier `PotentialHorse` (after one off-pin discard)
  returned **undecided**: condition 2 cannot be settled from this repository.
- `b1d4b9e`: Awaiting `exception`, and the session printed the exception ask with Fix / Keep as a
  residual / Stop.
- Answered **Keep**: `b33f2e1` moves the finding to `## Residuals` with the answer, Verdict OKAY,
  Round 1, Awaiting `none`. `--reviewed` printed `reviewed: OKAY in round 1`, exit 0.
- Shows: an undecided finding is neither a blocker nor dropped; it becomes a user decision, and
  Keep ends the review without a further dispatch.

## (d) The same ask answered **Fix** — one more delta check (1178 + 91 s)

Fixture `$TMPDIR/prp-fix/repo-f1ee`, change `f1ee` (Mandatory class `none`, Depth `standard`), so
the budget is spent after the round-1 fix delta check. Schema blob as above, committed `8271e7d`.

- Round 1 (seeded, one confirmed blocker: every check in the plan passes whatever the week boundary
  does): `7be739b` pre-triage, `ed5b1c6` triage, `cbfb2e9` the fix.
- The delta check (seeded) returns a new finding citing a private monorepo consumer; `ce5b877`
  records it, the live verifier `F1eeTriage2Retry` returns **undecided**, `6d9d025` sets Awaiting
  `exception`. The printed ask names the consequence verbatim:
  `1. **Fix**: I change the artifacts using one of these two approaches. The fix is then followed
  by one more delta check.`
- Answered **Fix (approach a)**: `90ce052` edits `design.md` only (7 insertions), then exactly one
  delta check runs (`EeScopeA3`, OKAY) and `f0788f2` records Verdict OKAY, **Round 3**, Awaiting
  `none`, Override `none`. `--reviewed` printed `reviewed: OKAY in round 3`, exit 0.
- Shows row 5.31's successor state: Fix on a spent budget is allowed, the fix is bounded to the
  artifacts, and it buys exactly one more delta check — not a new full round, and not an unbounded
  loop.

## Retained tool calls

### Legs (a), (c) and (d)

**Leg (a)** — `-tmp-prp-fix-repo-f1ea/2026-11-02T04-06-49-598Z_01a19a70-3dfe-730e-8ad5-1155b8478a01`,
27 calls: instruction and template reads (1-11); `bash` digest of every change file and
`V --digest` (12-16); `bash omp config get task.agentModelOverrides` and the verifier pin
(17-18); `read history://SeedScopeA1` (19); **`write review.md`** (20) and
`git commit` (21) — the pre-triage record `760616c`, before any verifier; **`task F1eTriageR1`**
(22); `wait`; `read history://F1eTriageR1`; `bash jq … provider + model` (25);
**`write review.md`** (26) and the commit (27) — `3dd2b12`, OKAY with both findings refuted.
One `task` call in the session, and it is the verifier.

**Leg (c)** — `-tmp-prp-fix-repo-f1ec/2026-11-02T04-06-57-132Z_01a19a70-5b6c-77bb-b853-237e80f4ebb4`,
28 calls: instruction, template and `gate.md` reads plus the payload (1-8); two validator calls
(9-10); `read history://SeedScopeA3` (11); two `grep` calls on the validator (12-13);
**`write review.md`** (14) and `git commit` (15) — the pre-triage record `6ccd5f8`;
**`task blocker-verifier`** (16); `wait`; `read history://PrimitiveTyrannosaurus` and two
`jq … provider + model` calls (18-20) — off the pin, discarded; **`task blocker-verifier`** again
(21, `PotentialHorse`); `wait`; `bash ls <session dir>`; `read history://PotentialHorse:1`;
`bash jq …` (25); two `edit` calls on `review.md` (26-27) and the commit (28) — `b1d4b9e`,
Awaiting `exception`.
The answer session
(`2026-11-02T04-25-05-554Z_01a19a80-f712-758d-b420-28c561804c6b`, 13 calls) reads the instruction
and the record, runs `V --digest`, **writes `review.md` once**, runs `V --reviewed` and commits
(`b33f2e1`). No `task` call: Keep dispatches nothing.

**Leg (d)** — `-tmp-prp-fix-repo-f1ee/2026-11-02T04-45-11-210Z_01a19a93-5caa-74cd-be42-10f6c0e51a8d`,
46 calls. The ordering that matters:

```
21 write review.md / 22 git commit        <- round 1 pre-triage record (7be739b)
23 task: F1eeTriage1 / 24 wait / 25 read history:// / 26 jq provider+model
27 edit review.md / 28 git commit         <- triage record (ed5b1c6)
30-33 edit tasks.md, proposal.md          <- the round-1 fix, change folder only
34 validator / 35 cat <delta payload>
36 write review.md / 37 git commit        <- delta-check record (ce5b877)
38 task: F1eeTriage2 ... 42 task: F1eeTriage2Retry (first attempt off-pin)
45 edit review.md / 46 git commit         <- Awaiting exception (6d9d025)
```

The answer session (`2026-11-02T05-05-08-155Z_01a19aa5-a03b-7769-a194-9b4c3142b4c7`, 23 calls):
instruction and record reads (1-14), **two `edit` calls on `design.md` only** (15-16), the commit
(17, `90ce052`), the delta payload and the pin check (18-19), `read history://EeScopeA3` (20),
`write review.md` (21) and the commit (22, `f0788f2`). The first artifact edit is call 15 — after
the answer — and exactly one delta check follows it.

### Leg (b)'s earlier sessions

All under `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1eb/`.

- **Round 1** (`2026-11-02T04-06-53-094Z_01a19a70-4ba6-75e8-b865-28d65640bbf6`, 21 calls): the
  instruction and payload reads, `read history://SeedScopeA4`, `eval` writing the record,
  `git commit` at call 11 (`778e92c`, the pre-triage record), then the verifier at 13-14
  (`ShrillHummingbird`), its D10 jq check at 16, the retry at 17-18, the second jq at 19-20, and
  the failed-twice record at 21 (`d8ac2f3`). The record commit precedes both verifier dispatches.
- **Round-1 triage resume** (`2026-11-02T04-39-46-811Z_01a19a8e-697b-7231-a259-5a699eb95990`,
  22 calls): instruction, pin and payload reads; one `edit` restoring the record's marker and
  `git commit` (15); **`task TriageF1ebR1`** (16) — the only dispatch; `wait`;
  `read history://TriageF1ebR1`; `bash jq …`; `edit review.md` (21) and the commit (22,
  `2220a0b`, Awaiting `scope`). No reviewer dispatch on a resume.
- **The scope answer and round 2**
  (`2026-11-02T04-42-58-094Z_01a19a91-54ae-761d-90b2-bdb25f75612b`, 42 calls): the instruction
  paged in six `awk` calls (8-13); the fixes as `edit` calls on `design.md`, `spec.md`, `tasks.md`
  and `gate.md` (20-26) with the validator (27) and one commit (28, `755a369`); the round-2
  payload (29-30); `eval` writing the pre-triage record (31) and its commit (32, `7fd58c4`);
  **`task TriageF1ebR2`** (34), jq (37), **`task TriageF1ebR2Retry`** (38) — both off the pin —
  and the failed-twice record (41-42, `86d2c30`).
- **Round-2 triage resume** (`2026-11-02T05-16-38-342Z_01a19ab0-2846-73f5-8ce0-7fa0ee7afb7e`,
  26 calls): `read agent://SeedScopeB5` and `glob **/f1eb-round2.json` to recover the delivered
  blocker text (17-18); **`task TriageF1ebR2Resume`** (19); `wait`; `read history://…`;
  `bash jq …`; three `bash git show` calls comparing the earlier records (23-24); `edit review.md`
  (25) and the commit (26, `980d9bc`, Awaiting `exhaustion`).

### The unanswered-ask resume and its Override

Under `~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1eb-ask/`.

- **Re-ask** (`2026-11-02T08-21-56-203Z_01a19b59-cd6b-71ac-b33b-e1a24e7921c1`, **10 calls**, 33 s),
  complete list: `read skill://openspec`; `bash openspec instructions review --change f1eb --json`
  ×2; `read /tmp/f1eb-instruction.md:raw`; `read /tmp/f1eb-template.md:raw`;
  `read /tmp/f1eb-instruction.md:300-310:raw`; `bash ls -la openspec/changes/f1eb && cat
  review.md`; `bash V --digest`; `read review.md:32:raw`; `read review.md:raw`. **No `task`, no
  `edit`, no `write`, no `git` write** — the ask is reconstructed from the record alone.
- **Override** (`2026-11-02T08-22-48-211Z_01a19b5a-9893-74f8-b6da-b54d61bbfe0e`, 15 calls, 47 s):
  instruction and template reads (1-7); `bash ls && cat review.md` (8); three `grep`/`read` calls
  on the validator (9-11); `read review.md:1-12` and `:23` (12-13); **one `edit`** (14);
  `bash V --reviewed` (15). Again no dispatch.

### Leg (b)'s two answer sessions

Session paths under
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1eb/`.

**Fix answer** (`2026-11-02T05-21-17-268Z_01a19ab4-69d4-735a-bf7c-91aa44f129cf`, 30 calls, 1289 s),
in order: `read skill://openspec`; `bash openspec instructions review --change f1eb --json`;
`eval` (the same instruction as JSON); `bash ls openspec/changes/f1eb && git log && git status
--porcelain`; `read review.md`; `bash V --digest`; `read review.md:22:raw`; three `bash` reads of
`package.json`, `src/day-list.ts` and the recording commit; `bash` probe of `bun test` on an empty
file; **`write tasks.md`**, `bash V`, `write tasks.md`, `bash V`;
`bash git add openspec/changes/f1eb/tasks.md && git commit` (`b926c55`); `bash grep ^model
blocker-verifier.md`; **`task DeltaF1ebR3`**; `wait`; `read history://DeltaF1ebR3`; `bash jq … provider
+ model` (the D10 check); `read agent://DeltaF1ebR3/blockers`; `write review.md`;
`bash git commit` (`b3498d9`); **`task TriageF1ebR3`**; `wait`; `read history://TriageF1ebR3:1-2`;
`bash jq …`; two `edit` calls on `review.md`; `bash git commit` (`22813e8`).

The first artifact edit is call 11, after the answer; the delta reviewer is dispatched at call 17,
after the fix commit at 15; and exactly one reviewer dispatch appears in the whole session.

**Override answer** (`2026-11-02T05-43-03-174Z_01a19ac8-5706-72f7-817d-f59261e6d814`, 22 calls,
67 s), in order: `read skill://openspec`; two `bash openspec instructions review` calls; `read` of
the delivered instruction in two halves and of the record template; six `bash sed` reads of the
instruction's later sections; `write xd://report_issue`; `bash cat review.md && git status`;
`bash V --digest`; three `grep`/`read` calls on `validate-openspec-change.mjs`; `read review.md`;
**one `edit`** recording the Override; `bash V --reviewed`.

No `task` call appears at all: Override dispatches nothing and edits no artifact.

**Retained outputs.**

```
$ node … validate-openspec-change.mjs --reviewed openspec/changes/f1eb
reviewed: REJECT overridden by the user: the task's wording and the requirement describe the same
two-refresh sequence from opposite ends, the implementer has both texts in front of them, and I
accept the risk that the task wording is read the wrong way around.
exit 0

$ git show --stat b926c55          # the Fix answer's only artifact edit
 openspec/changes/f1eb/tasks.md | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)
```

Digests: round 2 `1fe2557bb9756f415cd314a0fbb646da3c8655c865e1999bd1b2c45c280a3e46`, the delta
check after the Fix `6c69e15a42628e4cec0e0b2758b40056a5dbe90bdf48dc38ffdfdbeadb73ce93`.


## Honest notes

- Leg (d) needed a second fixture. The first attempt (`repo-f1ed`) planted a weaker round-1 defect
  and the live verifier refuted it, so the review ended OKAY in round 1 and never reached the
  budget. That run is real and is left in place; it is not evidence for this row.
- Across these four legs, six dispatches left the pinned model mid-run and were discarded. Every
  one of them cost wall time and some cost an extra session; none produced a counted verdict.
