# Review

- **Verdict**: REJECT
- **Reviewed digest**: d848e4e9883cba26f6b03b1a09b6839fa6a8b6827491da09f55a431c123c2cb4
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanReviewDelta4
- **Verifier**: blocker-verifier, BlockerVerifier4
- **Models**: PlanReviewDelta4 onara/cx/gpt-6.1-sol, BlockerVerifier4 onara/cx/gpt-6.1-sol
- **Round**: 4
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Delta (PlanReviewDelta4)

1. **PROCESS 4 — Capture return correctness**
   - defect: Applying the complete Maestro sweep to every capture deletes legitimate capture JSON. With a credential-free signed-in screen, a normal command such as `desktop capture commands --out DIR` creates commands.png and commands.json; the newly prescribed sweep unconditionally deletes commands.json because it resembles a Maestro command record. The host therefore cannot receive the promised PNG/JSON pair. This breaks the passing-capture criterion; the damage is reversible by recapturing, but the supported command no longer meets its contract.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:197 and tasks.md:34 newly prescribe sweepRoot for captures. team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:753-758 accepts `commands` and constructs commands.json. qa.mjs:951 defines RECORD as /^commands.*\.json$/, and :966-968 deletes matching files regardless of credentials or the `failed` flag. openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:169-171 requires both PNG and JSON to exist on the host after a passing capture.
   - change: Share the credential-bearing path-removal and content-neutralization passes across every returned tree, but keep Maestro-specific record and step-artifact removal confined to flow roots. Add a credential-free `desktop capture commands` control proving both files survive, alongside the synthetic credential-named capture control proving neither file leaves the guest.
   - triage: confirmed, blocking true, protected true: The prescribed return design applies sweepRoot to captures as passed (design.md:197; tasks.md:34). desktopCapture accepts the name commands and creates commands.png and commands.json (qa.mjs:753-758). RECORD matches commands.json (qa.mjs:951), and sweepRoot unconditionally unlinks matching records before its credential passes (qa.mjs:966-969), even when failed is false and no credential is present. Thus the ordinary supported capture loses its JSON, violating the passing-capture contract (spec.md:169-171). This is a delivery defect, not merely missing verification: generic capture tests do not resolve the explicitly prescribed destructive sweep. The finding concerns the credential-sanitization return boundary, so protected is true.

2. **PROCESS 4 — F1 login-surface contradiction**
   - defect: The delta prohibits all login-surface captures and claims no F1 row takes one, but the retained agent-edit row explicitly requires a kept screenshot of modified sign-in-screen text. During the prescribed fresh-session verification, an agent obeying the new rule cannot produce that artifact, while an agent satisfying the row violates the rule. Consequently F1 cannot be completed as specified. The immediate consequence is a failed or invalid proof, reversible by changing the verification task; taking and retaining a real-account login capture is not an acceptable workaround.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:198 now says no capture, flow screenshot or hierarchy of a login surface is taken. tasks.md:40 adds that prohibition to the delivered skill, and :95 asserts 'No row captures a login surface'. However tasks.md:109 asks the fresh session to change the sign-in screen's title and requires a kept screenshot showing that new text. tasks.md:112 requires every F1 row, including agent-edit, to run and be judged.
   - change: Change agent-edit to modify text on a credential-free signed-in screen and require sign-in to finish before the screenshot. Preserve its edit → vm up → routed verification → vm down proof, without requiring any login-surface capture.
   - triage: confirmed, blocking true, protected true: design.md:198 prohibits capture, flow screenshot or hierarchy of any login surface, and tasks.md:40 requires that prohibition in the delivered skill. Nevertheless tasks.md:109 explicitly asks the fresh agent to edit the sign-in screen title and retain a screenshot showing that text; tasks.md:112 requires every F1 row, including agent-edit. That normal prescribed verification sequence cannot both show the modified sign-in screen and obey the prohibition. The assertion at tasks.md:95 that no row captures a login surface does not remove the contradictory row. This delivery contradiction prevents valid completion of required F1 proof regardless of whether later QA detects it. It also names a real-account login-capture privacy path, so protected is true.

## Residuals

none
