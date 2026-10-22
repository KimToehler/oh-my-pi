## Must-fix

None.

## Should-fix

- **`team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs:428–431` — The recorded RED run stops at the new `STALE` stdout assertion before it exercises the stale-freeze refusal.** Consequently, `red-f2w2-b2.txt` proves that the prior script lacked the warning, but not that the committed test would detect the missing freeze guard independently. This does not block the delta: the guard is present in the reviewed code, and the test exercises it in the passing path.  
  **Fix:** Run the committed test against a version with only the freeze guard removed, or separate the warning and refusal assertions into independently discriminating tests; retain the resulting RED output.  
  **Single instance:** The delta has one test containing this warning-before-guard assertion sequence; I searched the convergence tests for `STALE .*wave|predates the retier`.

## Nit

None.

## Checked

- **Duplication across slices/files:** No instance found in the delta.
- **Naming inconsistency:** No instance found; *lane*, *wave*, and *retier* are consistent across the changed code, tests, and prose.
- **Uneven API surface:** No instance found; the new guards apply to both F2 and F3.
- **Mixed conventions:** No instance found.
- **Missing or premature abstractions:** No instance found.
- **Dead code:** No instance found; the added locals and test helper parameter are used.
- **Doc drift:** No instance found for the changed guards and stale-wave warning.
- **Surprise scope and plan walks:** The four changed files fit the delta assignment; no excluded implementation was found. No i18n keys were added. The supplied plan’s post-merge installation remains a future step. The evidence inventory contains suite, smoke, RED, and installed-reviewer artifacts; the QA matrix’s latest combined witness identifies an earlier head, so it does not establish a final-head rerun for this delta.
- **Seams:** Checked the changed retier/decide state transitions, F2/F3 tests, and review-work instructions. The parser, validator, snapshot format, tier vocabulary, and auth definition were not changed by this delta. The validator’s lack of ledger enforcement is expressly accepted as residual risk in the brief.
- **Simplification pass:** No cross-slice simplification candidate found in the delta.

PASS
