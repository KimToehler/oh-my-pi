# Review

- **Verdict**: REJECT
- **Reviewed digest**: 9ae267f466795dc275e5d959c40ea1fb28ed244ce6120d981b13e68f8a2e9f55
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanRev5A_AQSD, PlanRev5B_AQSD
- **Verifier**: blocker-verifier, BlockerVerify5_AQSD
- **Models**: PlanRev5A_AQSD onara/cx/gpt-6.1-sol; PlanRev5B_AQSD onara/cx/gpt-6.1-sol
- **Round**: 5
- **Awaiting**: exhaustion (finding 1), exception (finding 2)
- **Override**: none

## Blockers

### Scope A (PlanRev5A_AQSD)

1. {"area": "CHECK 1 — Credential-bearing artifact filenames", "defect": "The planned guard protects file contents and printed lines, but not filesystem path names. A passing flow that names its evidence using the configured username can export that credential in the screenshot filename even when the image bytes and all logs scan clean. This is a plausible account-labelled QA artifact, not a corrupted-file or hostile-local-machine scenario. The exported file is removable, but disclosure becomes durable if its path enters committed evidence.", "evidence": "openspec/changes/app-qa-shared-driver/design.md:88-91 assigns exported screenshots only a post-copy fileHit check; design.md:104 and specs/app-qa-driver/spec.md:207 preserve the screenshot's filename. The inherited scanner examines contents only: /Users/tim/git/onara/app_kmp/scripts/qa.mjs:189-191 calls fileHit(readFileSync(f), ...), while :850-852 copies to join(out, e.name). For example, an account-labelled screenshot named sign-in-<configured username>.png survives those guards when its image contains no matching credential bytes. The D3 inventory and D7 sentinel controls do not cover this pathname sink.", "change": "Include artifact path names in the credential holder/sink inventory and protection. Before exporting, reject credential-bearing screenshot names without printing the value, delete the owned unsafe artifact, and fail without PASS. Ensure retained-root paths cannot disclose configured values either. Add a negative control with clean image bytes but a configured credential in the filename, asserting no retained or exported path contains it."}
   - verifier: confirmed, blocking true, protected true: The clean-image/credential-bearing-filename sequence is supported by the planned export: design.md:88-91 assigns content scanning to screenshots, and D6 at design.md:104 preserves their names and checks copies with fileHit. The inherited scanner at /Users/tim/git/onara/app_kmp/scripts/qa.mjs:189-191 inspects readFileSync(f), not f; :850-852 preserves e.name in the destination. Thus a screenshot with clean bytes and the configured username in its name can be exported successfully. D3/D7 do not add a pathname guard. This is a delivery defect, not merely a request for different verification. Credential disclosure in ordinary account-labelled evidence reaches the real credentials explicitly identified in gate.md:6 and is not among its accepted residual risks.

2. {"area": "Build vs. adopt — Evidence secret scan candidate record", "defect": "The Gitleaks candidate lists the default stable version instead of the newest entry by publishedAt. Consequently the record lacks the newest-release fact that this repository's design instruction explicitly requires. Applying the plan would proceed with an incomplete adoption record; this is a reversible planning/value-proof defect, not a runtime vulnerability.", "evidence": "openspec/changes/app-qa-shared-driver/design.md:140 records v8.30.1, 2026-02-21. openspec/schemas/omp-gated/schema.yaml:218 requires each candidate's newest release and date, and :230 explicitly defines newest by latest publishedAt. The cited deps.dev package endpoint lists later entries, including v8.30.1-0.20261023204459-5f6ec56cfa6f published 2026-10-23T20:44:59Z; v8.30.1 is marked isDefault, which is a different selection criterion. The fetched response is retained at artifact://156:1924-2047.", "change": "Correct the Candidates line using the latest publishedAt entry, explicitly distinguishing a Go pseudoversion from the latest stable/default release. Reassess and record the rejection gap against the candidate actually considered; the decision may remain build if that gap is substantiated."}
   - verifier: undecided, blocking false, protected true: Repository evidence confirms that design.md:140 records v8.30.1 dated 2026-02-21, while openspec/schemas/omp-gated/schema.yaml:218,230 requires the newest release selected by latest publishedAt. However, whether a later release exists depends on the external deps.dev response cited at artifact://156:1924-2047. A repository-wide search finds the asserted pseudoversion only in review.md's repetition of this blocker, not in retained registry evidence. Under the read-repository-files-only assignment, that external fact cannot be independently established, so condition 2 remains unsettled.

## Residuals

none
