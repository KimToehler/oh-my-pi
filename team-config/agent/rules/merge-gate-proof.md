---
description: Before asking to merge or reporting gated work as done, show a Gate proof block proving integration-review and review-work actually ran in full
alwaysApply: true
---

# Merge gate proof: show it, never make the user ask

Applies when a reply asks to merge, merges, asks for merge approval, or reports work as done that a plan with a `## Merge gate` section governs. Work without such a plan (questions, investigations, plans carrying `- Merge gate: not applicable (<reason>)`) gets no block. When you cannot tell, because the governing plan was not read, is missing, cannot be read, or has no complete `## Merge gate` section, the rule applies and every unproven line reads `NOT RUN (<what is missing>)`.

When it applies, put this block in the reply, filled from tool output of this session, never from memory:

```
Gate proof
- integration-review: RAN | NOT RUN (<reason>) | not needed (<plan's Whole-diff review reason>)
  range <base>...<head> (literal SHAs) · report <tracked path> · Must-fix: <n> open / <n> fixed in <sha>
- review-work: RAN | NOT RUN (<reason>)
  reviewed_sha <40-hex> · plan_sha256 <hex>
  implementation-audit: <PASS|FAIL|FAIL overridden> · <agent> · <model> · trailer <path>
  strategic-risk-review: <PASS|FAIL|FAIL overridden|not run (reason)> · trailer <path>
  override: none | by <user> · <n> downgrades (<count per rule>)
  record <tracked repo-relative path> · validate-gate-record.mjs exit 0 at <HEAD sha>
- code committed after reviewed_sha: none | <shas> → gate void, re-run
```

`reviewed_sha` MUST be the record's full literal 40-hex value, and `record` MUST be its tracked repo-relative JSON path. Together they bind the stop hook to that exact gate record across linked worktrees; a different or newer record never substitutes for it. The record's `plan` path remains opaque to the hook; the validator owns file or OpenSpec change-folder interpretation.

Each line has one of four outcomes:
- passed: `RAN` with `PASS` verdicts and the record validated;
- overridden: `RAN`, every FAIL carries an override the user gave in this session, one `downgrades` entry per blocker, and the record validated; write the verdict as `FAIL overridden` and fill the override line;
- legitimately skipped: integration-review `not needed (<plan's Whole-diff review reason>)`, or strategic-risk-review `not run (<reason>)` when review-work's depth rule chose one reviewer; never for the four mandatory classes (auth/secrets/PII, schema or migration, wire contract or public API, concurrency or state machine), which always need both reviewers;
- not passed: anything else, written as `NOT RUN (<reason>)` or `FAIL`.

Only passed, overridden and legitimately skipped lines allow a merge request. If any line is neither passed, overridden, nor legitimately skipped, say so at the top of the reply and do not ask for merge approval; the `NOT RUN` wording makes the merge-gate extension read the reply as a status report, not a claim.

## What "ran in full" means

- integration-review: whole diff read, every failure mode named with an instance or "no instance found", simplification pass, plan scope walk, the reviewer dispatched with the skill's verbatim brief, a stored report, one cleanup commit for applied fixes, and a delta round after fixes. A reviewer asked "is this good?" is not the skill.
- review-work: plan frozen first (F2 `[x]`, then `plan_sha256`), each reviewer dispatched with the skill's verbatim brief, its `REVIEW-TRAILER-v1` stored unedited at a tracked path, the `team-config.merge-gate/v3` record written and staged (default path `.omp/team-config/evidence/gate/<plan-basename>.json`, any tracked path works), the validator exiting 0, re-run after the record commit.
- For an OpenSpec change folder the plan is the folder: `plan_sha256` is the digest of the bundle `GC snapshot` writes as the wave's plan copy, and the record's `mandatory_class` and `whole_diff` equal `gate.md`.

Order: integration-review, fixes, review-work. Code committed after review-work's `reviewed_sha` voids it; code committed after integration-review's last reviewed SHA needs a delta round over `<last reviewed>...<head>`.

## Failures this prevents

- Review rounds dispatched with custom checklists instead of the verbatim briefs both said PASS without trailers, so no valid gate record could exist; the verbatim round then found a real defect.
- Merge approval was requested with integration-review never run; the user had to ask whether both skills had run.
- A trailer was reformatted to make the validator pass. Never trim or edit a trailer; re-run the invocation.
