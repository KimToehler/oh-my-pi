# OpenSpec distribution (P3b)

## Goal

Automate what P3 left as manual steps, without a second ownership mechanism:

- the deploy checks the OpenSpec CLI against one pinned version and turns OpenSpec telemetry off persistently on every machine it deploys to;
- one project command installs or updates the `omp-gated` workflow in a project repository, using git as the backup and ownership record, and reports what a project set up under an older team version still has to change.

Decisions:

- Tim, 2026-10-22 (after P3 F3 delta round 1 REJECT): distribution is split out of P3 into this plan with its own gate. The deploy version check and automatic telemetry opt-out were requested by Tim the same day.
- Tim, 2026-10-23: the schema template and the team `config.yaml` ship with the review-work skill (deployed into `~/.omp/agent` in the same commit as the validator that checks changes against them), and the project installer is a skill script run with `node`, so a project needs no oh-my-pi checkout. This replaces the earlier `scripts/install-openspec-workflow.ts` copying from a fork checkout, which could install a template from a different commit than the deployed validator.
- Tim, 2026-10-23: the installer reports projects in the pre-P4a/P4b shape (config pointing at a per-project validator copy, open changes whose `gate.md` still carries `Review tier`) and changes none of those files.

Work happens in worktree `.worktrees/openspec-distribution`, branch `feat/openspec-distribution` from `main` `3ebaf372a1` (P3, P4a and P4b merged).

## Scope

Files:

