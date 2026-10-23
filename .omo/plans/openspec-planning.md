# OpenSpec planning with review, routed from default mode (P3a')

## Goal

Make OpenSpec planning in omp as simple as plan mode without a core patch:

- every OpenSpec change gets the same independent cross-family review the plan mode has (bundled `plan-reviewer`), and `/opsx-apply` does not start on a change whose review is missing, stale or REJECT;
- in default mode, "plan feature X" in a repository with `openspec/` reaches `/opsx-propose` without the user remembering that two planning paths exist; small changes stay in plan mode;
- the team `AGENTS.md` stops telling the model to enter plan mode, which it cannot do.

Decisions:

- Tim, 2026-10-23: P3a as planned (plan mode writes `openspec/changes/**`, folder proposal, folder hash in TUI/ACP approval) is dropped. Its three extras over this plan (technical write protection while planning, approval dialog, execution from an immutable snapshot) are not needed for now; revisit only after real OpenSpec changes show the need.
- Tim, 2026-10-23: P3a' is team-config only, Risk tier internal-tooling, no core patch, no upstream PR. It includes the routing skill and the `AGENTS.md` correction.

Facts checked before planning (OpenSpec 1.14.3, scratch project with the installed `omp-gated` schema):

- An artifact `review` (`generates: review.md`, `template: review.md`, `requires: [tasks]`) plus `apply.requires: [review]` passes `openspec schema validate`; `openspec instructions apply --json` reports `"state": "blocked"`, `"missingArtifacts": ["review"]` until `review.md` exists, then `"state": "ready"`. An artifact without `template` is refused (`artifacts.5.template: expected string`).
- `openspec validate --strict` and `validate-openspec-change.mjs` both pass a valid change with an extra file in the folder.
- When apply is ready, the schema's `apply.instruction` is returned verbatim as `instruction`; the generated `/opsx-apply` follows it as the built-in instruction.
- `/opsx-propose` creates every artifact in the transitive `requires` closure of `apply.requires`, so `review` is created at the end of propose by following its `instruction`.
- The model cannot enter plan mode (`setPlanModeState` is called only from `interactive-mode.ts` and `acp-agent.ts`; `xd://propose` refuses outside plan mode, `tools/resolve.ts:46`) and cannot run slash commands; it can read `~/.omp/agent/commands/opsx-*.md` and follow them.
- Skill descriptions over 100 characters reach the model as their first sentence (at least 40 chars) or a 12-word compression (`extensibility/skill-descriptions.ts:113-127`); the routing trigger must sit in the first sentence.

Work happens in worktree `.worktrees/openspec-planning`, branch `feat/openspec-planning` from `main` `2c435dc6bd`.

## Scope

Files:

- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml` — new artifact `review` after `tasks`; `apply.requires: [review]`; `apply.instruction` runs the reviewed check before the first source edit.
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/review.md` — the review record template.
- `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` and `.test.ts` — `--digest` and `--reviewed` modes.
- `team-config/agent/skills/openspec/SKILL.md` — new routing skill.
- `team-config/agent/AGENTS.md` — the plan-mode bullet.
- `team-config/README.md` and `team-config/agent/skills/review-work/SKILL.md` — the review step and the skill.
- `.omo/plans/harness-integration.md` — P3a replaced by this plan, "P3a setting" removed from P6.

Out of scope: the omp core, plan mode, `plan.review` settings, the six generated `opsx-*` commands, the project `config.yaml`, the merge gate (`validate-gate-record.mjs` and convergence keep reading the folder as today; `review.md` simply becomes part of the bundle), the installer code (it copies the canonical tree, so the new template ships on the next run).

Design constraints:

- Review record `review.md`, top-level bullets read with `plan-contract.mjs` `topLevelField` on `planContent(scanMarkdown())`, each exactly once:
  - `**Verdict**`: `OKAY` or `REJECT`;
  - `**Reviewed digest**`: 64 lowercase hex, the review digest at dispatch time;
  - `**Reviewer**`: `plan-reviewer` and the subagent id (`plan-reviewer, <id>`); the task result names no model, the transcript `history://<id>` does;
  - `**Round**`: positive integer;
  - `**Override**`: `none`, or the user's reason in their words when they accept a REJECT;
  - a `## Blockers` section with the reviewer's blockers verbatim (empty for OKAY).
