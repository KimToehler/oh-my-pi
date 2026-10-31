# D1 instruction review

Dispatch: one `task` call, default agent (not scout), four fresh agents InstrReviewD1a, InstrReviewD1b, InstrReviewD2a, InstrReviewD2b, context "Instruction review: answer only from the requirement and instruction text given in your task; do not read or edit files.". Each brief is in `<id>.brief.md`; `(a)` is the delivered text, `(b)` the purpose-broken copy.

## (a) delivered: InstrReviewD1a

Brief: `D1a.brief.md`

Output (verbatim):

None found.

I checked the sentences that could open a route for a forbidden blocker, and each one is closed.

- **Coverage and the user's request:** "Coverage never applies to an excluded blocker." and "An excluded blocker is never accepted, frozen or overridden at any path, even on the user's request". The "user's explicit request" paragraph applies only to a blocker "that no exclusion names". The class exclusion names every other blocker on a class-not-`none` change.
- **Class exclusion:** the "mandatory class is not `none`" bullet allows only a verification-only blocker that misses both threshold limbs. It says "every other blocker stays excluded, including one about the delivered change, one that concerns both, one whose subject is unclear and one that leaves a material behaviour unproven".
- **Security sources and disputes:** the bullets on review_scope item 4 or CHECK 1, `security_delta: yes`, and disputes of the Mandatory class, Risk tier, reviewer set or whole-diff-review decision are all listed as never eligible.
- **Evidence-form exception:** the sentence "only a gap in the form of evidence … for a behaviour that stays proven by a check that can fail is weaker proof" sits in the threshold definition. The exclusions still take precedence, because "an exclusion always makes it ineligible".

## (b) mutated: InstrReviewD1b

Brief: `D1b.brief.md`

Output (verbatim):

Three sentences permit behaviour the Negative control forbids.

1. **Unclear subject counts as verification.** Quoted from the Excluded list: "the change's mandatory class is not `none`, unless the blocker concerns only this change's verification as `Change verification` defines it; a blocker whose subject is unclear counts as verification".
   - Under a non-`none` class, a blocker whose subject is unclear is then treated as verification-only. It can pass the threshold and become Accept-eligible.
   - The requirement says an unclear subject stays excluded.
   - The "Unclear means blocking" paragraph says unclear is not eligible. It conflicts with this sentence and does not repair it.

2. **Coverage ignores the threshold.** Quoted: "Coverage is the existing `accepted-residual`/`out-of-scope` path: the entry was reviewed with the plan, so a covered blocker may stay unfixed even when it breaks the threshold. Coverage never applies to an excluded blocker."
   - Under a non-`none` class, a verification-only blocker that leaves material behaviour unproven is not excluded by the class bullet, because it concerns only verification.
   - The sentences let a `gate.md` Accepted residual risks entry cover that blocker. The requirement says the entry does not cover it.

3. **User request accepts a non-eligible blocker.** Quoted: "For a non-eligible blocker that no exclusion names, the user may still ask to accept it at plan-review Accept or Override, a freeze or a delta accept."
   - A verification-only blocker under a non-`none` class that breaks the threshold is non-eligible, and no exclusion names it.
   - The user can therefore accept it on request and have it recorded in `gate.md`. The requirement says the options are fix, re-plan or stop, with no `gate.md` entry written.