- `team-config/openspec-version` — the single OpenSpec CLI pin (`1.14.3`).
- `scripts/ensure-openspec-cli.ts` and `scripts/ensure-openspec-cli.test.ts` — version check plus persistent telemetry opt-out.
- `scripts/deploy-local.sh` — calls the check inside the existing team-config branch (`OMP_SKIP_TEAM_CONFIG=1` skips it with the rest of the team config).
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/**` — the canonical schema (moved, byte-identical, from `openspec/schemas/omp-gated/`).
- `team-config/agent/skills/review-work/openspec/config.yaml` — the team project config (today only in the README).
- `openspec/schemas/omp-gated` — becomes a relative symlink to the canonical schema, so this repository's own OpenSpec changes use the same bytes (checked: OpenSpec 1.14.3 resolves a symlinked project schema, `openspec schema which omp-gated` → `Source: project`).
- `team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs` and `.test.ts` — project install/update plus migration notices.
- Existing tests that read the templates (`validate-openspec-change.test.ts`, `validate-gate-record.test.mjs`) point at the canonical path.
- `package.json` — both new tests join `test:team-config`.
- `team-config/README.md` — replaces P3's manual setup and telemetry steps with the two commands, the pin file, and the bump procedure; `team-config/agent/skills/review-work/SKILL.md` names the installer where it describes OpenSpec folders.

Out of scope: installing the OpenSpec CLI itself; merging a project's own `openspec/config.yaml` rules; rewriting open changes; non-git projects; Windows shells.

Design constraints:

- The installer writes only `openspec/schemas/omp-gated/` and, when absent, `openspec/config.yaml`. Every check runs before the first write. It refuses (exit 1, nothing changed) when:
  - the target is not inside a git work tree;
  - `git status --porcelain --ignored --untracked-files=all -- openspec/config.yaml openspec/schemas/omp-gated` prints anything, so every replaced byte is in `HEAD`;
  - `openspec`, `openspec/schemas`, `openspec/schemas/omp-gated` or `openspec/config.yaml` is a symlink (never write through a link; this also covers running it on this repository);
  - an existing `openspec/config.yaml` has a top-level `schema:` other than `omp-gated`, or none; the message gives the one-line fix;
  - its own canonical schema is missing next to it (agent dir not deployed).
- The schema is replaced in place: remove `openspec/schemas/omp-gated` and copy the canonical tree there; no staging directory or other path is created. When the copy (or creating `openspec/config.yaml`) fails, the same process rolls back before exiting 1: it removes `openspec/schemas/omp-gated` and, if `HEAD` tracked it, runs `git checkout HEAD -- openspec/schemas/omp-gated`; it removes `openspec/config.yaml` only if this run created it. The removal is safe because this process verified the clean-path precondition before its first write, so every byte it deletes is either its own copy or in `HEAD`. Afterwards it checks that `git status --porcelain` over the workflow paths is empty. If a rollback step fails or the status is not empty (for example the disk is still full), it says the rollback did not complete, prints the remaining `git status` lines and the original error, and names `git checkout HEAD -- openspec/schemas/omp-gated` as the recovery for a tracked schema once the cause is fixed; it never claims a restore it did not observe. A run that finds the paths dirty (including after a killed run) refuses with the `git status` lines and suggests no deletion: the user inspects them and decides.
- Migration notices are printed after a successful install, one line per finding with the fix, exit status 0, no file touched: config text naming `scripts/validate-openspec-change.mjs`; a project file `scripts/validate-openspec-change.mjs`; each open change `openspec/changes/<name>/gate.md` (not under `archive/`) with a top-level `Review tier` bullet (read with `plan-contract.mjs` `topLevelField` on `planContent(scanMarkdown())`, the parser the validator uses); project `.omp/commands/opsx-*.md` duplicating the deployed commands.
- Git runs through `node:child_process` `spawnSync` like the other skill scripts; the installer needs only `node` and `git` in the project.
- `ensure-openspec-cli.ts` runs every `openspec` call with `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`, so the check never sends an event. The read-back is protected too: `openspec config get telemetry.enabled` prints the persisted value even with both variables set (checked against 1.14.3: a config file holding `true` reads `true` under `DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0`; the variables only gate sending, `dist/telemetry/opt-out.js`).
- The opt-out covers the global config OpenSpec reads in the deploying user's environment; the check prints that path (`openspec config path`). A later invocation with a different `XDG_CONFIG_HOME` reads another config file and is not covered (accepted residual risk below).
- The deploy runs the check from the deployed ref (`$WT/scripts/ensure-openspec-cli.ts`) before `Installing dependencies`; a ref without the script skips it.

## TODOs

- [x] 1. Add `team-config/openspec-version` and `scripts/ensure-openspec-cli.ts` per the constraints: read the pin; `openspec` not on `PATH` or `openspec --version` different → exit 1 printing `npm install -g @fission-ai/openspec@<pin>`; on match `openspec config set telemetry.enabled false`, then `openspec config get telemetry.enabled` must print `false`, else exit 1; print the config path. Verify: `bun test scripts/ensure-openspec-cli.test.ts` (RED first: run against a stub script that exits 0) with a fake `openspec` on `PATH` logging argv and env: match, mismatch, missing, every call carries both variables even when the caller's environment allows telemetry, persisted value not `false`.
- [x] 2. Call the check from `scripts/deploy-local.sh` after the worktree switch and before `Installing dependencies`, only when `OMP_SKIP_TEAM_CONFIG` is not `1` and the script exists in `$WT`. Verify: `bash -n scripts/deploy-local.sh`; F1 runs the real deploy with a mismatching fake.
- [x] 3. Move the schema to `team-config/agent/skills/review-work/openspec/schemas/omp-gated/` (`git mv`), add the team `config.yaml` beside it (content of README step 3), replace `openspec/schemas/omp-gated` with the relative symlink, repoint the two test template paths. Verify: `openspec schema which omp-gated` in the repo prints `Source: project`; `openspec validate --all --strict` unchanged; `bun run test:team-config` green.
- [x] 4. Add `install-openspec-workflow.mjs [project-root]` (default: the git top level of the current directory) per the constraints. Verify: `bun test team-config/agent/skills/review-work/scripts/install-openspec-workflow.test.ts` (RED first against a stub) covering clean install with the full project file list compared before/after (only the schema tree and `openspec/config.yaml` added), update over a committed local template edit (replaced, shown by `git status`, recoverable with `git show HEAD:`), a copy failure after the first write — injected after the first copied file, on a project whose committed schema lacks a file the canonical tree has — that exits 1 and leaves `git status --porcelain` empty and every project file byte-identical, the same failure on a fresh install leaving no workflow path behind, a copy failure whose rollback checkout also fails (injected) exiting 1 with "rollback did not complete" and the dirty paths, existing `schema: omp-gated` config left byte-identical, dirty/untracked/ignored path refusal printing no `rm`, foreign and missing schema refusal, symlink refusal, non-git refusal, and each migration notice with its negative (archived change, `Risk tier` gate.md, config without the old path: no notice).
- [x] 5. Replace P3's manual setup and telemetry steps in `team-config/README.md` with the two commands, a migration paragraph for projects set up before this change, and the bump procedure (edit `team-config/openspec-version`, regenerate the six commands with that version, redeploy); name the installer in `SKILL.md`. Verify: follow the README verbatim on a fresh temporary project, then `openspec new change probe` reports `omp-gated` and both strict validators pass on a filled change.
- [x] 6. F3 wave 1 should-fixes (`.omo/evidence/openspec-distribution/f3-wave-1.md`), one cleanup commit: (a) the installer accepts `schema: "omp-gated"` and `'omp-gated'` like the plain form; (b) preflight refuses when `git check-ignore` matches a workflow path the run would create (`openspec/config.yaml`, any file under `openspec/schemas/omp-gated/`), naming the path and the ignore rule, nothing written; (c) the fresh-install test asserts the `openspec` CLI ran (no silent skip) and its exit status 0. Verify: `bun test team-config/agent/skills/review-work/scripts/install-openspec-workflow.test.ts` with new rows for (a) both quote styles and (b) a project whose `.gitignore` ignores `openspec/config.yaml`, each RED before the fix.
- [x] 7. Row 6 delta note, reproduced: with `*.yaml` plus `!openspec/config.yaml` in `.gitignore`, `git check-ignore -v` prints the negated match and the installer refuses `openspec/config.yaml` although git would not ignore it. The ignore preflight counts a path only when its matching pattern does not start with `!`. Verify: a new install-test row with that `.gitignore` refuses naming `openspec/schemas/omp-gated/schema.yaml` (the `*.yaml` match) and not `openspec/config.yaml`; a second row with `*.md`, `*.yaml` and `!openspec/**` installs (exit 0); both RED before the fix.

## Final verification wave

- [x] F3. Whole-diff review: `integration-review` over `main...<head>`; needed because deploy script, CLI check, schema relocation, project installer and docs span several layers
- [x] F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

F1 scenarios:

1. Real deploy with a fake `openspec` reporting `1.14.2` first on `PATH`: exits non-zero before `Installing dependencies`; `sha256` of `~/.local/bin/omp` and `omp.deployed` unchanged. Then a real deploy with the real CLI succeeds and the installed `skills/review-work/openspec/` equals the canonical tree (`diff -r`).
2. Real CLI with a temporary `XDG_CONFIG_HOME` whose config starts at `telemetry.enabled: true`: after the check, `openspec config get telemetry.enabled` prints `false` with both variables unset, and the check printed that config's path.
3. Installed installer on a scratch git project: fresh install, `openspec new change probe` → `Schema: omp-gated`; a project in the old README shape (copied validator, config naming it, open change with `Review tier`) gets one notice per finding and those files stay byte-identical.

## Merge gate

- Author's risk assessment: a wrong check blocks every team deploy or lets a mismatched CLI drive commands generated for another version; a wrong installer overwrites or deletes workflow files in colleagues' project repositories; a broken schema move breaks this repository's own OpenSpec changes and the validator tests. All of it is developer tooling on developer machines and project repositories, recoverable by redeploying or `git show HEAD:`, and reaches no production data, credential, personal data or release artifact.
- Mandatory class: none
- Risk tier: internal-tooling
- Whole-diff review: needed (deploy script, CLI check, schema relocation, project installer and docs span five file groups across two mechanisms)
- Accepted residual risks: the OpenSpec CLI is still installed by hand, so a fresh machine's first deploy stops with the install command; the telemetry opt-out is persisted only in the global config of the deploying environment, so an invocation with a different `XDG_CONFIG_HOME` (another user, a sandbox) is not covered until that config is opted out too; projects with a foreign schema, dirty or symlinked workflow paths are fixed by hand before the installer runs; an installer killed by a signal mid-copy cannot roll back, and a rollback that itself fails (disk still full) leaves the schema directory dirty; both are reported (the next run refuses with the `git status` lines) and the committed schema stays recoverable from `HEAD`; `OMP_SKIP_TEAM_CONFIG=1` skips the version check and telemetry opt-out together with the team config; open changes in the old shape are reported, not rewritten
- Out of scope for blocking: OpenSpec versions other than the pin, Windows shells and non-git projects; findings there become follow-ups
- Feature-specific criteria:
  - Invariant: a deploy that syncs the team config never proceeds on a machine whose OpenSpec CLI is missing or differs from `team-config/openspec-version`
    Positive witness: a fake `openspec` reporting the pinned version lets the check exit 0, and the real deploy with the real CLI completes
    Negative control: a fake reporting `1.14.2`, and a `PATH` with no `openspec`, MUST each exit non-zero with the exact `npm install -g @fission-ai/openspec@<pin>` line; the real deploy with the mismatching fake stops before `Installing dependencies` with `omp` and `omp.deployed` unchanged
    Observable: exit status, stderr, deploy log, sha256 of the installed `omp` and `omp.deployed` before and after
    Boundary: `bun scripts/ensure-openspec-cli.ts` as invoked by `scripts/deploy-local.sh`
  - Invariant: after the check passes, telemetry is persisted off in the global config OpenSpec reads in the deploying environment, and the check itself never runs `openspec` with telemetry allowed
    Positive witness: with a temporary `XDG_CONFIG_HOME` starting at `telemetry.enabled: true`, the real CLI reports `false` via `openspec config get telemetry.enabled` with `DO_NOT_TRACK` and `OPENSPEC_TELEMETRY` unset, and the check printed that config's path
    Negative control: a fake `openspec` that sees any call (`--version`, `config set`, `config get`, `config path`) without `DO_NOT_TRACK=1` and `OPENSPEC_TELEMETRY=0`, including when the caller sets `DO_NOT_TRACK=0 OPENSPEC_TELEMETRY=1`, or whose persisted value stays `true`, MUST fail the test or make the check exit 1
    Observable: persisted config value, fake's argv/env log, exit status, printed config path
    Boundary: OpenSpec global config file under `XDG_CONFIG_HOME`, read through `bun scripts/ensure-openspec-cli.ts`
  - Invariant: the project installer never loses content git cannot restore and writes nothing outside `openspec/schemas/omp-gated/` and an absent `openspec/config.yaml`
    Positive witness: on a clean git project it installs the canonical schema and config, the full project file list differs only by those paths, and `openspec new change probe` reports `omp-gated`; on a project whose committed template carries a local edit it replaces the template, `git status` shows the change and `git show HEAD:` returns the edit
    Negative control: a modified, an untracked and an ignored file under the workflow paths, a config with `schema: spec-driven` or no `schema:`, a symlinked `openspec/schemas/omp-gated`, and a non-git directory MUST each exit 1 with every file hash and `git status --porcelain` unchanged and no deletion suggested; a copy that fails after its first file MUST exit 1 with `git status --porcelain` empty and every project file byte-identical, also when the canonical tree adds a file `HEAD` lacks; when the rollback checkout fails too, the run MUST exit 1 saying the rollback did not complete and listing the dirty paths, never reporting the project as restored
    Observable: exit status, stderr, `git status --porcelain`, sha256 of every project file before and after
    Boundary: `node ~/.omp/agent/skills/review-work/scripts/install-openspec-workflow.mjs <project-root>`
  - Invariant: a project set up under the older team shape is told exactly what still blocks it, and nothing it owns is rewritten
    Positive witness: a config naming `scripts/validate-openspec-change.mjs`, that file, an open change whose `gate.md` has `- **Review tier**: standard`, and `.omp/commands/opsx-apply.md` each produce one notice naming the path and the fix, exit 0
    Negative control: the same `Review tier` gate.md under `openspec/changes/archive/`, an open change with only `Risk tier`, and a config without the old path MUST produce no notice; the flagged files MUST stay byte-identical
    Observable: installer stdout notice lines, exit status, sha256 of the flagged files
    Boundary: migration report of `install-openspec-workflow.mjs`, printed after a successful install
  - Mechanical: `openspec/schemas/omp-gated` is a symlink resolving to `team-config/agent/skills/review-work/openspec/schemas/omp-gated`, and after deploy `~/.omp/agent/skills/review-work/openspec/` equals that tree
    Invariant: one schema source for this repository, the deployed validator and every project install
    Observable: `readlink`, `diff -r` exit status
    Boundary: repository tree and deployed agent dir
