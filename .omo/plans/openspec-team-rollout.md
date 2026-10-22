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

Decision by Tim (2026-10-22, after the row-16 delta REJECT): fix B2 (a failed config write can leave a partial config that later runs refuse to repair); accept B1 (a process changing a workflow file between the step-1 check and the step-2 copy) as below the blocking threshold, because its trigger is a racing manual run on the user's own machine and the P3b installer is where a lock belongs.

Decision by Tim (2026-10-22, after the second REJECT on rows 16/17): step 3 becomes text with a YAML block and no shell command, which removes the `ln` destination-directory, chmod-failure and interrupted-write findings at the root; the round is accepted (`accepted-risk`), no further delta round on rows 16-18; F2 reviews the final diff.

Decision by Tim (2026-10-22, F3 wave 2 STOP): continue. Fix `setup-source-destination-aliasing` as row 19, delta-review it, then run F3 wave 3.

Decision by Tim (2026-10-22, F3 wave 3 and the row-21 OKAY): accept row 19's REJECT (`accepted-risk`: a committed `openspec/schemas` symlink into the fork and a source change between guard and copy are states the user constructs or races on their own machine); continue with row 20 for wave 3 B1; after the second REJECT on rows 20/21 fix the indented-heading and fenced-comment findings as row 22 and review rows 20-22 together. If that round finds further Markdown edge cases, accepting them is the recommended way out.

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
- [x] 17. Close `delta-r16-partial-config-on-write-failure` in `team-config/README.md` step 3: write the team content completely to a temporary file in `openspec/`, then create `openspec/config.yaml` with `ln` (atomic, fails when the file exists); a failed write never links, an existing config stays untouched and gets the merge instructions, and the temporary file is always removed. Verify: follow the README verbatim in temporary git repositories under `/bin/sh`, `bash`, `zsh` and `dash`: absent config is created with mode 644 and the team content; an existing config stays byte-identical; a `cat` that writes part of the content and exits 1 leaves no `openspec/config.yaml` and no temporary file; first install and update still end with `Schema: omp-gated`.
- [x] 18. Close `delta-r17-ln-directory-destination`, `delta-r17-chmod-failure` and `delta-r17-interrupted-cleanup` by replacing the step-3 shell block in `team-config/README.md` with instructions and a `yaml` block: create `openspec/config.yaml` with exactly that content when absent; otherwise change only the `schema:` line and merge `rules`/`operations` by hand. The `openspec init` paragraph stays consistent. Verify: the README setup section contains no shell command that writes `openspec/config.yaml`; following it verbatim (YAML block copied into the file) on a fresh repository and on an `openspec init` repository ends with `Schema: omp-gated`, and both validators pass on a minimal complete change.
- [x] 19. Close `setup-source-destination-aliasing` (F3 wave 2 B1) in `team-config/README.md` step 2: before deleting anything, require `$FORK/openspec/schemas/omp-gated/schema.yaml` and `$FORK/scripts/validate-openspec-change.mjs` to exist, and stop when `FORK` resolves to the current project (`pwd -P`); otherwise replace the schema directory and validator as before. Verify: run the README step-2 block verbatim with `FORK` set to (a) the same checkout, (b) a nonexistent path, (c) a separate oh-my-pi checkout; (a) and (b) leave `git status` empty and the schema directory present, (c) copies the files and `openspec new change probe` reports `omp-gated`.
- [x] 20. Close `proposal-content-unvalidated` (F3 wave 3 B1) in `scripts/validate-openspec-change.mjs`: `proposal.md` needs exactly one `## Why`, `## What Changes`, `## Capabilities` and `## Impact` section; Why, What Changes and Impact need content outside HTML comments; the proposal template's capability placeholders are rejected; the Capabilities subsections may stay empty. The README validator paragraph names the proposal rule. Verify: `bun test scripts/validate-openspec-change.test.ts` (a complete proposal with an empty `### Modified Capabilities` passes; each missing section and the unfilled schema template fail and name the field) and the F1 `/opsx-propose` output passes the validator.
- [x] 21. Close `delta-r20-fenced-and-heading-only-sections` in `scripts/validate-openspec-change.mjs:validateProposal`: lines inside fenced code blocks (``` or ~~~) are neither section headings nor content, and heading lines do not count as section content. Verify: `bun test scripts/validate-openspec-change.test.ts` (the four required headings only inside a fence fail with `expected exactly one ## <section> section`; `## Why` followed only by `### Details` fails with `proposal Why: section needs content`; the complete fixture with a fenced example in What Changes still passes) and the F1 `/opsx-propose` output passes the validator.
- [x] 22. Close `delta-r21-indented-heading-content` and `delta-r21-comment-markers-in-fences` in `scripts/validate-openspec-change.mjs:validateProposal`: one pass over the lines tracks fenced code blocks and HTML comments in context, so comment markers inside a fence change nothing and an unclosed `<!--` outside a fence hides the rest of the file (fail-closed, as a Markdown renderer hides it); ATX headings indented up to three spaces, with optional closing `#`s, count as headings (section boundaries) and not as content. Verify: `bun test scripts/validate-openspec-change.test.ts` (`## Why` holding only `  ### Details` fails with `proposal Why: section needs content`; `## Why` holding only an unclosed `<!--` comment fails the same way; a fenced example containing `<!--`, followed by the real sections and a later `-->`, passes) and the F1 `/opsx-propose` output passes the validator.

## Final verification wave

- [ ] F3. Whole-diff review: `integration-review` over the finished P3 diff; needed because commands, schema, validator and distribution docs are four independently testable layers
- [x] F1. Manual QA on the real surface: OpenSpec 1.14.3 schema resolved and validated; `/opsx-propose` through real omp generated proposal/specs/gate/tasks and left `src/` unchanged; both validators passed; malformed artifact-class controls failed in tests; ACP advertised exactly the six global commands and advertised none without the command directory
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate

- Author's risk assessment: a broken schema or command can silently create incomplete plans across every team repo; impact is reversible before implementation but broad because distribution is user-wide
- Mandatory class: none (planning artifacts only; no auth, schema migration, public wire contract or concurrent state machine changes)
- Whole-diff review: needed (commands, schema, validator and team distribution span four layers)
- Accepted residual risks: OpenSpec CLI installation stays manual, so an unprepared machine gets a clear command-not-found instead of automatic setup; P3a is required before OpenSpec changes receive the current ACP independent-review dialog; until P3b lands, project setup and updates are manual copy steps and the deploy does not check the OpenSpec CLI version or set the telemetry opt-out; the manual setup does not lock the workflow paths, so a process that changes one between the step-1 check and the step-2 copy loses that change (P3b's installer owns locking)
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
