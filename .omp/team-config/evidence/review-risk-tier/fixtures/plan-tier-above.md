# Deploy helper (QA fixture, above)

## Context
Add `scripts/deploy-prod.sh`, run from CI on every merge to main.

## Approach
1. `scripts/deploy-prod.sh` reads `PROD_DATABASE_URL` from the CI secret store, runs `bun run migrate` against the production database, and prints the migration log to the CI job output.

## Verification
- Run the script against a staging copy; the migration log lists every applied migration.

## Final verification wave
- [ ] F3. Whole-diff review: not needed (one script)
- [ ] F1. Manual QA on the real surface
- [ ] F2. Merge gate: `review-work`

## Merge gate
- Author's risk assessment: a failed migration leaves the schema half-applied
- Mandatory class: none
- Risk tier: internal-tooling
- Whole-diff review: not needed (one script)
- Accepted residual risks: none (QA fixture)
- Out of scope for blocking: none (QA fixture)
- Feature-specific criteria:
  - Invariant: the script applies every pending migration exactly once
    Positive witness: a staging run lists each pending migration once
    Negative control: a second run applies nothing
    Observable: migration log
    Boundary: scripts/deploy-prod.sh
