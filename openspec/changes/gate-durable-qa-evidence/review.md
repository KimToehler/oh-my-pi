# Review

- **Verdict**: REJECT
- **Reviewed digest**: 51912bc96f487492af1517d4e1a004366783a62ed755639c5384b97e05911844
- **Reviewer**: plan-reviewer, GdqeCorrectnessR7, GdqeVerificationR7, GdqeChecksR7
- **Round**: 7
- **Override**: none

## Blockers

### Correctness (GdqeCorrectnessR7)

[
  {
    "area": "Correctness and lifecycle",
    "defect": "The F1 evidence commit is made after the F3 baseline, but the plan does not account for it in the convergence ledger before starting F2. In the ordinary planned sequence, F2 reports the commit as unreviewed and refuses to proceed. This is recoverable by recording the appropriate review, but blocks the stated merge path.",
    "evidence": "tasks.md:15-21 runs F3, commits the four F1 files in their own commit, then starts F2 without covering that commit. gate-convergence.mjs:181-200 marks every commit after the existing baseline unreviewed unless a delta verdict or exemption covers it; review-work/SKILL.md:409-413 reuses F3's baseline and requires GC ready before GC snapshot. The F1 artifacts are review input, so the skill's exemption for commits changing neither behavior nor review input does not apply (review-work/SKILL.md:429-435).",
    "change": "Add the applicable delta-review and ledger-recording step for the F1 evidence commit before F2 readiness, or redesign the sequence so the evidence commit is included in the F3 baseline without weakening the stated review requirements."
  }
]

### Verification (GdqeVerificationR7)

[
  {
    "area": "Quality and verification — QA artifact byte binding",
    "defect": "Task 1.2 does not require a QA-specific test using non-UTF-8 bytes or a mutation that corrupts them through text decoding. An implementation that mishandles PNG or terminal-stream bytes only on the new QA path could pass the named scenarios and F1 while rejecting valid evidence, breaking the durable-QA goal. The failure is reversible by fixing the validator, but it can block an ordinary gate.",
    "evidence": "specs/merge-gate-record/spec.md:5-6 requires the SHA-256 of artifact bytes; design.md:27 explicitly includes PNG and JSONL artifacts. tasks.md:6 requires only the 18 listed scenarios and their specified mutations; tasks.md:16 exercises four Markdown captures. The existing suite documents this exact blind spot at team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs:1670-1683: ASCII fixtures previously allowed a byte-versus-text regression to ship, and its binary test covers trailers, not QA rows.",
    "change": "Add a QA-row positive test with invalid UTF-8 bytes and a digest computed independently from raw bytes, plus a QA-only UTF-8 round-trip mutation that makes that test fail. Include it in task 1.2's test count and RED evidence checks."
  }
]

### Checks (GdqeChecksR7)

[
  {
    "area": "CHECK 1 — protected-data holders and sinks",
    "defect": "The plan introduces publication of QA captures containing possible credentials or third-party personal data, but provides no sentinel control demonstrating that those values are excluded from every published artifact. A normal QA capture can include a real cookie, token, or personal data despite the synthetic-data instruction; committing it to the public repository can irreversibly disclose it.",
    "evidence": "design.md:44–46 identifies stdout/stderr, terminal streams, screenshots, metadata, HTTP headers/cookies/bodies and logs, then relies on manual inspection and redaction before digesting. gate.md:7 explicitly states that no sentinel control guards cited QA files. The existing capture procedure writes raw terminal streams and metadata (team-config/agent/skills/visual-qa/SKILL.md:68–70).",
    "change": "Add a negative control that plants distinct synthetic sentinels in each applicable capture input, exercises the actual inspection/redaction and publication workflow, and scans every resulting published artifact and other applicable sink for zero hits. Include an appropriate image-aware check or explicitly prevent an uninspectable capture from being published."
  }
]
