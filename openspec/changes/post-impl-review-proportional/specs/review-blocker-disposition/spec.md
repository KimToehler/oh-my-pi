# Spec Delta

## MODIFIED Requirements

### Requirement: One disposition definition for the post-implementation lanes

The disposition rules SHALL be stated once, in the `Blocker disposition` section of the `review-work` skill, for F2 (Phase 4, fix waves and the budget ask), F2 delta reviews and an on-demand `integration-review`. `integration-review/SKILL.md` SHALL reference it through `skill://review-work`, add only its lane's decision points, and treat every blocker as not eligible when the section cannot be read, telling the user once per review. Plan review of `omp-gated` changes SHALL NOT apply it.

#### Scenario: F3 reads the shared definition

- **WHEN** the STOP of an on-demand `integration-review` (ledger lane F3) decides whether a Must-fix class may be frozen, in the default agent directory or a profile
- **THEN** it applies the `Blocker disposition` section of the `review-work` skill installed in the active agent directory

#### Scenario: Budget ask reads the shared definition

- **WHEN** an F2 gate asks the user after its fix-round budget is spent
- **THEN** each open blocker is shown with its disposition under the `Blocker disposition` section, and Override is recommended only when every open blocker is eligible or covered

#### Scenario: Plan review does not apply the definition

- **WHEN** the `omp-gated` review instruction handles a plan-review finding
- **THEN** it uses the verifier triage of `openspec-plan-review` and decides no Accept eligibility

#### Scenario: Section cannot be read

- **WHEN** an F2 decision or the `integration-review` STOP cannot read the `Blocker disposition` section
- **THEN** every blocker is handled as not eligible, `integration-review` offers no freeze, and the instruction tells the user once per review that the section was unreadable and Accept is off

#### Scenario: Negative control

- **WHEN** `integration-review/SKILL.md` states its own eligibility test, exclusion list or ambiguity default, or the `omp-gated` review instruction applies Accept eligibility to a plan-review finding
- **THEN** review of that instruction MUST fail
