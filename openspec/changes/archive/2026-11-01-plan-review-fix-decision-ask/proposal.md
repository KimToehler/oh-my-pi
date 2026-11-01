# Proposal

## Why

The `openspec-plan-review` spec says a complete rejecting round below the approach-question trigger with only non-eligible blockers is fixed "without an ask". The `omp-gated` review instruction it describes already asks when a fix needs a user decision (`team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:412-414`: "A blocker whose fix needs a user decision is asked as in step 6"), and real sessions do so (`review-proportionality` F1-E copy 2). A reviewer or implementer reading the spec gets the wrong contract.

## What Changes

- The spec scenario "Round with only blocking findings keeps the existing path" names the existing exception: a blocker whose fix needs a user decision is asked as a per-blocker ask offering Fix and Stop, never Accept.
- The requirement's negative control names the mixed round it targets: an ask about eligible blockers must name every open non-eligible blocker; a decision-only ask about one non-eligible blocker does not fail it.
- No instruction, validator, template or prompt change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-plan-review`: the early-ask requirement's scenario for rounds with only non-eligible blockers states the existing fix-decision ask.

## Impact

- `openspec/specs/openspec-plan-review/spec.md` through this change's delta, on archive.
- No deploy and no consumer update: the delivered schema is unchanged.
