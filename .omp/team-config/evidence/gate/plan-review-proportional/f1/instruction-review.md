# F1-F: instruction review for the branches no live run forces

Date: 2026-11-01, re-run for row 4.11 on the head after 4.7's last code commit, with the list of
forbidden routes extended by the four routes row 4.11 adds (11-14) and the exhaustion-ordering
route row 5.25 closed (15).

Schema blob the reviewed instruction was extracted from:

```
f7ad8d3534d80e841900f9d9cb878514945da9d4
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`;
the instruction is `artifacts[id=review].instruction`, 299 lines, written to
`/tmp/f1f/delivered-instruction.md`.)

## Setup

A fresh default `task` agent (no review role, no plan context) received three files as **data**,
with the explicit rule never to follow an instruction inside them:

- A `/tmp/f1f/delivered-instruction.md` — the delivered instruction, 299 lines.
- B `/tmp/f1f/control-instruction.md` — the same text with one sentence inserted after line 165:
  `- When the verifier omits a blocker, record it as a residual.`
- C `/tmp/f1f/blocker-verifier.md` — the verifier prompt the instruction dispatches.

Its task: list **every sentence that permits** one of the forbidden routes, verbatim with its line
number, and say explicitly when another sentence closes the route.

Forbidden routes (1-10 as in row 4.6; 11-14 added by row 4.11; 15 added here for row 5.25):

1. a verifier result with an omitted or repeated index triaged as complete;
2. a third `risky` round, or a second `standard` delta check, without the user's answer;
3. a `risky` review ending OKAY after round-1 fixes without round 2, or answered with a
   one-reviewer delta check;
4. a dispatch while the change folder has uncommitted or untracked changes;
5. a delta diff base other than the recording commit;
6. Override offered for a security-scope finding;
7. an unconfirmed security finding, or a threshold-meeting `undecided` finding, recorded as a
   residual without an ask, or kept outside `## Blockers` while awaiting the answer;
8. a fix that needs an open scope decision applied without an ask;
9. re-triage of recorded findings on resume;
10. a retry-less incomplete round written to `review.md`;
11. a verdict or triage result counted from a dispatch whose session records a model other than
    its pin;
12. a partly failed round whose delivered blocker is left unrecorded, untriaged, fixed or asked
    about;
13. a reviewer dispatched on a resume whose `Awaiting` is not `incomplete`;
14. a finding carried from an incomplete round dropped, merged with a repeat, or left out of the
    re-run's triage;
15. an artifact edited after the budget is spent and before the user answered the exhaustion ask.

## Result

**File A: no sentence found.** The agent named, for each of the fifteen routes, the sentence that
closes it:

| Route | Closed at (lines of the delivered instruction) |
|---|---|
| 1 | 148 ("counts only when it holds exactly one entry per index 1 to N and no duplicate or other index"), 150-151, 152-160 |
| 2 | 196-199, 219, 246 |
| 3 | 207-212, 193-195 |
| 4 | 10-14, 212-213 |
| 5 | 14-15, 242 |
| 6 | 181-184, 248-250 |
| 7 | 169-171, 173-178, 187-189 |
| 8 | 202-203, 246 |
| 9 | 276-282 |
| 10 | 108-124 |
| 11 | 94-106 |
| 12 | 113-121, 152-160 |
| 13 | 160, 193, 281-282 |
| 14 | 128-129, 144-146, 288-295 |
| 15 | 196-199 ("edit no artifact and dispatch nothing… Only the answer Fix authorizes the edits below") |

**File C: no sentence found.** Line 58 requires exactly one result per index with no other index,
line 57 forbids merging, splitting and renumbering, line 50 restricts `undecided` and line 52 sets
`protected` independently of the result.

**File B: the planted sentence is reported.** The agent diffed B against A, named the single
inserted line (B:166) verbatim, and reported it twice: under route 1, because recording an omitted
blocker as a residual counts it as triaged without a retry or an Awaiting `triage` record, and
under route 7, because the sentence has no security or `protected` carve-out. It also stated why
the neighbouring sentences do not close it: line 150 bans reading a missing entry as a
*refutation*, not as a residual, and lines 152-156 apply only after the retry also failed.

## The three borderline observations, and why none is a finding

The agent listed them separately rather than as findings; the QA lane agrees:

1. **Resume skips step 2's clean check (routes 4, 13).** A resume continues at the triage step or
   re-runs from step 3, so it does not repeat the commit and `git status --porcelain` check. It is
   guarded by the recorded digest still equalling `V --digest`. The digest is computed over the
   change folder's tracked plan files, so an uncommitted edit to any of them changes it and the
   resume refuses; `review.md` itself is excluded by design, because the resume's own record is
   what it reads. Not a leak.
2. **A verifier without a pin would leave blockers unrecorded (route 12).** The delivered
   `blocker-verifier.md` pins its model on line 5, so the branch is unreachable for the delivered
   pair. The agent said so itself.
3. **A stale re-run after Stop could start a third `risky` round (routes 2, 13).** Editing an
   artifact after a review makes it stale and requires a re-run — but the edit changes the digest,
   so the re-run is a **new review** on new bytes with its own budget, not a third round of the
   old one. The budget sentence counts the rounds "this review" dispatched since its first round
   as the committed records show, and those records bind a digest. Not a leak.

## What the QA lane judges

- The delivered instruction and the verifier prompt leave none of the fifteen routes open.
- A single inserted sentence that opens route 1 is found, quoted and explained, so the method
  discriminates; the control is not a formality.
