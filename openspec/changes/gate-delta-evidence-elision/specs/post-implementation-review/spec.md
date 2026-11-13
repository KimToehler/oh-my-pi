## ADDED Requirements

### Requirement: Fix-delta patches leave out gate evidence

`gate-convergence.mjs patch` SHALL write one patch per commit of `<base>..<head>`, holding its header and every hunk
of a file outside `.omp/team-config/evidence/` and none under it. A patch whose commit changes evidence SHALL end with a
listing of each changed evidence directory, its file count and lines, and the command that shows one file. The
manifest SHALL record the left-out directory, and the delta brief of `review-work` SHALL say all of this.

#### Scenario: Commit that mixes a fix with a capture

- **WHEN** `patch` covers a commit that changes `src/engine.kt` and adds `.omp/team-config/evidence/gate/demo/f1/logcat.txt`
- **THEN** its patch holds the `src/engine.kt` hunks and no line of `logcat.txt`, and ends with a listing that names `.omp/team-config/evidence/gate/demo/f1/` with 1 file and the capture's added lines

#### Scenario: Evidence-only commit

- **WHEN** `patch` covers a commit that changes only files under `.omp/team-config/evidence/`
- **THEN** the commit keeps its numbered patch file and manifest entry, and the patch holds its commit header and the listing only

#### Scenario: Range without evidence

- **WHEN** `patch` covers commits that change no file under `.omp/team-config/evidence/`
- **THEN** each patch has the same bytes as `git show --format=fuller --no-renames --patch <sha>` and ends with no listing

#### Scenario: Negative control

- **WHEN** `patch` covers a commit that changes `src/engine.kt` and a file under `.omp/team-config/evidence/`, and its patch lacks the `src/engine.kt` hunks or holds a line of the evidence file
- **THEN** the requirement MUST fail

### Requirement: A delta directory verifies against the patch form its manifest names

`gate-convergence.mjs delta` and `accept` SHALL recompute each patch of a delta directory in the form its manifest
names: the full `git show` patch when the manifest has no left-out directory, and the form of "Fix-delta patches leave
out gate evidence" when it names `.omp/team-config/evidence/`. A manifest that names any other left-out value SHALL be
refused as changed since dispatch, and nothing SHALL be appended to the ledger.

#### Scenario: Delta directory written before the change

- **WHEN** a delta directory holds full patches and a manifest without a left-out field, as `patch` wrote them before this change, and `delta` runs on it with a structured verdict
- **THEN** the patches verify and the verdict is recorded

#### Scenario: Patch edited after dispatch

- **WHEN** a patch file of a delta directory written in the new form is changed after `patch` wrote it
- **THEN** `delta` refuses it as changed since dispatch and the ledger is unchanged

#### Scenario: Negative control

- **WHEN** a manifest names `src/` as its left-out directory, with patches recomputed to match that form, and `delta` runs on it
- **THEN** recording that verdict MUST fail: `delta` refuses the manifest and the ledger is unchanged
