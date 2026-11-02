# Review

- **Verdict**: <OKAY or REJECT: OKAY only when no confirmed blocking finding, no untriaged finding and no finding awaiting an answer is open>
- **Reviewed digest**: <64-hex digest printed by --digest before this round's dispatch>
- **Depth**: <standard or risky, from gate.md>
- **Reviewer**: plan-reviewer, <scope A or only reviewer id>[, <scope B id>]
- **Verifier**: blocker-verifier, <subagent id, or none when no verifier result stands: no finding needed triage, or this record was written before the dispatch>
- **Models**: <one entry per dispatch of this round, retries and attempts that counted as having no result included: "<subagent id> <provider/model>", further models that dispatch ran on appended, "(no verdict)" after an attempt whose result did not count>
- **Round**: <1 for the first full round, incremented once per further full round and once per delta check>
- **Awaiting**: <none, exception, exhaustion, incomplete, scope or triage>
- **Override**: none

## Blockers

<none, or one "### <Scope> (<subagent id>)" subsection per rejecting reviewer with its open findings verbatim, each with the verifier's result and reason, or "not triaged: the verifier has not returned" before the dispatch and "not triaged: the verifier failed twice" after both attempts failed when Awaiting is triage, or "not triaged: the round is incomplete" when Awaiting is incomplete>

## Residuals

<none, or every other finding with the verifier's result and reason>
