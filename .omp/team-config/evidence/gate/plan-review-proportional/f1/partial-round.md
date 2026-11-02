# F1-H: a partly failed round and its re-run

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head (row 5.30 changed when a
round's blockers are committed, which is what this scenario is about). Deployment as in F1-A
(`.../f1/standard.md`, "Deployment deviation").

Schema the sessions ran on, installed into the fixture with `install-openspec-workflow.mjs` and
committed there as `5c9d0d2`:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:openspec/schemas/omp-gated/schema.yaml` in the fixture, the same bytes as
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` at this head,
committed as `b7cd4fd13a`.)

## Fixture

`$TMPDIR/prp-fix/repo-f1h3`, change `f1h`, Depth `risky`, digest
`a20fa81a479c7540cb40c209507b4e92607615ea7c7ccf92e22251168130ce29`. The fixture deliberately starts
with a **stale OKAY record** for round 2 on that same digest (`57c6d47`). That is the trap this
scenario exists for: if the incomplete round writes nothing, the OKAY stays current on an unchanged
digest and `--reviewed` keeps authorizing apply.

Substitution: scope A's result comes from a payload file; scope B is treated as returning no
structured result, on its first attempt and on its retry. Everything else runs for real.

## Session 1 — the incomplete round (63 s)

`4fd2d8b` replaces the stale OKAY with:

- Verdict **REJECT**, Round **3**, Awaiting **`incomplete`**, Verifier `none`.
- Models: `SeedH1ScopeA` on the pin, `SeedH1ScopeB1 (no verdict)` and its retry
  `SeedH1ScopeB2 (no verdict)`.
- Scope A's delivered finding verbatim under `## Blockers`, marked
  `- **Verifier**: not triaged: the round is incomplete`.

The session then told the user which reviewer failed and stopped: no verifier dispatch, no fix, no
further dispatch.

## Session 2 — the re-run (184 s)

- The resume saw Awaiting `incomplete` and dispatched **two fresh reviewers**
  (`SeedH2ScopeA`, `SeedH2ScopeB`, both on the pin, both OKAY with no blockers).
- `ab9f0f5` **before the verifier**: Verdict REJECT, Awaiting `triage`, Verifier `none`, and the
  carried finding kept verbatim with both markers:
  `- **Carried**: carried from the incomplete round` and
  `- **Verifier**: not triaged: the verifier has not returned`. The round is still numbered 3: the
  incomplete round spent no budget.
- The live verifier `F1hR3Triage` refuted the carried finding.
- `cf26f5a`: Verdict **OKAY**, Round 3, Awaiting `none`, the carried finding under `## Residuals`.
  `--reviewed` printed `reviewed: OKAY in round 3`, exit 0.

## What this run shows

- A round that only partly returns still produces a committed REJECT record, so a stale OKAY on the
  same digest cannot survive it (row 5.30's route 16).
- The delivered blocker is neither triaged nor fixed nor asked about while the round is incomplete;
  it is carried verbatim into the re-run and triaged there, even though the re-run's own reviewers
  returned nothing.
- The re-run keeps the round number: an incomplete round spends no budget.
