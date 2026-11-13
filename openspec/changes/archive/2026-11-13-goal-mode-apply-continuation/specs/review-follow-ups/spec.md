# Spec Delta

## MODIFIED Requirements

### Requirement: The bump procedure names every team addition to the generated commands
The README's OpenSpec bump procedure SHALL name each team addition to the generated `opsx-*.md` commands (command, step, title) and SHALL tell the maintainer to re-apply all of them after regenerating, so a bump cannot silently drop the follow-up steps.

#### Scenario: Bump after this change
- **WHEN** a maintainer follows the procedure for a new OpenSpec version
- **THEN** it names the `opsx-apply.md` worktree step, the `opsx-archive.md` follow-up step, the `opsx-propose.md` follow-up step and the `opsx-propose.md` goal-mode continuation as the expected diff and the steps to re-apply

#### Scenario: Negative control
- **WHEN** the procedure names the three follow-up and worktree additions but not the goal-mode continuation
- **THEN** that procedure MUST fail the requirement
