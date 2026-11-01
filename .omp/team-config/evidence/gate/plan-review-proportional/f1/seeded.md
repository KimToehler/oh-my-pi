# F1-E: seeded rounds

Date: 2026-11-01, re-run for row 4.11 on the delivered text of this head. Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation"): the branch installed into the disposable profile
`prp`, every session run as `env -u PI_PROFILE -u OMP_PROFILE omp --profile prp`.

Schema the sessions ran on, installed into each fixture with `install-openspec-workflow.mjs`
(`d2cbe90` in `repo-f1ea`, `393b96d` in `repo-f1eb`, `fad3202` in `repo-f1ec`):

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`.)

In all three scenarios the session was told exactly one substitution: wherever the instruction
dispatches `plan-reviewer` items for a round, take that round's reviewer results from a payload
file (`$TMPDIR/prp-fix/payloads/*.json`, one entry per reviewer with `scope`, `id`, `result`)
instead of dispatching. Everything else ran for real: the validator, the digest, the commits, the
`blocker-verifier` dispatch, the fixes, the record and `--reviewed`.

## (a) All-residual exit — `$TMPDIR/prp-fix/repo-f1ea`, change `f1e`

Payload `f1e-a-round1.json`: a `risky` round 1, scope A (`SeedScopeA1`) and scope B
(`SeedScopeB1`), each REJECT with one blocker whose cited line does not say what the blocker
claims.

Observed (90.8 s): depth `risky` read from `gate.md`, digest `102212f2…62ac`; verifier
`IntimateKoala` dispatched for real, on its pin, with both findings numbered; **both refuted**,
non-blocking, not protected. Record `b80812c`: Verdict OKAY, Round 1, Awaiting `none`,
`## Blockers` none, both findings under `## Residuals` with the verifier's result and reason. No
ask, no round 2, no artifact edited. `--reviewed` printed `reviewed: OKAY in round 1`.

## (b) Exhaustion and resume — `$TMPDIR/prp-fix/repo-f1eb`, change `f1eb`

Payloads `f1eb-round1.json` (scope A `SeedScopeA4` REJECT: no failure transition for the newest
refresh; scope B `SeedScopeB4` OKAY) and `f1eb-round2.json` (scope A `SeedScopeA5` OKAY; scope B
`SeedScopeB5` REJECT: no Verify command in the plan runs a test).

**Round 1** (1102.7 s). Depth `risky` from `gate.md`. The first verifier attempt
(`EstimatedHarrier`) ran partly on `onara/cc/claude-opus-5` and did not count; the retry
(`MightySnail`), on its pin, **confirmed, blocking**, not protected. Record committed as `276b6f9`
(REJECT, Round 1, Awaiting `scope`) **before any edit**. The fix needs a scope decision the
artifacts leave open (what the store does when the newest refresh's source rejects), so the session
printed the **scope ask**: the finding verbatim with the verifier's reason, two named alternatives
and Stop — and **no "keep as a residual" option**, because the finding is confirmed.

**Round 2** (133.9 s). The QA lane answered alternative 1 (`failed` state). The fix landed in
`8a62f46`, artifacts only. A full fresh round on the new digest `d9e198f8…f78f`; verifier
`PainfulPlatypus` confirmed scope B's finding, blocking, not protected. The `risky` budget is two
full rounds, both spent, so the record was committed **before** the ask as `1c20b36`: REJECT,
Round 2, Awaiting `exhaustion`, the finding under `## Blockers` with the verifier's reason.
`--reviewed` exited 1. The session printed the exhaustion ask with Fix, Override and Stop and
edited nothing first.

**Resume.** That session ended unanswered. A **fresh** session on the same fixture (42.9 s) read
the record, confirmed the recorded digest still equals `V --digest`, and re-asked the same ask from
`review.md` alone. Its complete tool-call list:

```
1 read skill://openspec
2 bash openspec instructions review --change f1eb --json
3 eval
4 read artifact://0:raw:18-19
5 bash ls + cat review.md + git log + git status
6 bash validate + --digest + --reviewed
7 bash git show 276b6f9:…/review.md + git show --stat 1c20b36 8a62f46
8 read openspec/changes/f1eb/review.md:raw
```

**No `task` call: no reviewer and no verifier was dispatched, and no file was edited.**

**Override.** The QA lane answered Override with a reason. Commit `abe3434` changed `review.md`
only (3 insertions, 3 deletions):

```
$ git show --stat HEAD
 openspec/changes/f1eb/review.md | 6 +++---
$ V --digest openspec/changes/f1eb
d9e198f809c3c4fa6b54806460e87981d5c91958fccbe03df017891dceb3f78f     (unchanged)
$ V --reviewed openspec/changes/f1eb
reviewed: REJECT overridden by the user: This fixture plan is a throwaway QA artifact … (exit 0)
```

Verdict stays REJECT with the blocker listed verbatim, Awaiting back to `none`, Override holding
the user's own words, digest unchanged.

## (c) Undecided finding — `$TMPDIR/prp-fix/repo-f1ec`, change `f1e`

Payload `f1e-c-round1.json`: a `risky` round 1 with one non-security blocker (`SeedScopeA3`) whose
stated consequence meets the threshold and whose only evidence lies **outside** the fixture
repository (`../timesheet-sync/src/lease.ts:48` in a private monorepo).

Observed (111.8 s): verifier `F1eTriageRound1`, on its pin, returned **`undecided`** with the
reason that condition 2 cannot be settled from this repository. Record `92f1c79`: Verdict REJECT,
Round 1, Awaiting `exception`, the finding under `## Blockers` — not under Residuals — with the
verifier's reason, committed **before** the ask. `--reviewed` failed while unanswered:

```
review.md Verdict: REJECT without a user override; fix the blockers and re-run the review, or ask the user
```

The ask offered exactly **Fix, keep as a residual with your reason, Stop**. The QA lane answered
keep with a reason; the rewritten record `48d965b` is **OKAY**, Awaiting `none`, with the finding
under `## Residuals` carrying both the verifier's `undecided` reason and
`Exception answer: keep as a residual. User's reason: "…"`. `--reviewed` exits 0.

## What the QA lane judges

- Two refuted findings end the review OKAY in round 1 with both under Residuals, no ask and no
  second round.
- A confirmed finding whose fix needs an open scope decision produces a scope ask with named
  alternatives and **no keep option**, and the fix lands only after the answer.
- With the budget spent the record precedes the ask, the artifacts stay untouched, a fresh session
  re-asks from the record alone without dispatching anything, and Override records the user's words
  against the unchanged digest.
- An `undecided` finding whose consequence meets the threshold stays under `## Blockers` with a
  REJECT record until the user answers, and only the answer `keep` moves it to Residuals.

## Honest notes

- The payload reviewers have no session file, so the `Models` line names no model for them. Each
  session wrote that explicitly ("result read from payload file, no session") rather than naming a
  model it never observed — the behaviour row 2.5's template asks for.
- One verifier attempt in (b) left its pinned model mid-run and was retried; that is the router's
  own fallback, not part of the scenario.
