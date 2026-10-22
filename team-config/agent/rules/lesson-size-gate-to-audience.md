---
description: Size the threat model and merge gate to who runs the tool and what it can damage; personal tools opt out, dev/CI/proof tooling declares Risk tier: internal-tooling
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

A product repo's dev tooling hit the same loop: a dev-env script that writes a local .env ran about
eight fix-delta rounds over NUL bytes and short reads, and a local docs-check script ran seven F2
waves, while the product milestones had not started. Every round counted every finding as a
blocker. Reviewers now mark blockers only against the shared blocking threshold, and every blocker
the gate leaves unfixed goes into the record's downgrades with the user's override.

**How to apply:**
- Personal, local-only tool: put `- Merge gate: not applicable (<reason>)` in the plan. Threat model
  = accidents that corrupt your own results, not an adversary on your own machine.
- Invariants protect **decision correctness**: matched conditions, complete data, honest
  eligibility. Hardening beyond that is a follow-up, driven by real use.
- Before the gate, write the **value proof**: the one real end-to-end run whose result the user would act on.
  Run it before any review wave.
- Dev, CI, or proof tooling in a product repo: `- Risk tier: internal-tooling` with `Mandatory class: none`. One auditor, two fix rounds per lane, then freeze or re-plan; unfixed blockers go into the record's downgrades.
- Gate waves: follow the review-work skill's "Fix waves" section; it stops when fix-induced blockers
  rise, the blocker count does not fall over three waves, or an internal-tooling lane has used its two fix rounds.
