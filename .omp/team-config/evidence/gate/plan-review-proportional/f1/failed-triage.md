# F1-G: a failed triage and its resume

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head (row 5.30 changed when a
round's blockers are committed, which this scenario exercises twice). Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs` and
committed there as `4b9b366`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture, the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head,
committed as `b7cd4fd13a`.)

## Fixture

`$TMPDIR/prp-fix/repo-f1g3`, change `f1g`, Depth `risky`, digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`. Two substitutions: the round's
two reviewer results come from a payload file, and every `blocker-verifier` attempt in session 1
returns a structurally incomplete result (one entry for a two-blocker brief). Everything else runs
for real.

## Session 1 — the triage fails twice (68 s)

- `02fbb36` **before any verifier attempt**: Verdict REJECT, Round 1, Awaiting `triage`, Verifier
  `none`, both findings verbatim, each marked
  `- **Verifier**: not triaged: the verifier has not returned` (two occurrences).
- The first attempt `SeedG1Verify1` returned a result missing an index; the fresh retry
  `SeedG1Verify2` returned the same. Neither counted.
- `e098e70` on the same digest: Verifier still `none`, Models lists both attempts as
  `(no verdict)`, and both findings now carry
  `not triaged: the verifier failed twice` (two occurrences). Verdict stays REJECT.
- `--reviewed` fails at this point with
  `review.md Verdict: REJECT without a user override; fix the blockers and re-run the review, or ask the user`,
  exit 1 — an un-triaged round cannot authorize apply.

## Session 2 — the resume (140 s)

- Resumed with a plain instruction and no substitution: the session saw Awaiting `triage` on the
  unchanged digest, dispatched **no reviewer**, and ran one live verifier `F1gTriage1` on the pin
  over exactly the two untriaged findings.
- Both were refuted. `d2f44f2`: Verdict **OKAY**, Round 1, Awaiting `none`, both findings under
  `## Residuals`, the two failed attempts still listed as `(no verdict)` in Models.
  `--reviewed` printed `reviewed: OKAY in round 1`, exit 0.

## What this run shows

- An incomplete verifier result is never read as a refutation: it gets one fresh retry, and when
  that also fails the record says so in the finding itself.
- A twice-failed triage is a committed, resumable state that blocks apply; the session stops rather
  than guessing a verdict.
- The resume triages exactly the untriaged findings and dispatches no reviewer, so the round number
  and the reviewer list stay as recorded.
