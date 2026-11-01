# F1-E: seeded rounds

Date: 2026-11-01. Same deployment as F1-A (`.../f1/standard.md`, "Deployment deviation"): the
branch installed into the disposable profile `prp`, every session run as `omp --profile prp`.

In all three scenarios the session was told exactly one substitution: wherever the instruction
dispatches `plan-reviewer` items for a round, take that round's reviewer results from a payload
file (`$TMPDIR/prp-fix/payloads/*.json`, one entry per reviewer with `scope`, `id`, `result`)
instead of dispatching. Everything else ran for real: the validator, the digest, the commits, the
`blocker-verifier` dispatch, the fixes, the record and `--reviewed`. Every verifier child resolved
to `onara/cx/gpt-6.1-sol` at effort `medium`.

Scenarios (a), (b) and (c) ran on the text before the F2 wave-1 fixes; the probe at the end of this
file ran on the fixed text. The fixes do not touch what (a), (b) and (c) observe: (a) turns on
condition 2 of the verifier (the cited lines do not say what the blockers claim), (c) on
`undecided` for evidence outside the repository, and (b) on the exhaustion ask, the record and the
cross-session resume. Row 5.1 changed condition 3 only, and it can only make the verifier stricter,
never more lenient; row 5.2 changed the scope ask, which none of the three raises; row 5.3 added
the triage-failure record, which none of the three triggers.

## (a) All-residual exit — `$TMPDIR/prp-fix/repo-f1ea`, change `f1e`

Payload `f1e-a-round1.json`: a `risky` round 1, scope A (`SeedScopeA1`) and scope B
(`SeedScopeB1`), each REJECT with one blocker whose cited line does not say what the blocker
claims (`src/day-list.ts:5` is a local `new Map()`, not published state; `src/day-list.ts:16` is a
`.map()`, not a sort by minutes).

Observed: depth `risky` read from `gate.md`; verifier `LivingAphid` dispatched for real with both
findings numbered; **both refuted**, non-blocking, not protected. `review.md` (commit `fc114f4`):
Verdict OKAY, Round 1, Awaiting `none`, `## Blockers` none, both findings under `## Residuals`
with the verifier's result and reason. No ask, no round 2, no artifact edited.
`--reviewed` printed `reviewed: OKAY in round 1` and exited 0.

## (b) Exhaustion and resume — `$TMPDIR/prp-fix/repo-f1eb`, change `f1eb`

Payloads `f1eb-round1.json` (scope A REJECT: no failure transition for the newest refresh) and
`f1eb-round2.json` (scope B REJECT: no Verify command in the plan runs a test).

Round 1: verifier `VerifyF1ebRound1` **confirmed, blocking**. Record committed as `831684b`
(REJECT) before any edit; the fix (failure transition in proposal, design, a new requirement with
a negative control, tasks 1.1 and 1.2) committed as `e9cf54f`.

Round 2: verifier `VerifyF1ebRound2` **confirmed, blocking**, not protected. Record committed as
`baa6a94`: Verdict REJECT, Depth `risky`, Round 2, Awaiting `exhaustion`, the finding under
`## Blockers` with the verifier's reason — written **before** the ask. `--reviewed` exited 1
("REJECT without a user override"). The session then printed the exhaustion ask, quoting the
finding's area, defect and evidence verbatim with the verifier's reason, and offering Fix,
Override and Stop.

