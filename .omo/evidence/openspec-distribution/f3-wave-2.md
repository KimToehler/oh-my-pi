## Must-fix

None.

## Should-fix

None.

## Nit

None.

## Checked

### Previous review classes

- **Schema-value spelling:** Closed for the reported plain, single-quoted, and double-quoted forms. The installer strips matching quotes, and the tests cover both quoted forms without rewriting the config.
- **Newly created ignored workflow paths:** Closed at the installer and README sites. Preflight checks prospective files with `git check-ignore`; tests cover ignored config and schema files and negated matches.
- **Silently skipped CLI integration assertion:** Closed. The fresh-install test asserts that spawning OpenSpec succeeded, its exit status is zero, and its output identifies the project schema.

### Seven failure modes

1. **Duplication:** The production and test `listFiles` helpers enumerate different trees and handle entries differently; no extraction candidate found.
2. **Naming inconsistency:** `schema`, `config`, and `installer` are used consistently across the changed implementation and documentation; no instance found.
3. **Uneven API surface:** No comparable sibling public API requiring alignment found.
4. **Mixed conventions:** The Node installer and Bun CLI check use different process APIs, consistent with their documented runtime requirements; no problematic instance found.
5. **Missing or premature abstractions:** No instance found.
6. **Dead code:** Searched new installer helpers and their consumers; no unused production helper found.
7. **Doc drift:** No remaining instance found in the changed README or skill instructions.

### Scope, plan, seams, and verification

- **Surprise scope:** Changed files fit the pinned plan’s listed file groups, plus the plan and specified tests.
- **Out of scope:** No implementation found for CLI installation, config-rule merging, rewriting open changes, non-git project support, or Windows-shell support.
- **Verification checklist:** Inspected the specified test cases. The supplied wave-2 evidence records `bash-n exit=0` and `559 pass / 0 fail`, but does not identify the command behind that count; it also records an earlier formatting failure. RED evidence and results for every individual checklist command were not supplied. F1 and F2 remain unchecked in the pinned plan. No checks were run in this read-only review.
- **i18n:** No i18n keys changed.
- **Seams:** Reviewed the pin/check/deploy ordering; canonical schema, symlink and team-config deployment; project config; shared parser use; test-suite wiring; and README/SKILL descriptions. Real deployed bytes and real-surface CLI behavior remain F1 verification items.
- **Simplification pass:** No cross-slice simplification candidate found.

PASS
