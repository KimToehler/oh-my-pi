# Review

- **Verdict**: REJECT
- **Reviewed digest**: c15d2022f9ab924579683df299ba4c22dc3955d920374da3360c92fc5050e067
- **Reviewer**: plan-reviewer, GdqeCorrectnessR5, GdqeVerificationR5, GdqeChecksR5
- **Round**: 5
- **Override**: none

## Blockers

### Verification (GdqeVerificationR5)

[
  {
    "area": "Verification — committed QA bytes",
    "defect": "Task 1.1 adds only the uncommitted-record staged-versus-working-tree QA test. It does not test either committed-record HEAD comparison for QA artifacts, although the modified requirement applies both comparisons to every QA artifact.",
    "evidence": "openspec/changes/gate-durable-qa-evidence/specs/merge-gate-record/spec.md:71-72 requires working-tree and index bytes to equal HEAD when the record is committed; tasks.md:5 names only the new scenario where an uncommitted record has a staged QA artifact edited afterwards. Existing committed-HEAD controls at team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs:2486-2504 exercise a report and a trailer, not a QA row. Thus a QA-specific regression that skips the HEAD check can pass all the specified QA tests; a normal post-record stage or edit can leave the published audit evidence different from the verified bytes. The mismatch is reversible, but the audit trail is affected.",
    "change": "Add QA-specific committed-record tests for index and working-tree differences from HEAD, with the row digest matching the bytes being checked, and demonstrate that each fails when the corresponding QA HEAD comparison is disabled."
  },
  {
    "area": "Verification — F3 whole-diff review",
    "defect": "The plan skips F3 despite changing at least three modules/layers, contrary to the repository's whole-diff gate rule. This leaves the validator, review-work guidance, and other authoring and capture surfaces without the required composition review.",
    "evidence": "openspec/changes/gate-durable-qa-evidence/gate.md:6 declares whole-diff review not needed; tasks.md:5-11 changes the validator, review-work skill, plan rule, OpenSpec template, README, gate-layout and visual-qa skill. team-config/agent/rules/plan-merge-gate.md:26 specifies whole-diff review is needed when a change spans 3+ modules/layers. A mismatch between any guidance surface and the new validator can cause ordinary gates to fail after review or produce evidence at the wrong location; this is recoverable but breaks the cutover goal.",
    "change": "Add F3 integration-review over the whole committed diff before F1, including its report, verdict, and evidence check; change the gate classification to whole-diff review needed."
  }
]

### Checks (GdqeChecksR5)

[
  {
    "area": "CHECK 1 — QA evidence publication",
    "defect": "The plan relies on manual inspection and redaction but provides neither the required complete holder-and-sink inventory nor a sentinel negative control. A normal QA capture can contain a real credential or third-party personal data despite synthetic test inputs—for example, an HTTP transcript with an ambient authorization header or terminal output containing environment-derived data. Staging and merging that capture publishes it into repository history; the disclosure may be irreversible.",
    "evidence": "design.md:44-46 identifies terminal streams, screenshots, metadata, HTTP transcripts and logs but treats wave directories as the holders and the evidence commit as the only new sink; tasks.md:9-10 prescribes inspection and redaction, not a sentinel control. Existing review guidance explicitly forbids raw credentials, auth headers, cookies, environment dumps and PII (team-config/agent/skills/review-work/SKILL.md:337). gate.md:7 explicitly accepts that no sentinel control guards cited QA files.",
    "change": "Search all capture inputs, holders and sinks, including subprocess stdout/stderr and review handoffs; establish a named publication chokepoint or justify each exclusion. Add a negative control that plants a sentinel in every applicable input field and scans every resulting artifact for zero hits, including the outputs that can be staged."
  }
]
