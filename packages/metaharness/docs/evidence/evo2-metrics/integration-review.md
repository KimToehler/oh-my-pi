# Evo2 metrics integration review

- Base: `main` (`935046d15b61d55788cd1e015b151a1ca3eb7e70`)
- Head: `4ef04ca86798a6eb55d76b8f4ab3110ea00a0a17`
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

## Final verdict

Fresh reviewer over `cc525adc8b..4ef04ca867` (full branch delta `935046d15b...4ef04ca867`): `VERDICT: PASS`, no blockers.
