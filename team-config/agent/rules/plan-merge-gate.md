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
- Risk tier: <product | internal-tooling>
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
`auth-secrets-pii` applies when the change touches a real credential, an authentication or authorisation path, or third-party personal data. Classify the value and its reach, never the filename: a provider key or production token read from a local `.env` is real; a synthetic password generated only for disposable local/test services is not.

## Risk tier

- `product`: ships to users or production, or can reach a protected asset (production data, a
  real credential, third-party personal data, tenant isolation, money, an audit trail,
  irreversible state). Full gate; mandatory classes apply. A plan without the field is product.
- `internal-tooling`: dev, CI, and proof tooling that reaches no protected asset. `Mandatory
  class` must be exactly `none`. F2 runs exactly one implementation-audit; each gate lane allows
  two fix rounds, and a third wave that still has blockers stops for freeze or re-plan, with
  unfixed blockers in the record's `downgrades`. A protected asset in reach makes the plan product.
- `personal`: a local tool for one user opts out with `- Merge gate: not applicable (<reason>)`;
  the validator refuses `Risk tier: personal`.
- The value is exactly one tier word; the reason goes into `Author's risk assessment`.

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

## OpenSpec change folders

An OpenSpec change folder is a plan when `--plan` names the directory: its `gate.md` is the `## Merge gate` section (`Risk tier`, `Mandatory class`, `Author's risk assessment`, `Whole-diff review`, the abort fields), its specs' `### Requirement:` blocks are the criteria (a change without requirements adds a `- Feature-specific criteria:` block to `gate.md`), and `plan_sha256` is the digest of the folder's bundle.
