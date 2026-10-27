# Design

## Context

See proposal.md - Why. Current state (paths relative to `team-config/agent/skills/review-work/`):

- `openspec/schemas/omp-gated/schema.yaml`, artifact `review`: step 3 dispatches one fresh `plan-reviewer` task with a fixed context line and a fixed brief, and forbids any planner-added focus ("what the planner thinks matters steers the reviewer away from what the planner missed"). Step 4 fixes blockers for at most two fix rounds; step 5 writes `review.md` with `plan-reviewer, <subagent id>`; step 6 asks the user per open blocker after a final REJECT.
- `openspec/schemas/omp-gated/templates/review.md`: `- **Reviewer**: plan-reviewer, <subagent id>`, a `## Blockers` section with one placeholder.
- `scripts/validate-openspec-change.mjs` `checkReview`: `Reviewer` must match `^plan-reviewer\s*,\s*[A-Za-z0-9][\w.-]*$` (exactly one id); a REJECT needs non-`none` blockers; nothing constrains the blockers of an OKAY.
- `scripts/install-openspec-workflow.test.ts` fills the template by replacing `<subagent id>` once.
- The `plan-reviewer` prompt (`packages/coding-agent/src/prompts/agents/plan-reviewer.md`) numbers its `<review_scope>` items 1 to 5 and defines CHECK 1 to 8; rules with `agents: [plan-reviewer]` (`plan-review-process.md`, `plan-review-eval-domain.md`) add checks under their own labels.
- The oh-my-pi repository links `openspec/schemas/omp-gated` to the canonical schema; onara and weaver hold copies written by `install-openspec-workflow.mjs`. onara has an open change (`strength-progression-targets`, mid-implementation) whose current `review.md` names one reviewer id.

## Goals / Non-Goals

**Goals:**
- Raise the share of existing plan defects one review round finds, with the lens split that the replay measured.
- Keep every existing valid review record valid.

**Non-Goals:**
- Verifying blockers before they are fixed, deduplicating them across lenses, or changing what counts as a blocker.
- Detecting a stalled subagent in the `task` tool.
- Any change to the `plan-reviewer` prompt, its model role, fix-delta reviews or plan-mode plan reviews.

## Decisions

**D1. Three fixed lenses per round, in one batch.** The round dispatches three fresh `plan-reviewer` tasks in one `task` call, sharing the existing context line. Each brief is the fixed brief, unchanged, then one lens paragraph from the schema. The rule against planner-added focus stays: the lens paragraphs are part of the schema, the same for every change, so they carry nothing the planner believes about this change. Alternatives measured in the replay and rejected: three repeats of the unrestricted review (13 of 85 latent defects against 23 of 85 for the lens split), one review with `high` thinking (no recall gain over `medium` at 1.7–2× the cost). A two-lens split was not measured; the checks lens stays because item 4 (security) and the mechanical checks have no other owner.

**D2. Lens texts.** The three paragraphs are the texts the replay ran, with one addition. The measured checks text covered "the eight mechanical checks and the merge-gate `Boundary:` rule only", while the other two lenses say the mechanical checks are covered elsewhere; checks defined by rules loaded for the reviewer (`DOMAIN …`, process checks) would then have no lens. The checks paragraph therefore also names "every further check that rules loaded for you define". Paragraph texts:

- Correctness: "Focus for this review: review_scope items 1 and 2 only (correctness and reasoning, architecture). Check every claim the plan makes about existing code against the repo, trace each requirement end to end through the design to the code it touches, including every caller and read path that consumes the changed entity, missing cases, error and boundary input, ordering and lifecycle. Verification quality, executability, security and the mechanical checks are covered by separate reviews; spend your whole effort on your focus and work through it exhaustively, plan file by plan file."
- Verification: "Focus for this review: review_scope items 3 and 5 only (quality and verification, executability). Go through every `### Requirement:` and every `#### Scenario:`, and name the task and test that proves it; then go through every task and decide whether its Verify command and listed tests could fail when that task is broken. Include the final verification tasks (F1/F3) and their evidence checks. Correctness of the design, security and the mechanical checks are covered by separate reviews; spend your whole effort on your focus and work through it exhaustively, requirement by requirement and task by task."
- Checks: "Focus for this review: review_scope item 4 (security and privacy), the eight mechanical checks, every further check that rules loaded for you define, and the merge-gate `Boundary:` rule only. For each check decide explicitly whether the plan contains its trigger; for every triggered check, do the complete inventory the check requires (every holder and sink, every input, every entry path, every derivation, every default) by searching the repo, and compare it with what the plan provides. Correctness of the design and verification of individual tasks are covered by separate reviews; spend your whole effort on your focus and work through every check exhaustively."

