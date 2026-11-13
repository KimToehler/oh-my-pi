# Proposal

## Why

The `omp-gated` plan review checks a finished plan with `plan-reviewer` on `onara/cx/gpt-6.1-sol:high`. No step obtains a second-family architecture opinion before that review. A blinded pilot on three historical `risky` plans (`runs/fable-oracle-20261112/RESULT.md` on branch `experiment/fable-oracle-pilot`) compared the two models as architecture advisors. Claude Fable 5.2 (`high`) found 10 confirmed design-defect mechanisms, and Sol (`xhigh`) found 9. Each model found blocking mechanisms the other missed: 3 Fable-only, 2 Sol-only, each rated blocking by both blinded readers. Only Fable confirmed simplifications (2). At list price Fable cost about $6 per consultation, about 6.6× Sol. The two are complementary rather than substitutes. That cost justifies a consultation only where a wrong design is expensive. The plan review already marks those changes as `risky`: changes with a mandatory class or changes to a review, gate or release mechanism. The user decided:

- the consultation runs automatically at `risky` depth;
- `--reviewed` enforces it;
- the plan author decides each finding.

## What Changes

- New read-only team agent `architecture-oracle`, pinned in its definition to `onara/cc/claude-fable-5-2:high`, with tools `read, grep, glob` and a structured report: bottom line, up to five findings, recommended approach, residual uncertainties and inspected files. Its prompt is the pilot's oracle prompt with the experiment-only constraints removed.
- The team seed `models.yml` lists `cc/claude-fable-5-2` at its published list price. The seed config adds no fallback chain for it.
- The `review` artifact instruction gains a consultation step. It runs before the first `plan-reviewer` dispatch, full round or delta check, of a `risky` change whose folder holds no `consultation.md`, and on a re-run of a current OKAY review that lacks the record. At `standard` depth it runs only when the user asks. The step commits the folder and dispatches one fresh `architecture-oracle` item with a fixed brief, then checks the dispatch's model against the pin. A dispatch without a result, or one that ran on another model, gets one fresh retry. If the retry fails too, the user chooses between skipping with their reason and stopping; after a Stop, the user's request to consult again, for example after fixing the installation, allows two further attempts. The author marks every finding `adopted` (fixed in the artifacts) or `rejected` with a reason. The step writes `consultation.md` from a new template and commits it with the adopted fixes before round 1.
- The fixed review brief, the delta brief and the delta diff exclude `consultation.md`, so formal reviewers stay independent of the consultant's findings.
- `validate-openspec-change.mjs --reviewed` refuses a `risky` change without a well-formed `consultation.md`, meaning a completed consultation or a skip with the user's reason. It also refuses a malformed `consultation.md` at any depth.
- `team-config/README.md` and the delegation rule describe the step, its cost, and the manual `models.yml` merge that existing installations need.

## Capabilities

### New Capabilities

- `plan-architecture-consultation`: when an `omp-gated` change gets a cross-family architecture consultation before formal plan review, which agent and model run it, how the author records and applies its findings, and what `--reviewed` requires of that record.

### Modified Capabilities

- `openspec-plan-review`: "The user is asked only on named exceptions" gains one exception, the skip-or-stop ask after two failed consultation attempts. Its other requirements keep their text: brief fidelity and the pinned-model rule already cover any fixed brief and any pinned dispatch, and the consultation-specific rules live in the new capability.

## Impact

- `team-config/agent/agents/architecture-oracle.md` (new), `team-config/seed/models.yml`.
- `team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml`: the `review` instruction and both briefs. Also `templates/consultation.md` (new). This repository's `openspec/schemas/omp-gated` is a symlink to that directory.
- `team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs` and its test file. `install-openspec-workflow.test.ts` only if its fixture becomes `risky`; today it is `standard`.
- `team-config/README.md` and `team-config/agent/rules/delegation.md`.
- Rollout: `scripts/deploy-local.sh` installs the agent and the new schema files. Existing installations keep their own `models.yml` because the seed is copied only when the file is absent (`scripts/install-team-config.ts:604-615`). Until the entry is merged by hand, a consultation dispatch runs on another model, counts as having no result, and ends in the user's skip-or-stop choice. Consumer projects get the schema through `install-openspec-workflow.mjs`. Running sessions need a restart.
- Open `risky` changes on other branches (for example `plan-adopt-and-cap`, `approach-question-resume`) need a `consultation.md` before `--reviewed` passes again after this deploy. Either a consultation or a user-approved skip is enough. A change already reviewed OKAY re-runs the review, which records it without a further round unless an adopted finding edits the plan. `plan-adopt-and-cap` and `approach-question-resume` also edit the `review` instruction, so whichever merges second resolves a text conflict.
- Cost: about $4–8 at list price per `risky` change, once per change. The `task` tool has no per-dispatch cost cap.
