# Docs link check (QA fixture, below)

## Context
Add `scripts/check-docs-links.ts`, a local developer script that reports broken relative links in `docs/**/*.md`.

## Approach
1. `scripts/check-docs-links.ts` walks `docs/**/*.md`, resolves every relative link against its file's directory, prints `file:line target` for each missing target, and exits 1 when any is missing, else 0.

## Verification
- A docs tree with one broken link prints that link and exits 1; after the fix it exits 0.

## Final verification wave
- [ ] F3. Whole-diff review: not needed (one script)
- [ ] F1. Manual QA on the real surface
- [ ] F2. Merge gate: `review-work`

## Merge gate
- Author's risk assessment: a false report costs a developer a minute; nothing ships
- Mandatory class: none
- Risk tier: internal-tooling
- Whole-diff review: not needed (one script)
- Accepted residual risks: links inside HTML blocks are not checked
- Out of scope for blocking: absolute URLs
- Feature-specific criteria:
  - Invariant: every broken relative link is reported with its file and line
    Positive witness: one broken link gives one report line and exit 1
    Negative control: a tree without broken links exits 0 with no output
    Observable: stdout and exit code
    Boundary: scripts/check-docs-links.ts
