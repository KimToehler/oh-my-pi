# gate-workspace-layout Specification

## Purpose

Defines where the team-config gate tooling keeps its ledger, delta artifacts and evidence inside a checkout, which of those files a repository keeps local, and which locations the shipped skills and rules point agents to.

## Requirements

### Requirement: Gate ledger location
`gate-convergence.mjs` SHALL read and append gate events only in `<repo>/.omp/team-config/ledger.jsonl`, creating it when absent. It SHALL NOT read `.omo/ulw-execute/ledger.jsonl`; a gate recorded only there is unknown to it and that file stays unchanged.

#### Scenario: First baseline creates the ledger
- **WHEN** `gate-convergence.mjs --repo <repo> --plan <plan> baseline --sha HEAD` runs in a checkout without `.omp/team-config/ledger.jsonl`
- **THEN** it prints `BASELINE <sha> recorded` and `.omp/team-config/ledger.jsonl` holds one `gate_baseline` event for that plan

#### Scenario: Negative control
- **WHEN** the checkout's only ledger is `.omo/ulw-execute/ledger.jsonl` holding a `gate_baseline` for the same plan at commit A, and `baseline --sha HEAD` runs at commit B
- **THEN** resuming the old gate MUST fail: the run prints `BASELINE` with commit B and `recorded`, writes the new ledger and leaves the old file byte-identical; printing commit A with `existing` is a defect

### Requirement: Gate delta artifact location
`gate-convergence.mjs snapshot` SHALL write each wave's snapshot and plan copy into `<repo>/.omp/team-config/gate-deltas/`, and the shipped review-work instructions SHALL direct `patch --out` and delta verdicts into that directory.

#### Scenario: Snapshot location
- **WHEN** `snapshot --lane F2` succeeds for a plan
- **THEN** its first output line is a path inside `.omp/team-config/gate-deltas/` and the printed `PLAN` copy lies in the same directory

#### Scenario: Negative control
- **WHEN** `snapshot --lane F2` runs in a checkout that has a `.omo/gate-deltas/` directory
- **THEN** a snapshot written under `.omo/gate-deltas/` MUST fail the requirement: no file there is created or changed, and a new file there is a defect

### Requirement: Repository ignore policy
In this repository, under `.omp/team-config/`, `git check-ignore` SHALL report ignored for the ledger, the `gate-deltas/` and `frontend-design/` contents and QA output under `evidence/` outside `evidence/gate/`, and SHALL report not ignored for files in `evidence/gate/`, QA output below a record's evidence directory included, unless a later repository-wide scratch pattern in `.gitignore` matches the name (e.g. `out.jsonl`), and for files under `evidence/` whose name contains `trailer`.

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

### Requirement: Shipped guidance names omp-native locations
Files under `team-config/agent/` and `team-config/seed/` SHALL name plans at `.omp/plans/`, team-config state under `.omp/team-config/` and the record id `team-config.merge-gate/v3`. No `.omo/` path, `omo.merge-gate` id or `ulw-execute` SHALL remain, except in `skills/coding-agent-sessions/` and in historical text listed in design.md. Rule globs SHALL match the new locations.

#### Scenario: Plan rules follow plans
- **WHEN** a session reads or edits `.omp/plans/demo.md`
- **THEN** the `plan-handoff`, `lesson-size-gate-to-audience` and `lesson-answer-only-about-the-worktree…` rules match that path by their globs

#### Scenario: Evidence rule follows evidence
- **WHEN** a session edits `.omp/team-config/evidence/demo/f1/qa.md`
- **THEN** the `evidence-discipline` rule matches that path by its globs

#### Scenario: Negative control
- **WHEN** a shipped file outside the allowlist still contains `.omo/plans`, `.omo/evidence`, `omo.merge-gate` or `ulw-execute`
- **THEN** the inventory check from tasks.md MUST fail: it lists that file and exits non-zero, and a clean exit is a defect