**D3. Round verdict and record.** OKAY only when all three lenses return OKAY. `review.md` keeps one `## Blockers` section; for a REJECT it holds one `### <Lens> (<subagent id>)` subsection per rejecting lens with that lens's blockers verbatim; for an OKAY it is `none`. Blockers that two lenses both raise stay in both subsections: merging them is a planner judgment that could drop one, and step 4 fixes each blocker anyway. Lens notes are not recorded, as today. Alternative rejected: one merged blocker list without lens attribution, which hides which lens found what and makes the later rounds-to-OKAY measurement impossible.

**D4. Incomplete round.** A lens without a structured verdict (failed task, unparsable output, or a task the agent stopped because it made no progress) gets one fresh retry with the same brief. If the retry also has none, the round is incomplete: the agent writes no record and tells the user which lens failed. This mirrors review-work's rule for a fix-delta review without a structured verdict (`SKILL.md`, "Fix waves: delta review and convergence (F2)", step e: "one fresh retry; still none → stop and tell the user").

**D5. Validator: a reviewer list, not a count.** `Reviewer` becomes `plan-reviewer` followed by one or more comma-separated ids, each matching today's id pattern, pairwise distinct. The validator does not require three ids: onara's open change has a valid one-id record that a three-id rule would reject mid-implementation, and projects keep dispatching one reviewer until their schema copy is reinstalled. Requiring three would not add a guarantee either, since the validator cannot witness a dispatch today (README: "Both checks are prompt-level"). Alternative rejected: a format version field, which would keep two record formats alive indefinitely. New guard: an OKAY whose `## Blockers` is not `none` is refused, so a round where one lens rejected cannot be recorded as OKAY with its blockers attached. The only open-change review records today (onara `strength-progression-targets`, in the main checkout and its worktree; oh-my-pi and weaver have none) are OKAY with `none`.

**Scope.** Two independently testable parts: the schema instruction with its template (prompt text, checked by `openspec instructions` and manual QA) and the validator (unit tests). They share one contract, the `review.md` record format, and ship together.

## Risks / Trade-offs

- [A round costs about three reviews and lasts as long as its slowest lens] → measured at about $0.25 per round on `gpt-6.1-terra:medium`; whether fewer rounds offset it is the follow-up measurement, not assumed here.
- [More blockers per round: the replay's lens rounds raised 6–15 blockers against 3–6 for one review, and about 40 % of round-1 blockers were invalid or below blocker severity in a single-pass verification] → more fix work per round; step 6's "recommend Accept when the fix widens the plan" still applies. Blocker verification is a separate decision.
- [Lens subagents stalled without progress in about 11 of 60 replay runs] → D4 lets the agent stop a stalled lens and retry it; the instruction says so.
- [The validator accepts a one-id record written after this change by an agent that skipped two lenses] → accepted residual risk (gate.md); the same agent could write any record today.
- [Rollback to the old validator rejects three-id records] → rollback also re-runs the review of any open change recorded in the new format.

## Migration Plan

1. Merge; run `scripts/deploy-local.sh` (validator and canonical schema under the agent directory).
2. Run `install-openspec-workflow.mjs` in onara and weaver and commit the schema copy there. Until then those projects dispatch one reviewer; their records stay valid.
3. No session restart: `openspec instructions` reads the schema per call and the validator runs per command.
