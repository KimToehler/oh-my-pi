# Proposal

## Why

A commit that only edits comments costs a full review round in two places. Between fix waves, `review-work` already allows `GC exempt` for "a comment", but it does not say that some comments are read by a tool and change behaviour (build tags, linter or type-checker suppressions, doctests, generated API docs), so the exemption is either too broad or skipped out of caution. After the final F2 verdict, any commit on the branch that touches more than gate evidence voids the record (`validate-gate-record.mjs:742`), and the skill names no way to land a purely informative comment without a new wave. The user asked that the orchestrator decide which kind a comment is, and that informative comments need no review.

The same post-verdict trap is set by Phase 5 itself: it opens with "Write reviewer-readable Markdown to plan's `Evidence:` path". OpenSpec changes have no `Evidence:` field, so orchestrators invent a path such as `docs/evidence/<change>/merge-gate.md` and commit it after the record (onara, 2026-10-29 and 2026-10-30). Nobody reads it: the record, the trailers and `review.md` carry the gate, and the user confirmed he does not read these files.

## What Changes

- `review-work` names the two kinds of comment. A comment is **behaviour-changing** when a tool or a review input reads it: a compiler, interpreter, build or code-generation directive, a linter, formatter or type-checker suppression, a doc comment that runs as a test or generates a shipped API document, or text a reviewer brief, criterion or agent-loaded instruction reads. Every other comment is **informative**.
- The orchestrator decides the kind per commit and names it in the exemption reason. Between waves, a commit that changes only informative comments may be exempted with `GC exempt`; a behaviour-changing comment, or a commit mixing comments with anything else, is delta-reviewed like code. When in doubt, review.
- After the final F2 verdict, an informative-comment commit is not added to the branch: it is committed on the default branch after the merge (with the archive commit, where there is one) and needs no gate. A behaviour-changing comment after the verdict is code: it goes on the branch and the gate continues as for any code commit after `reviewed_sha`.
- Phase 5 no longer asks for a human-readable Markdown summary; the gate record and the trailers, plus `review.md` for an OpenSpec change, are the gate's evidence.
- No validator, record, ledger or script change.

## Capabilities

### New Capabilities
- `gate-comment-commits`: how a comment-only commit is classified and routed during the post-implementation gate, between fix waves and after the final verdict.

### Modified Capabilities

## Impact

- `team-config/agent/skills/review-work/SKILL.md`: Fix waves step 5 (exemption) and Phase 5 (after the record).
- Installed through the existing team-config installer (`scripts/deploy-local.sh`); running sessions load the new text after a restart. The `omp-gated` schema is not edited, so project copies need no re-install.
- Out of scope, each its own plan if wanted: a validator path that admits post-verdict comment commits on the branch, and automatic comment classification by a script.
