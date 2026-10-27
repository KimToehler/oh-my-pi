# Review

- **Verdict**: REJECT
- **Reviewed digest**: 479c8a40e8aa99b6cb453b14002631b5b78c0d7fd516a50008e3d6862d9a7e07
- **Reviewer**: plan-reviewer, GdqeCorrectnessR6, GdqeVerificationR6, GdqeChecksR6
- **Round**: 6
- **Override**: none

## Blockers

### Verification (GdqeVerificationR6)

[
  {
    "area": "Task 1.1 / 1.2 order and 1.1 Verify",
    "defect": "1.1's tests need a scratch harness that only 1.2 migrates, so they cannot pass, or pass for the wrong reason, when 1.1 is verified. The pre-1.2 harness gives every record a default QA row that points at an untracked, nonexistent path with no digest. The migration is assigned to 1.2 (\"Migrate every fixture ... and every scratch record\"), after the 1.1 Verify.",
    "evidence": "fixtures/pass.json:39 gives `artifact: .omp/team-config/evidence/review-work/validator-tests.txt` and no digest. test.mjs:989-1014 `scratchArtifacts` creates no QA file and no digest, and `scratchRepo` (974-987) has no .gitignore. Without migration, the positive scenarios (reviewed tree, committed with the record after the review, non-default evidence directory) cannot exit 0. The negative scenarios (directory, missing digest, malformed digest, digest mismatch) would all fail on the harness's own `qa.0.artifact` (nonexistent path), not on the field under test. The plan's rule that each scenario \"must be seen failing against the unchanged validator\" therefore proves nothing about the cause.",
    "change": "Move the shared-helper migration (`scratchArtifacts`, `rebind`, a way to set the record path and a `.gitignore` for ignored-path scenarios) into a task that runs before 1.1's scenario tests, or put it into 1.1 and keep only the per-fixture JSON migration in 1.2. 1.1's Verify must run on a harness whose default QA row is valid."
  },
  {
    "area": "Task 1.1 Verify",
    "defect": "The only Verify is `bun test ... -t \"QA artifact\"`. Nothing in it fails if one of the 18 scenario tests is missing, misnamed, or has a weak assertion. The per-scenario discrimination, including the 7 scratch mutations, exists only as prose \"recorded in the commit message\", which no command checks.",
    "evidence": "tasks.md 1.1: the command ends at `-t \"QA artifact\"`. A run with 17 of 18 tests, or with none (a filter that matches nothing), still reports passes. The task lists 14 'seen failing on the unchanged validator' scenarios, 4 scratch-mutation scenarios and 3 byte-comparison mutations, yet the command asserts no count or title list.",
    "change": "Add a mechanical check to Verify: for example, assert that the 18 expected scenario titles each appear in the test file (`grep -c '^test(\"QA artifact'` equals 18) and in the `-t` output. Make the mutation evidence checkable, for example a committed evidence file listing each mutation and its failing test, or drop the claim from Verify."
  },
  {
    "area": "Task 2.1 Verify",
    "defect": "The 2.1 Verify does not check two of the edits it lists, (a) and (f), and has no positive check for (h). A stale copy there passes Verify, and the design says a stale guidance text fails only at Phase 5, after the reviewers have already run.",
    "evidence": "(a) is the opening notes. SKILL.md:16 says \"The record and every trailer must be staged before validating\", and the Verify has no grep for it. (f) is the field-rules paragraph; SKILL.md:483 says \"every row must name a non-empty `artifact`\" with no digest, and the Verify has no grep for it. (h) is only a negative grep for 'binds the plan and every trailer artifact', so any other wording passes. design.md decision 4 says a stale text 'now fails only at Phase 5'.",
    "change": "Add Verify clauses that fail on the old text and pass only on the new one: (a) the notes name the record's evidence directory or `artifact_sha256`; (f) the field-rules paragraph requires `artifact_sha256` per row; (h) a positive grep for QA artifacts in the validator summary."
  },
  {
    "area": "Task 3.1 Verify",
    "defect": "3.1 is F3 'fixes delta-reviewed'. Its Verify checks only the report's first line. A report that ends in FAIL, or one never recorded with `GC wave`, still passes.",
    "evidence": "tasks.md 3.1 Verify: `test \"$(head -n 1 .../f3-integration-review-report.md)\" = INTEGRATION-REVIEW-REPORT-v1`. integration-review SKILL, Step 4: the verdict is the last line of the report, bare PASS or FAIL, and `FAIL` means a Must-fix remains. The 3.2 Verify, by contrast, does check `RESULT PASS`.",
    "change": "Extend the Verify: `test \"$(tail -n 1 report)\" = PASS`, and ideally `GC ready --lane F3` / the ledger showing `f3=PASS` for the final head."
  }
]

### Checks (GdqeChecksR6)

[
  {
    "area": "CHECK 1 — QA publication boundary",
    "defect": "The new public-history sink has no negative control demonstrating that protected data is removed from every cited artifact before publication.",
    "evidence": "design.md:44-46 makes manual inspection and redaction the publication boundary for command output, screenshots, terminal streams, metadata, HTTP transcripts and logs; gate.md:7 explicitly says no sentinel control guards cited QA content. A normal capture can contain a real credential or third-party data, and publishing it in repository history can cause irreversible disclosure.",
    "change": "Add a sentinel-based negative control covering each applicable capture/input type and all publication artifacts, including image and terminal evidence; demonstrate that the actual inspection/redaction procedure prevents every planted value from reaching the commit."
  },
  {
    "area": "CHECK 8 — Visual QA storage default",
    "defect": "The new visual QA storage path relies on RECORD_EVIDENCE_DIR without specifying how it is set or what standalone visual QA should do when there is no gate record.",
    "evidence": "tasks.md:11 replaces both storage and the tui-check input with $RECORD_EVIDENCE_DIR but defines only what the variable means. team-config/agent/skills/visual-qa/SKILL.md:2-14 makes visual QA applicable to any UI change or requested visual check, not only a merge-gate run. In a normal standalone invocation with the variable unset, the prescribed path becomes /tui-web-terminal/, potentially failing at the filesystem root and breaking evidence capture; the failure is reversible.",
    "change": "Define an explicit, reported evidence directory for standalone visual QA and provide a safe local default or require and validate an explicit choice before capture; retain the record-derived directory for gate runs."
  }
]
