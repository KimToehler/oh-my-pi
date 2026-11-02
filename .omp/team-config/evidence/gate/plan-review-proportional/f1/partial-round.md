# F1-H: a partly failed round, its two resumes and the control

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head (row 5.30 changed when a
round's blockers are committed, which is what this scenario is about). Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into each fixture with `install-openspec-workflow.mjs` and
committed there as `5c9d0d2`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture, the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head,
committed as `b7cd4fd13a`.)

## Fixture

Change `f1h`, Depth `risky`, digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`. The fixture deliberately starts
with a **stale OKAY record** for round 2 on that same digest (`57c6d47`): if the incomplete round
writes nothing, that OKAY stays current on an unchanged digest and `--reviewed` keeps authorizing
apply.

## (1) The incomplete round (`repo-f1h3`, 63 s)

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h3/2026-11-02T06-24-16-650Z_01a19aee-150a-740c-ad76-a1b67f7cf904`
(11 calls), in order: `bash openspec instructions review --change f1h --json` ×2;
`read /tmp/f1h-instr.txt:1-331:raw`; `bash ls -la openspec/changes/f1h; git log; git status
--porcelain`; `bash V … --digest`; `bash git log --oneline --stat -- openspec/changes/f1h; cat
<payload>`; `bash omp config get task.agentModelOverrides; ls "$(omp config path)/agents"`;
`read history://SeedH1ScopeA`; `bash git show b8a9ab0 --stat`; **`write review.md`**;
`bash V … --reviewed`.

No `task` call at all: scope A came from the payload, scope B was treated as failing twice, and the
verifier is not dispatched on an incomplete round.

`4fd2d8b` replaces the stale OKAY with: Verdict **REJECT**, Round **3**, Awaiting **`incomplete`**,
Verifier `none`; Models `SeedH1ScopeA` on the pin, `SeedH1ScopeB1 (no verdict)` and its retry
`SeedH1ScopeB2 (no verdict)`; scope A's finding verbatim under `## Blockers` marked
`- **Verifier**: not triaged: the round is incomplete`. The session then named the failed reviewer
and stopped.

## (2) The re-run with seeded reviewers (`repo-f1h3`, 184 s)

Session `…/2026-11-02T06-25-31-499Z_01a19aef-396b-7362-a5c1-70b0b536c7ce` (20 calls), in order:
`bash openspec instructions review`; `read skill://openspec`; two `eval` calls parsing the
instruction and re-running it; `bash ls && cat review.md && git log`; `read <payload>`; `bash V`;
`bash omp config get task.agentModelOverrides; omp config path`; `bash grep ^model
blocker-verifier.md`; `read history://SeedH2ScopeA`; two `bash grep/wc` calls on the validator;
**`write review.md`**; `bash git add && git commit` (`ab9f0f5`); **`task F1hR3Triage`**; `wait`;
`read history://F1hR3Triage`; `bash jq … provider + model`; **`write review.md`**;
`bash git add && git commit` (`cf26f5a`).

- `ab9f0f5` **before the verifier**: REJECT, Awaiting `triage`, Verifier `none`, the carried finding
  verbatim with both markers `- **Carried**: carried from the incomplete round` and
  `- **Verifier**: not triaged: the verifier has not returned`. Still round 3: an incomplete round
  spends no budget.
- The live verifier `F1hR3Triage` refuted it. `cf26f5a`: Verdict **OKAY**, Round 3, Awaiting
  `none`, the carried finding under `## Residuals`. `--reviewed` printed `reviewed: OKAY in round
  3`, exit 0.

## (3) The re-run with both scopes dispatched for real (`repo-f1h3b`, 1999 s)

A copy of the incomplete fixture at `4fd2d8b`, resumed with no substitution at all. Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h3b/2026-11-02T07-09-00-502Z_01a19b17-08d6-75d1-a3ed-77a539ace59b`
(46 calls). The dispatch sequence, in order:

```
18. task: F1hR3ScopeA+F1hR3ScopeB      <- both scopes in ONE batch
19. wait
20-22. read history://F1hR3ScopeB; jq provider+model (both scopes)
23. task: F1hR3ScopeBRetry             <- scope B left its pin, retried
27. task: F1hR3ScopeARetry             <- scope A left its pin, retried
29-33. read history://…Retry; jq provider+model
36. write review.md  /  37. git commit  (5c500f2)   <- record BEFORE the verifier
38. read agent://F1hR3ScopeBRetry/blockers
39. task: F1hR3Verifier                <- the only verifier dispatch
45. write review.md  /  46. git commit (2739ffa)
```

- `5c500f2`: REJECT, **Round 3** (unchanged), Awaiting `triage`, Verifier `none`, Models naming all
  four reviewer dispatches with `(no verdict)` on the two that left the pin, and the carried
  finding marked `carried from the incomplete round`.
- `2739ffa`: the verifier refuted the carried finding, which moves to `## Residuals` under
  `### Scope A (SeedH1ScopeA), carried from the incomplete round` with its reason, and confirmed a
  **new** finding from the real reviewers (task 1.1 proves nothing about the initial totals), so
  the record is REJECT with Awaiting `exhaustion` and the session printed the ask with Fix,
  Override and Stop.

## (4) Control: scope A OKAY and scope B failing leaves the record untouched (`repo-f1h3c`, 64 s)

Session
`~/.omp/profiles/prp/agent/sessions/-tmp-prp-fix-repo-f1h3c/2026-11-02T07-09-04-270Z_01a19b17-178e-7543-ba83-c9f0f777a09e`
(16 calls): the instruction and template reads, five `eval`/`read` calls paging the instruction,
`bash ls && cat review.md`, `bash V --digest`, `bash cat <payload>`, `read history://CtrlH3ScopeA`.
No `write`, no `edit`, no `git` write, no `task`.

```
$ git log --oneline -3
5c9d0d2 fixture: install the current omp-gated schema
57c6d47 fixture change f1h (risky)
66d1594 fixture: current OKAY review record for f1g

$ git diff --exit-code -- openspec/changes/f1h/review.md   ; echo $?
0
$ git status --porcelain                                   ; echo $?
0
```

The session's answer named the failed reviewer (`the scope B plan-reviewer, on both CtrlH3ScopeB1
and CtrlH3ScopeB2`) and said the earlier OKAY stays current because this round delivered no
blockers.

## What these runs show

- A round that only partly returns, but delivered a blocker, produces a committed REJECT record, so
  a stale OKAY on the same digest cannot survive it (row 5.30's route 16).
- A round that delivered **nothing** writes no record at all: the control's tree is byte-identical
  afterwards.
- The delivered blocker is neither triaged nor fixed nor asked about while the round is incomplete;
  it is carried verbatim into the re-run and triaged there, whether the re-run's reviewers are
  seeded (leg 2) or dispatched for real (leg 3), and even when they return nothing.
- The re-run keeps the round number, and both scopes go out in one batch.
