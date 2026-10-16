# omp Evo2 metric substrate plan

## Context
User wants to test Evo2-style harness evolution for omp, with config-layer genes first and source-code genes supported by the same identity model. Fitness must combine a private, repo-derived search suite with a held-out Terminal-Bench transfer suite. Implementation lives in `/Users/tim/git/oh-my-pi/packages/metaharness`; work happens in `/Users/tim/git/oh-my-pi/.worktrees/evo-metrics` on a feature branch, never in the shared `main` checkout.

Existing substrate is useful but incomplete. `src/store.ts` already persists run-level score/pass/fail/error, aggregate input/output/cache tokens and cost, plus trial reward/status/duration/trace path. `src/runner.ts` already evaluates fixed Harbor task lists with repeated attempts, writes raw `agent/omp.txt` JSONL, and extracts verifier reward. `src/experiments.ts` already supplies cross-arm task matrices. omp JSONL already emits assistant usage, tool lifecycle, retry/compaction, TTSR-rule, and task-result events. Missing for Evo2: content-addressed variant lineage, matched parent/child identity, per-trial LLM-call/token/tool metrics, subagent usage inclusion, mechanism-fired evidence, no-op/startup validity, paired fitness deltas with uncertainty, and one reflector-ready evidence bundle.

This plan builds measurement/evaluation substrate only; Proposer/Reflector prompts, genetic parent sampling, crossover orchestration, and weight training consume these APIs later. Weight evolution is not applicable to current fixed proprietary models.

## Approach

### 1. Add typed transcript metrics at Harbor trial boundary
- Add `packages/metaharness/src/evo/transcript.ts` with `summarizeOmpTranscript(path): TranscriptMetrics`. Stream lines with bounded buffers; never load multi-GB traces wholesale. Parse JSON lines and tolerate explicit non-JSON marker/error lines.
- Define exact persisted fields: `llm_calls`, `llm_errors`, `turns`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `tool_calls`, `tool_errors`, `compactions`, `retries`, `final_stop_reason`, `started`, `startup_errors`, and sorted unique `signals`.
- Count main-agent usage once from assistant `message_end` events. Add subagent aggregate usage from terminal `task` results at `result.details.usage` or `result.details.results[].usage`, with usage also accepted from blocking `tool_execution_end` or detached terminal `tool_execution_update`; keep the richest per-toolCallId snapshot until EOF so mixed blocking+async ordering and replay count the full aggregate exactly once. Deduplicate by tool-call ID and prove no double counting with a fixture containing both parent and child usage. Count task requests separately so call efficiency includes delegated model calls.
- Derive evidence signals without prompt-text assertions:
  - `tool:<name>` from `tool_execution_start`;
  - `skill:<name>` from `read` calls whose path is `skill://<name>`;
  - `rule:<name>` from `ttsr_triggered.rules[].name` or `read` calls on `rule://<name>`;
  - `agent:<name>` from top-level and batched `task` arguments;
  - `mark:<id>` only from non-JSON stderr lines matching `EVO-MARK:<id>`.
- Treat non-JSON `Failed to load extension …` lines as startup errors. `started` means at least one assistant `message_end`; do not infer success from process creation.
- Extend `Trial`, `BenchmarkTrace`, `TraceRow`, and SQLite `trials` columns with these metrics. Add ALTER migrations following existing `PRAGMA table_info` pattern. Populate finished Harbor trials during `readTrials()`/`syncRun()`; leave nullable fields for edit/SnapCompact adapters rather than fabricating equivalents. If a resumed trial changes back to running, clear its terminal transcript summary and recompute after the new terminal result.
- Preserve current run aggregates. Add run-detail JSON exposure of new per-trial fields; dashboard changes are limited to showing mean LLM calls and output tokens per decided trial beside existing spend.

### 2. Introduce content-addressed harness variants and proposal outcomes
- Add `packages/metaharness/src/evo/variants.ts` and SQLite tables:
  - `evo_variants(id, config_hash, source_ref, source_dirty_hash, snapshot_path, parent_id, donor_variant_id, depth, mutation, strategy, directive, expected_signals_json, diff_path, changed_files_json, created_at)`;
  - `evo_proposals(id, parent_id, candidate_variant_id, mutation, donor_variant_id, outcome, detail, created_at)` where outcome is exactly `applied | noop | apply_failed`.
