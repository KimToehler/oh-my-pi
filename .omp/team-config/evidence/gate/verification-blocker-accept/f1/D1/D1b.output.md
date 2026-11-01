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
