# Review

- **Verdict**: REJECT
- **Reviewed digest**: bef60e87df79b3cd16a5dd0379f83afc71ac8314511716e4ff95eca9a017df67
- **Reviewer**: plan-reviewer, GdqeCorrectnessR9, GdqeVerificationR9, GdqeChecksR9
- **Round**: 9
- **Override**: none

## Blockers

### Correctness (GdqeCorrectnessR9)

[
  {
    "area": "Correctness: QA finding precedence",
    "defect": "The binding requirement demands a digest-field finding whenever a tracked artifact no longer matches its recorded digest, while the committed-bytes requirement demands a path-field finding when those same working-tree bytes differ from the index or HEAD. The planned validator checks the path comparison first and stops at the first finding.",
    "evidence": "specs/merge-gate-record/spec.md:6,28-30 require qa.<n>.artifact_sha256 for a digest mismatch; spec.md:77-78 requires qa.<n>.artifact for a working-tree/index mismatch. For a staged QA file edited after its digest was recorded, both conditions hold. validate-gate-record.mjs:249-250 calls assertTracked before hashing, and :346-369 blocks on the path field first. The result is a reversible but ordinary edit state that cannot meet the stated scenario.",
    "change": "Define precedence explicitly: restrict the digest-mismatch scenario to bytes that pass the index/HEAD comparison, or change the contract and implementation to report both findings. Align the scenario and requirement with the chosen behavior."
  }
]

### Verification (GdqeVerificationR9)

[
  {
    "area": "Task 1.1 (Verify and its premise)",
    "defect": "1.1 says the harness migration is done before the validator changes and that \"the unchanged validator ignores `artifact_sha256`, so the whole file passes on it\". That holds only if the migrated QA files are already in the reviewed tree. 1.1 has `scratchArtifacts` write each QA file \"below the record's evidence directory\" and \"stage\" it, and `scratchArtifacts` takes `reviewed_sha` from the HEAD that exists before that file. Existing scratch tests then commit everything with `git add -A; git commit` after `scratchArtifacts` and revalidate. The QA file therefore arrives in a post-review commit. The unchanged validator does not pin QA paths, so `commitsTouchOnlyEvidence` returns false and blocks with a `reviewed_sha` finding. Tasks 1.2 and the spec's added-after-review requirement rely on exactly this: a post-review QA file is rejected by the old validator. Every scratch test that commits evidence and expects exit 0 fails on 1.1's own Verify, so 1.1 cannot be completed as written.",
    "evidence": "validate-gate-record.mjs:397-428: `changed.every((file) => evidencePaths.has(file))`, and `context.pinned` holds no QA path today (the comment at :393-396 says QA is deliberately not exempt). validate-gate-record.test.mjs:989-1019: `scratchArtifacts` takes `reviewed_sha: git(\"rev-parse\", \"HEAD\")` and stages the artifacts without committing. Tests at :1023-1030, :1038-1046 and :1061-1081 commit with `git add -A` and then expect exit 0 or a specific finding. tasks.md 1.1: \"`scratchArtifacts` writes each default QA row's file below the record's evidence directory, stages it ... The unchanged validator ignores `artifact_sha256`, so the whole file passes on it.\" tasks.md 1.2 itself lists \"committed with the record after the review\" among the scenarios that fail on the unchanged validator, which contradicts 1.1's claim.",
    "change": "Make 1.1 match what the unchanged validator accepts. For example, have the default scratch harness commit the QA files before it takes `reviewed_sha`, so they sit in the reviewed tree. Only the new 1.2 scenario tests then add QA after the review, and those are expected to fail until the validator changes. Alternatively, drop the claim that the whole file is green on the unchanged validator and name which existing tests are expected to fail until 1.2, scoping 1.1's Verify to the tests that stay green. Say explicitly how the sandbox-based tests (`run()` with `fixtures/*.json`) get their QA file committed into `sandboxHead`."
  }
]

### Checks (GdqeChecksR9)

[
  {
    "area": "CHECK 1 — publication of QA evidence",
    "defect": "The plan introduces a public, durable sink for potentially sensitive QA output but supplies neither a complete holder/sink inventory nor the required sentinel negative control. Procedural inspection does not demonstrate that every path to publication is covered.",
    "evidence": "design.md:44-46 identifies screenshots, command output, HTTP transcripts and logs as possible protected-data sources, but lists only wave/f1 directories as holders and omits command processes and their stdout/stderr as holders and sinks. tasks.md:6 additionally writes complete test output into tracked RED files without including those files in the cited-artifact inspection step. gate.md:7 explicitly says there is no sentinel control. Ordinary QA can encounter a real credential or third-party data; committing it to a public repository exposes a protected asset and cannot reliably be reversed from history or clones.",
    "change": "Search and inventory every holder and sink, including capture processes, stdout/stderr, RED logs and all committed artifacts; establish a publication chokepoint inherited by every new path or justify exclusions. Add a negative control planting sentinels in every relevant input field and scanning all publication artifacts for zero hits."
  },
  {
    "area": "CHECK 5 — validated artifact bytes",
    "defect": "The single-read change lacks the required control that mutates the source between comparison and subsequent digest/use. The structural grep does not prove the checked bytes are the bytes actually hashed for every tracked artifact.",
    "evidence": "specs/merge-gate-record/spec.md:77-78 requires the same bytes to be compared and hashed; tasks.md:7 explicitly substitutes a source-text check and unchanged suite for a change-between-reads control. The existing validator reads tracked bytes in assertTracked and then reads the path again for hashing (team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:238-250, 335-347). A capture still being written during validation is the scenario identified in design.md:28; accepting a digest for different bytes breaks the committed-evidence criterion, although the repository state is repairable.",
    "change": "Add a deterministic control, using an injectable filesystem seam or an equivalent synchronization mechanism, that changes the artifact after comparison and asserts rejection or hashing of the original verified bytes. Exercise the shared path for QA and existing tracked artifacts."
  }
]
