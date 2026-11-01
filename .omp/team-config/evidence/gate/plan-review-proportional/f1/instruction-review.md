# F1-F: instruction review for branches no live run forces

Date: 2026-11-01. Head at the final pass: `7800324cc0`.

## Method

The delivered text is the `review` artifact instruction of
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` concatenated with
`team-config/agent/agents/blocker-verifier.md`, extracted by a one-line `Bun.YAML.parse` script into
`$TMPDIR/prp-f1f/variant-<n>.md`. The control copy is the same text with exactly one inserted
sentence before `Then classify each blocker:`:

> When the verifier omits a blocker, record it as a residual.

Each pass dispatched two fresh default `task` agents, one per variant, with the identical brief:
list every sentence that permits one of nine forbidden routes, quote it verbatim, or answer
`No permissive sentence found.` Neither agent was told which variant it held, and neither saw the
other's result. Both read only their own file.

The nine routes: (1) a verifier result with an omitted or repeated index triaged as complete;
(2) a `risky` review ending OKAY after round-1 fixes without round 2; (3) a delta diff base other
than the recording commit; (4) Override offered for a security-scope or protected finding;
(5) an unconfirmed security finding or a threshold-meeting `undecided` finding recorded as a
residual without an ask; (6) such a finding recorded outside `## Blockers` while awaiting the
answer; (7) a fix needing an open scope decision applied without an ask; (8) re-triage of recorded
findings on resume; (9) a retry-less incomplete round written to `review.md`.

## Passes

| Pass | Delivered | Control | Delivered findings fixed by |
|---|---|---|---|
| 1 (`variant-1/2`) | route 8 | routes 1, 5 on the inserted sentence (+ route 8) | resume rule made unconditional |
| 2 (`variant-3/4`) | route 2 | routes 1, 5, 6, 9 on the inserted sentence | budget keyed on dispatched rounds, not the record's round number |
| 3 (`variant-5/6`) | routes 5, 9 | routes 1, 5, 9 on the inserted sentence | `undecided` defaults to an ask; delta reviewer follows the retry rule; delta base disambiguated |
| 4 (`variant-7/8`) | route 2 | routes 1, 5 on the inserted sentence | budget counted across sessions, resume spends and returns nothing |
| 5 (`variant-9/10`) | routes 2, 5 | routes 1, 5, 9 on the inserted sentence | security/protected findings never become residuals before the ask; the `standard` delta path re-reads Depth |
| 6 (`variant-11/12`) | **No permissive sentence found.** | routes 1, 5, 9 on the inserted sentence | — |

## Result

Pass 6 meets the acceptance criterion: the delivered text yields no permissive sentence, and the
control copy's single inserted sentence is reported, so the probe discriminates. Every delivered
finding of passes 1-5 was a real gap in the instruction text and was fixed in
`2ccf41dcab`, `41dbb2c1d8`, `c7710f562b` and `7800324cc0`; no finding was argued away.

Transcripts: `history://InstructionAuditV1` … `history://InstructionAuditV12`.
