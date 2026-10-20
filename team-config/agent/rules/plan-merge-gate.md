---
description: Every feature plan that will be merged carries the final verification wave (F3, F1, F2) and a `## Merge gate` section, including the abort-rule fields, that validate-gate-record.mjs --plan-only accepts
alwaysApply: true
---

# Plans carry their merge gate

A plan for work that will be merged (not a throwaway spike) ends with these two sections, in
this shape. The `merge-gate` extension runs `validate-gate-record.mjs --plan-only` on every
proposed plan and refuses the proposal until it passes; the criteria check runs again at merge
time, after reviewers were paid for, so get it right at plan time.

```
## Final verification wave
- [ ] F3. Whole-diff review: `integration-review` over <base>...<head> when Merge gate says needed; otherwise tick with its reason
- [ ] F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: <what could break, and how badly>
- Mandatory class: <none | auth-secrets-pii | schema-migration | wire-contract-api | concurrency-state>
- Whole-diff review: <needed | not needed + reason>   (needed when the change spans 3+ modules/layers)
- Accepted residual risks: <named risks that may not block a gate wave, or none (<reason>)>
- Out of scope for blocking: <areas, modes, providers whose findings become follow-ups, or none (<reason>)>
- Feature-specific criteria:
  - Invariant: <property that must hold>
    Positive witness: <observation proving expected behaviour>
    Negative control: <plausible broken outcome that MUST fail>
    Observable: <measured output>
    Boundary: <real contract surface where it is checked>
  - Mechanical: <deterministic equality check; no negative control needed>
    Invariant: <property that must hold>
    Observable: <measured output>
    Boundary: <real contract surface>
```

Every behavioural criterion needs all five fields; the negative control is the one that is most
often missing and the one that makes the criterion discriminate. Mandatory class other than
`none` means both reviewers run at F2, no discretion.

## The criteria are the abort rule

- The feature-specific criteria are the F2 blocking invariants. Write each one so a reviewer can
  decide whether a given finding violates it.
- A finding about an accepted residual risk or an out-of-scope area MUST NOT block a gate wave.
- Both abort-rule fields MUST be top-level bullets in `## Merge gate` with concrete text or
  `none (<reason>)`. The validator refuses a missing or duplicate field, an empty value, template
  text, `TBD`/`TODO`/`n/a`, and a bare `none`.

## Decide before code

- An assumption of the form "if this is not acceptable, then X" MUST be decided with the user
  before implementation; the plan records the decision and who made it.
- An X that adds a subsystem (proxy, staging tree, daemon, store, endpoint) MUST be designed in
  this plan or become its own plan.
- A plan that changes more than two subsystems (packages, services, independently testable
  mechanisms) MUST be cut into plans with their own gates, or state why the parts cannot ship
  separately.

## Opting out

Small changes that will not go through a merge gate (spikes, one-file fixes merged under the
direct-commit exception) skip both sections and carry this one line instead:
`- Merge gate: not applicable (<reason>)`. It counts only as a top-level bullet outside code fences
and HTML comments; quoting it inside a fence or nesting it under another bullet does not opt out.
A plan MUST NOT carry both the opt-out and feature-specific criteria.
