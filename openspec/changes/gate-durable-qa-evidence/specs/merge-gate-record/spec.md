# Spec Delta

## ADDED Requirements

### Requirement: QA artifact binding
For every `qa[]` row, the record validator SHALL require `artifact` to name a regular file inside the repository, tracked in the index, and `artifact_sha256` to be the SHA-256 of its bytes. A row that fails this SHALL fail validation. The finding names `qa.<n>.artifact` for a path that is missing, a directory, outside the repository, ignored or untracked. It names `qa.<n>.artifact_sha256` for a digest that is absent, malformed or mismatched.

#### Scenario: QA artifact committed in the reviewed tree
- **WHEN** an otherwise valid record's every `qa[]` row names a file committed at `reviewed_sha`, with `artifact_sha256` matching its bytes
- **THEN** the validator exits 0

#### Scenario: QA artifact with binary bytes
- **WHEN** a `qa[]` row names a tracked file in the reviewed tree whose bytes are not valid UTF-8, such as a PNG, and its `artifact_sha256` is the SHA-256 of those raw bytes
- **THEN** the validator exits 0

#### Scenario: QA artifact that was never added
- **WHEN** a `qa[]` row names a file that exists on disk at a path that is not ignored but was never added to the index, with a matching `artifact_sha256`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: QA artifact names a directory
- **WHEN** a `qa[]` row names a tracked directory such as `.omp/team-config/evidence/gate/demo/f1`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: QA artifact without a digest
- **WHEN** a `qa[]` row names a tracked file and carries no `artifact_sha256`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact_sha256` finding for that row

#### Scenario: QA artifact changed after the record was written
- **WHEN** a `qa[]` row's tracked file no longer hashes to its `artifact_sha256`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact_sha256` finding for that row

#### Scenario: QA artifact missing
- **WHEN** a `qa[]` row names a path that does not exist, with a well-formed `artifact_sha256`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: QA artifact outside the repository
- **WHEN** a `qa[]` row names `../outside.md`, or a tracked symlink whose target lies outside the repository, with a matching `artifact_sha256`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: QA artifact with a malformed digest
- **WHEN** a `qa[]` row names a tracked file and carries `artifact_sha256` `"abc"`
- **THEN** the validator exits non-zero with a `qa.<n>.artifact_sha256` finding for that row

#### Scenario: QA artifact invalid in a later row
- **WHEN** a record's first `qa[]` row is valid and its second row names a git-ignored file
- **THEN** the validator exits non-zero with a `qa.1.artifact` finding

#### Scenario: Negative control
- **WHEN** the record's only `qa[]` row names a file under the git-ignored `.omp/team-config/evidence/demo/wave-1/`, present on disk with a matching `artifact_sha256`, as the guidance before this change directed
- **THEN** validation MUST fail with a `qa.0.artifact` finding; an exit 0 is a defect

### Requirement: QA artifact added after the review
Commits after `reviewed_sha` MAY add a QA artifact without voiding the record only when its file is absent from the `reviewed_sha` tree, lies below the record's evidence directory (the record path without `.json`, e.g. `.omp/team-config/evidence/gate/demo/` for `demo.json`), and matches its row's `artifact_sha256`. Any other post-review change to a file a `qa[]` row names SHALL count as a change to reviewed code.

#### Scenario: QA artifacts committed with the record after the review
- **WHEN** the record and the QA artifacts it names under `.omp/team-config/evidence/gate/demo/wave-2/` are committed together on top of `reviewed_sha`, each file absent at `reviewed_sha` and matching its digest
- **THEN** the validator exits 0

#### Scenario: QA artifacts below a non-default record's evidence directory
- **WHEN** the record is `docs/evidence/demo/merge-gate.json`, and it is committed on top of `reviewed_sha` together with the QA artifacts it names under `docs/evidence/demo/merge-gate/wave-1/`, each absent at `reviewed_sha` and matching its digest
- **THEN** the validator exits 0

#### Scenario: QA artifact added outside the record's evidence directory
- **WHEN** a commit on top of `reviewed_sha` adds a QA artifact at `.omp/team-config/evidence/gate/other/demo.md` for the record `.omp/team-config/evidence/gate/demo.json`, its bytes matching `artifact_sha256`
- **THEN** the validator exits non-zero with a `reviewed_sha` finding

#### Scenario: Source change committed beside a QA artifact
- **WHEN** the commit that adds a bound QA artifact on top of `reviewed_sha` also changes a source file
- **THEN** the validator exits non-zero with a `reviewed_sha` finding

#### Scenario: Negative control
- **WHEN** a commit on top of `reviewed_sha` changes a file that existed at `reviewed_sha` below `.omp/team-config/evidence/gate/demo/`, and a `qa[]` row of the record `demo.json` names that file with the digest of its new bytes
- **THEN** validation MUST fail with a `reviewed_sha` finding; an exit 0 is a defect

## MODIFIED Requirements

### Requirement: Validated bytes are the committed bytes
For every tracked artifact (the record, each trailer, the whole-diff report, each QA artifact), the record validator SHALL require the working-tree and index bytes to equal the file's `HEAD` blob when the record itself equals its `HEAD` blob, and the working-tree bytes to equal the index blob otherwise, failing with a finding on that artifact's path field when they differ.

#### Scenario: Trailer differs from its staged blob
- **WHEN** the record is not yet committed, a trailer is staged, then edited in the working tree, and the record carries the digest of the edited bytes
- **THEN** the validator exits non-zero with a `verdicts.<n>.trailer_artifact` finding for that verdict

#### Scenario: Committed report differs from the bytes the record binds
- **WHEN** a commit holds report bytes A beside a record carrying the digest of bytes B, and B is then staged, so working tree and index both hold B, and the validator runs again
- **THEN** the validator exits non-zero with a `whole_diff.report` finding

#### Scenario: Staged change hidden by a restored working tree
- **WHEN** the record and its trailers are committed, a trailer is then edited and staged, and its working-tree file is restored to the committed bytes
- **THEN** the validator exits non-zero with a `verdicts.<n>.trailer_artifact` finding for that verdict

#### Scenario: QA artifact differs from its staged blob
- **WHEN** the record is not yet committed, a QA artifact is staged with bytes A, then edited to bytes B in the working tree, and its row carries the digest of B
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: Committed QA artifact edited in the working tree
- **WHEN** a commit holds QA bytes A beside a record whose row carries the digest of bytes B, and the working-tree QA file is then changed to B without staging
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: Committed QA artifact staged differently from HEAD
- **WHEN** the record and a QA artifact with bytes A are committed, bytes B are then staged for the QA file, the working-tree file is restored to A, and its row carries the digest of A
- **THEN** the validator exits non-zero with a `qa.<n>.artifact` finding for that row

#### Scenario: Negative control
- **WHEN** the report is staged with bytes A, then edited to bytes B in the working tree, and the record carries the digest of B
- **THEN** validation MUST fail with a `whole_diff.report` finding; an exit 0 is a defect
