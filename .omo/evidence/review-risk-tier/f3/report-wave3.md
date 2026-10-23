## Must-fix

None found.

## Should-fix

- `team-config/agent/skills/review-work/scripts/plan-contract.mjs:4` — `SECTION_PATTERN` is exported, but its only code consumer is `mergeGateSection` in the same module. This unnecessarily exposes an implementation detail; it does not block because the approved plan explicitly calls for the named export and no incorrect behavior follows.  
  **Fix:** Consider making the constant module-private if the plan’s export requirement is relaxed.  
  **Class:** unused exported surface. **Single instance:** tree-wide search with `functions.grep` pattern `SECTION_PATTERN` found no import or external consumer of this constant; the other matches are unrelated constants.

## Nit

None.

## Checked

1. **Duplication across slices/files:** No problematic instance found. Both scripts consume the shared plan parser rather than maintaining separate copies.
2. **Naming inconsistency:** No instance found among the three cross-slice concepts checked: *Risk tier*, *pinned plan copy*, and *fix rounds*.
3. **Uneven API surface:** The internal-tooling reviewer-set and mandatory-class checks are consistently enforced in full validator mode; no conflicting sibling API found.
4. **Mixed conventions:** No problematic instance found. `retier` intentionally uses `readLedger` rather than `gateState`, because the tier mismatch is its entry condition.
5. **Missing or premature abstractions:** The unused `SECTION_PATTERN` export is noted above; no cross-slice duplication warranting another abstraction found.
6. **Dead code:** The new parser functions and convergence helpers have production consumers. The exported constant has no external consumer, as noted above.
7. **Doc drift:** No blocking instance found in the checked tier vocabulary, credential classification, cap, snapshot output order, or reviewer plan-path instructions.

- **Surprise scope and plan files:** The changed-file inventory is confined to the plan, the named team-config scripts, tests, skills, rules, and extension comment. No implementation of the plan’s excluded OpenSpec-folder or bundled plan-reviewer-prompt work appears in the diff; legacy state is explicitly outside the blocking scope.
- **Verification walk:** The supplied evidence records red tests, a 444-test green run, the cap mutation failure, both CLI smokes, and the installed-surface branch/control and dependency-loss trials. The plan’s final F3/F1/F2 wave remains pending, and the installer check is explicitly post-merge; I did not run checks myself.
- **i18n:** No locale keys were added or changed.
- **Seams:** Checked the shared parser and both consumers; validator tier and reviewer rules; baseline/retier/cap state; pinned-copy production and wave checks; and skill instructions against the CLI’s output order and vocabulary.
- **Simplification pass:** The unused exported constant is the only candidate found.

PASS
