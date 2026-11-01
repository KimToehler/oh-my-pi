# Review

- **Verdict**: REJECT
- **Reviewed digest**: f64fdea4e1dfd2558d0976bc548f0eeabf6f69b18cf784f2b61730449ba9e943
- **Reviewer**: plan-reviewer, DbaCorrectnessR1, DbaVerificationR1, DbaChecksR1
- **Round**: 1
- **Override**: none

## Blockers

### Correctness (DbaCorrectnessR1)

[
  {
    "area": "correctness",
    "defect": "The search instruction permits skipping the library stage even though the requirement requires the ordered search through maintained open-source libraries.",
    "evidence": "specs/openspec-design-adoption/spec.md:9-11 requires searching the repository and dependencies, then the platform, then maintained libraries; design.md:61-63 instead says to search libraries only when the earlier steps do not cover the mechanism. For an ordinary format parser already available in the platform, the delivered instruction stops before the final required search. This misses the stated requirement; the planning impact is reversible.",
    "change": "Reconcile the requirement and delivered instruction: either require the library stage as specified, or explicitly amend the requirement and its scenarios to permit stopping on earlier coverage."
  },
  {
    "area": "correctness",
    "defect": "The early-stop rule and the mandatory library-adoption rule give incompatible instructions for common covered mechanisms already provided by the platform.",
    "evidence": "design.md:61-63 forbids searching libraries when an earlier stage covers the mechanism, while design.md:71-72 requires auth, crypto and protocol mechanisms to adopt a maintained library unless a gap exists. For a standard-library cryptographic primitive that fully meets the need, the planner must both stop before library discovery and adopt a maintained library, despite having no gap to invoke. This can lead to an unnecessary dependency or an instruction-violating decision; the planning impact is reversible.",
    "change": "Explicitly allow adoption of a suitable repository, dependency or platform implementation for these mechanisms, and align the auth/crypto/protocol requirement and decision form with that precedence."
  }
]

### Verification (DbaVerificationR1)

[
  {
    "area": "Verification — research order and release history",
    "defect": "The principal real-session row can pass without exercising the required platform search or the named release-history endpoint. In ordinary planning, an agent could search the repository and then jump straight to libraries, or record a release without using deps.dev, yet satisfy the row. That leaves the stated ordered research workflow and keyless release-history scenario unproved; the resulting planning behaviour is reversible but misses the change’s goal.",
    "evidence": "specs/openspec-design-adoption/spec.md:10-16 and :77-82 require repository, platform, then libraries and a keyless Maven release-history response. design.md:128 requires only a repository search followed by `web_search` or `read` research; tasks.md:15 judges against that row.",
    "change": "Require the retained calls and results to show each applicable search stage in order, including a successful keyless deps.dev Maven package read and its version/date response. Judge the session output against those observations."
  },
  {
    "area": "Verification — adoption when a candidate covers the need",
    "defect": "The only planner-session acceptance condition permits either adoption or any named gap, even when a maintained candidate covers the targets. A planner that continues hand-building the OIDC client despite a suitable library can therefore pass F1, leaving the primary value proposition unproved. This affects ordinary plans and is reversible, but defeats the goal of adopting an existing implementation.",
    "evidence": "specs/openspec-design-adoption/spec.md:65-68 requires adoption when a maintained OIDC client covers the targets; design.md:128 accepts a decision that 'adopts a library or names a gap'. The complete-decision row at design.md:134 supplies a prewritten adoption decision to the reviewer rather than exercising the planner's choice.",
    "change": "Add or strengthen a fresh planner-session row with a demonstrably suitable maintained candidate and judge that the resulting decision adopts it; retain the research and decision evidence."
  },
  {
    "area": "Verification — partial coverage branch",
    "defect": "No planned real-session row exercises a candidate that covers only part of the requested platforms. The model could treat partial coverage as a reason to build everything, or omit the uncovered platform and still pass every listed row. This is a normal adoption decision and leaves an explicit material scenario unproved; the resulting plan is reversible.",
    "evidence": "specs/openspec-design-adoption/spec.md:46-49 requires adoption of the covered part, building of the remainder, and the desktop gap. The complete F1 matrix in design.md:126-134 covers a general OIDC search, a format parser, and reviewer fixtures, but no partial-coverage planner scenario; tasks.md:15 runs only those rows.",
    "change": "Exercise a fresh planner session with a candidate that covers Android and iOS but not desktop, and retain and judge the resulting partial-adoption decision and named gap."
  }
]

### Checks (DbaChecksR1)

[
  {
    "area": "PROCESS 5 — gate.md risk tier and tasks.md workflow follow-up",
    "defect": "The plan classifies the change as internal-tooling even though it changes the criteria that gate implementation of product changes. Under PROCESS 5, a change to how product code is gated must use the product tier.",
    "evidence": "gate.md:3-4 declares Mandatory class none and Risk tier internal-tooling; design.md:83-90 adds a correctness-lens blocker for missing or incomplete build-vs-adopt decisions. The existing schema makes review required and blocks apply until an acceptable review exists (team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:323-329); its review instruction makes any rejecting lens reject the round (schema.yaml:401-402). Thus an ordinary product change subject to this schema can now be prevented from reaching implementation by the new criterion. The effect is reversible by reverting and redeploying the instruction, but it changes the product gate in normal use.",
    "change": "Classify the risk tier as product in gate.md, reassess the mandatory class from the delivered behavior under openspec/config.yaml, and update tasks.md's F2 workflow to use the product-tier review decision."
  }
]
