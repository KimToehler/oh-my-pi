# Negative control: Blind review

Files reviewed: `S` = schema.yaml review instruction (348-770), `T` = templates/consultation.md, `A` = architecture-oracle.md. Quotes join wrapped lines.

## (1) A plan-reviewer (full round or delta) allowed to read `consultation.md`

Forbidding sentences:
- S:466-467 full-round brief: "Review every file in the change directory except review.md and consultation.md (neither is part of the plan; do not read them) against the repository."
- S:456-457 "Each item's task is the brief below, verbatim, with only the two paths filled in".
- S:691-694 delta brief: "(proposal.md, specs/**/spec.md, design.md, gate.md and tasks.md; review.md is the review record and consultation.md the consultation record, neither is plan; do not read consultation.md)".
- S:688 "Delta brief (substitute the `{...}` inputs, change nothing else)".
- S:422-423 and S:559-561 retries use "the same brief".

Permitting sentences: none. Notes: the `blocker-verifier` brief (S:594-600) carries no exclusion, but it is not a plan-reviewer, S:440 says "no verifier triages consultation findings", and S:460-461 bars consultation content from its dispatch.

Verdict: forbidden

## (2) A delta-check patch containing `consultation.md`

Forbidding sentences:
- S:699-701 "The diff is {PATCH PATH}, written with `git diff {RECORDING COMMIT} -- {CHANGE DIR} ':!{CHANGE DIR}/review.md' ':!{CHANGE DIR}/consultation.md'`; read it completely before you decide."
- S:688 "change nothing else".

Possible ambiguity (not a permit): S:685-686 "its patch, taken from the recording commit, covers the consultation edits with the fixes" can be read as including consultation.md edits; "the consultation edits" means the adopted plan-artifact edits (S:441-443), and the fixed git command excludes the file regardless.

Verdict: forbidden

## (3) A reviewer or verifier dispatch quoting, summarising or naming a consultation finding

Forbidding sentences:
- S:460-461 "Never quote, summarise or name a consultation finding in any reviewer or verifier dispatch."
- S:457-458 "Add no focus area, emphasis, file list or summary of the change to any brief, beyond its scope paragraph" and S:459-460 "The scope paragraphs are fixed for every change and carry nothing about this one."
- S:454-456 `context` is "exactly" the fixed sentence.
- S:590-592 verifier gets "the brief below, the two paths and every blocker copied verbatim from the delivered payload (`read agent://<id>`), never retyped, paraphrased or filtered."
- S:698 delta `{FIX ENTRIES}` are "verbatim from the recorded round".
- S:440 "no verifier triages consultation findings."

Permitting sentences: none. Considered: adopted plan edits reach the reviewers only as plan/patch content (S:685-686), not as a dispatch quoting or naming a finding; S:688 "change nothing else" blocks adding any provenance text to the delta brief.

Verdict: forbidden

Overall: PASS
