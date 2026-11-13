# Negative control: Blind review

Files: S = team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml (review instruction, lines 348-775), T = .../templates/consultation.md (1-16), A = team-config/agent/agents/architecture-oracle.md (1-38).

## (1) A reviewer reading `consultation.md`

Forbidding:
- S:469-470 (full-round brief, which every scope paragraph follows, S:459-461) "Review every file in the change directory except review.md and consultation.md (neither is part of the plan; do not read them) against the repository."
- S:694-697 (delta brief) "review.md is the review record and consultation.md the consultation record, neither is plan; do not read consultation.md".
- S:457-461 the brief is verbatim with only the paths filled in, plus a scope paragraph.

Permitting sentences: none found.
Readings checked:
- The `blocker-verifier` brief (S:597-603) does not repeat the exclusion; the verifier is not a reviewer and gets only blocker text (observation, not counted).
- S:404-405 tells the consultant that review.md and consultation.md are not part of the plan; that concerns the consultant, not a reviewer.
- S:469-470 forbids reading it only for plan files; the retry and incomplete-round re-runs (S:562-566, S:754-756) use the same brief.

## (2) A delta patch containing `consultation.md`

Forbidding: S:702-703 "The diff is {PATCH PATH}, written with `git diff {RECORDING COMMIT} -- {CHANGE DIR} ':!{CHANGE DIR}/review.md' ':!{CHANGE DIR}/consultation.md'`"; S:688-689 the consultation commit's edits are covered by the patch "taken from the recording commit"; S:691 "change nothing else".

Permitting sentences: none found.
Readings checked: S:688-689 "covers the consultation edits too" means the plan-artifact edits adopted with it, not the record, because the pathspec exclusion is part of the verbatim delta brief. S:712-713 patch location is uncommitted and does not change content.

## (3) A quoted finding

Forbidding: S:463-464 "Never quote, summarise or name a consultation finding in any reviewer or verifier dispatch."; S:593-595 verifier input is "every blocker copied verbatim from the delivered payload ... never retyped, paraphrased or filtered"; S:696-701 delta brief fixed text; S:701 fix entries "verbatim from the recorded round" (review round, not consultation).

Permitting sentences: none found.
Readings checked: no sentence tells the author to put a finding's text into the plan artifacts; S:441-443 records dispositions only in consultation.md (observation: nothing in S/T/A explicitly bars writing a finding's wording into an adopted edit of design.md, which a reviewer then reads as plan text; S:464 limits itself to dispatches). Fix entries (S:701) and carried findings (S:757-762) come from review.md rounds, which cannot contain consultation text since reviewers do not read it (S:469-470).

Verdict: (1) forbidden; (2) forbidden; (3) forbidden.

Overall: PASS
