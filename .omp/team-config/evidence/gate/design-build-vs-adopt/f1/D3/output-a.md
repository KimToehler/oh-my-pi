None found.

The Negative control forbids letting a failed search pass as `none`, which would let a design record `none` for a stage whose only search failed and then decide build. I checked each sentence that could allow this.

- **"Repository: <PATH:LINE … or none and the paths searched>", "Platform: … or none and what was searched" and "Candidates: … | none and the searches run | not searched, covered above".** These allow `none` only with the searches named. The `none` entry is not tied to a successful search. The next sentence closes that gap, so this is not a permit.
- **"A search that failed or returned nothing readable is not `none`: retry it, and if it still fails, write the Decision as open with the failed search and ask the user before designing the mechanism; then replace it with the user's choice and their reason."** This forbids the behaviour. The failed search is not `none`, the Decision is open, and the planner asks the user before designing.
- **"Decision: … | build, gap: <what nothing above covers> | … | open, search failed: <which> | user decided: …".** `build` needs a named gap. `open, search failed: <which>` exists for the failure case, and `user decided` records the user's reason.
- **"A build or reject verdict names its gap."** This does not permit building after a failed search. It also does not let a failed search count as the gap.
- **"Auth, crypto and protocol mechanisms are never built when a stage above covers them: building one names a gap that none covers."** This is restrictive.
- **"stop at the first stage that covers it" and "not searched, covered above".** These apply only when an earlier stage actually covers the mechanism. An earlier stage that failed does not cover it, because the failure rule says it stays open.
- **"Research with tools every session has…".** This only lists the tools. It does not give a path for recording a failure as `none`.
