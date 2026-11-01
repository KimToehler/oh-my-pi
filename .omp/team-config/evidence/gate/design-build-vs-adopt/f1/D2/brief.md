Requirement (quoted verbatim from a change's delta spec):

### Requirement: A covered mechanism brings design.md

The design instruction SHALL list introducing a covered mechanism, whether it is built, adopted or reused, as a reason to create `design.md`, even when the change stays inside one module and meets no other reason.

#### Scenario: Single-module checksum

- **WHEN** a change inside one module adds a CRC-32 checksum and meets no other reason for `design.md`
- **THEN** the planner creates `design.md` with a `Build vs. adopt` decision for the checksum

#### Scenario: Negative control

- **WHEN** the reasons for `design.md` omit covered mechanisms, so a single-module checksum change skips `design.md`
- **THEN** review of that instruction MUST fail

Instruction text:

~~~~text
<input-a.md or input-b.md>
~~~~

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
