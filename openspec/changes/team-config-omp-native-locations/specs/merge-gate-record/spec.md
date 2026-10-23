# Spec Delta

## Purpose

Defines which gate record can back a merge or completion claim: its record id, and how the record validator and the session stop hook refuse a record under a retired id, wherever that record lies.

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
