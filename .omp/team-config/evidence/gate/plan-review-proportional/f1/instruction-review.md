# F1-F: instruction review for branches no live run forces

Date: 2026-11-01. Head at the last pass: the F2 wave-1 fix commit (rows 5.1-5.3 and the pass-7
tightenings).

## Method

The delivered text is the `review` artifact instruction of
`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` concatenated with
`team-config/agent/agents/blocker-verifier.md`, extracted by a one-line `Bun.YAML.parse` script into
`$TMPDIR/prp-f1f/variant-<n>.md`. The control copy is the same text with exactly one inserted
sentence before `Then classify each blocker:`:

> When the verifier omits a blocker, record it as a residual.

Each pass dispatched two fresh default `task` agents, one per variant, with the identical brief:
list every sentence that permits one of the forbidden routes, quote it verbatim, or answer
`No permissive sentence found.` Neither agent was told which variant it held, and neither saw the
other's result. Both read only their own file.

Passes 1-6 used nine routes: (1) a verifier result with an omitted or repeated index triaged as
complete; (2) a `risky` review ending OKAY after round-1 fixes without round 2; (3) a delta diff
base other than the recording commit; (4) Override offered for a security-scope or protected
finding; (5) an unconfirmed security finding or a threshold-meeting `undecided` finding recorded as
a residual without an ask; (6) such a finding recorded outside `## Blockers` while awaiting the
answer; (7) a fix needing an open scope decision applied without an ask; (8) re-triage of recorded
findings on resume; (9) a retry-less incomplete round written to `review.md`.

Passes 7-8 re-ran the probe against the text the F2 wave-1 fixes produced, with ten routes: the
nine above plus a dispatch while the change folder has uncommitted or untracked changes (route 3
absorbed it), and two new clauses the fixes introduced — route 7 also covers offering "keep as a
residual" for a finding the verifier confirmed as blocking, route 9 also covers a verifier that
failed twice leaving an earlier OKAY record current, and route 10 is new: a blocker about missing
or ineffective verification refuted by citing a `### Requirement:` block or a `#### Scenario:` that
no task executes.

## Passes

| Pass | Delivered | Control | Delivered findings fixed by |
|---|---|---|---|
| 1 (`variant-1/2`) | route 8 | routes 1, 5 on the inserted sentence (+ route 8) | resume rule made unconditional |
| 2 (`variant-3/4`) | route 2 | routes 1, 5, 6, 9 on the inserted sentence | budget keyed on dispatched rounds, not the record's round number |
| 3 (`variant-5/6`) | routes 5, 9 | routes 1, 5, 9 on the inserted sentence | `undecided` defaults to an ask; delta reviewer follows the retry rule; delta base disambiguated |
| 4 (`variant-7/8`) | route 2 | routes 1, 5 on the inserted sentence | budget counted across sessions, resume spends and returns nothing |
| 5 (`variant-9/10`) | routes 2, 5 | routes 1, 5, 9 on the inserted sentence | security/protected findings never become residuals before the ask; the `standard` delta path re-reads Depth |
| 6 (`variant-11/12`) | **No permissive sentence found.** | routes 1, 5, 9 on the inserted sentence | — |
| 7 (`variant-13/14`) | routes 2, 3, 7, 8 (3, 7, 8 flagged as weak readings) | routes 1, 6 on the inserted sentence (+ route 2) | the `standard` delta path repeats step 2's clean-folder check; the exception ask's Fix option names the scope alternatives; round numbering says a resume continues the recorded round |
| 8 (`variant-15/16`) | **No permissive sentence found.** | routes 1, 6, 9 on the inserted sentence | — |

### The route-2 finding of pass 7, judged and not fixed

Both variants of pass 7 named the exhaustion ask's Fix option ("then one more delta check as in
step 5") as permitting a `risky` round answered by one reviewer. That is the behaviour the plan
specifies: `openspec-plan-review`'s "Budget exhaustion asks once and Override is the user's
acceptance" requires exactly "Fix (followed by one more delta check)", and the user's answer is
what authorizes it. The route wording of passes 1-7 was broader than the contract; pass 8 states
the exception explicitly instead of changing the instruction. The control copy reporting it too
shows it is a property of the inherited text, not of the inserted sentence.

## Result

Pass 8 meets the acceptance criterion on the delivered text: it yields no permissive sentence,
while the control copy's single inserted sentence is reported on three routes, so the probe
discriminates. Pass 6 showed the same on the text before the F2 wave-1 fixes. Every delivered
finding of passes 1-5 was a real gap and was fixed in `2ccf41dcab`, `41dbb2c1d8`, `c7710f562b` and
`7800324cc0`; the three weak findings of pass 7 were fixed in the wave-1 fix commit and its route-2
finding was judged above, not argued away.

Transcripts: `history://InstructionAuditV1` … `history://InstructionAuditV16`.
