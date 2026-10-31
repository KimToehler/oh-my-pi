# Design

## Context

See proposal.md, Why. The behaviour already exists in review step 4 of the `omp-gated` schema; only the spec text lags.

## Goals / Non-Goals

**Goals:**
- The spec scenario matches the instruction's existing fix-decision ask.

**Non-Goals:**
- Any change to the review instruction, its asks or their options.

## Decisions

1. **Use step 6's options, not new wording.** The exception names the per-blocker ask with Fix and Stop and no Accept, as step 6 defines for a non-eligible blocker; "fix alternatives" is not step 6 wording and is not used.
2. **MODIFIED, whole requirement block.** The delta carries the full `Early ask at a complete round with eligible blockers` requirement with every scenario; only two lines change: that scenario's THEN line and the negative control's WHEN line, which is narrowed to an ask about eligible blockers so the decision-only ask the instruction already makes does not fail it (round-1 review).

## Risks / Trade-offs

- [The archived spec drops or reorders a scenario of the requirement] → the delta is the main spec's block copied verbatim with one line changed; F1 archives it in a scratch copy and diffs the result.
