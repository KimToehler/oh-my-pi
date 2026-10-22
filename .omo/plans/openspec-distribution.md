# OpenSpec distribution (P3b)

## Goal

Automate what P3 leaves as manual steps, without a second ownership mechanism:

- the deploy checks the OpenSpec CLI against one pinned version and turns OpenSpec telemetry off persistently on every machine it deploys to;
- one project command installs or updates the `omp-gated` workflow in a project repository, using git as the backup and ownership record.

Decision by Tim (2026-10-22, after P3 F3 delta round 1 REJECT): distribution is split out of P3 into this plan with its own gate. The deploy version check and automatic telemetry opt-out were requested by Tim the same day.

Starts after P3 (`.omo/plans/openspec-team-rollout.md`) merges to `main`; work happens in its own worktree `.worktrees/openspec-distribution`.

## Scope

Files:

- `team-config/openspec-version` — the single OpenSpec CLI pin (`1.14.3`), read by both scripts below.
- `scripts/ensure-openspec-cli.ts` and test — version check plus persistent telemetry opt-out.
- `scripts/deploy-local.sh` — calls the check before building, inside the existing team-config branch (`OMP_SKIP_TEAM_CONFIG=1` skips it with the rest of the team config).
- `scripts/install-openspec-workflow.ts` and test — project install/update.
- `package.json` — the two tests join `test:team-config`.
- `team-config/README.md` — replaces P3's manual setup and manual telemetry steps with the two commands.

Out of scope: installing the OpenSpec CLI itself; merging a project's own `openspec/config.yaml` rules; non-git projects; Windows shells; the gate on OpenSpec changes (P4).

Design constraints:

- No manifest and no backups directory for project installs. The installer refuses to run unless `git status --porcelain` over its workflow paths (`openspec/config.yaml`, `openspec/schemas/omp-gated`) is empty, so every replaced byte stays in `HEAD`. It never reads or writes `.team-config-manifest.json`, which belongs to the agent-dir installer (round-1 blocker `installer-ownership`).
- An existing `openspec/config.yaml` is never rewritten. `schema: omp-gated` → left alone; any other schema → exit non-zero with the one-line fix, nothing changed (round-1 blocker `foreign-schema-setup`).
- Git runs through Bun Shell, following the existing `scripts/` convention (`scripts/release.ts`); the natives addon is not built in a plain fork checkout, so `@oh-my-pi/pi-natives/vcs` is unavailable there.
- The telemetry `set` call itself runs with `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`, so the opt-out never sends an event.

## TODOs

- [ ] 1. Add `team-config/openspec-version` and `scripts/ensure-openspec-cli.ts`: read the pin; run `openspec --version`; missing CLI or a different version → exit 1 printing `npm install -g @fission-ai/openspec@<pin>`; on match run `openspec config set telemetry.enabled false` with both opt-out variables set, then confirm `openspec config get telemetry.enabled` prints `false` without them. Verify: `bun test scripts/ensure-openspec-cli.test.ts` with a fake `openspec` on `PATH` that logs argv and env (match, mismatch, missing, `set` env carries both variables), plus one run against the real CLI with a temporary `XDG_CONFIG_HOME` whose config starts at `telemetry.enabled: true`.
- [ ] 2. Call the check from `scripts/deploy-local.sh` before dependency install and build, only when `OMP_SKIP_TEAM_CONFIG` is not `1`; a failure stops the deploy before anything is built or published. Verify: run `scripts/deploy-local.sh` with a fake `openspec` reporting another version on `PATH` and show it exits before `Installing dependencies`, leaving `~/.local/bin/omp` and `omp.deployed` unchanged (hash before/after).
- [ ] 3. Add `scripts/install-openspec-workflow.ts <project-root>` per the design constraints: require a git work tree and clean workflow paths; replace `openspec/schemas/omp-gated/` from the fork (the validator is no longer copied: it is deployed with team-config at `~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs`); create `openspec/config.yaml` with the team content only when absent; refuse a foreign schema; print `git status --short` over the workflow paths. Verify: `bun test scripts/install-openspec-workflow.test.ts` covering clean install, update over a committed local validator edit (reported by `git status`, recoverable via `git show HEAD:`), dirty path refusal, foreign schema refusal, non-git refusal and an existing `.team-config-manifest.json` left byte-identical.
- [ ] 4. Replace P3's manual setup and telemetry steps in `team-config/README.md` with the two commands and the version bump procedure (edit `team-config/openspec-version`, regenerate the six commands, redeploy). Verify: follow the README verbatim on a fresh temporary project, then `openspec new change probe` reports `omp-gated` and both strict validators pass.

## Final verification wave

- [ ] F3. Whole-diff review: `integration-review` over the P3b diff; needed because deploy script, CLI check, project installer and docs are four layers
- [ ] F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate

- Author's risk assessment: a wrong check blocks every team deploy or lets a mismatched CLI drive commands generated for another version; a wrong installer overwrites project workflow files in colleagues' repositories; both are recoverable (redeploy, `git show HEAD:`) but reach every team machine
- Mandatory class: none (developer tooling; no auth, schema migration, public wire contract or concurrent state machine)
- Whole-diff review: needed (deploy script, CLI check, project installer and docs span four layers)
- Accepted residual risks: the OpenSpec CLI is still installed by hand, so a fresh machine's first deploy stops with the install command; projects with a foreign schema or dirty workflow paths must be fixed by hand before the installer runs; `OMP_SKIP_TEAM_CONFIG=1` skips the version check and telemetry opt-out together with the team config
- Out of scope for blocking: OpenSpec versions other than the pin, Windows shells and non-git projects; findings there become follow-ups
- Feature-specific criteria:
  - Invariant: a deploy that syncs the team config never proceeds on a machine whose OpenSpec CLI is missing or differs from `team-config/openspec-version`
    Positive witness: a fake `openspec` reporting the pinned version lets the check exit 0 and the deploy continue to the build
    Negative control: a fake reporting `1.14.2`, and an empty `PATH` entry with no `openspec`, MUST each exit non-zero with the exact `npm install -g @fission-ai/openspec@<pin>` line and stop the deploy before `Installing dependencies`
    Observable: exit status, stderr, deploy log position, hash of the installed `omp` before and after
    Boundary: `bun scripts/ensure-openspec-cli.ts` as invoked by `scripts/deploy-local.sh`
  - Invariant: after the check passes, OpenSpec telemetry is off for every later invocation regardless of environment
    Positive witness: with a temporary `XDG_CONFIG_HOME` starting at `telemetry.enabled: true`, the real CLI reports `false` via `openspec config get telemetry.enabled` with `DO_NOT_TRACK` and `OPENSPEC_TELEMETRY` unset
    Negative control: a fake `openspec` whose `config set` call arrives without `DO_NOT_TRACK=1` and `OPENSPEC_TELEMETRY=0` in its environment MUST fail the test
    Observable: persisted config value, fake's environment log
    Boundary: OpenSpec global config file
  - Invariant: the project installer never loses uncommitted or foreign-owned project content
    Positive witness: on a clean git project it installs the schema and config, and `openspec new change probe` reports `omp-gated`
    Negative control: a dirty schema file, a foreign `schema:` in an existing config, and a non-git directory MUST each exit non-zero with the tree byte-identical; an existing `.team-config-manifest.json` MUST stay byte-identical after a successful install
    Observable: exit status, `git status --porcelain`, file hashes before and after
    Boundary: `bun scripts/install-openspec-workflow.ts <project-root>`
