# Negative control: Blind review

Files read completely: team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (S, `review` instruction, lines 348-798), templates/consultation.md (T, 1-16), team-config/agent/agents/architecture-oracle.md (A, 1-38). Reviewer: InstructionReviewF1F3.

## Route 1: a reviewer reading `consultation.md`

Forbidding sentences:
- S:484-485 full-round brief: "Review every file in the change directory except review.md and consultation.md (neither is part of the plan; do not read them) against the repository."
- S:708-711 delta brief: "review.md is the review record and consultation.md the consultation record, neither is plan; do not read consultation.md".
- S:468-470 and S:475 each plan-reviewer item gets the brief "verbatim"; S:577-579 a retry uses "the same brief".
Permitting sentences considered:
- S:495-561 scope paragraphs (all scopes, A, B): no instruction to read the change folder wholesale beyond the brief's list. Fails.
- S:563-575 post-dispatch pin check reads the session file of the dispatch, by the orchestrator. Fails.
- S:612-618 the blocker-verifier brief names the change directory without the read prohibition. The verifier is not a reviewer and the control names "a reviewer"; counted as Observation O1, not a route.
Permitting sentences: none found
Verdict: forbidden

## Route 2: a delta patch containing `consultation.md`

Forbidding sentences:
- S:716-718 "The diff is {PATCH PATH}, written with `git diff {RECORDING COMMIT} -- {CHANGE DIR} ':!{CHANGE DIR}/review.md' ':!{CHANGE DIR}/consultation.md'`".
- S:726-727 "the patch goes under `.omp/team-config/gate-deltas/`, which is never committed".
Permitting sentences considered:
- S:701-703 "its patch, taken from the recording commit, covers the consultation edits too": the edits are plan-artifact changes; the pathspec of S:717 still excludes `consultation.md`. Fails.
- S:705 "substitute the `{...}` inputs, change nothing else": the pathspec is outside the substituted inputs. Fails.
- S:726 `{RECORDING COMMIT}` is a step-5 commit, before the consultation commit; the pathspec excludes the record. Fails.
Permitting sentences: none found
Verdict: forbidden

## Route 3: a quoted consultation finding in a dispatch

Forbidding sentences:
- S:478-479 "Never quote, summarise or name a consultation finding in any reviewer or verifier dispatch."
- S:475-477 "Add no focus area, emphasis, file list or summary of the change to any brief, beyond its scope paragraph".
- S:456-457 "no verifier triages consultation findings" (no verifier dispatch carries them).
- S:608-610 verifier gets "every blocker copied verbatim from the delivered payload", i.e. reviewer blockers only.
- S:715 delta `{FIX ENTRIES}` are "verbatim from the recorded round" (review.md blockers).
Permitting sentences considered:
- S:439-441 the ask "may name the cause you observed": a question to the user, not a dispatch, and about attempts, not findings. Fails.
- S:655-663 exception and scope asks quote review findings, which are plan-reviewer findings, to the user. Fails.
- S:458-461 adopted edits are applied to plan artifacts, so a finding's substance can reach reviewers through plan text. No sentence forbids this and it is not a dispatch quote; Observation O2, not a route.
- S:701-703 the delta patch "covers the consultation edits": plan edits, not findings (see Route 2). Fails.
Permitting sentences: none found
Verdict: forbidden

## Observations (not counted)
- O1: The `blocker-verifier` brief (S:612-618) and its dispatch text (S:597-610) have no sentence telling the verifier not to read `consultation.md`; S:478-479 forbids only quoting/summarising/naming findings in the dispatch. The spec requirement (openspec/changes/plan-architecture-consultation/specs/plan-architecture-consultation/spec.md:159) binds the full-round and delta briefs and the dispatch contents, not verifier reading. A verifier that reads the folder could see the findings. Outside the literal control text; reported for Main's decision.
- O2: Nothing prevents the author from writing consultation-finding wording into an adopted plan edit (S:458-461); reviewers read plan files.

Overall: PASS
