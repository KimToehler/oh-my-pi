# merge-gate-record Specification

## Purpose

Defines which gate record can back a merge or completion claim: its record id, how the whole-diff review report is bound to the record, and how the record validator and the session stop hook refuse a record under a retired id, wherever that record lies.

## Requirements

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
For every tracked artifact (the record, each trailer, the whole-diff report, each QA artifact), the record validator SHALL require working tree and index to equal the file's `HEAD` blob when the record equals its `HEAD` blob, and the working tree to equal the index blob otherwise, failing with a finding on that artifact's path field when they differ. Each digest the record carries SHALL be computed over those compared bytes; the record carries no digest of itself.

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

### Requirement: QA artifact binding
For every `qa[]` row, the record validator SHALL require `artifact` to name a regular file inside the repository, tracked in the index, and `artifact_sha256` to be the SHA-256 of its bytes, else fail. Path, tracking and byte-agreement failures name `qa.<n>.artifact` and are checked first; an absent, malformed or mismatched digest names `qa.<n>.artifact_sha256`.

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
- **WHEN** a `qa[]` row's tracked file is edited and staged again after the record was written, so its working-tree and index bytes agree but no longer hash to its `artifact_sha256`
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