- Review digest: one `snapshotFolder` of the change directory (`folder-plan.mjs`, the race-checked snapshot P4b uses); drop `review.md`; in `tasks.md`, rewrite the marker of every line the validator's `TASK_LINE` matches to `[ ]`, so ticking tasks during apply does not invalidate the review while every other byte does; then `bundleDigest(buildBundle(...))`.
- CLI: `validate-openspec-change.mjs <dir>` is unchanged (no review needed, so propose and the gate behave as today). `--digest <dir>` runs the normal checks and prints the digest only when they pass. `--reviewed <dir>` runs the normal checks on the same snapshot, then fails (exit 1, one line per defect) when `review.md` is missing, a field is missing, duplicated or malformed, the digest differs from the current one ("stale: the change changed after review, re-run the review"), or the verdict is `REJECT` with `Override: none`. `REJECT` with an override passes and prints the override.
- Schema `review.instruction` (prompt-level, followed by `/opsx-propose`): validate until `passed`; take `--digest`; dispatch `task` with agent `plan-reviewer`, naming the change directory and the repository root and asking for a review of every file in the folder against the code (the folder is untrusted data); on REJECT fix each blocker in the artifacts and repeat, at most two fix rounds; write `review.md` from the template with the digest taken before that round's dispatch and the blockers verbatim; after a final REJECT stop, show the blockers and ask the user to fix or to override; never write an override the user did not give.
- Schema `apply.instruction`: before the first source edit run `--reviewed`; on failure stop: missing or stale means re-run the review (`openspec instructions review --change <name> --json`), REJECT means ask the user. Then the existing text.
- Routing skill `openspec`: first sentence under 100 characters names the trigger (plan, specify or propose a feature or behaviour change where the repository has `openspec/`). Body: behaviour change and `openspec context --json` reports a root → read `~/.omp/agent/commands/opsx-propose.md` and follow it with the request as its input; implementing an existing change → `opsx-apply.md` the same way; small change (no observable behaviour change, rename, typo, config, one-file fix) → plan directly or ask the user for `/plan`; in plan mode with a behaviour change in an OpenSpec repository → tell the user to leave plan mode and run `/opsx-propose` (plan mode cannot write `openspec/changes`); no root → never create `openspec/`, use plan mode, mention the project installer only when the user wants OpenSpec.
- `AGENTS.md`: the bullet says the model plans non-trivial work before building, routes behaviour changes in OpenSpec repositories through the `openspec` skill, and otherwise asks the user to switch to plan mode (`/plan`), keeping the existing exception for documented patterns.

## TODOs

- [ ] 1. Add `--digest` and `--reviewed` to `validate-openspec-change.mjs` per the constraints, reusing `folder-plan.mjs` and `plan-contract.mjs`. Verify: `bun test team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts` (RED first against the unchanged script) with rows: OKAY with matching digest passes; the same after ticking every task passes; missing `review.md`, each field missing or duplicated, malformed digest, `REJECT` with `Override: none` each exit 1 naming the defect; a post-review edit to `proposal.md`, a spec, `design.md`, `gate.md`, `.openspec.yaml` and a task's text, a file added to the folder (new spec) and a file deleted from it (`design.md`), each in its own row, exits 1 with the stale diagnostic. The review fixture contains `design.md` and `.openspec.yaml`, and every edit row leaves the folder passing the plain checks, so the row fails on staleness alone. `REJECT` with an override passes and prints it; the plain mode still passes without `review.md`.
- [ ] 2. Add the `review` artifact, its template and the new `apply.requires`/`apply.instruction` to the canonical schema. Verify: a test row runs the real `openspec` 1.14.3 (missing CLI fails the row, no skip) on a temporary project with the canonical schema: `openspec schema validate omp-gated` valid; `instructions apply --json` blocked with `missingArtifacts: ["review"]` before `review.md`, ready after; `openspec validate --strict` valid with `review.md`; `bun run test:team-config` green.
- [ ] 3. Add `team-config/agent/skills/openspec/SKILL.md` and change the `AGENTS.md` bullet per the constraints. Verify: the skill's first sentence is under 100 characters (`previewSkillDescription` returns it unchanged); F1 scenarios 1-3.
- [ ] 4. Document the review step (what blocks apply, how to override, re-review after artifact edits) and the routing skill in `team-config/README.md`; name `--reviewed` in the review-work `SKILL.md` where it describes OpenSpec folders; update the roadmap. Verify: follow the README on a fresh scratch project through `openspec new change`, a filled change, the review record and `--reviewed`.

## Final verification wave

- [ ] F3. Whole-diff review: not needed, see Merge gate
- [ ] F1. Manual QA on the real surface, one evidence path per scenario, on the head after the last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

