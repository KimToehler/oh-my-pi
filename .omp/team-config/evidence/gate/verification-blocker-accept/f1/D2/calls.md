# D2 instruction review

Dispatch: one `task` call, default agent (not scout), four fresh agents InstrReviewD1a, InstrReviewD1b, InstrReviewD2a, InstrReviewD2b, context "Instruction review: answer only from the requirement and instruction text given in your task; do not read or edit files.". Each brief is in `<id>.brief.md`; `(a)` is the delivered text, `(b)` the purpose-broken copy.

## (a) delivered: InstrReviewD2a

Brief: `D2a.brief.md`

Output (verbatim):

Negative control forbids: (a) recommending an option by counting blockers, (b) offering pre-written fixes as options, (c) an area assignment (delivered vs. verification) that differs from the Blocker disposition eligibility judgement.

Sentences checked:

- "Show the round; per lens its verdict and blocker count; per blocker its area and whether it concerns the delivered change or this change's verification, judged by the blocker's consequence, not by which lens raised it (shown so the user can dispute it; it never changes a blocker's severity, and it is the same judgement `Blocker disposition` makes for the class exclusion, never a separate one)". This requires the same judgement. It is not permissive, so it is not flagged.
- "Never recommend by counting blockers, and never offer pre-written fixes as options." This forbids (a) and (b), so it is not flagged.
- Continue: "fix every non-eligible blocker in the artifacts and repeat from step 1; ask per blocker (step 6) only for eligible ones, Accept recommended, and for a fix that needs a user decision." Continue is a generic option, not a pre-written fix, so it is not flagged.
- Re-plan, Split and Stop: these are generic options and do not recommend by count or pre-write fixes, so they are not flagged.
- "recommend the option that removes that cause while best keeping the goal, with the reason." This is cause-based, not count-based, so it is not flagged.

One residual: "judged by the blocker's consequence, not by which lens raised it … it is the same judgement `Blocker disposition` makes for the class exclusion". The class exclusion is only part of the eligibility decision, which also has the threshold and other exclusions. This is a possible gap, but the sentence still requires one shared judgement. It does not permit a mismatch, so I am not flagging it.

**none found**

## (b) mutated: InstrReviewD2b

Brief: `D2b.brief.md`

Output (verbatim):

Negative control forbids: (a) recommending an option by counting blockers, (b) offering pre-written fixes as options, (c) showing a blocker as concerning verification while eligibility treats it as concerning the delivered change, or the reverse.

Sentences checked:

1. "...whether it concerns the delivered change or this change's verification, judged by the blocker's consequence, not by which lens raised it (shown so the user can dispute it; it never changes a blocker's severity, and eligibility judges the subject separately)". **This permits (c).** The requirement says the approach question uses "the same judgement the `Blocker disposition` section uses for eligibility". The clause "eligibility judges the subject separately" says the two judgements are separate. That allows the shown assignment and the eligibility decision to disagree, which the negative control forbids ("or the reverse"). The "shown so the user can dispute it" clause adds to this, because it treats the shown assignment as a disputable display rather t…

2. "Never recommend by counting blockers, and never offer pre-written fixes as options." This forbids (a) and (b), so it does not permit them.

3. The options list (Continue, Re-plan, Split, Stop) offers no pre-written fixes. "Continue: fix every non-eligible blocker..." is a process step, not a pre-written fix. The Split option's recommendation criteria (a named class-setting part that can ship separately) rest on a structural judgement, not on counting blockers. None of these permits (a) or (b).

4. "recommend the option that removes that cause while best keeping the goal, with the reason" is causal, not count-based, so it is fine.

**Result:** one violating sentence, the sentence quoted in item 1: "...judged by the blocker's consequence, not by which lens raised it (shown so the user can dispute it; it never changes a blocker's severity, and eligibility judges the subject separately)". The fragment "eligibility judges the subject separately" is the cause.

[Some lines truncated to 768 chars. Use agent://InstrReviewD2b:raw:5-5 to read line 5 whole]
