# F1 manual QA: verification-blocker-accept

Commit under test: `ef16a628d6664c24983130811bafa72e5c44df79` (head after task 1.3). Base `B` = `fa6bf72aef2775cd0c2dee71f6a8e52b2f694355`. Installed omp 18.13.1. All sessions were fresh ordinary omp sessions using the existing model configuration, with no copied credential. Each ran in its own disposable git repository under `/tmp/vba-f1/<row>`, built by `tools/mk.py`.

Each fixture holds:
- the delivered `F` at `.omp/skills/review-work/SKILL.md`;
- `integration-review/SKILL.md` at `.omp/skills/integration-review/SKILL.md`;
- the delivered schema `S` at `openspec/schemas/omp-gated/` (`openspec schema which omp-gated` gives `Source: project`);
- the fixture change `session-refresh` (class `concurrency-state`, a token-refresh retry state machine) with a hand-written review.md for the recorded round, whose digest equals `V --digest`;
- the round's lens outputs under `.omp/review-rounds/`.

Each row directory holds:
- `inputs/`: the fixture's own files, without the delivered ones;
- `delivered.sha256` and `delivered-check-before.txt` / `delivered-check-after.txt`: 53 delivered files, OK before and after every row;
- `calls.md`: ordered user turns, tool calls with arguments and results, including every `ask` and its answer, extracted by `tools/calllog.py`;
- `artifacts/`: git status and diff of the fixture at the row's end;
- for TUI rows, the screen capture of each ask.

## Validity

- **Skill path:** the review instruction calls `V` from `~/.omp/agent/skills/review-work/scripts/`, so sessions also look for SKILL.md in that directory. Each session therefore ran with its own `HOME` built by `tools/home.sh`. Every entry is a symlink into the real HOME, so nothing is copied, credentials included. The exceptions are `~/.omp/agent/skills/review-work/SKILL.md` and its `openspec/`, which are symlinks to the fixture's own `.omp/skills/review-work/` copy. A read through `~` therefore reads the fixture copy. `skill-paths.txt` lists every path any session, subagents included, used for review-work's SKILL.md: each is the fixture copy, directly or through that symlink.
- **First attempt discarded:** the first attempt ran with the real HOME. A read the installed pre-change `~/.omp/agent/skills/review-work/SKILL.md`, and B diffed the installed copy against the fixture's. All four first-attempt sessions were stopped and the fixtures rebuilt. Those runs are not part of this evidence.
- **Credentials:** a scan of every retained file against the credential values in `~/.omp/agent/models.yml` and the process environment, plus common token patterns, found 0 hits.

## Rows

| Row | Observation | Result |
|---|---|---|
| A | Round 2 (c1, v1, v2, v3, k1, u1, s1, cl1; correctness REJECT). One ask in this round, before any edit, with one question per blocker. **v1:** Accept offered and recommended (`ELIGIBLE`: "concerns only F1 verification and misses both limbs"). **c1, v2, v3, k1, u1, s1, cl1:** only Fix or Stop. The exclusion reasons were named: u1 "consequence is ambiguous … unclear and blocking", s1 "the area names CHECK 1 → excluded no matter what the consequence says", cl1 "disputes the Mandatory class → excluded". **Answers:** Accept for v1 with note "evidence path naming only", typed "accept v2 anyway, I take the risk" for v2, Fix for the others. A second ask named v2 as excluded ("it can't be accepted even on request") and offered Fix, Re-plan, Stop; answered Fix. gate.md gained an Accepted residual risks entry for v1 with the user's reason and none for v2. The row ended at the first reviewer dispatch: `tools/stop-at-dispatch.py` killed the session at the `task` call (`screen-dispatch.txt`). | PASS |
| A0 | Same fixture and answers with `F` from `B` (negative control). No ask in round 2 and no Accept offered for v1: every blocker went to Fix (`calls.md`, edits 22:40:23–22:40:43). Deviation: the dispatch stopper was not yet running, so the round-3 dispatch at 22:41:12 ran. The later round-3 approach question is outside this row. | PASS |
| A2 | Round 2 (c1, v2, u1; correctness REJECT). The fixture's gate.md holds Accepted residual risks entries naming v2's gap and consequence and u1's defect and consequence. **v2, u1:** treated as excluded and not covered; no ask, no Accept offered; both fixed in the artifacts. The session also replaced the residual entries with "none (the change's mandatory class makes both verification gaps of round 2 non-acceptable …)". There was no ask, so the typed "accept u1 anyway" did not arise. Deviation as in A0: the round-3 dispatch at 22:41:05 ran before the stopper existed. Everything after it is outside this row. | PASS |
| B | Round 3 (v1, v2; correctness OKAY). The approach question showed both as verification and stated "Accept is possible only for a verification-only blocker that misses both limbs …, which is blocker 1 here". It also called v2 excluded because it leaves the retrying → failed transition unproven. Recommended Re-plan; answered Continue. The following per-blocker ask covered only v1 (Accept recommended, with Accept, Fix and Stop offered); v2 got no question and no Accept option. Answered Stop: no edit, no dispatch (`artifacts/git-status.txt` empty), and review.md stays REJECT. | PASS |
| C | Delivered `F`, three `omp -p` lanes with QA passed, prompts `*.prompt.txt`, outputs `*.output.txt`. **F2 Phase 4 (p1, p2, p3, sd1):** only p1 may get a `below-threshold` downgrade; sd1 is named excluded because it "comes from a `security_delta: yes` trailer"; p2 is excluded as audit trail and unproven behaviour, p3 as the delivered change. **Delta exit 3:** with only p1, accept is offered and recommended; with p1 and p3, accept is not offered and p3 is named with its consequence. **F3 convergence STOP:** with only p1, freeze is offered and recommended; with p1 and p3, re-plan or continue is offered, freeze is not, and p3 is named with its consequence. | PASS |
| C0 | Same prompts with `F` from `B` (negative control): **F2:** "None of the four blockers may stay unfixed"; **delta:** accept is offered in neither case; **F3:** freeze is offered in neither case. p1 gets no override, accept or freeze. | PASS |
| D1 | Requirement "Security sources and gate classification are never eligible". **(a) delivered `Blocker disposition`:** "None found". **(b) bullet replaced by the threshold-dropping, unclear-subject-admitting text:** quotes the mutated bullet. It also quotes the coverage and user-request sentences, which become permissive once the mutation lets an over-threshold verification blocker escape the exclusion. | PASS |
| D2 | Requirement "The approach question diagnoses before it recommends". **(a) delivered step 4a:** "none found". **(b) parenthetical "…, and eligibility judges the subject separately":** quotes the mutated parenthetical. | PASS |

## Unexercised branches

- A blocker without a stated consequence: not exercised.
- The F2 and F3 lanes run end to end with real reviewers: not exercised. Row C covers those lanes' decisions with single-turn sessions only.

Neither branch is reported as passed.

## Tools

`tools/`: one-off evidence helpers, not delivered.
- `mk.py`: fixture builder.
- `home.sh`: per-row HOME of symlinks.
- `check.py`: delivered-bytes check.
- `watch.py`: waits for a pending ask, dispatch or idle turn.
- `stop-at-dispatch.py`: ends a row at its first `task` call.
- `calllog.py`: extracts calls.md from session JSONL.
