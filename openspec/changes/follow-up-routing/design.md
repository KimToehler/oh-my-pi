# Design

## Context

`team-config/agent/commands/opsx-*.md` are the output of the pinned OpenSpec version (`team-config/openspec-version`, 1.15.0) with one hand-made team addition, step 4 of `opsx-apply.md` (README, `Bumping OpenSpec`). `opsx-archive.md` runs: select, artifact check, task check, delta-spec sync assessment, move, summary. `opsx-propose.md` step 6a already tells the planner to inspect the project before drafting each artifact.

The gate record (`review-work`, `.omp/team-config/evidence/gate/<change>.json` or the repository's convention) binds the final reviewer replies through `verdicts[].trailer_artifact`, and, when `whole_diff.run` is true, the integration-review report (`SKILL.md:521`). A trailer file normally holds the whole reply, including its non-blocking notes (`review-work/SKILL.md:426`, reply format "If passed: short non-blocking notes"; `agents/auditor.md:17` reports other findings "as a non-blocking risk"). A repaired trailer holds only the blocker lines and the trailer block; the original reply stays git-ignored local evidence (`SKILL.md:356`). Trailer paths need not carry a wave (`SKILL.md:14` permits `f2/trailer-implementation-audit.txt`), and neither trailer nor record has a wave field. `downgrades` entries carry `invocation` and `blocker` (`SKILL.md:539`); `disposition` is `residual` or `follow-up`, and a follow-up's `reason` only names where it is tracked (`SKILL.md:382`).

## Goals / Non-Goals

**Goals:**
- One place per program where its open follow-ups are, read at the moment a new change is planned.
- Reading only what is on disk, so the archive works in a session other than the one that ran the gate.

**Non-Goals:**
- Changing the gate record schema, the validator, blocker disposition or any review verdict.
- Plan-mode plans (`.omp/plans/*.md`): they have no archive step.
- Backfilling changes archived before this change.
- Plan-review residuals (`review.md` `## Residuals`): they are accepted risks, not work for a later change.
- Notes from replies the record does not bind (earlier waves, cancelled dispatches): the final wave reviewed the fixed tree, so its replies are the current findings.

## Decisions

**D1. Team additions to the generated commands, not a rule or skill.** The follow-up steps must run at fixed points of two workflows. A path-triggered rule never fires: the archive moves the folder with `mv`, and the follow-up section is written only by this step. An always-apply rule would cost context in every session to serve two commands. A skill would have to be remembered. Adding a step is what `opsx-apply.md` step 4 already does; the README's bump procedure names all additions so a regeneration re-applies them (spec requirement "The bump procedure names every team addition").

**D2. Sources: the gate record and the replies it binds.** See spec requirement "Archive collects the change's follow-ups from its gate record". Out-of-scope findings need no separate source: reviewers report them in the same replies as non-blocking findings, because `review-blocker-disposition` keeps them from blocking. A repaired trailer has lost its notes; the archive does not reach for the ignored local reply, because it is absent in any checkout other than the gate's (accepted residual in `gate.md`).

**D3. Destination: a document the proposal names that already has `## Follow-ups`, else ask.** Changes in a program already name their roadmap in the proposal (onara's KMP slices name `docs/roadmap/compose-multiplatform-migration.md`). A section that exists is the opt-in signal; a named document without one may be a reference, not the program's roadmap, so the user decides, and may enter any path when the proposal names none. Rejected: a fixed per-repository fallback file. onara's `tasks/` holds 148 one-topic follow-up files, last touched 2026-09-04 and marked historical; a list nobody opens at planning time is the failure this change fixes.

**D4. Item shape and identity.** One bullet: finding and consequence, location (`PATH:LINE` or area), then `Source:` with the change name, the bound artifact's repository path and the finding id (a downgrade's `blocker`, else the reviewer's own label such as `N2`, else `note <n>` by order in that artifact). Everything in the source comes from bytes the record pins, so a fresh session derives the same text: no wave is needed (the artifact path carries one when the layout does), and the order of notes in a pinned artifact cannot change. The source text is the identity: a repeated archive run adds nothing twice, and two findings at one location stay two items. Rejected: location plus reviewer, which merges distinct notes on one line.

**D5. Taken items leave at archive, not at propose.** A proposal lists each taken item under `## Follow-ups taken` as its document's repository path followed by the bullet verbatim. The path makes the proposal name the document, so the archive's write restriction covers the deletion even when the roadmap came only from the request or project context. The items stay in the roadmap until the change archives, because a proposal can be abandoned; removing them at propose time would lose them. Deletion matches the verbatim bullet; a bullet edited in the meantime is not found and the summary names it.

**D6. Placement.** Archive: new step 5 after the delta-spec sync assessment and before the move (later steps renumbered), so the proposal is still at `changeRoot` when it is read, and all questions come before the folder moves. The success outputs gain a `**Follow-ups:**` line. Propose: a sub-step of 6a that runs when the artifact is the proposal, plus a guardrail line. The proposal template stays generated; `## Follow-ups taken` is added by the step only when items are taken.

No mechanism in this change falls under `Build vs. adopt`: it is instruction text and Markdown project glue, no protocol, format or general infrastructure.

Scope: two command texts and the README, one mechanism. They cannot ship separately: the propose step reads the section the archive step writes, and the archive step deletes what the propose step records.

## Risks / Trade-offs

- [The agent misreads which reply text is a non-blocking finding] → Trailers keep notes in a fixed place of the reply format; F1 runs the archive on a fixture with real trailers holding a note, a blocker resolved in the wave and a `residual` downgrade.
- [A follow-up section grows without bound] → D5 removes items as changes take them; the archive summary shows the count, so growth is visible.
- [One more question per archive] → Asked only when there are items and no single destination.
- [A bump drops the steps] → README names all three additions as the expected diff.

## Migration Plan

Merge, then `scripts/deploy-local.sh` installs the commands into every profile that carries the team config. Existing `## Follow-ups` sections (onara's KMP roadmap) already match D4. Rollback: revert the commit and redeploy; sections written in the meantime stay valid Markdown.
