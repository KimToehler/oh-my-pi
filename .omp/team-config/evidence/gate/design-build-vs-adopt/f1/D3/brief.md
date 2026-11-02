Requirement (quoted verbatim from a change's delta spec):

### Requirement: A failed search leaves the decision open

The design instruction SHALL forbid recording a failed or unreadable search as `none`. The planner SHALL retry it; if it still fails, the Decision SHALL stay open with the failed search named, and the planner SHALL ask the user before designing the mechanism.

#### Scenario: Search provider fails

- **WHEN** `web_search` returns an error on the retry as well
- **THEN** the Decision reads open with the failed search, and the planner asks the user instead of deciding build

#### Scenario: Negative control

- **WHEN** a design records `none` for a stage whose only search failed and decides build
- **THEN** review of that instruction MUST fail, because it lets a failed search pass as evidence that nothing exists

Instruction text:

~~~~text
<input-a.md or input-b.md>
~~~~

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
