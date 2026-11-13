# F1 row s8-negative-manifest

Head: 9da2bf11616fb8d66db6655976da96949ead17ae

Commands: `bash run-scenarios.sh` (section s8-negative-manifest): three fresh new-form directories with a REJECT
verdict whose manifest `left_out` is set to `src/` (with every patch and evidence file recomputed in the `src/` form
by `src-form.mjs`, so only the value is wrong), `.omp/team-config/evidence` (no trailing slash) and `null`; then
`GC delta` and `GC accept` on each, with the ledger's sha256 before and after. `src-form.mjs` given
`.omp/team-config/evidence/` reproduces `GC patch`'s directory byte for byte (checked on a scratch range before the run).

Observation: all six calls exit 1 with `patch artifacts changed since dispatch: manifest.json`, and the ledger's
sha256 is unchanged after each. A verifier that trusted the manifest's value would have accepted the `src/` directory,
whose patches hide the source fixes in evidence files.

Capture: captures/s8-negative-manifest/refusals.txt sha256:d900b8f903419a420e37d4f2871a4f6fe086e48a1aebfb34f9bf83f127f1de7a
Capture: captures/s8-negative-manifest/manifest-v-src-.json sha256:734baaec39306354ee79c18ed8d4ade4270785fc9c0a6ef7f8eb259e39df2323
Capture: captures/s8-negative-manifest/manifest-v--omp-team-config-evidence.json sha256:146dfbd982c3c89389dc61e15aefdc8a6e721c459e9860036033f163603f6e43
Capture: captures/s8-negative-manifest/manifest-v-null.json sha256:3a219bd75b7144f08fa8071f7b7b9b54178523d4af2e11235113a32167381527
Capture: src-form.mjs sha256:fbb47c3632a6fa977e017b0687f9fa81ee9f31c9b63d70aa7b725f4f7f2cbfb1

Verdict: PASS