- Model mutation as exhaustive variants `root | autonomous | revision | crossover | manual`. Crossover keeps recipient `parent_id` and records donor separately, matching paper lineage semantics.
- Add `variant_id` and `suite_id` to `runs`/`RunRow`/`LaunchRecord`. Every variant launch records both config hash and source identity; comparisons reject mismatched source identities instead of attributing source drift to config evolution.
- Compute config hash from sorted relative paths and bytes with SHA-256. Snapshot only `AGENTS.md`, `config.yml`, `rules/`, `skills/`, `agents/`, and `extensions/`; dereference symlinks. Exclude `.env`, `models.yml`, DB/WAL/SHM files, sessions, cache, prediction data, logs, backups, and lock files. Reject symlinks escaping source roots, sockets/devices, unreadable files, malformed YAML, and secrets-bearing excluded paths.
- Compute `source_ref` with `git rev-parse HEAD`; if dirty, hash tracked diff plus untracked file names/content into `source_dirty_hash`. Config-first variants normally share this source identity. Source variants use a clean task-owned worktree as `snapshot_path`; runner support in step 3 accepts that worktree as source root, so schema has no nonfunctional source mode.
- Materialize snapshots immutably under `<jobs-dir>/_evo/variants/<id>/`. Generate unified parent diff and changed-file list. Same config/source hashes as parent create a proposal row with `noop` and reuse parent variant ID; malformed/apply failures create `apply_failed` proposal rows without a fake candidate.
- Add REST boundaries with parsed request bodies:
  - `POST /api/evo/variants` registers/snapshots candidate plus proposal metadata;
  - `GET /api/evo/variants` lists lineage and attached run counts;
  - `GET /api/evo/variants/:id` returns variant, proposal history, diff locator, and runs.

### 3. Make config and source genomes reproducibly runnable
- Extend `LaunchRequest`, `harborRunnerArgs()`, runner `Config`, resume snapshots, and CLI help with `variantId`, `suiteId`, `--agent-dir`, `--source-root`, and `--models-yaml`.
- Config variant launch stages a complete agent directory under `<jobs-dir>/_bench/<job>/agent-overlay/`:
  1. copy immutable variant snapshot;
  2. parse `config.yml` with `Bun.YAML`;
  3. reserve executor keys `modelRoles`, `enabledModels`, `modelProviderOrder`, and `retry` from evolution;
  4. rewrite every discovered/built-in model role to fixed launch model/thinking level;
  5. apply benchmark web-search/find settings, then explicit `--setting` overrides last;
  6. write merged `config.yml` and copy fixed `models.yml` supplied by `--models-yaml`.
- Add read-only agent-overlay mounts to Docker compose and Apple-container mount JSON. `agent/omp_local.py` copies mounted overlay to `$HOME/.omp/agent` before execution; when overlay exists it MUST NOT regenerate config/models. Existing generation remains fallback for ordinary non-evo runs.
- Support direct onara execution: `--models-yaml` works with `--no-gateway`, sets `OMP_BENCH_MODELS_YAML`, and triggers `_write_models_yaml()` even when gateway is off. Container-safe models file uses `apiKey: ONARA_ROUTER_KEY`; runner forwards value only through explicit `--env ONARA_ROUTER_KEY`. Never persist key in SQLite, manager JSON, logs, staged overlay, or dry-run output.
- Source variant launch replaces hard-coded `REPO_ROOT` only in source dependency hashing, package discovery, compose/mount paths, package version lookup, and binary lookup through `Config.sourceRoot`. Require git worktree path and recorded source identity match before spawn; reject drift with both expected/actual identities. Config-first runs use default source root.
- Persist exact staged config hash and executor config hash in run `config_json`. `resolveArmLaunch()` inherits variant, suite, source root, executor model, attempts, and explicit task list; sibling arms may change only variant ID plus arm label/note.

