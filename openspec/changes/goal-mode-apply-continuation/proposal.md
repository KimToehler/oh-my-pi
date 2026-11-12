# Proposal

## Why

`/opsx-propose` ends every proposal with a planning boundary: the invoking request authorizes planning only, and apply needs a new user request after the artifacts are presented (`team-config/agent/commands/opsx-propose.md:7,165`). A goal-mode session that the owner started to run a whole programme of OpenSpec changes therefore stalls after each proposal. onara's generation-pipeline roadmap (2026-11-12) was rejected by plan-reviewer on exactly this point: the roadmap cannot authorize apply in advance against the command's text, so the roadmap had to plan either one owner pause per slice or rely on an interpretation the command does not state.

omp already sends a new user-role message at every goal turn boundary: the hidden goal continuation, which repeats the objective (`packages/coding-agent/src/goals/host-controller.ts:620`, `packages/coding-agent/src/prompts/goals/goal-continuation.md`). The command does not say whether that message counts as the new request, so one agent applies and another stops.

## What Changes

- `opsx-propose.md` gains a team addition, **Goal-mode continuation**, after its planning boundary. A goal continuation counts as the new user request for one change when the goal is active, its objective explicitly authorizes applying the changes it proposes, that change's artifacts were presented in an earlier turn and pass `validate-openspec-change.mjs --reviewed`, and no user message has arrived since. That continuation turn then runs `/opsx-apply` for the change.
- The boundary itself is unchanged in every other case: no apply in the turn that planned (goal or not), no apply on an objective that only asks to plan, on an unreviewed change, or after the user replied.
- The proposal output tells the owner, under this exception, that the next continuation applies the change, and how to stop it (a message queued before that turn, or pausing the goal).
- The boundary sentence, the "start the apply workflow explicitly" line and the planning guardrail name the exception as the only one.
- The README's `Bumping OpenSpec` procedure names the new team addition, so a regeneration re-applies it.
- No change to `opsx-apply.md`, the validator, the review artifact, the merge gate or goal-mode runtime code.

## Capabilities

### New Capabilities
- `openspec-planning-boundary`: when implementation may start after `/opsx-propose` has planned a change, including the goal-mode continuation that may stand in for the owner's new request.

### Modified Capabilities
- `review-follow-ups`: the requirement "The bump procedure names every team addition to the generated commands" gains the goal-mode continuation as a fourth named addition.

## Impact

- `team-config/agent/commands/opsx-propose.md`: one new paragraph after the planning boundary, and additions to the boundary sentence, line 17, the Output prompt and the planning guardrail.
- `team-config/README.md`: `Bumping OpenSpec` names four team additions.
- Deployed by `scripts/deploy-local.sh` to every omp profile that carries the team config. Affects only sessions with an active goal whose objective authorizes apply; every other session keeps today's boundary.
- Consumer: onara's `docs/roadmap/generation-pipeline.md` protocol step 3 already relies on this behaviour and can cite the command once this change is deployed.
