# Review

- **Verdict**: REJECT
- **Reviewed digest**: fd28d908063ffdb84310b41821ebecb9d00e956815cec9009be958c2e6da1ceb
- **Depth**: risky
- **Reviewer**: plan-reviewer, GdeD3
- **Verifier**: blocker-verifier, none
- **Models**: GdeD3 onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: triage
- **Override**: none

## Blockers

### Fix delta (GdeD3)

1. **Area**: PROCESS 4 — correctness / executability, task 3.1
   **Defect**: Normal execution of s1-mixed now retains the omitted evidence inside the measured directory, so a correct implementation cannot satisfy its required “under 1 MB” observation. The delta reduces mandatory reading, not total artifact size. This blocks honest completion of the planned value proof; the contradiction is reversible before implementation.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/design.md:55-59 adds <NNN>.evidence.patch beside each numbered patch and puts every omitted evidence hunk into it. proposal.md:8-10 states that the selected range contains 10 MB of patches, with only 251 KB outside evidence. However, tasks.md:19 still requires s1-mixed to capture “du -b of the directory (the observation: under 1 MB, against 10 MB before)”. Moving those evidence hunks into sidecars within that directory preserves approximately the original total bytes rather than reducing them below 1 MB.
   **Change**: Measure the mandatory reading set explicitly: manifest plus the numbered files referenced by commits[].patch, excluding commits[].evidence. Apply the under-1-MB expectation to that set, and report total directory bytes separately without claiming they shrink. Update s1-mixed's command and expected observation accordingly; retain the historical-evidence sidecars and m4 lookup proof.
   **Triage**: not triaged: the verifier has not returned

## Residuals

- Round 1 (GdeR1A, GdeR1B; triage GdeV1): four findings confirmed blocking and fixed in commit after 4983a1188d (one LEFT_OUT_DIR spelling, new-form round trip, exact brief check, head-bound F1 rows).
- Round 2 (GdeR2A, GdeR2B; triage GdeV2): three findings confirmed blocking (reviewer cannot run git to read left-out evidence; no real-session check of that lookup; RED rule contradicts preservation guards); budget spent, the user answered the exhaustion ask with Fix (2026-11-13); fixed in the commit after 8c863d829c.
