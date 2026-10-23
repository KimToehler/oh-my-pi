# Spec Delta

## Purpose

Defines which gate record can back a merge or completion claim: its record id, how the whole-diff review report is bound to the record, and how the record validator and the session stop hook refuse a record under a retired id, wherever that record lies.

## ADDED Requirements

### Requirement: Record id
The record validator SHALL accept a gate record only when its `schema` field equals `team-config.merge-gate/v3`. Any other value, including the retired `omo.merge-gate/v1` and `omo.merge-gate/v2`, SHALL fail validation with a `schema` finding that names `team-config.merge-gate/v3`. The record body is otherwise unchanged from v2, and the record and trailer paths stay free: any tracked path inside the repository is accepted, as before.

#### Scenario: v3 record passes
- **WHEN** `validate-gate-record.mjs --repo <repo> --record .omp/team-config/evidence/gate/demo.json --plan <plan>` runs on a tracked, otherwise valid record whose `schema` is `team-config.merge-gate/v3`
- **THEN** the validator exits 0

#### Scenario: v3 record at a project's own evidence path
- **WHEN** the same tracked, otherwise valid v3 record is passed as `--record docs/evidence/demo/merge-gate.json`
- **THEN** the validator exits 0

#### Scenario: Negative control
- **WHEN** the record at `.omp/team-config/evidence/gate/demo.json` carries `"schema": "omo.merge-gate/v2"` and every other field is valid
- **THEN** validation MUST fail with a `schema` finding naming `team-config.merge-gate/v3`; an exit 0 is a defect

### Requirement: Whole-diff report binding
When `whole_diff.run` is `true`, the record validator SHALL require `whole_diff.report`, the path of a tracked file, and `whole_diff.report_sha256`, the SHA-256 of its bytes. Commits after `reviewed_sha` MAY add the report without voiding the record only when it is a `.md` file absent from the `reviewed_sha` tree, inside the record's directory, whose first line is `INTEGRATION-REVIEW-REPORT-v1`.

#### Scenario: Report committed with the record after the review
- **WHEN** the record and the report it binds are committed together on top of `reviewed_sha`, the report's bytes matching `whole_diff.report_sha256`
- **THEN** the validator exits 0

#### Scenario: Report changed after the record was written
- **WHEN** the tracked report's bytes no longer match `whole_diff.report_sha256`
- **THEN** the validator exits non-zero with a `whole_diff.report_sha256` finding

#### Scenario: Source change committed beside the report
- **WHEN** the commit that adds the bound report on top of `reviewed_sha` also changes a source file
- **THEN** the validator exits non-zero with a `reviewed_sha` finding

#### Scenario: Report added outside the record's directory
- **WHEN** a commit on top of `reviewed_sha` adds the bound report at a path outside the record's directory, its bytes matching `whole_diff.report_sha256`
- **THEN** the validator exits non-zero with a `reviewed_sha` finding

#### Scenario: New source file named as the report
- **WHEN** a commit on top of `reviewed_sha` adds a new source file inside the record's directory, and the record names it as `whole_diff.report` with its digest
- **THEN** the validator exits non-zero with a `reviewed_sha` finding

#### Scenario: Untracked report
- **WHEN** a record with `whole_diff.run` `true` names a report that exists on disk but is not tracked, with a matching `whole_diff.report_sha256`
- **THEN** the validator exits non-zero with a `whole_diff.report` finding

#### Scenario: Negative control
- **WHEN** a commit on top of `reviewed_sha` changes a source file that existed at `reviewed_sha`, and the record names that file as `whole_diff.report` with the digest of its new bytes
- **THEN** validation MUST fail with a `reviewed_sha` finding; an exit 0 is a defect

### Requirement: Validated bytes are the committed bytes
For every tracked artifact (the record, each trailer, the whole-diff report), the record validator SHALL require the working-tree and index bytes to equal the file's `HEAD` blob when the record itself equals its `HEAD` blob, and the working-tree bytes to equal the index blob otherwise, failing with a finding on that artifact's path field when they differ.

#### Scenario: Trailer differs from its staged blob
- **WHEN** the record is not yet committed, a trailer is staged, then edited in the working tree, and the record carries the digest of the edited bytes
- **THEN** the validator exits non-zero with a `verdicts.<n>.trailer_artifact` finding for that verdict

#### Scenario: Committed report differs from the bytes the record binds
- **WHEN** a commit holds report bytes A beside a record carrying the digest of bytes B, and B is then staged, so working tree and index both hold B, and the validator runs again
- **THEN** the validator exits non-zero with a `whole_diff.report` finding

#### Scenario: Staged change hidden by a restored working tree
- **WHEN** the record and its trailers are committed, a trailer is then edited and staged, and its working-tree file is restored to the committed bytes
- **THEN** the validator exits non-zero with a `verdicts.<n>.trailer_artifact` finding for that verdict

#### Scenario: Negative control
- **WHEN** the report is staged with bytes A, then edited to bytes B in the working tree, and the record carries the digest of B
- **THEN** validation MUST fail with a `whole_diff.report` finding; an exit 0 is a defect

### Requirement: Stop hook refuses a retired record id
When a reply makes a merge or completion claim, the merge-gate stop hook SHALL refuse the stop, with a reason naming `team-config.merge-gate/v3`, when a file at the Gate proof's record path holds a `schema` other than that id, wherever the path lies. This holds even when the record's reviewed SHA and exact bytes are already on the default branch, the case in which a v3 record is accepted without re-running the validator.

#### Scenario: Merged v3 record
- **WHEN** the Gate proof cites a v3 record at `.omp/team-config/evidence/gate/demo.json` whose reviewed SHA and exact bytes at that path are on the default branch
- **THEN** the stop is allowed through the settled shortcut

#### Scenario: Unmerged v2 record in a linked worktree
- **WHEN** the claim's Gate proof names `.omp/team-config/evidence/gate/demo.json` and the reviewed SHA, and that file in a linked worktree holds `omo.merge-gate/v2`
- **THEN** the stop is refused and the reason names `team-config.merge-gate/v3`

#### Scenario: Historical v2 record at its old location
- **WHEN** the Gate proof names `.omo/evidence/gate/demo.json`, an `omo.merge-gate/v2` record merged into the default branch with identical bytes, and its reviewed SHA
- **THEN** the stop is refused and the reason names `team-config.merge-gate/v3`, not "no record exists"

#### Scenario: Negative control
- **WHEN** a historical `omo.merge-gate/v2` record was moved unchanged to `.omp/team-config/evidence/gate/demo.json` (as P5b does with `git mv`), and the claim cites it with its reviewed SHA, which is on the default branch together with the record's exact bytes at that path
- **THEN** the stop MUST fail: the session is refused with a reason naming `team-config.merge-gate/v3`, and letting it stop is a defect
