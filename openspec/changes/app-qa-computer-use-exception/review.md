# Review

- **Verdict**: REJECT
- **Reviewed digest**: efb14dbea8f76648e3c1d7c41aefe2fed46d5c89627d6108520b3f03ce07cfc2
- **Depth**: risky
- **Reviewer**: plan-reviewer, ProposeComputerUse.PlanReviewDelta16
- **Verifier**: blocker-verifier, ProposeComputerUse.Triage16
- **Models**: ProposeComputerUse.PlanReviewDelta16 onara/cx/gpt-6.1-sol, ProposeComputerUse.Triage16 onara/cx/gpt-6.1-sol
- **Round**: 16
- **Awaiting**: none
- **Override**: none (the exhaustion ask of this round was answered Fix by the user, Tim, 2026-11-13: "Fix: route every computer call in a configured repository and every app-QA call, then one delta check and the full F1 run")

## Blockers

### Delta check (ProposeComputerUse.PlanReviewDelta16)

1. **PROCESS 4 — task 2.5 / design D15: weakened routing protection**
   - defect: The replacement changes the rule’s routing scope from every computer call in a configured repository to calls made to check, test or keep app evidence. This leaves ordinary desktop requests in configured repositories outside the pointer and its window limits, contradicting the unchanged specification. The claim that non-QA computer calls were already outside the bullet is false.
   - evidence: The supplied patch removes D4’s instruction that “in a repository with `.omp/app-qa.json` a `computer` call follows the team skill” and replaces it with the app-check qualification. This replacement is prescribed at openspec/changes/app-qa-computer-use-exception/tasks.md:20 and present at team-config/agent/rules/ui-automation-credentials.md:25. Design.md:75 explicitly says calls outside app QA stay outside “as before”, whereas the removed instruction had no QA qualification. The unchanged proposal.md:16 promises routing even for requests not phrased as QA checks, and specs/app-qa-driver/spec.md:105,116-117 requires a configured-repository request to read another app’s window to reach the skill and be refused. Concrete trigger: a session in a configured repository asks to read an unrelated app’s window for ordinary desktop assistance and reaches the computer trigger without having read the skill—the rule-only state already observed by F1. The revised bullet expressly excludes that task, removing the previous fallback routing protection. An ensuing other-app read breaks the criterion and can put private screen content into an irreversible transcript.
   - change: Preserve the existing configured-repository route while adding the missing-configuration case: require the skill before any computer call in a repository with `.omp/app-qa.json`, and also before any app-QA computer call regardless of whether configuration exists. Retain the interrupted-read retry and missing-configuration refusal for app QA. Update D15 and task 2.5 to express that union; ordinary non-QA desktop use without a configuration can remain outside it.
   - triage: confirmed, blocking, protected (ProposeComputerUse.Triage16): task 2.5 (tasks.md:20) and the rule bullet route only app-QA computer calls, while proposal.md:16 and spec.md:116-117 require a configured repository to route every computer call, another app's window included, through the skill.

## Residuals

none
