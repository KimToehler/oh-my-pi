# Evo2 metrics manual QA

Head: `6b7a1a5403c5b54bbcdf19614b247efa33aeacaa`

| Area | Result | Evidence | Artifact |
|---|---|---|---|
| Metaharness tests | PASS | `bun test` in `packages/metaharness`: `151 pass`, `0 fail`, `798 expect() calls`, `Ran 151 tests across 14 files.` | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Formatting and static checks | PASS | `bun run check`: `All matched files use the correct format.` Oxlint and four tsgo commands exited 0. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Task calibration | PASS | Verifier reward before solution: `0`; verifier reward after solution: `1`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| REST identity, variant, suite | PASS | `spoof_status=400 root=771f6afc7ed08e57 noop=noop normalized_duplicate_status=400 normalized_error=suite.include must not contain task IDs that normalize to the same task name suite=head-local` | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Fitness and signal gate | PASS | Fitness JSON: `vHat 1`, `perTask [t1]`, `outside [t2]`, `meanCostUsd 2`, `signalHits {}`, `rawDelta 1`, `creditedDelta 0`, `missingSignals [mark:needed]`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Runner overlay and secret masking | PASS | Dry run emitted `harbor run -p /tmp/omp-evo-task-calibration`; read-only mount `/opt/omp/agent-overlay`; `OMP_BENCH_FORWARD_ENV=PI_NO_TITLE,ONARA_ROUTER_KEY (values hidden)`; job dir `/tmp/omp-evo-head-cli/head-overlay`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Literal-key validation | PASS | Exit `1`, no job dir, error `models.yml providers.bad.apiKey must be an environment variable name (literal keys, commands and URLs are not allowed)`. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
| Full Harbor container task run | NOT RUN | Unavailable: both `docker` and `container` commands are absent. This is limitation, not pass. | `packages/metaharness/docs/evidence/evo2-metrics/manual-qa.md` |
