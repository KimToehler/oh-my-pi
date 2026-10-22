# OpenSpec team rollout

## Goal

Ship one versioned OpenSpec workflow for the team without replacing omp execution or merge enforcement:

- global omp slash commands supplied by `team-config`;
- project-local, harness-independent OpenSpec config and `omp-gated` schema;
- deterministic validation for the team-specific contract OpenSpec does not validate;
- no changes to `merge-gate.ts`, review-work, ACP plan mode or the gate validator in this plan.

Decisions by Tim (2026-10-22): rollout is team-wide now; behaviour-changing features use OpenSpec and small work uses omp plan mode; independent review later follows option B (existing core cross-family review over the OpenSpec change folder) plus artifact hashes at merge time; all distributed material remains public and free.

Decision by Tim (2026-10-22, after F3 delta round 1 REJECT): split distribution out of P3. P3 ships content only (commands, schema, validator) with a documented manual project setup; the project-local installer, the deploy-time OpenSpec CLI version check and the automatic telemetry opt-out move to `.omo/plans/openspec-distribution.md` (P3b) with its own gate.

Decision by Tim (2026-10-22, after F3 delta round 2 REJECT): fix again, fail-closed. The validator does not emulate YAML; `skip_specs` is honoured only in flat metadata. The manual setup never overwrites a project's `openspec/config.yaml` and uses a clean git state of the workflow paths as the backup.

Decision by Tim (2026-10-22, after F3 delta round 3 REJECT): fix B1 (ignored/untracked destinations) and B2 (check-then-copy config), accept the round (`accepted-risk` in the convergence ledger), no round 4 on those commits. B3 is not a defect: row 14 forbids quotes and flow collections as YAML constructs, not as characters inside a plain scalar; OpenSpec 1.14.3 loads `goal: abc"def` and `goal: abc[def]` with `skip_specs: true` as plain strings (status `skipped`), so the validator matches it.

## Scope

Files:

- `team-config/agent/commands/opsx-{propose,explore,apply,update,sync,archive}.md` — OpenSpec 1.14.3 generated commands, commands-only delivery to avoid duplicate skill discovery.
- `openspec/config.yaml` — project rules and telemetry-independent workflow selection.
- `openspec/schemas/omp-gated/schema.yaml` and templates — fork of OpenSpec `spec-driven`, adding `gate.md` and exact validation syntax.
- `scripts/validate-openspec-change.mjs` and test — content validation absent from `openspec validate --strict`.
- `team-config/README.md` — CLI prerequisite, telemetry opt-out, usage and update path.
- `.omo/plans/harness-integration.md` — roadmap status only.

Out of scope: automatic OpenSpec CLI installation; user-level OpenSpec schema installation; plan-mode writable roots; review/hash records; migration/deletion of `.omo` artifacts; the project-local workflow installer, deploy-time OpenSpec CLI version check and telemetry opt-out automation (all P3b).

## Implementation

- [x] 1. Generate the six core omp commands from OpenSpec 1.14.3 and retain commands only. Verify each command invokes the OpenSpec CLI and the ACP slash-command loader sees project/user commands.
- [x] 2. Fork `spec-driven` to project-local `omp-gated`. Add `gate` after specs and before tasks. `gate.md` owns risk classification only; requirements/scenarios remain the behavioural truth.
- [x] 3. Require every Requirement to carry a `#### Scenario: Negative control` with WHEN/THEN, every tracked task to carry `Verify: \`<command>\``, and `gate.md` to carry one mandatory class, review tier, whole-diff decision, accepted residual risk and out-of-scope decision.
- [x] 4. Build `validate-openspec-change.mjs`. RED controls: missing Negative control, missing task command, invalid gate class and placeholder text must fail; a complete change must pass.
- [x] 5. Document `@fission-ai/openspec@1.14.3` as prerequisite and `openspec config set telemetry.enabled false` / `DO_NOT_TRACK=1`. Existing configs remain untouched by deploy.
- [x] 6. Smoke the real surface: initialize/use the checked-in schema, run `opsx-propose` through omp, run both OpenSpec strict validation and the team validator, and confirm all six commands are discoverable in ACP.

