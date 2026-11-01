# Review

- **Verdict**: REJECT
- **Reviewed digest**: e2a449ccfd3091b02f756b96e6c769273e5e3f0adb1c44f5425863ba130e7189
- **Reviewer**: plan-reviewer, DbaCorrectnessR2, DbaVerificationR2, DbaChecksR2
- **Round**: 2
- **Override**: none

## Blockers

### Correctness (DbaCorrectnessR2)

[
  {
    "area": "correctness",
    "defect": "The design trigger and reviewer check only cover built mechanisms, leaving adopted mechanisms without a required decision.",
    "evidence": "design.md:50,84-88 restrict the trigger and check to builds; specs/openspec-design-adoption/spec.md:18-21,43 require a decision for each covered mechanism, including platform SHA-256. A single-module change using the existing JDK digest, with no other design trigger, can skip design.md entirely. This reversibly misses the stated decision requirement.",
    "change": "Trigger design.md and the missing-decision review for covered mechanisms regardless of whether they are built or adopted."
  }
]

### Verification (DbaVerificationR2)

[
  {
    "area": "Quality and verification",
    "defect": "F1 never exercises a mechanism already covered by the repository or an installed dependency, so it cannot establish that the planner adopts it and stops before platform and library research. In ordinary use, an agent could overlook existing project code and perform unnecessary research or propose a duplicate implementation while every planned row passes. The resulting plan is reversible, but misses the central build-versus-adopt goal.",
    "evidence": "design.md:128-133 exercises a repository search that proceeds to platform and libraries, and a separate platform-covered case; no row supplies a covering repository implementation or dependency. design.md:138 names only the nothing-found branch as unexercised; tasks.md:15 runs only those rows.",
    "change": "Add a fresh-session fixture with a covered mechanism already implemented in the repository or an installed dependency. Require the decision to identify it with PATH:LINE, adopt it, and show no platform or library search; retain the same evidence as the other F1 rows."
  },
  {
    "area": "Quality and verification",
    "defect": "The correctness-lens tests do not exercise the explicitly required rejection of a decision missing an entire form line. A reviewer that catches a missing subsection, missing candidate release and gap-less verdicts but accepts a decision without, for example, its Repository or Platform line would pass all the planned lens rows. This is a reversible plan-review failure, but breaks a stated gate criterion.",
    "evidence": "specs/openspec-design-adoption/spec.md:94-96 requires a blocker for a missing line or candidate fact. design.md:134-136 tests a missing subsection, missing candidate release and gap, and a complete decision, but no decision missing a form line; tasks.md:15 runs those cases.",
    "change": "Add a real correctness-lens session with an otherwise complete decision missing one required line, and require a REJECT blocker naming that omission. Retain the reviewer output and calls with the other F1 evidence."
  }
]

### Checks (DbaChecksR2)

[
  {
    "area": "CHECK 4 — Build-vs-adopt decision, design.md D4/E2 and D6",
    "defect": "The decision predicate has no undecidable state for an unavailable, incomplete or unreadable research source. During an ordinary search-provider outage, the planner can record the searches run, enter `none`, and provide a build gap; the planned lens then has no reason to reject that complete-looking decision. This can permit a covered mechanism to be built without establishing that adoption was unavailable, defeating the change's goal. The resulting plan is reversible.",
    "evidence": "design.md:58-72 permits `none and the searches run` and `build, gap: <what nothing above covers>`; design.md:81-85 makes the lens block missing fields or gaps, not failed research. Search failures are realistic: packages/coding-agent/src/web/search/index.ts:349-355 returns an error with an empty sources list after providers fail. D6 at design.md:128-140 has no outage or incomplete-result control.",
    "change": "Define completed research and a visible undecidable outcome for failed, missing, partial or unreadable results; prevent a build decision from treating those states as no candidate. Add a negative control that exercises a failed search and confirms that the decision cannot pass as `none`."
  }
]
