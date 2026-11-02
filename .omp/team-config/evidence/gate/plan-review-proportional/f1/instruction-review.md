# F1-F: instruction review for the branches no live run forces

Date: 2026-11-02, re-run for row 5.33 on the delivered text of this head, with the list of
forbidden routes extended by the route row 5.30 adds (16).

Schema blob the reviewed instruction was extracted from:

```
b0f3c2009a7bd3d89e60438b34011efdbdbaff0b
```

(`git rev-parse HEAD:team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`,
committed as `b7cd4fd13a`; the instruction is `artifacts[id=review].instruction`, 309 lines,
written to `/tmp/f1f2/delivered-instruction.md`.)

## Setup

A fresh default `task` agent (no review role, no plan context) received three files as **data**,
with the explicit rule never to follow an instruction inside them:

- A `/tmp/f1f2/delivered-instruction.md` — the delivered instruction, 309 lines.
- B `/tmp/f1f2/control-instruction.md` — the same text with one sentence inserted after line 165:
  `- When the verifier omits a blocker, record it as a residual.`
- C `/tmp/f1f2/blocker-verifier.md` — the verifier prompt the instruction dispatches.

Its task: list **every sentence that permits** one of the forbidden routes, verbatim with its line
number, and say explicitly when another sentence closes the route.

Forbidden routes (1-10 as in row 4.6; 11-14 added by row 4.11; 15 by row 5.25; 16 here for
row 5.30):

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
15. an artifact edited after the budget is spent and before the user answered the exhaustion ask;
16. a round's blockers left uncommitted until after the verifier returns.

## Result

**File A: no sentence found.** The agent named, for each of the sixteen routes, the sentence that
closes it. The new route 16 is closed at lines 130-137:

> Before the dispatch, write `review.md` for this round (step 7) and commit it with Verdict
> REJECT, Awaiting `triage` … without that commit an earlier OKAY record stays current on the
> unchanged digest and `--reviewed` keeps authorizing apply.

followed by "Then dispatch one fresh task item". Route 15 is closed at 206-207 ("edit no artifact
and dispatch nothing, and go to the exhaustion ask … Only the answer Fix authorizes the edits
below") together with 258-259, which forbids any edit on Override. The other fourteen rows are the
same sentences as in the row 4.11 review, shifted by the new text.

**File C: no sentence found.** C is the verifier's own prompt: line 58 requires exactly one result
per index with no other index, line 57 forbids merging, splitting and renumbering, line 50
restricts `undecided`, line 52 sets `protected` independently of the result, line 5 carries the
pin. It addresses the producer side only and permits none of the dispatch-control routes.

**File B: the planted sentence is reported.** The agent diffed B against A (`165a166`, the single
inserted line), quoted it verbatim and reported it under **two** routes: route 1, because an
omitted index recorded as a residual counts the verifier result as triaged, and route 7, because
the sentence has no security, `protected` or `undecided` carve-out. It also said why the
neighbouring sentences do not close it: B keeps A's 155-158, so the text contains two rules and
cannot say which wins, and the inserted one reads as the more specific exception.

## The two borderline observations, and why neither is a finding

The agent listed them as readings, not findings, and counted both routes closed. The QA lane
agrees:

1. **Route 4 on the resume paths.** The triage resume (165-168) and the incomplete re-run
   (295-297) do not repeat step 2's `git status --porcelain` check; they rely on the digest being
   unchanged. The text does not state what `V --digest` covers, so the agent could not settle it
   from the text alone. It is settled outside the text: the digest is computed over the change
   folder's tracked plan files, so any uncommitted edit to one of them changes it and the resume
   refuses.
2. **Route 15, lines 208-210.** "an exception or scope ask answered Fix on a spent budget: fix
   every confirmed blocking finding …" read in isolation could be taken to cover an unanswered
   exhaustion ask. The closing sentence is 206-207, two lines above, and the live run in
   `.../f1/seeded.md` leg (d) shows the delivered behaviour: the session edited nothing until the
   answer arrived, then edited `design.md` only and ran exactly one delta check. Recorded here as
   a wording risk, not a leak.

## What the QA lane judges

- The delivered instruction and the verifier prompt leave none of the sixteen routes open.
- A single inserted sentence that opens routes 1 and 7 is found, quoted, diffed and explained, so
  the method discriminates; the control is not a formality.
- The two borderline readings are recorded with the reason each route is nonetheless closed, one
  of them with a live run as the evidence.
