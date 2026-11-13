# Review

- **Verdict**: REJECT
- **Reviewed digest**: 6d3dc8edb5a6ebaddc11d3f1c37dea4cd03e0d442a4e2e8441dc064a8ea54058
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta14
- **Verifier**: blocker-verifier, ProposeComputerUse.Triage14
- **Models**: ProposeComputerUse.PlanReviewDelta14 onara/cx/gpt-6.1-sol, ProposeComputerUse.Triage14 onara/cx/gpt-6.1-sol
- **Round**: 14
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta14)

1. **PROCESS 4 — Residual exception exceeds the accepted boundary**
   - defect: The replacement criteria exempt every ignore-on search before either instruction source loads, rather than only the whole-worktree search named in the accepted residual. A fresh QA session can search `.omp/` or an evidence folder directly with default ignore settings, receive tracked evidence, and have that breach adjudicated as an accepted residual. This weakens the existing evidence-isolation criterion beyond the authorized exception; any sensitive content returned is already in the transcript and cannot be scrubbed.
   - evidence: gate.md:8 accepts an ignore-on search “over the whole worktree” before instruction loading. In contrast, specs/app-qa-driver/spec.md:34 exempts “a search with ignore rules on that ran before either was loaded and returned the folder's lines,” without restricting its scope; :49 gives the same unrestricted exception to the routing negative control. tasks.md:50 consequently assigns `residual observed` to that broader class. Concrete sequence: read `weaver-app-qa`, then grep `qa\.mjs` over `.omp/` with default ignore settings, returning tracked `.omp/team-config/evidence/...` lines before either team instruction source loads. The new text accepts it although it is not the whole-worktree case in gate.md. This also contradicts design.md:72's claim that the three locations “exempt exactly that case.”
   - change: Constrain all three exceptions to the exact gate.md residual: an ignore-on whole-worktree search executed before either instruction source loads and returning tracked evidence. Keep directly scoped evidence searches and searches over `.omp/` or `.omo/` as a whole outside that exemption. Preserve Tim's residual and verbatim reason, the post-load prohibitions, and the fully blocking ignore-off checks.
   - triage: confirmed, blocking, protected (ProposeComputerUse.Triage14): spec.md:34, :49 and tasks.md:50 omit gate.md:8's whole-worktree restriction, so a pre-load ignore-on search of `.omp/` or an evidence folder directly would be accepted as the residual.

## Residuals

none