## TODOs

- [x] 7. Close `incomplete-tracked-task-enumeration` across `scripts/validate-openspec-change.mjs:validateTasks` and `openspec/schemas/omp-gated/schema.yaml` by validating every OpenSpec-tracked checkbox state, including mixed valid/invalid task files. Verify: `bun test scripts/validate-openspec-change.test.ts`
- [x] 8. Close `cross-line-gate-field-capture` across every required `gate.md` field by parsing top-level bullets line-by-line and rejecting empty adjacent values. Verify: `bun test scripts/validate-openspec-change.test.ts`
- [x] 9. Close `schema-validator-delta-operation-mismatch` across validator, schema, proposal template, and generated command contracts by accepting explicit `skip_specs` and every schema-supported delta operation while retaining Requirement negative controls where requirements exist. Verify: `bun test scripts/validate-openspec-change.test.ts && DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 bunx --bun @fission-ai/openspec@1.14.3 validate --strict --all`
- [x] 10. Close `undistributed-project-local-workflow-dependencies` across `team-config/README.md`, project assets, and installer ownership with a concrete project-local setup/update command that installs the versioned schema, config, and validator without user-level schema installation. Verify: execute the documented setup in a separate initialized temporary repository, then run both strict validators there.
- [ ] 11. Close `missing-f1-evidence` after the cleanup commit by rerunning every F1 scenario on the final F3 code SHA and storing one command-output evidence path per scenario under `.omo/evidence/openspec-team-rollout/`. Verify: evidence records the literal reviewed SHA and every command exit status.
- [x] 12. Close `delta-r1-skip-specs-raw-text`: `scripts/validate-openspec-change.mjs` honours `skip_specs` only when `.openspec.yaml` declares it exactly once with a plain boolean, and rejects duplicate, non-boolean, quoted, nested or malformed declarations with a `.openspec.yaml` diagnostic, matching OpenSpec 1.14.3 which refuses that metadata. Verify: `bun test scripts/validate-openspec-change.test.ts`
- [x] 13. Close `delta-r1-installer-ownership`, `delta-r1-foreign-schema-setup` and `delta-r1-new-subsystem` by re-scoping row 10: remove `scripts/install-openspec-workflow.ts`, its test, `team-config/openspec-config.yaml` and the `test:team-config` entry from P3 (they move to P3b); document the manual project setup in `team-config/README.md` as exact copy steps for `openspec/schemas/omp-gated/` and `scripts/validate-openspec-change.mjs`, `schema: omp-gated` in `openspec/config.yaml`, no `openspec init` needed, and the fix when `openspec init` already wrote another schema. Verify: follow the README steps verbatim in a separate temporary git repository, then `openspec new change`, `openspec status` shows `omp-gated`, and both strict validators run there.
- [x] 14. Close `delta-r2-metadata-line-approximation` in `scripts/validate-openspec-change.mjs`: when `.openspec.yaml` mentions `skip_specs` in any spelling or indentation, every non-blank, non-comment line MUST be a flat `key: value` line at column 0 with an unquoted key and a plain scalar value (no indentation, block or flow collections, quotes, document markers, tabs, anchors/aliases/tags, block scalars, or `: ` inside the value), no key may repeat, and `skip_specs` MUST be exactly `true` or `false`; anything else is a `.openspec.yaml` error that says skip_specs requires flat metadata. Without a `skip_specs` mention the file is not inspected and specs stay required. Verify: `bun test scripts/validate-openspec-change.test.ts` with negative controls for the round-2 example (`skip_specs: true` + `owner:` + `  broken: [`), nested map, block list, flow list, quoted value on another key, duplicate non-skip key, document marker, tab indentation and `: ` inside a value, plus a positive control that is the exact file `openspec new change` writes with `skip_specs: true` appended, accepted by both this validator and `openspec validate --strict`.
- [x] 15. Close `delta-r2-setup-overwrites-project-files` in `team-config/README.md`: setup and update start with a check that `git status --porcelain -- openspec/config.yaml openspec/schemas/omp-gated scripts/validate-openspec-change.mjs` prints nothing (committed state is the backup); an existing `openspec/config.yaml` is never overwritten (create it only when absent, with a no-clobber guard; otherwise change only the `schema:` line and merge `rules`/`operations` by hand); after copying, `git diff` and `git status` over those paths show every local change the copy replaced, and the README says to re-apply what should be kept before committing. Verify: in a temporary git repository holding a committed, locally edited validator, an extra file in the schema directory and an existing `openspec/config.yaml` with another schema and custom rules, follow the README verbatim; the custom rules survive byte-for-byte except the `schema:` line, `git diff`/`git status` list the replaced validator edit and the removed extra file, `git show HEAD:<path>` still returns both, and the precondition prints a path when one of them is dirty.
- [x] 16. Close `delta-r3-ignored-destinations` and `delta-r3-config-check-then-copy` in `team-config/README.md`: the step-1 precondition uses `git status --porcelain --ignored --untracked-files=all` over the three workflow paths and tells the user what to do with `??` and `!!` lines; step 3 creates `openspec/config.yaml` with `set -C` (O_EXCL no-clobber) instead of `[ -e ]` followed by `cp`. Verify: follow the README verbatim in temporary git repositories: an ignored validator and an untracked schema file each make step 1 print a `!!`/`??` line; step 3 against an existing config leaves it byte-identical under `/bin/sh`, `bash`, `zsh` and `dash`; first install and update scenarios still end with `Schema: omp-gated`.