### 4. Define fixed suites and matched-condition fitness
- Add `packages/metaharness/src/evo/suites.ts` with strict manifest parsing. Suite schema: `{ id, split: "search" | "heldout", benchmark: "harbor", dataset, include, attempts, timeoutMultiplier, model, thinking, environment }`. Empty/duplicate task IDs and implicit random sampling are errors.
- Store manifests under `<jobs-dir>/_evo/suites/*.json`; API `POST /api/evo/suites` snapshots one and `GET /api/evo/suites` lists immutable versions by content hash. `POST /api/evo/variants/:id/evaluate` accepts only `{ suiteId, jobName?, concurrency? }`; all matched-condition fields come from suite manifest.
- Add `packages/metaharness/src/evo/fitness.ts`:
  - per-task reward = mean of attempts; missing reward and agent-caused errors, including `AgentTimeoutError`, count as `0`;
  - infrastructure exceptions use an explicit allowlist from observed Harbor exception types, remain excluded, and make estimate `incomplete` until resumed;
  - `VHat` = macro mean of complete per-task rewards;
  - report tasks/trials/errors, sample SD/SE/95% CI, mean LLM calls/output tokens/cost per task, startup failure rate, and signal hit counts;
  - parent delta uses shared task IDs under identical suite/executor/source hashes, reports mean paired delta, paired SE/95% CI, wins/ties/losses, and missing-task lists. Reject unmatched comparisons with 409 and exact differing fields.
- Expected signals come from variant registration. Empty signal set means unconditional config/prompt change and needs no runtime gating. Non-empty set is satisfied only when every expected signal appears in at least one child trial. Reflector-credited positive delta is clamped to zero if expected signals were not observed; raw delta remains visible.
- Add APIs:
  - `GET /api/evo/variants/:id/fitness?suite=<id>`;
  - `GET /api/evo/variants/:id/compare?baseline=<id>&suite=<id>`;
  - `GET /api/evo/variants/:id/reflection-bundle?suite=<id>` returning child/parent metadata, stored diff, fitness/delta/cost, signal evidence, per-task flips, and normalized trace links for up to 3 regressions, 3 improvements, and 3 persistent failures.
- Reuse existing normalized trace parser by extracting it from `ManagerServer.#trace` into a shared pure function; do not duplicate JSONL interpretation.

### 5. Add private-suite task generator, not task selection
- Add `packages/metaharness/scripts/evo-task.ts make` with required typed options: `--repo`, `--base`, `--fix`, `--name`, `--instruction`, `--test-command`, repeatable `--test-glob`, `--base-image`, and `--output`.
- Generate canonical Harbor task: `task.toml` schema 1.3, `instruction.md`, `environment/Dockerfile`, `tests/test.sh`, hidden fixed test files, `solution/solve.sh`, and fixed non-test files. Agent environment uses public network only for model access; verifier runs with `no-network`. Test script writes numeric reward to `/logs/verifier/reward.txt`.
- Base image contains repo at `base`; hidden verifier overlays test files from `fix`; solution overlays non-test fixed files and handles deleted files. Reject merge commits, identical base/fix, missing test changes, test files also included in solution, dirty source repo, absolute/traversal paths, and commands containing NUL/newlines.
- Add `verify --task <generated-task-dir>` subcommand: run verifier before solution and require reward `0`, run `solution/solve.sh`, then rerun verifier and require reward `1`. This discriminating RED/GREEN calibration is mandatory before task enters a suite.
- Ship one real example manifest using `base = 63b339b814^`, `fix = 63b339b814`, hidden test `packages/coding-agent/test/web/search/read-limited-text.test.ts`, and test command `bun test packages/coding-agent/test/web/search/read-limited-text.test.ts`. Do not commit archived repo payloads or user-private suite contents; generated tasks live under gitignored `<jobs-dir>/_evo/tasks/`.
- Initial search/held-out suite content remains user-curated after generator validation. This change ships no guessed Terminal-Bench manifests: evo APIs accept only user-supplied immutable manifests with explicit non-empty task IDs. Until those manifests exist, only the one-task generated example suite is runnable.