Resume: that session ended unanswered. A **fresh** session on the same fixture read the record,
confirmed the recorded digest still equals `V --digest`, and re-asked the same ask from
`review.md` alone — with no reviewer or verifier dispatched and no file edited (its own report and
the session's tool calls show only `openspec instructions`, the validator and reads). The QA lane
answered Override with a reason. Afterwards: commit `d176551` changed `review.md` only
(`git diff --stat baa6a94 HEAD` -> `openspec/changes/f1eb/review.md | 4 ++--`), the Verdict stays
REJECT with the blocker listed verbatim, Awaiting is back to `none`, Override holds the user's own
words, the digest is unchanged, and `--reviewed` exits 0 printing
`reviewed: REJECT overridden by the user: …`.

## (c) Undecided finding — `$TMPDIR/prp-fix/repo-f1ec`, change `f1e`

Payload `f1e-c-round1.json`: a `risky` round 1, scope A (`SeedScopeA3`) REJECT with one
non-security blocker whose consequence meets the threshold (a lease contract the publisher never
releases, blocking the nightly export) and whose only evidence lies outside the fixture repository
(`../timesheet-sync/src/lease.ts:48`); scope B (`SeedScopeB3`) OKAY.

Observed: verifier `NetHookworm` returned **undecided** with `blocking: false`, `protected: false`,
reasoning that condition 2 cannot be settled from this repository. The session did **not** read
that as a residual: `review.md` (commit `4277929`) is Verdict REJECT, Round 1, Awaiting
`exception`, with the finding under `## Blockers` and the verifier's reason; `--reviewed` failed
while the answer was outstanding. The ask offered Fix, keep-with-reason and Stop. The QA lane
answered "keep" with a reason; the record was rewritten on the same digest
(`102212f2…4162ac`, commit `108af2c`) as Verdict OKAY, Awaiting `none`, `## Blockers` none, with
the finding, the verifier's `undecided` result and the user's reason under `## Residuals`.
`--reviewed` printed `reviewed: OKAY in round 1`.

## Acceptance

| criterion | result |
|---|---|
| (a) verifier refutes both, OKAY, Blockers none, both residual, no ask, no round 2 | yes |
| (b) REJECT with Awaiting `exhaustion` and the verifier's reason written before the ask | yes |
| (b) ask quotes the finding verbatim with Fix, Override, Stop | yes |
| (b) fresh session re-asks from the record, nothing dispatched first | yes |
| (b) after Override: record carries it, only `review.md` changed, `--reviewed` passes | yes |
| (c) verifier `undecided`, REJECT with the finding under Blockers, Awaiting `exception` | yes |
| (c) `--reviewed` fails while unanswered; options Fix, keep, Stop | yes |
| (c) after "keep": OKAY with the finding and reason under Residuals | yes |

## Fixture iterations, and the defect they exposed (honest record)

Scenario (b) needed two fixture rewrites before it could reach round 2, and the reason was a real
defect in the delivered text, not fixture luck: on a "the Verify command cannot fail" finding the
verifier's judgement was **not stable**. The same payload blocker was confirmed by one verifier run
(`ConsistentHamster`) and refuted by two others (`MonthlyWallaby`, `VerifyF1ebR1`), each time
citing the spec's written negative-control scenarios as if they were executable checks. The
scenario became deterministic only when the blocker named the gap explicitly ("the Negative control
scenarios are written criteria, not commands; no task executes them") and cited `package.json`. The
same leniency refuted the planted defect in F1-A. Findings about a missing failure transition or a
missing section were confirmed every time.

The F2 wave-1 audit raised that as blocker class `prose-as-executable-verification`, and row 5.1
fixed condition 3 of `blocker-verifier.md`: only a check the plan runs (a task's verify command, a
test the tasks name, or a planned real-session run whose retained outputs would show the failure)
can refute, and a `### Requirement:` block or a `#### Scenario:` never does.

### Probe of the fixed rule

The same **plain** blocker — the one the two earlier runs refuted, with no meta-argument about
scenarios and no `package.json` citation, naming only `tasks.md:5-7` — was sent to a fresh
`blocker-verifier` (`WelcomeBandicoot`, `onara/cx/gpt-6.1-sol` effort `medium`) in a fresh session
on the unchanged `$TMPDIR/prp-fix/repo-f1eb` fixture, through the fixed agent file. One entry for
index 1: **confirmed, blocking true, protected false**:

> All conditions hold. tasks.md:5-7 runs only `bun run format` and file-existence checks;
> package.json:5 defines format as `prettier --check .`. A formatted implementation that publishes
> every refresh, accompanied by an empty test file and an empty Unreleased entry, can pass all
> three commands. **Task 1.2 describes the necessary tests but never executes them, and neither
> design.md nor gate.md adds an executable or real-session check.** … This defeats the change's
> central supersession goal and leaves the state and failure transitions unproven; gate.md accepts
> no residual risks.

Two runs of the old text refuted this blocker; the fixed text confirms it, with the reason naming
exactly the distinction row 5.1 introduced. F1-A was re-run end to end on the fixed text as well
(`standard.md`), where the planted defect is now confirmed and fixed.
