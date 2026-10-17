# Evo2 metrics integration review

- Base: `main` (`935046d15b61d55788cd1e015b151a1ca3eb7e70`)
- Head: `51c6b5e0c7379ca5ff33094ec9dc8a6f35204f66`
- Result: **PASS**

## Review history

Whole-diff review over `935046d15b..ab48053920` raised R1 and R2; successive fresh delta reviews over `ab48053920..<head>` raised R3 through R10. Each fix shipped with a failing-first test observed RED before the change.

- R1 (materialize nested config): dismissed as false positive; `Bun.write` creates parent directories, accepted by the next reviewer.
- R2 explicit `--env NAME=VALUE`; R3 API `envNames`/`extraArgs`; R4 non-omp agents; R5 harbor passthrough after `--`; R6 flag-spelling independence; R7 `--setting` JSON-decoded values and `\u003d` escapes; R8 object keys, unbounded nesting, `--models-yaml` inside `extraArgs`; R10 host credential value under another `--env` name. All credential-persistence fixes.
- R9: `oven/bun` image tag from a `packageManager` range (`bun@>=1.4` produced `docker: invalid reference format`), found by a real Docker run.
- R11: the comparison identity did not bind the fixed `models.yml` content, so editing that mutable host file between a parent and a child evaluation produced an accepted, confounded delta. Found by the merge-gate implementation audit. `buildEvalLaunch` now snapshots the validated text to `<jobsDir>/_evo/models/<sha256>.yml` and records `modelsYamlHash`, which `ConditionIdentity` requires.
- R12: that snapshot was published with `existsSync` plus an in-place write, so concurrent evaluations could expose a partial file. It is now written to a UUID temp file and renamed into place.
- R13: `models.yml` validated only keys named `apiKey`, so a literal `headers.Authorization` or a `baseUrl` carrying URL userinfo was accepted, persisted to the content-addressed snapshot and the staged overlay, and printed verbatim by `--dry-run`. Found by the merge-gate implementation audit. Header values must now name an environment variable, URL userinfo is rejected, and the dry run prints the models path plus its sha256.
- R14: a source variant mounts a live worktree and the identity was verified only before spawn, so bytes changing mid-run left the run recorded under its original identity and still comparable. The runner now records `postRunSourceIdentity` and the comparison refuses a drifted run with 409.
- R15: that post-run identity was overwritten on every run, so restoring the source before `--resume` cleared a recorded drift while the job kept the drifted run's trials. A recorded drift is now sticky.
- R16: an incomplete comparison still emitted `creditedDelta`, a decision interval and win counts computed from the shared tasks, so a child omitting failed or unrun suite tasks could earn positive credit. Those fields are now `null` whenever either side is incomplete.
- R17: the content-addressed models snapshot was left writable and a reuse hit was trusted without rehashing. It is now published read-only and rehashed on reuse, and the runner verifies the file against `--models-yaml-hash` before writing its config and again before staging the overlay.
- R18: only URL userinfo was rejected, so `baseUrl: "https://host/v1?api_key=..."` was accepted and persisted. A non-empty query or fragment is now rejected.
- R19: `new URL()` throws on a relative reference and the catch waved it through, so `baseUrl: "/v1?api_key=..."` bypassed those rules. A failed absolute parse now retries against a fixed dummy base.

