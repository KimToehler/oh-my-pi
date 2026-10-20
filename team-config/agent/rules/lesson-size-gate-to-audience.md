---
description: Size the threat model and merge gate to who runs the tool; a personal local-only tool gets "Merge gate: not applicable" and proves value with a real run, not adversarial review waves
globs:
  - "**/plan.md"
  - "**/.omo/plans/**/*.md"
  - "**/.omp/plans/**/*.md"
---

# Size the gate to the audience

Before a plan claims a mandatory class or freezes security invariants, ask who runs the tool and
whose data it touches.

**Why:** the Evo2 metrics substrate in oh-my-pi was a personal, local-only tool. Its plan was written
like a shared product: credentials must never reach disk, an unauthenticated bind was a blocker, and
`concurrency-state` made two reviewers mandatory. That ran 88 fix rounds, 26 of them about credentials.
Every dual-review wave found new sinks, and the one thing that mattered was never shown: a real A/B
comparison with a decision-eligible result. The user stopped it with "it doesn't need to be perfect.
It needs to work and deliver real value."

**How to apply:**
- Personal, local-only tool: put `- Merge gate: not applicable (<reason>)` in the plan. Threat model
  = accidents that corrupt your own results, not an adversary on your own machine.
- Invariants protect **decision correctness**: matched conditions, complete data, honest
  eligibility. Hardening beyond that is a follow-up, driven by real use.
- Before the gate, write the **value proof**: the one real end-to-end run whose result the user would act on.
  Run it before any review wave.
- If the same invariant class yields new findings in two consecutive review waves, stop and ask
  the user whether the scope still fits, before fixing round three.
