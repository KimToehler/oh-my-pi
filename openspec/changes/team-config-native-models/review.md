# Review

- **Verdict**: REJECT
- **Reviewed digest**: 27bc356098150067b653ba0517c09a0c1f3135fc12c184afe27fa82ee2a67c31
- **Depth**: standard
- **Reviewer**: plan-reviewer, PlanReviewNative1
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewNative1 openai-codex/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### All scopes (PlanReviewNative1)

1. **CHECK 6 — design D4 / tasks 1.1–1.2**
   - Defect: The planned guard cannot pass after the specified migration. It requires every override and agent model field to start with a native provider, but the migration leaves supported role aliases unchanged. An ordinary installation therefore fails the new test, preventing completion; the failure is reversible.
   - Evidence: openspec/changes/team-config-native-models/design.md:51–52 and tasks.md:5 require literal native prefixes for all overrides and agent models. However, team-config/seed/config.yml:67 contains reviewer: "@review", and team-config/agent/agents/oracle.md:5 contains model: "@oracle". Neither appears among the changes in tasks.md:6. These are intentional supported selectors: packages/coding-agent/src/config/model-resolver.ts:1312–1330 expands role aliases.
   - Change: Explicitly handle role aliases in the requirement and guard: resolve them through the seeded roles using the existing resolver, then check the resulting providers. Preserve coverage for both literal pins and role references, including rejection when a referenced role resolves outside the native allowlist.
   - Verifier: not triaged: the verifier has not returned

2. **Verification — task 3.1**
   - Defect: The documentation Verify command proves removal only, not the required replacement guidance. Removing the old setup instructions and pin examples without adding native sign-in steps or native examples still passes. This leaves new members without the documented authentication setup the change promises; the documentation defect is reversible.
   - Evidence: openspec/changes/team-config-native-models/tasks.md:14 requires native /login setup and replacement pin examples, but its entire Verify is a negated search for old router strings. It succeeds when the relevant sections are simply deleted. The schema's tracked-task instruction, openspec/schemas/omp-gated/schema.yaml under artifacts.tasks.instruction, explicitly requires deterministic proof of delivered text and rejects later catch-all verification.
   - Change: Supplement the removal check with deterministic checks of the required routing-bearing selectors and setup-command structure in the named documents. Keep prose quality under review; no model-behaviour re-scoring is needed.
   - Verifier: not triaged: the verifier has not returned

## Residuals

none