## Critical files & anchors
- `packages/metaharness/src/store.ts` — `SCHEMA`, constructor migrations, `syncRun()`, `RunRow`/`TraceRow`; persistence boundary for variants and per-trial metrics.
- `packages/metaharness/src/runner.ts` — `Config`, `parseTrial()`, `prepareSourceDeps()`, compose/mount builders, `buildHarborEnv()`; source identity and container staging.
- `packages/metaharness/agent/omp_local.py` — `OmpLocal.install()`, `_write_models_yaml()`, `run()`; agent overlay installation and direct-provider config.
- `packages/metaharness/src/server.ts` — `ManagerServer.#route()`, `launch()`, normalized trace handler; evo REST boundary and shared trace extraction.
- `packages/coding-agent/src/task/index.ts` — async terminal task-result/progress-details contract; settled result and usage payload emitted through progress details.
- `packages/metaharness/src/evo/` — new bounded modules for transcript parsing, variant snapshots, suites, and fitness; no single file above 250 pure LOC.

## Verification
- Working directory: `/Users/tim/git/oh-my-pi/.worktrees/evo-metrics`. Prerequisites: `bun install`; `uv tool install harbor`; Docker Desktop running; `ONARA_ROUTER_KEY` present; container-safe `~/.omp/evo/models.yml` with `apiKey: ONARA_ROUTER_KEY` and exact list-price cost fields.
- RED/GREEN evidence: add committed tests first and run each against pre-change source before implementation. Required discriminating tests:
  - transcript fixture with parent + task subagent usage proves exact calls/tokens and no double count;
  - malformed/oversized/mixed stderr lines prove bounded parser and startup-error capture;
  - variant snapshot proves symlink dereference, forbidden-file exclusion, hash stability, noop/apply-failed outcomes;
  - source/config/executor mismatch proves comparison rejection;
  - paired fixture with known rewards proves VHat, error handling, SE/CI, cost means, and signal-gated credited delta;
  - generated example task fails before solution and passes after solution.
- Run focused tests: `bun test packages/metaharness/test/evo-transcript.test.ts packages/metaharness/test/evo-variants.test.ts packages/metaharness/test/evo-fitness.test.ts packages/metaharness/test/evo-task.test.ts packages/metaharness/test/manager.test.ts packages/metaharness/test/runner.test.ts packages/coding-agent/test/sdk-task-async-guidance.test.ts`.
- Run package gates: `bun --cwd packages/metaharness run check` and `bun --cwd packages/metaharness test`.
- API smoke: start `bun --cwd packages/metaharness run serve --port 4700`; register root + one no-op + one modified config variant, register explicit one-task suite, then observe variant/proposal/fitness/compare/reflection JSON via REST. Expected: no-op reuses parent content, modified child preserves lineage, unmatched source comparison returns 409.
- Calibrate generated task before any agent run:
  `bun packages/metaharness/scripts/evo-task.ts verify --task <jobs-dir>/_evo/tasks/read-limited-text`.
  Expected observable: verifier reward `0` before solution and `1` after `solution/solve.sh`.
- Real omp surface smoke on same task:
  `bun packages/metaharness/src/runner.ts --model onara/cc/claude-sonnet-5-5 --thinking medium --dataset <jobs-dir>/_evo/tasks/read-limited-text --tasks 1 --attempts 1 --concurrency 1 --agent-dir <variant-snapshot> --models-yaml ~/.omp/evo/models.yml --no-gateway --env ONARA_ROUTER_KEY --environment docker --job-name evo-smoke --jobs-dir <jobs-dir>`.
  Expected observable: actual omp reward plus non-null per-trial `llm_calls`, output tokens, tool counters, `started=true`, and a trace link. Negative control: broken extension variant yields startup error/zero started trials and cannot receive positive credited delta.
- Repeat same one-task suite for parent and child with identical executor/source. `GET …/compare` must show shared task, exact raw delta, call/token/cost differences, and expected signal evidence. No held-out claim occurs until user supplies an explicit held-out suite manifest; once supplied, it stays unread during search and runs only against selected champion.

