# Review

- **Verdict**: REJECT
- **Reviewed digest**: 7c421b738e9055bd19966bcc5186ed5768daa1e7bb5dd439666b67a2c8b7f216
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanRev11A_AQSD, PlanRev11B_AQSD
- **Verifier**: blocker-verifier, BlockerVer11_AQSD
- **Models**: PlanRev11A_AQSD onara/cx/gpt-6.1-sol; PlanRev11B_AQSD onara/cx/gpt-6.1-sol; BlockerVer11_AQSD onara/cx/gpt-6.1-sol
- **Round**: 11
- **Awaiting**: exhaustion
- **Override**: none

## Blockers

### Scope A (PlanRev11A_AQSD)

1. {"area": "Correctness — conflicting desktop acceptance criteria", "defect": "Two desktop negative controls are broader than the failures they are meant to forbid. First, attaching with an explicit valid PID while two matching JVMs run is permitted by the design but forbidden by the attach negative control. Second, a valid detach in worktree A while worktree B with the same configuration name remains attached must change A's session, but the session negative control forbids changing either session in precisely that state. These are ordinary supported operations, not malformed local state. Following the design therefore fails the stated merge criteria; following the negative controls prevents the supported operations. Session changes are reversible by attaching again.", "evidence": "openspec/changes/app-qa-shared-driver/specs/app-qa-driver/spec.md:40 permits selection by explicit process ID, and design.md:98 explicitly says `desktop attach --pid N` selects one of several eligible JVMs; however, spec.md:55-56 forbids any successful attach while two matching JVMs run, without excluding an explicit eligible PID. Separately, spec.md:62-63 describes tapping and detaching in the first of two attached worktrees while preserving the second. Its negative control at spec.md:66 includes `a detach in one worktree ... while another worktree with the same configuration name is attached`, and spec.md:67 says `changing either session ... MUST fail`. tasks.md:10 plans both successful explicit-PID selection and independent tap/detach behavior.", "change": "Qualify the multiple-JVM negative case as attach without an explicit eligible PID. In the session negative control, distinguish configuration/main-class mismatches—which must change neither session—from a valid detach in one worktree—which may change its own session but must not change the other worktree's session. Preserve exactly one Negative control scenario per requirement."}
   - verifier: confirmed, blocking true, protected false: Both contradictions are present. spec.md:40 permits an explicit process ID, design.md:98 explicitly permits `desktop attach --pid N` among several eligible JVMs, and tasks.md:10 requires testing that success; nevertheless spec.md:55-56 forbids attaching or exiting 0 whenever two matching JVMs run, without excluding explicit selection. Likewise spec.md:62-63 supports tap and detach in the first attached worktree while preserving the second, and tasks.md:10 expressly tests that operation, but spec.md:66-67 includes that valid detach among states where changing either session MUST fail. These are concrete ordinary supported operations for which the acceptance criteria contradict the intended behavior. This is a defect in the delivered specification, not missing verification, so the planned desktop tests do not resolve it. The contradictions block consistent satisfaction of the desktop acceptance criteria. No protected asset or security/privacy path is implicated by the finding.

## Residuals

none
