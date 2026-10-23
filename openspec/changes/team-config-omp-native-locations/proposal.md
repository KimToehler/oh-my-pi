# Proposal

## Why

The team config still runs on oh-my-openagent (OmO) conventions: plans default to `.omo/plans`, the gate ledger lives in `.omo/ulw-execute/`, delta artifacts in `.omo/gate-deltas/`, evidence and gate records in `.omo/evidence/`, and the record id is `omo.merge-gate/v2`. omp has its own plan location (`.omp/plans`, the default when `plan.autosaveDir` is unset) and the OmO runtime is no longer used. This change is step P5a of `.omo/plans/harness-integration.md` (decided by Tim, 2026-10-23): team-config stops carrying the OmO name and uses omp-native locations, with a clean cutover.

## What Changes

- Plans: `plan.autosaveDir: .omo/plans` leaves `team-config/seed/config.yml`, so plans land in omp's default `.omp/plans`. An existing install's `config.yml` is never rewritten; the deploy prints a notice when it still points at an `.omo` plan directory.
- Everything omp has no native place for moves under `.omp/team-config/`:
  - `evidence/` for QA artifacts and reviewer trailers, `evidence/gate/` for gate records (the defaults the guidance names; a project may keep records elsewhere, as onara does under `docs/evidence/`);
  - `ledger.jsonl` (was `.omo/ulw-execute/ledger.jsonl`);
  - `gate-deltas/` (was `.omo/gate-deltas/`);
  - `frontend-design/state.md` (was `.omo/frontend-design/state.md`, the frontend skill's design state).
- **BREAKING** The record id `omo.merge-gate/v2` becomes `team-config.merge-gate/v3`. `validate-gate-record.mjs` and the merge-gate extension accept only the new id. No second read path, no alias. Every record written before the cutover carries a retired id, so none of them lets the stop hook pass, wherever it lies, including a historical v2 record already merged into the default branch. Record and trailer paths stay free.
- **BREAKING** `gate-convergence.mjs` reads and writes only the new ledger and delta locations. A gate running on the old ledger is finished with the old tooling before the deploy; no migration code.
- Rules (texts and globs), the review-work, integration-review, visual-qa, frontend and git-master skills, and `team-config/README.md` name the new locations and record id. The README documents the `.omp/team-config/` layout and the ignore rules a project needs.
- This repository's root `.gitignore` gains the `.omp/team-config/` policy: ledger, gate deltas, design state and QA output stay local; gate records and trailers stay addable.

Not part of this change: moving this repository's existing `.omo/plans` and `.omo/evidence` (P5b, which also retires the root `.gitignore` `.omo` block), removing the OmO platform from `coding-agent-sessions` and deleting local OmO state (P5c), the `oh-my-openagent` provenance notes in the README (kept on purpose).

## Capabilities

### New Capabilities

- `merge-gate-record`: which gate record backs a merge or completion claim: its id, and how the validator and the stop hook refuse a record under a retired id.
- `gate-workspace-layout`: where the team-config gate tooling keeps its ledger, delta artifacts and evidence, which of them a repository ignores, and which locations the shipped skills and rules name.
- `team-config-install`: what the team-config seed and deploy do with plan locations for new and existing installs.

### Modified Capabilities

None: `openspec/specs/` holds no capability yet.

## Impact

- Gate scripts: `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs`, `gate-convergence.mjs`, their tests and JSON fixtures.
- Extension: `team-config/agent/extensions/merge-gate.ts`, `lib/gate-record.ts`, `team-config/tests/merge-gate.test.ts`.
- Installer: `scripts/install-team-config.ts` (deploy notice) and its test; `team-config/seed/config.yml`.
- Guidance: rules `evidence-discipline`, `merge-gate-proof`, `plan-merge-gate`, `plan-handoff`, `lesson-scope`, `lesson-size-gate-to-audience`, `lesson-answer-only-about-the-worktree…`, `lesson-keep-next-step-advice…`, `lesson-never-end-a-turn-waiting…`; skills `review-work`, `integration-review`, `visual-qa`, `frontend/references/designpowers/*`, `git-master/references/github-attachment-upload.md`; `team-config/README.md`.
- Repository: root `.gitignore`.
- Every machine that deploys team-config: after the deploy, new gates write v3 records under `.omp/team-config/`; old records remain an archive. Gates open in other worktrees at deploy time (today `acp-v2-surface`, `fork-compaction-budget`) must finish first.
- omp core (`packages/`): unchanged. omp loads only fixed `.omp/` subfolders, so `.omp/team-config/` is never read as rules, skills, commands, prompts or context.
