## ADDED Requirements

### Requirement: Fix-delta patches leave out gate evidence

`gate-convergence.mjs patch` SHALL write one patch per commit of `<base>..<head>`, holding its header and every hunk
of a file outside `.omp/team-config/evidence/` and none under it. Those hunks SHALL go to an evidence file beside the
patch, which SHALL end with a listing of each changed evidence directory, its file count and lines, and that file's
name. The manifest SHALL record the left-out directory and each evidence file, and the delta brief SHALL say all this.

#### Scenario: Commit that mixes a fix with a capture

- **WHEN** `patch` covers a commit that changes `src/engine.kt` and adds `.omp/team-config/evidence/gate/demo/f1/logcat.txt`
- **THEN** its patch holds the `src/engine.kt` hunks and no line of `logcat.txt`, and ends with a listing that names `.omp/team-config/evidence/gate/demo/f1/` with 1 file and the capture's added lines and names the commit's evidence file, which holds the `logcat.txt` hunk and no `src/engine.kt` line

#### Scenario: Evidence-only commit

- **WHEN** `patch` covers a commit that changes only files under `.omp/team-config/evidence/`
- **THEN** the commit keeps its numbered patch file and manifest entry, the patch holds its commit header and the listing only, and its evidence file holds every hunk of the commit

#### Scenario: Range without evidence

- **WHEN** `patch` covers commits that change no file under `.omp/team-config/evidence/`
- **THEN** each patch has the same bytes as `git show --format=fuller --no-renames --patch <sha>`, ends with no listing, and no evidence file is written

#### Scenario: Negative control

- **WHEN** `patch` covers a commit that changes `src/engine.kt` and a file under `.omp/team-config/evidence/`, and its patch lacks the `src/engine.kt` hunks or holds a line of the evidence file
- **THEN** the requirement MUST fail

### Requirement: A delta directory verifies against the patch form its manifest names

`gate-convergence.mjs delta` and `accept` SHALL recompute each patch of a delta directory in the form its manifest
names: the full `git show` patch without a `left_out` key, and the evidence-elided form with its evidence files when
`left_out` is exactly `.omp/team-config/evidence/`. Any other `left_out` value, and an evidence file that differs, is
missing or is not expected, SHALL be refused as changed since dispatch, with nothing appended to the ledger.

#### Scenario: Directory written by the new patch

- **WHEN** `patch` writes a range holding a commit that mixes a fix with a capture and an evidence-only commit, `delta` records a REJECT from it, and `accept` runs on the same directory
- **THEN** its manifest's `left_out` is `.omp/team-config/evidence/`, `delta` records the verdict and `accept` records `accepted-risk`

#### Scenario: Delta directory written before the change

- **WHEN** a delta directory holds full patches and a manifest without a left-out field, as `patch` wrote them before this change, and `delta` runs on it with a structured verdict
- **THEN** the patches verify, `delta` records the verdict, and after a REJECT `accept` records `accepted-risk`

#### Scenario: Patch edited after dispatch

- **WHEN** a patch file or an evidence file of a delta directory written in the new form is changed after `patch` wrote it
- **THEN** `delta` refuses it as changed since dispatch and the ledger is unchanged

#### Scenario: Negative control

- **WHEN** a manifest names `src/` as its left-out directory, with patches recomputed to match that form, and `delta` runs on it
- **THEN** recording that verdict MUST fail: `delta` refuses the manifest and the ledger is unchanged
