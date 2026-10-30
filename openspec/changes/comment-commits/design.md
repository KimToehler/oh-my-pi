# Design

## Context

See proposal.md - Why. `review-work/SKILL.md` Fix waves step 5 lets the orchestrator exempt "a comment" with `GC exempt`; the reason goes to the ledger and the exemption decides the commit for F2 and F3. After the record, `validate-gate-record.mjs` accepts only commits on top of `reviewed_sha` that touch authenticated evidence paths; one source file voids the record. The `merge-gate` stop hook treats a tracked record already merged into the default branch as settled, and post-merge commits on the default branch are not gated today: the OpenSpec archive commit is made there after every merge.

## Goals / Non-Goals

**Goals:** an informative comment costs no review round, during or after the gate; a comment a tool or review input reads is still reviewed as code; the record phase stops producing a summary file nobody reads.

**Non-Goals:** any validator, record, ledger, convergence-script or schema change; classifying comments by script; changing what an exemption between waves decides beyond the comment kind.

## Decisions

**D1. Classify by reader, not by syntax.** A comment is behaviour-changing when its text changes what a tool outputs or decides, or a review input reads it; a parser or lexer that only skips comments does not count; the instruction gives examples (build and code-generation directives, linter, formatter and type-checker suppressions, doctests, doc comments that generate a shipped API document, text a reviewer brief, criterion or agent-loaded instruction reads) but the test is the reader. A syntax list per language would never be complete. Uncertainty counts as behaviour-changing, which matches the existing "When in doubt, review".

**D2. After the verdict, informative comments go to the default branch after the merge.** The final verdict is the F2 wave that printed `DECISION: PASS`, or the STOP the user resolved with freeze (Fix waves step 3); a commit after a CONTINUE wave stays under step 5. Alternatives: (a) a validator path that admits comment-only commits after `reviewed_sha` - it would have to parse comments per language and could be used to smuggle code past the record, so it is its own plan if ever wanted; (b) a new F2 wave - the cost the user wants to avoid; (c) never committing the comment. Landing it after the merge keeps the record valid for the merge, reuses the archive-commit precedent, and needs no new mechanism. The commit subject says it changes informative comments only, so the decision stays visible in history.

**D3. A behaviour-changing comment after the verdict is never landed unreviewed.** After a PASS wave it is code: committed on the branch, and the gate continues with a new wave as for any code commit after `reviewed_sha` (`GC` allows another wave after PASS). After a freeze `GC` refuses any further wave in the lane (`gate-convergence.mjs:209-210`), so it becomes a follow-up change after the merge, exactly like the frozen blockers; nothing is committed to the frozen branch.

**D4. Drop the summary instruction.** Phase 5's first sentence asks for "reviewer-readable Markdown to plan's `Evidence:` path". OpenSpec gate sections have no such field, and the summary is written after the record, so committing it on the branch voids the record. The record, the trailers and `review.md` already carry every fact a reader needs; the sentence is removed rather than redirected.

**D5. One instruction file and one guard test.** All four decisions are edits to `team-config/agent/skills/review-work/SKILL.md`: Fix waves step 5 (D1, between waves) and Phase 5 (D2-D4). D2 relies on the stop hook keeping a merged record settled after a later default-branch commit; `merge-gate.test.ts` covers settlement only directly after the merge, so one test beside it pins the later-commit case.

## Risks / Trade-offs

- [An orchestrator misclassifies a behaviour-changing comment as informative and lands it unreviewed] → the reader test, uncertainty as behaviour-changing, the ledger reason between waves and the commit subject after the merge keep the call visible; the residual risk is accepted in gate.md.
- [An informative comment fix is forgotten after the merge] → it is a comment; losing it costs nothing a reviewer gated.

## Migration Plan

Edit the skill in the task worktree, merge, run `scripts/deploy-local.sh` (default agent directory only; a profile, `PI_CONFIG_DIR` root or custom `PI_CODING_AGENT_DIR` needs its own `bun scripts/install-team-config.ts`); running sessions load the new text after a restart. The `omp-gated` schema is not touched, so project copies need no re-install. Roll back by reverting the commit and redeploying.
