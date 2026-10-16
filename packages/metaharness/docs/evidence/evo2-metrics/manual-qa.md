# Evo2 metrics manual QA

Head: `01a4dc7869bfd120475704ff1816d9c71088a2cd`

| Area | Result | Evidence | Artifact |
|---|---|---|---|
| Metaharness tests | PASS | `bun test` in `packages/metaharness`: `161 pass`, `0 fail`, `900 expect() calls`, `Ran 161 tests across 15 files.` | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Formatting and static checks | PASS | `bun run check`: `All matched files use the correct format.` Oxlint and four tsgo commands exited 0. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Task calibration | PASS | Verifier reward before solution: `0`; verifier reward after solution: `1`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| REST identity, variant, suite | PASS | `spoof_status=400 root=771f6afc7ed08e57 noop=noop normalized_duplicate_status=400 normalized_error=suite.include must not contain task IDs that normalize to the same task name suite=head-local` | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Fitness and signal gate | PASS | Fitness JSON: `vHat 1`, `perTask [t1]`, `outside [t2]`, `meanCostUsd 2`, `signalHits {}`, `rawDelta 1`, `creditedDelta 0`, `missingSignals [mark:needed]`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Runner overlay and secret masking | PASS | Docker dry run emitted `--extra-docker-compose .../omp-compose-overlay.yaml`; parsed overlay has exactly one long-form bind for agent overlay with `read_only: true`; `OMP_BENCH_FORWARD_ENV` values hidden. Executable mode and Compose metachar/path guards included in 161-test suite. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Literal-key validation | PASS | Exit `1`, no job dir, error `models.yml providers.bad.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Full Harbor container task run | NOT RUN | Actual `docker` and `container` binaries absent. Fake command used only to pass dry-run availability guard; no trial claimed. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