## Final verification wave

- [ ] F3. Whole-diff review: `integration-review` over the finished P3 diff; needed because commands, schema, validator and distribution docs are four independently testable layers
- [x] F1. Manual QA on the real surface: OpenSpec 1.14.3 schema resolved and validated; `/opsx-propose` through real omp generated proposal/specs/gate/tasks and left `src/` unchanged; both validators passed; malformed artifact-class controls failed in tests; ACP advertised exactly the six global commands and advertised none without the command directory
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate

- Author's risk assessment: a broken schema or command can silently create incomplete plans across every team repo; impact is reversible before implementation but broad because distribution is user-wide
- Mandatory class: none (planning artifacts only; no auth, schema migration, public wire contract or concurrent state machine changes)
- Whole-diff review: needed (commands, schema, validator and team distribution span four layers)
- Accepted residual risks: OpenSpec CLI installation stays manual, so an unprepared machine gets a clear command-not-found instead of automatic setup; P3a is required before OpenSpec changes receive the current ACP independent-review dialog; until P3b lands, project setup and updates are manual copy steps and the deploy does not check the OpenSpec CLI version or set the telemetry opt-out
- Out of scope for blocking: OpenSpec behaviour outside version 1.14.3 and non-omp harness adapters; they become follow-ups rather than P3 blockers
- Feature-specific criteria:
  - Invariant: an OpenSpec change missing any team-required planning field cannot pass the deterministic validator
    Positive witness: a complete change containing proposal, specs, gate and verifiable tasks exits 0 and prints `passed`
    Negative control: remove one representative required field from each artifact class; every malformed fixture MUST exit non-zero and name the missing field
    Observable: validator exit status and diagnostics
    Boundary: `node scripts/validate-openspec-change.mjs <change-dir>`
  - Invariant: team members can invoke all six core OpenSpec workflows from omp without project-local generated command copies
    Positive witness: an ACP session rooted in a temporary initialized project advertises the six `opsx-*` commands and `/opsx-propose` writes valid planning artifacts only
    Negative control: remove the user command directory in the sandbox; ACP MUST stop advertising those six commands
    Observable: ACP `available_commands_update`, generated change files, unchanged source tree
    Boundary: deployed `team-config/agent/commands` plus omp ACP command discovery
  - Mechanical: checked-in schema is resolvable and structurally valid under OpenSpec 1.14.3
    Invariant: `openspec schema which omp-gated` resolves the project schema and `openspec schema validate omp-gated` succeeds
    Observable: schema path and command exit status
    Boundary: OpenSpec CLI schema resolver
