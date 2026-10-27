# Spec Delta

## MODIFIED Requirements

### Requirement: Repository ignore policy
In this repository, under `.omp/team-config/`, `git check-ignore` SHALL report ignored for the ledger, the `gate-deltas/` contents, the `frontend-design/` contents and QA output under `evidence/` outside `evidence/gate/`, and SHALL report not ignored for files in `evidence/gate/`, including QA output below a record's evidence directory, except a file whose name a later repository-wide scratch pattern in `.gitignore` matches (e.g. `out.jsonl`), and for files under `evidence/` whose name contains `trailer`.

#### Scenario: Addable gate outputs
- **WHEN** `git check-ignore -q` runs on `.omp/team-config/evidence/gate/demo.json` and `.omp/team-config/evidence/demo/f2/trailer-implementation-audit.txt`
- **THEN** both exit 1 (not ignored)

#### Scenario: Addable QA output below a record's evidence directory
- **WHEN** `git check-ignore -q` runs on `.omp/team-config/evidence/gate/demo/wave-1/terminal.png` and `.omp/team-config/evidence/gate/demo/f1/a-new-guidance.md`
- **THEN** both exit 1 (not ignored)

#### Scenario: Scratch-named QA output stays ignored
- **WHEN** `git check-ignore -q` runs on `.omp/team-config/evidence/gate/demo/f1/out.jsonl`
- **THEN** it exits 0 (ignored)

#### Scenario: Local QA output
- **WHEN** `git check-ignore -q` runs on `.omp/team-config/evidence/demo/wave-1/terminal.png`
- **THEN** it exits 0 (ignored)

#### Scenario: Negative control
- **WHEN** `git check-ignore -q` runs on `.omp/team-config/ledger.jsonl` and `.omp/team-config/gate-deltas/F2-x-wave-1.snapshot.json`
- **THEN** making either one addable MUST fail: both commands exit 0 (ignored), and an exit 1 on either is a defect
