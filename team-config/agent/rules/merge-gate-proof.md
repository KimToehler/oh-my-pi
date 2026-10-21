---
description: Before asking to merge or reporting gated work as done, show a Gate proof block proving integration-review and review-work actually ran in full
alwaysApply: true
---

# Merge gate proof: show it, never make the user ask

Applies when a reply asks to merge, merges, asks for merge approval, or reports work as done that a plan with a `## Merge gate` section governs. Work without such a plan (questions, investigations, plans carrying `- Merge gate: not applicable (<reason>)`) gets no block.

When it applies, put this block in the reply, filled from tool output of this session, never from memory:

```
Gate proof
- integration-review: RAN | NOT RUN (<reason>) | not needed (<plan's Whole-diff review reason>)
  range <base>...<head> (literal SHAs) · report <tracked path> · Must-fix: <n> open / <n> fixed in <sha>
- review-work: RAN | NOT RUN (<reason>)
  reviewed_sha <40-hex> · plan_sha256 <hex>
  implementation-audit: <PASS|FAIL> · <agent> · <model> · trailer <path>
  strategic-risk-review: <PASS|FAIL|not run (reason)> · trailer <path>
  record <path> · validate-gate-record.mjs exit 0 at <HEAD sha>
- code committed after reviewed_sha: none | <shas> → gate void, re-run
```

Any line that is not RAN/PASS: say so at the top of the reply and do not ask for merge approval. Write it as `NOT RUN (<reason>)`; the merge-gate extension then reads the reply as a status report, not a claim. A reviewer that review-work's depth rule chose not to run is a valid `not run (<reason>)`, except for the four mandatory classes (auth/secrets/PII, schema or migration, wire contract or public API, concurrency or state machine), which always need both reviewers.

## What "ran in full" means

- integration-review: whole diff read, every failure mode named with an instance or "no instance found", simplification pass, plan scope walk, the reviewer dispatched with the skill's verbatim brief, a stored report, one cleanup commit for applied fixes, and a delta round after fixes. A reviewer asked "is this good?" is not the skill.
- review-work: plan frozen first (F2 `[x]`, then `plan_sha256`), each reviewer dispatched with the skill's verbatim brief, its `REVIEW-TRAILER-v1` stored unedited at a tracked path, the `omo.merge-gate/v2` record written and staged, the validator exiting 0, re-run after the record commit.

Order: integration-review, fixes, review-work. Code committed after review-work's `reviewed_sha` voids it; code committed after integration-review's last reviewed SHA needs a delta round over `<last reviewed>...<head>`.

## Failures this prevents

- Review rounds dispatched with custom checklists instead of the verbatim briefs both said PASS without trailers, so no valid gate record could exist; the verbatim round then found a real defect.
- Merge approval was requested with integration-review never run; the user had to ask whether both skills had run.
- A trailer was reformatted to make the validator pass. Never trim or edit a trailer; re-run the invocation.
