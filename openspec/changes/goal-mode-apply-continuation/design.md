# Design

## Context

See proposal.md - Why. `team-config/agent/commands/opsx-propose.md` is the output of the pinned OpenSpec version with team additions that the README's `Bumping OpenSpec` names. The planning boundary appears four times in it: the boundary paragraph (`:7`), "When the user is ready to implement, they must start the apply workflow explicitly" (`:17`), the Output prompt (`:151`) and the first guardrail (`:165`).

Goal mode in omp: an active goal puts its objective into the system context (`packages/coding-agent/src/prompts/goals/goal-mode-active.md`), and when a turn ends while the goal is active and the host is idle, the host controller submits a hidden user-role message that begins `Continue active goal.` and repeats the objective (`packages/coding-agent/src/goals/host-controller.ts:600-620`, `prompts/goals/goal-continuation.md`). Continuation runs in interactive and ACP hosts by default, and in RPC only when configured (`goals/settings.ts`, `goal.continuationModes`). ACP continues only while a client prompt is open (`modes/acp/acp-goal.ts:189`). The controller starts a continuation only when the session is idle with no admitted or queued submission (`host-controller.ts:600-606`); the interactive host waits 800 ms after the turn ends before it submits (`modes/interactive-mode.ts:3378-3423`). A message the user sends with Enter while a turn runs steers that running turn: it reaches the agent inside it (`modes/controllers/input-controller.ts:1392-1409`). A message sent while the agent is idle, before the continuation is submitted, takes the next turn; one sent after a continuation turn has started steers that turn.

`opsx-apply.md` takes the change name as its input and follows the schema's apply instruction, which refuses to edit source until `validate-openspec-change.mjs --reviewed` passes (`openspec/schemas/omp-gated/schema.yaml:687-691`).

## Goals / Non-Goals

**Goals:**
- A goal-mode session can run propose, then apply, change after change, without an owner message between them, when the owner asked for that in the objective.
- Every other session keeps today's boundary, word for word in effect.

**Non-Goals:**
- Changing goal-mode runtime code or its prompts.
- Changing `opsx-apply.md`, the review artifact, the validator or the merge gate.
- Letting a non-goal mechanism (a plan, a roadmap, a rule, project context) authorize apply in advance.

## Decisions

**D1. A team addition to `opsx-propose.md`, not runtime code or a rule.** The boundary lives in the command, so the exception has to be stated where the boundary is read, or an agent following the command keeps stopping (the onara roadmap review showed that a roadmap's own reading is not enough). Rejected: editing `goal-continuation.md` to say it authorizes apply (it is generic goal runtime text read for every goal, and the fork tracks upstream there); an always-apply rule (context cost in every session for one command); objective wording alone (that is the interpretation the command does not state).

**D2. The exception crosses a turn boundary; it never applies in the planning turn.** The continuation is a new user-role message after the artifacts were presented, which is what the boundary asks for. Keeping the turn boundary costs one automatic turn. In an interactive host the continuation follows 800 ms after the turn ends, so the owner's veto is a message sent while the planning turn runs (it steers that turn), a message sent in the 800 ms before the continuation, or pausing the goal. Every such message counts, so the exception's condition is "no user message since this workflow started for the change", not "since the presentation". Rejected: applying in the same turn under goal mode (removes that chance and contradicts the guardrail's purpose).

**D3. The objective must authorize apply explicitly.** Goals that plan a programme without implementing it are legitimate, so an active goal alone is not authorization. The addition gives example wording and states that "execute the roadmap" without such a sentence does not count. Rejected: any active goal; a configuration flag (one more setting for a choice the objective already expresses per goal).

**D4. The reviewed validation is a precondition of the exception, checked before apply starts.** The schema's apply instruction would refuse an unreviewed change anyway; stating it in the exception makes the turn report the failed condition instead of entering apply and stopping there.

**D5. A user message wins.** Any user message after this workflow started for the change, other than the request that invoked it, is the new request and decides what happens to the change; no later continuation applies against it. This covers a message that steered the planning turn and one that took the turn after it. A message that steers a continuation turn already running reaches the agent inside that turn, possibly after apply started; that is an accepted residual (gate.md).

**D6. The output carries a notice.** Under the exception the proposal output says the next continuation applies the change, and that a message before that turn starts or pausing the goal stops it, so the owner knows how to veto.

Delivered text (task 2.1 inserts it verbatim after the boundary paragraph; the fence is not part of it):

```
**Goal-mode continuation** (team addition): an active goal can supply the new user request for one change. It does so only when all of these hold:

- The turn was started by the goal continuation: the hidden message that begins `Continue active goal.` and repeats the objective. A turn the user started is not one.
- The goal's objective explicitly authorizes applying the OpenSpec changes the goal proposes, for example "apply each reviewed proposal" or "each goal continuation is the owner's request to apply the change the previous turn proposed". An objective that only asks to plan, propose, or execute a roadmap, without saying that its changes are applied, does not.
- This workflow presented that change's artifacts in an earlier turn, and no user message has arrived since this workflow started for the change, other than the request that invoked it. A message that reached you while the planning turn ran counts. Any such message is the new request and decides instead, and no later continuation applies the change against it.
- `node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed <change-dir>` passes for the change now.

Then that turn runs the apply workflow (`opsx-apply.md`) with the change name as its input. If any condition fails, do not apply: say in the turn's reply which condition failed, and continue the goal with other work or stop as its objective directs. Never start apply in the turn that ran this workflow, goal or not.
```

Other edits: `:7` gains "The goal-mode continuation below is the only exception."; `:17` gains "(or an active goal authorizes it; see Goal-mode continuation)"; the Output gains, after the prompt line, "- Under the goal-mode continuation, add: \"Goal mode: the next goal continuation applies `<name>`. To stop it, send a message before that turn starts or pause the goal.\""; the `:165` guardrail, which has no final full stop, gains ". The goal-mode continuation is the only exception, and never within the turn that ran this workflow."

No mechanism in this change falls under `Build vs. adopt`: it is instruction text.

Scope: one command text and the README, one mechanism. They ship together because the README names the addition the command carries.

## Risks / Trade-offs

- [An agent reads a user-started turn as a continuation] → The condition names the continuation's literal opening and says a user-started turn is not one; F1 runs a user-message row.
- [An objective is read as authorizing when it does not] → D3's examples and its explicit non-example; F1 runs a planning-only objective.
- [A failed review makes the goal loop on continuations] → The turn reports the failed condition and follows the objective's own stop rules; the exception adds no retry.
- [A bump drops the addition] → README names it as an expected diff (review-follow-ups requirement).
- [Compliance is shown on fixtures, not as a rate] → accepted residual in gate.md.

## Migration Plan

Merge, then `scripts/deploy-local.sh` installs the command into every profile that carries the team config; running sessions pick it up after a restart. Rollback: revert and redeploy; changes applied in the meantime went through the normal apply and merge gates.