Scope decision (user): the credential invariant covers accidental persistence; deliberate re-encoding by a key holder is out of scope.
- R20: `computeFitness` checked only task IDs, so a suite declaring `attempts: 2` that produced one terminal trial per task still reported `complete: true` and let the comparison rank two differently sized samples. Each task's terminal-attempt cardinality must now equal the manifest's `attempts`.
- R21: host credential values shorter than eight characters were dropped from leak detection, so a real seven-character credential persisted under an unrelated `--env NAME=VALUE`. Short values are now matched exactly, against a whole argument or the half after the first `=`.
- R22: `make` and `verify` were separate optional commands and suite registration checked nothing, so an uncalibrated generated task could enter a suite and corrupt every fitness number. `verifyTask` now writes `calibration.json` bound to a hash of the task's files, and registration rejects a missing, unsuccessful or stale calibration.
- R23: any clean worktree path was accepted as a source variant and bind-mounted into every trial, which Apple Container mounts writable. The worktree must now lie under `<jobsDir>/_evo/worktrees/`.
- R24: evaluate accepted an existing job name, and registering the launch deleted the prior run's trial rows before any replacement existed. It now returns 409 for any existing name.
- R25: the R23 check ran only at registration, so a variant row persisted earlier, or an arm inheriting an evo template's config, still reached the mount. The shared check now also runs in `variantLaunchFields` and on an inherited evo source root.
- R26: `resume()` rebuilds its invocation from the recorded config and bypassed both guards; it now applies the same check when the run carries a `variantId`.
- R27: `hashConfig` and `diffConfigs` ignored `ConfigFile.executable` although `materializeConfig` chmods the staged tree from it, so a variant flipping only a script's exec bit took its parent's id and was discarded as a no-op. Both now fold the bit in, mirroring `hashTaskDir`.
- R28: `callsDelta`, `outputTokensDelta` and `costUsdDelta` were computed unconditionally while the decision fields were nulled, so their means could span different task sets. All three are now `null` unless the comparison is complete.
- R29: a reviewer required migrating variant identities across R27's hash-frame change. Dismissed as not applicable and confirmed by a second reviewer: `main` carries neither the evo schema nor `src/evo`, the schema lands only in this unmerged branch, and the package is private at `0.0.1`, so no old-frame row can exist outside the gitignored scratch dir, which was reset.
- R30: only `apiKey`, `headers`, `baseUrl` and `url` were validated, so an unrelated scalar holding a referenced credential's host value was snapshotted into `_evo/models` before any scan, and the overlay's later scan had an 8-character floor. `assertNoHostCredentialValues` now checks every scalar leaf and mapping key before both copies, reusing the existing length-aware matcher.
- R31: that check skipped the whole `headers` subtree, so a header NAME could be the credential, and it guarded only the evo snapshot while the direct `--models-yaml` path copied the file verbatim into the container. Header keys are now scanned, the direct runner runs the same check inside its existing credential guard, and a credential-bearing key is reported as `<key>` so the dotted path cannot echo it.
- R32: `assertNoHostCredentialValues` walked only the parsed tree, but comments never survive parsing while the original text is what every caller copies, so a credential in a trailing comment reached the persisted snapshot. The raw text is now scanned too.
- R33: the evaluate job-name check was a TOCTOU across the `buildEvalLaunch` await, so a loser's `registerLaunch` could delete the winner's trial rows. First addressed with an atomic placeholder row.
- R34: that placeholder used `status='running'`, which `ManagerServer.launch` refuses, so every evaluate failed; the race test had hidden it by stubbing `launch`. Repaired with a distinct `claimed` status, plus two scan gaps closed.
- R35: the placeholder then produced five further lifecycle findings, so the mechanism was removed rather than patched. `#evaluate` re-checks after the await and launches synchronously, which is sufficient because the real launch path does not yield. Net deletion of 118 lines.
- R36: removing the reaper left any legacy `claimed` row unreclaimable, so store open now purges them. No such row exists outside this unmerged branch; the purge guards a database file that outlives its writer.
- R37: `materializeConfig` made snapshot files read-only, but POSIX lets an owner unlink a read-only file from a writable directory and drop a replacement in, so a tampered variant evaluated with 201 under its original id. The registered `configHash` is now re-verified before staging, at `variantLaunchFields`, at `resolveEvoInheritance` for an inheriting arm, and in `stageAgentOverlay` via `--agent-dir-hash` so resume re-checks too.
- R38: `listRuns` ordered only by `created_at DESC`, which is epoch milliseconds, so same-millisecond rows tied and the template an inheriting arm copies was arbitrary — which made the R37 inherited-arm check pass only intermittently. Ordering is now `created_at DESC, rowid DESC`.
- R39: `stageAgentOverlay` hashed the collected snapshot and then re-read the same mutable path, so a replacement landing in between was staged under the original identity. The overlay is now materialized from the single verified collection.
- R40: the plan's 250-line ceiling for `src/evo/` had drifted unnoticed to 286 and 262, because nothing checked it. Both modules were split behind unchanged import paths.
- R41: the hand-rolled counter added with that split could be satisfied by reformatting rather than by removing code, so it was hardened into a character scanner.
- R42: two further bypasses showed that hardening a JS lexer by hand has no clear end, so the counter was deleted and the ceiling moved to a scoped `eslint/max-lines` override in `.oxlintrc.json`, which rides the `oxlint .` already starting `check` and `lint`.
- R43: no credential scanner was reachable from variant registration, so a whitelisted config file whose body carried the host key registered 201 and persisted it; the forwarded-env union was also computed but not scanned.
- R44: the new scanner read file bytes but not file names, and never re-read the generated diff, so a credential-named file and a pre-R43 parent secret both still persisted.
- R45: short credential values matched only whole strings or `KEY=VALUE`, so a three-character forwarded value persisted in a filename and a body line.
- R46: the token-boundary rule enumerated separators and was wrong twice, so the definition was inverted to word-character continuation, which closes the class rather than the reported characters.

- R53: resume rebuilt the Harbor invocation from the recorded config without the R49 integrity gate, so a tampered suite snapshot could execute on resume under stale hashes; the gate now runs in `resume()` too.
- R54: the first resume guard trusted the optional `run.config.suiteId` while the durable identity is the `suite_id` column, so a missing or different config value validated the wrong suite; `run.suiteId` is now the identity and both places must agree.
## Final verdict

Fresh reviewer over `03e6b108..51c6b5e0c` (full branch delta `935046d15b...51c6b5e0c`): `VERDICT: PASS`, no blockers. The R47–R52 wave before it was reviewed in `b74a187f83..c7f0b122b6` with one blocker (the resume gate), closed as R53/R54 and re-reviewed PASS.
