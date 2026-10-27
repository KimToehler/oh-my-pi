# Review

- **Verdict**: REJECT
- **Reviewed digest**: 62b99e7fd0636d5b037979164e91d3713bdc7797ecf190292dfc7a2008cdac52
- **Reviewer**: plan-reviewer, GdqeCorrectnessR4, GdqeVerificationR4, GdqeChecksR4
- **Round**: 4
- **Override**: none

## Blockers

### Correctness (GdqeCorrectnessR4)

[
  {
    "area": "Correctness — bootstrap and rollback",
    "defect": "The plan requires the new post-review QA exemption before deploying the validator that implements it. The existing installed validator rejects those same committed QA files, and the merge-gate hook independently invokes that installed validator for an unsettled record. Rolling back has the same incompatibility for any unmerged record written under the new rule.",
    "evidence": "tasks.md:15,20-22 writes this change's F1 artifacts under its evidence directory, cites them in F2, requires the record to validate before merge, and deploys only afterwards. review-work/SKILL.md:6,493-497 uses the installed ~/.omp validator; team-config/agent/extensions/merge-gate.ts:262-278 invokes that validator for unmerged records. The existing validator explicitly does not exempt QA paths (validate-gate-record.mjs:393-396), and its post-review diff scan rejects any changed path not pinned (397-419). Thus, once the record and new QA files are committed after reviewed_sha, the installed validator reports reviewed_sha despite the worktree implementation passing. The failed gate is recoverable, but blocks the planned merge. design.md:60-62 also claims rollback compatibility based only on the old validator ignoring the extra field; it still rejects those added QA paths.",
    "change": "Specify a pre-merge bootstrap that makes both the Phase 5 validation and the merge-gate hook use the branch's new validator, without prematurely deploying an unmerged release, and specify how rollback handles unmerged records that already rely on the new exemption."
  }
]

### Checks (GdqeChecksR4)

[
  {
    "area": "CHECK 1 — published QA evidence",
    "defect": "The plan requires unshareable captures to stay local but does not inventory protected-data holders and publication sinks, provide a shared exclusion chokepoint, or test that sensitive inputs cannot reach committed artifacts. Synthetic test data alone does not prevent a real credential or third-party data from appearing in terminal output, screenshots, command metadata, or logs. Once such a capture is committed and pushed to the public repository, disclosure is not reliably reversible.",
    "evidence": "design.md:44 extends safe-to-share handling to images and raw terminal streams and says unshareable captures stay local; tasks.md:10-11 moves wave output and visual captures into addable evidence directories and relies on inspection before citation. The existing rule at team-config/agent/skills/review-work/SKILL.md:337 names tokens, credentials, auth headers, cookies, environment dumps and PII, but the plan provides no holder/sink inventory or sentinel control.",
    "change": "Inventory sources, holders and sinks for protected data across capture, staging, records, logs and handoffs; define a shared publication boundary or justify exclusions, and add a negative control planting sentinels in each applicable input and scanning every publishable artifact."
  }
]
