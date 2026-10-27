# Review

- **Verdict**: REJECT
- **Reviewed digest**: f9da04d03338714eb6efef591c9c129d8537305591458dbd95a59eaaea34d7df
- **Reviewer**: plan-reviewer, GdqeCorrectnessR8, GdqeVerificationR8, GdqeChecksR8
- **Round**: 8
- **Override**: none

## Blockers

### Verification (GdqeVerificationR8)

[
  {
    "area": "Verification — task 1.2 RED evidence",
    "defect": "The RED check records and verifies only a nonzero `bun test` exit, not that the selected test ran and failed on the intended behavioral assertion. A scratch validator copy that cannot resolve its relative imports, or another setup failure, can produce all required nonzero exits while the unmodified implementation remains undetected. The final green run does not distinguish that situation. This makes the claimed regression proof unreliable; the damage is reversible by rerunning the controls correctly.",
    "evidence": "tasks.md:6 requires 22 lines containing only the test title, mutation name and exit code, and its Verify command accepts any positive exit. The test harness fixes the validator path relative to the test module at team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs:49-50; the validator imports sibling modules at team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:7-10, so running a copy from an unsuitable scratch location is a concrete setup-failure case.",
    "change": "Capture each RED run's output and require that exactly the named test ran and failed with the expected behavioral assertion or finding, rather than an import, setup, selection or runner error. Preserve the output alongside the generated summary."
  }
]

### Checks (GdqeChecksR8)

[
  {
    "area": "CHECK 1 — design.md decision 6; tasks.md 2.1–2.2",
    "defect": "The new publication sink has no sentinel negative control, and the inventory does not trace protected values through the processes and intermediate outputs that hold or print them. Procedural inspection alone is the proposed chokepoint, but the plan explicitly provides no control demonstrating that it prevents publication.",
    "evidence": "design.md:43-46 identifies credentials or personal data in command stdout/stderr, terminal streams, screenshots, metadata, HTTP transcripts and logs, and makes the cited artifact's commit a new public sink. gate.md:7 states that no sentinel control guards cited files. review-work/SKILL.md:337 prohibits raw credentials and PII; visual-qa/SKILL.md:68-70 captures raw terminal streams and screenshots. In an ordinary QA run, a captured token or third-party datum can be committed and published; removing it later does not erase exposed history or revoke the credential.",
    "change": "Inventory the producing processes, their inputs and stdout/stderr, intermediate files and every publication or handoff sink; identify the common protection inherited by each new path. Add a negative control planting sentinels in every applicable input field and scanning every resulting artifact and publication sink for zero hits, including a defined approach for non-text captures."
  },
  {
    "area": "CHECK 5 — design.md decision 1; tasks.md 1.2",
    "defect": "The plan reuses an artifact checker that reads the working file separately for byte agreement and for hashing, without pinning those reads to the same bytes or testing a change between them.",
    "evidence": "validate-gate-record.mjs:335-357 reads and compares the working file with the index or HEAD; validate-gate-record.mjs:247-250 then reads it again and hashes that second read. design.md:27 and tasks.md:6 propose using this path for QA artifacts. If a still-running capture updates a file between those reads, the validated digest can describe different bytes from the committed blob, defeating the stated durable-evidence binding; the audit record can be corrected later, but it can initially misrepresent the evidence.",
    "change": "Read and pin one byte snapshot, compare that same snapshot to the index/HEAD blob and hash it, or bind directly to an immutable staged blob. Add a control that changes the source between check and use and requires rejection or use of the originally verified bytes."
  }
]