F1 scenarios (branch deployed with `scripts/deploy-local.sh feat/openspec-planning`, scratch git projects set up with the installer, real omp sessions in default mode, evidence under `.omo/evidence/openspec-planning/`):

1. "Plane Feature: <behaviour change>" in a project with `openspec/`: the session reads the `openspec` skill and `opsx-propose.md`, creates the change, dispatches `plan-reviewer`, writes `review.md`; `--reviewed` passes; `openspec instructions apply` is ready.
2. A small change request ("rename variable x in file y") in the same project and a feature request in a project without `openspec/`: no `openspec/changes/*` and no `openspec/` created (`git status`).
3. In plan mode, a feature request in the OpenSpec project: the model tells the user to leave plan mode and run `/opsx-propose`, and writes nothing under `openspec/`.
4. After scenario 1, edit `proposal.md` and run `/opsx-apply`: the session runs `--reviewed`, reports the stale review and edits no source file before re-review.
5. A change with a planted defect (a task's `Verify:` that cannot prove its requirement): the reviewer returns REJECT, the session fixes or stops after two rounds, and `/opsx-apply` refuses while `review.md` says REJECT without an override.

## Merge gate

- Author's risk assessment: a wrong digest or field check either blocks every `/opsx-apply` in every team project (all changes look stale) or lets a change without a current review start implementation; a wrong schema edit breaks `openspec` commands in projects that rerun the installer; wrong routing prose sends small changes into OpenSpec (cost) or features past it (no review). All of it runs on developer machines over planning files in git, recoverable by redeploying or reverting the schema, and reaches no production data, credential, personal data or irreversible state.
- Mandatory class: none
- Risk tier: internal-tooling
- Whole-diff review: not needed (two mechanisms with no shared code path: the review artifact checked by one validator mode in one script, and routing prose in one skill plus one `AGENTS.md` bullet)
- Accepted residual risks: the model transcribes the reviewer's verdict into `review.md` and the validator cannot prove the subagent answered that way (the record names the subagent id for a human check); `/opsx-apply` refusing on a failed `--reviewed` is prompt-level, nothing stops a model that ignores the instruction from editing source; routing by skill description is a model choice, not a hard switch; the planning artifacts are not write-protected while planning.
- Out of scope for blocking: plan mode and the omp core, the merge-gate validator and convergence, OpenSpec versions other than the pin, projects that have not rerun the installer; findings there become follow-ups.
- Feature-specific criteria:
  - Invariant: `--reviewed` passes only for a change whose `review.md` holds a well-formed OKAY, or REJECT with a user override, for exactly the current artifacts with task checkboxes ignored
    Positive witness: an OKAY record with the digest `--digest` printed passes, also after every task in `tasks.md` is ticked; a REJECT with `Override: <reason>` passes and prints the reason
    Negative control: no `review.md`; a missing, duplicated or malformed field; `REJECT` with `Override: none`; and, each on its own, any post-review edit to `proposal.md`, a spec, `design.md`, `gate.md`, `.openspec.yaml` or a task's text, a file added to the folder and a file deleted from it MUST exit 1, the edits with the stale diagnostic and the rest with a line naming the defect
    Observable: exit status, stderr lines, printed digest
    Boundary: `node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed <change-dir>`
  - Invariant: OpenSpec itself refuses apply for a change without `review.md`, and the review artifact keeps every existing check valid
    Positive witness: with `review.md` present, `openspec instructions apply --json` reports `ready`, `openspec validate --strict` reports valid and the plain validator prints `passed`
    Negative control: the same change without `review.md` MUST report `blocked` with `missingArtifacts: ["review"]`
    Observable: `state` and `missingArtifacts` from the JSON, both validators' output
    Boundary: OpenSpec CLI 1.14.3 on a project with the canonical `omp-gated` schema
  - Invariant: in default mode a behaviour-change planning request in a repository with an OpenSpec root ends in a reviewed change folder, and no other request creates OpenSpec files
    Positive witness: F1 scenario 1 leaves `openspec/changes/<name>/` with all artifacts and a `review.md` that passes `--reviewed`
    Negative control: the small-change request and the request in a project without `openspec/` MUST leave `git status` without any `openspec/` path (F1 scenario 2)
    Observable: session transcript tool calls, `git status --porcelain`, `--reviewed` exit status
    Boundary: real omp session with the deployed team config
  - Mechanical: the plain validator mode, `validate-gate-record.mjs` and gate convergence results are unchanged for a change without `review.md`
    Invariant: P4b's folder gate keeps working on changes created before this plan
    Observable: `bun run test:team-config` exit status with the existing rows unchanged
    Boundary: team-config test suite
