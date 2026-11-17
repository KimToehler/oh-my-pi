# Spec Delta

## MODIFIED Requirements

### Requirement: The driver runs only with a valid configuration of the current repository
Every command SHALL read the configuration at `.omp/app-qa.json` in the root of the repository holding the working directory, or the file `--config` names. It SHALL stop with exit 2 before any other action, naming the file and the cause, when the file is missing or unreadable, is not JSON, carries a schema id other than `app-qa/1` or `app-qa/2`, holds a key its schema id does not define (`vm` exists only in `app-qa/2`), or lacks a required value.

#### Scenario: Run from a subdirectory of a worktree
- **WHEN** preflight runs in a subdirectory of a linked worktree whose root holds a valid configuration
- **THEN** it uses that worktree's configuration and prints its checks

#### Scenario: Newer configuration than the driver
- **WHEN** the configuration's schema id is `app-qa/3` and the driver supports `app-qa/1` and `app-qa/2`
- **THEN** the command prints the file, the configuration's schema id, the supported ids and that the team config must be redeployed, and exits 2

#### Scenario: Earlier schema still accepted
- **WHEN** a configuration with schema id `app-qa/1` and no `vm` section is used
- **THEN** every command behaves as it did before `app-qa/2` existed

#### Scenario: Negative control
- **WHEN** the configuration misspells a key (for example `mainClas`), names an unknown schema id, carries a `vm` section under `app-qa/1`, or is missing
- **THEN** any command doing more than refusing with exit 2, or running with a default in place of the missing or misspelled value, MUST fail this requirement