## Assumptions & contingencies
- Full Proposer/Reflector/genetic-search driver is a separate consumer after metrics prove discriminating. No implementation decisions for that loop are hidden here.
- Executor stays fixed at `onara/cc/claude-sonnet-5-5:medium` across one comparison. If cost requires another model, create a new suite version; never mix executor identities in one delta.
- onara is a custom local provider; omp auth gateway intentionally ignores local `models.yml`. Therefore local Docker trials use `--no-gateway`, explicit models file, and forwarded router key. This exposes key to local task container environment. If that is unacceptable, stop and add a host-side proxy that supports custom providers before running untrusted tasks.
- Tasks with `no-network` cannot reach onara directly. Exclude them from suite or switch entire suite to a broker-routable provider; never silently drop only failed tasks after evaluation.
- Source variants must be clean, task-owned worktrees. If dependency lock differs, build a separate cached Linux dependency tree keyed by that lock hash; do not reuse an incompatible tree.
- Initial private search suite and Terminal-Bench held-out suite are not auto-curated. Generator and one calibrated example land now; user supplies explicit task IDs in immutable manifests afterward. Evo APIs reject empty or implicit-random manifests.

## TODOs
- [x] R1. Create parent directories before materializing nested whitelisted config files (`packages/metaharness/src/evo/config-snapshot.ts`). Dismissed as false positive: `Bun.write` creates parent directories; a nested-materialization probe passed before any change, and `evo-variants.test.ts` "concurrent registration" already reads `config/rules/r.md` from a registered variant.
- [x] R2. Prevent explicit forwarded environment values from persisting in runner config; resume must resolve values from host environment (`packages/metaharness/src/runner.ts`). `runBenchmark` rejects `--env NAME=VALUE` for any variable a `--models-yaml` apiKey references, before anything is written; credentials must use host-sourced `--env NAME`.
- [x] R3. Reject env values smuggled through the API launch boundary (`packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/server.ts`). `assertLaunchEnvSafe` runs in `ManagerServer.launch()` before the job dir or run row exists: `envNames` must be variable names, and harbor `extraArgs` may not carry `--env`/`-e`/`--env=`.
- [x] R4. Apply the `--models-yaml` credential guard for every agent, not only `omp` (`packages/metaharness/src/runner.ts`).
- [x] R5. Close the harbor passthrough bypass after a literal `--` (`packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/runner.ts`). `harborEnvAssignmentNames` parses `--ae`/`--agent-env`/`--ve`/`--verifier-env` and `-e`/`--env` values containing `=`; the API rejects any such flag after `--`, and the runner rejects `--models-yaml` credential names found in passthrough before anything is written. A bare `-- -e docker` stays allowed.
- [x] R6. Make credential-value detection independent of argv flag spelling (`packages/metaharness/src/evo/models-yaml.ts`, `packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/runner.ts`, `packages/metaharness/src/server.ts`). `findCredentialLeaks (superseded by R7)` rejects any full argument containing `<models.yml credential name>=`; the API loads credential names synchronously before launch persistence, and the runner scans passthrough plus agent args before writing artifacts.
+- [x] R7. Detect credentials structurally over the decoded launch config and by host value (`packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/server.ts`, `packages/metaharness/src/runner.ts`). `findCredentialLeaks` walks every string leaf (JSON-decoded and post-`=` halves included) of the whole API request and of the runner's argv-derived config (`settings`, passthrough, agent args), rejecting `<models.yml credential>=` and any host credential value of at least 8 characters before anything is written.
- [x] R8. Close accidental-leak gaps in credential detection (`packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/server.ts`). `findCredentialLeaks` now walks object keys as well as values with no depth limit (explicit stack, cycle-safe), and the API derives credential names from every effective models file (`request.modelsYaml` plus any `--models-yaml` inside `extraArgs`). Scope decision: the invariant covers accidental persistence (plaintext, `NAME=`, JSON escapes, keys, any nesting, effective models file); deliberate re-encoding (base64, hex, splitting across arguments) by someone already holding the key is out of scope, because content scanning cannot close it.
- [x] R9. Resolve the `oven/bun` image tag from a `packageManager` range (`packages/metaharness/src/runner.ts`). `bun@>=1.4` produced `oven/bun:>=1.4` and `docker: invalid reference format`, which broke every `--install source` Docker run; `resolveBunImageVersion` keeps exact pins, otherwise uses the host Bun when it satisfies the range, and fails loudly when it does not.
- [x] R10. Scan explicit `--env` values for host credential values (`packages/metaharness/src/runner.ts`). `--env OTHER=<credential value>` bypassed the name-based check; the runner guard now passes every non-host-sourced `cfg.env` entry to `findCredentialLeaks` before anything is written.
- [x] R11. Bind the staged `models.yml` content into the comparison identity (`packages/metaharness/src/evo/launch.ts`, `compare.ts`, `service.ts`, `launch-args.ts`, `packages/metaharness/src/server.ts`). The host models file is mutable, so editing it between a parent and a child evaluation changed the effective executor while `executorConfigHash` stayed equal and `/compare` still returned a numeric delta. `buildEvalLaunch` now snapshots the validated text to `<jobsDir>/_evo/models/<sha256>.yml`, launches against that immutable copy, and records `modelsYamlHash`; `ConditionIdentity` requires it, and `/api/runs` rejects it as a caller-supplied evo identity field.
- [x] R12. Publish the models snapshot atomically (`packages/metaharness/src/evo/launch.ts`). `existsSync` plus an in-place `Bun.write` let two concurrent evaluations with the same absent hash expose a partial file to the staging reader; the write now goes to `.<hash>.<uuid>.tmp` and is renamed into place, mirroring `snapshot-publish.ts`. No test accompanies this fix: a concurrency probe passed 3/3 against the pre-fix source, so it was removed rather than kept as a green-always test; the guarantee rests on rename atomicity.
- [x] R13. Validate every credential-bearing models.yml field, not only `apiKey` (`packages/metaharness/src/evo/models-yaml.ts`, `packages/metaharness/src/runner.ts`). A literal `headers.Authorization` or a `baseUrl` with URL userinfo was accepted, then persisted to `<jobsDir>/_evo/models/<sha256>.yml` and the staged overlay and printed verbatim by `--dry-run`; header values must now be environment-variable names, URL userinfo is rejected, and the dry run prints the models path plus its sha256 instead of the body.
- [x] R14. Re-verify the source identity after the run and refuse drifted runs (`packages/metaharness/src/runner.ts`, `packages/metaharness/src/evo/service.ts`). A source variant mounts a live worktree and the identity was checked only before spawn, so bytes changed mid-run (a concurrent host edit, or the agent itself where Apple Container ignores `read_only`) left the run recorded under its original identity and still comparable. `runBenchmark` now records `postRunSourceIdentity` in `_bench/<job>/runner-config.json` and warns on drift; `#identity` returns 409 `source changed during the run` when the recorded post-run identity differs from the launch one.
- [x] R15. Keep a recorded source drift sticky across a resume (`packages/metaharness/src/runner.ts`). `recordPostRunSourceIdentity` overwrote the field on every run, so restoring the source before `--resume` cleared the mismatch while the resumed job kept the drifted run's completed trials; a recorded drift is now never replaced by a matching value, and the warning still prints on every run.
- [x] R16. Withhold decision metrics from an incomplete comparison (`packages/metaharness/src/evo/compare.ts`). `creditedDelta`, the decision interval and wins/ties/losses were computed from the shared tasks before `complete` was decided, so a child that improved one task while omitting failed or unrun suite tasks still earned positive credit; those fields are now `null` whenever either side is incomplete, while `rawDelta` and the per-task deltas remain as diagnostics.
- [x] R17. Verify the models snapshot bytes on reuse and before staging (`packages/metaharness/src/evo/launch.ts`, `packages/metaharness/src/launch-args.ts`, `packages/metaharness/src/runner.ts`). The content-addressed snapshot was left writable and a reuse hit was trusted without rehashing, so editing it in place between two evaluations kept one recorded `modelsYamlHash` across different staged bytes; the snapshot is now published read-only and rehashed on reuse, and the runner receives `--models-yaml-hash` and verifies the file before `runner-config.json` is written and again before the overlay is staged.
- [x] R18. Reject credentials in models.yml URL query and fragment components (`packages/metaharness/src/evo/models-yaml.ts`). Only userinfo was rejected, so `baseUrl: "https://host/v1?api_key=..."` was accepted and persisted into the snapshot and the staged overlay; a non-empty query or fragment on any `baseUrl`/`url` is now rejected by dotted path without echoing the value.
- [x] R19. Apply the URL credential rules to relative references too (`packages/metaharness/src/evo/models-yaml.ts`). `new URL(value)` throws on a relative reference and the catch waved it through, so `baseUrl: "/v1?api_key=..."` or `url: "?token=..."` skipped the query/fragment rejection and was persisted; a failed absolute parse now retries against a fixed dummy base and applies the same rules, while a plain relative path stays acceptable.
- [x] R20. Enforce the suite's declared attempt count before a fitness decision (`packages/metaharness/src/evo/fitness.ts`, `packages/metaharness/src/evo/service.ts`). Only task IDs were checked, so a suite declaring `attempts: 2` that produced one terminal trial per task still reported `complete: true` and let the comparison rank two differently sized samples; each task's terminal-attempt cardinality must now equal `suite.manifest.attempts`, and `compareFitness` already withholds the decision fields once a side is incomplete.
- [x] R21. Detect short host credential values (`packages/metaharness/src/launch-args.ts`). The 8-character floor on host-value matching let a real 7-character credential pass under an unrelated `--env NAME=VALUE` and persist in `runner-config.json`; values at or above the floor keep the substring match, while shorter ones now match a whole scanned string or the half after the first `=`, which stays exact without firing on ordinary prose.
## Final verification wave
- [ ] F3. Whole-diff review: `integration-review` over main...feat/evo-metrics because change spans store, runner, server, Python agent, task generation, and API layers
- [ ] F1. Manual QA on real metaharness REST + Harbor/Docker surfaces, one evidence path per Verification scenario, on head after F3's last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: High local benchmark risk; wrong accounting can select regressions, duplicate subagent cost, leak router credentials, or compare unmatched task/model/source conditions. Production task runtime now emits settled async result/usage in progress details; behavior/control flow unchanged but metric consumers may depend on payload.
- Mandatory class: concurrency-state
- Whole-diff review: needed
- Feature-specific criteria:
  - Invariant: Every decided Harbor trial records complete main+task-subagent call/token/tool metrics exactly once.
    Positive witness: fixture and real smoke totals equal independently counted JSONL events and task-result aggregate usage.
    Negative control: running initial end, duplicate replay, and sparse async update before richer mixed end MUST NOT double-count or overwrite richer per-toolCallId aggregate.
    Observable: persisted trial metric columns and fitness cost totals.
    Boundary: `agent/omp.txt` → `syncRun()` → `metaharness.sqlite`/REST.
  - Invariant: Parent/child delta compares only identical suite, executor identity (including the exact staged models.yml bytes), source identity, and explicit task IDs.
    Positive witness: matched variants return paired delta and per-task flips.
    Negative control: A changed model, a changed staged models.yml, a changed source hash, a changed suite hash, or a missing task set MUST return 409/incomplete, never a numeric comparable delta.
    Observable: compare API status and response fields.
    Boundary: evo suite/variant run records → fitness API.
  - Invariant: Positive reflector credit requires runtime evidence for every declared expected signal.
    Positive witness: child trace emitting declared marker retains positive credited delta.
    Negative control: same raw gain without marker evidence MUST clamp credited delta to zero.
    Observable: raw delta, signal hits, credited delta.
    Boundary: trial transcript signals → reflection bundle.
  - Invariant: No models.yml credential reaches persisted metaharness artifacts or dry-run output by accident (plaintext, NAME=, JSON escapes, object keys, any nesting depth, or an effective --models-yaml supplied anywhere); deliberate re-encoding by a key holder is out of scope.
    Positive witness: container resolves `ONARA_ROUTER_KEY` and completes a call while stored config records only variable name.
    Negative control: seeded sentinel secret MUST fail repository/jobs-dir recursive scan if any artifact contains it.
    Observable: sentinel scan result and successful trial.
    Boundary: host env → container process env versus job/DB/log persistence.
  - Mechanical: Variant hash and diff are deterministic for identical dereferenced config/source content.
    Invariant: Same bytes/source identity produce same variant ID and changed-file set.
    Observable: equality across independently materialized snapshots.
    Boundary: agent/source paths → evo variant registry.
