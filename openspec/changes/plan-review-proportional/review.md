# Review

- **Verdict**: REJECT
- **Reviewed digest**: 614cbac63abb3514f5933d53b93ecd85c806d36368880aa01c5e1d8a553da865
- **Reviewer**: plan-reviewer, RevA1, RevB1
- **Round**: 1
- **Override**: none

## Blockers

### Scope A: correctness and checks (RevA1)

[
  {
    "area": "CHECK 4 — pending exception decisions",
    "defect": "The record-before-ask rule has no valid blocked representation for an unconfirmed finding that requires a user decision. When the verifier refutes a security finding or returns undecided on a material finding, the plan requires moving it to Residuals and writing the round before asking. Writing OKAY authorizes apply prematurely; writing REJECT with no confirmed Blockers fails the unchanged record contract. An interruption at this ordinary exception branch can therefore leave an authorizing record before the required user answer. The record is reversible, but source edits made under that authorization may already have occurred.",
    "evidence": "openspec/changes/plan-review-proportional/specs/openspec-plan-review/spec.md:64 sends every non-confirmed blocker to Residuals; :107 requires an exception ask for unconfirmed security findings and material undecided findings; :145 requires writing the verdict before that ask and permits only confirmed blocking findings under Blockers; :174 defines the verdict after any exception ask. team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs:408-416 requires nonempty Blockers for REJECT and empty Blockers for OKAY; :426-431 accepts a current OKAY without considering an outstanding ask.",
    "change": "Define an explicit awaiting-decision state that keeps --reviewed failing until the exception answer is recorded. For example, retain the unresolved exception findings under Blockers with REJECT while awaiting the answer, then move them to Residuals only after the user's decision. Reconcile the record-before-ask, Blockers and verdict requirements, and add a negative control that interrupts or stops at the unanswered exception ask and requires apply to remain blocked."
  },
  {
    "area": "CHECK 4 — verifier-result completeness",
    "defect": "The new verifier result is used to decide which findings remain blocking, but the plan defines failure handling only for absence of a structured result. It does not define rejection of a structured results array that omits a blocker, repeats an index or contains an out-of-range index. These are realistic model-output failures, especially when two reviewers contribute multiple findings. Without a complete one-to-one mapping, the orchestrator cannot distinguish a refuted finding from an unprocessed one; treating the returned subset as the completed triage can silently drop a material or security finding. The record can be corrected later, but its premature authorization is not automatically undone.",
    "evidence": "openspec/changes/plan-review-proportional/design.md:32 defines results[] with an unconstrained numeric index; tasks.md:5 specifies the element schema but no coverage or uniqueness validation, and tasks.md:10 provides a retry only when there is no structured result. specs/openspec-plan-review/spec.md:50 requires one result per blocker, but :197 defines incomplete handling only for no structured result. No outcome is specified for a partial or ambiguously indexed structured result before the authorization decision at :174.",
    "change": "Define a canonical index mapping over the complete combined blocker list and require exactly one result for every input blocker, with no duplicate or unknown indices, before triage is complete. Treat missing, partial or ambiguous coverage as incomplete/undecidable, never as residual or clean. Specify the retry/stop behavior and include negative controls for an omitted finding and duplicate indices."
  }
]

### Scope B: verification (RevB1)

[
  {
    "area": "Quality and verification — tasks 1.1, 2.1, 4.1–4.2",
    "defect": "The verification does not necessarily exercise the new loop’s central residual and bounded-exit behaviour. F1-A requires a genuine confirmed defect but makes refuted findings optional; F1-B expressly permits exhaustion to remain unexercised. There is no required session for an all-residual exit, an exhaustion decision, verifier failure/retry, or rejection recorded before a fix/ask. A verifier that confirms every finding, or an instruction with broken exhaustion handling, can therefore satisfy the specified observations. The lexical checks do not close this gap. These are ordinary workflow states and material promised behaviour; missing their proof defeats the value proof, although the resulting workflow damage is reversible.",
    "evidence": "openspec/changes/plan-review-proportional/tasks.md:5 checks agent fields but not the four-condition prompt semantics; :10 checks only required/forbidden strings in the instruction. At :21, F1-A retains the final review.md and accepts 'any refuted findings', so it requires neither a refutation nor evidence of the intermediate REJECT’s timing. At :22, F1-B explicitly allows branches not reached by real output to remain unexercised. The affected criteria include specs/openspec-plan-review/spec.md:62–84 ('Only confirmed findings block'), :86–104 ('Fix budget per depth'), and the requirements 'Budget exhaustion asks once and Override is the user’s acceptance', 'A round is recorded before any fix or ask', and 'Incomplete round'.",
    "change": "Require proportionate proof of the changed mechanisms and their riskiest branches: exercise verifier refutation/below-threshold handling and an all-residual exit; reach budget exhaustion and retain its ask/answer and subsequent action; retain successful interactions or intermediate artifacts establishing record-before-fix/ask ordering. Add focused delivered-text/instruction negative controls for the new exception, retry and budget rules where live failures are not exercised. Judge retained real-session behaviour directly; no behaviour-scoring command or new runtime subsystem is needed. Unexercised material branches must not leave the final verification complete."
  },
  {
    "area": "Quality and verification — task 4.3 security oracle",
    "defect": "F1-C uses a fake fixture key but requires a CHECK 1 finding to be confirmed or escalated. The reviewer contract explicitly excludes test-fixture values from protected credentials. A correct reviewer can return no security blocker, leaving the intended protected-finding branch entirely untested; forcing the expected result would instead reward a false finding. This occurs with the fixture exactly as planned and invalidates the security-branch evidence, without requiring actual credential damage.",
    "evidence": "openspec/changes/plan-review-proportional/tasks.md:23 specifies 'a fake provider-key sentinel from a fixture config' and requires 'the CHECK 1 finding either confirmed and fixed, or unconfirmed and asked'. packages/coding-agent/src/prompts/agents/plan-reviewer.md:95 defines CHECK 1’s trigger and states that 'a local development default or test fixture value is not one'. The criterion in specs/openspec-plan-review/spec.md under 'Checks lens scope for session authentication' instead concerns a plan that copies the provider key from agent configuration into committed evidence.",
    "change": "Use a disposable planning fixture whose proposed QA step would copy a real provider credential, but never execute that unsafe step or include the credential itself. Have the ordinary review session inspect that plan and retain the finding, verifier result and required fix/ask. Keep any sentinel-only execution separate as a safe artifact test, not as proof that CHECK 1 must trigger."
  },
  {
    "area": "Executability — task 2.3",
    "defect": "The schema-refresh task cannot execute as written. This repository already links its schema to the canonical source, and the installer explicitly refuses that symlink. Committing tasks 2.1 and 2.2 does not change this condition. The proposed diff also compares the linked directory with its own target, rather than proving a copied installation. The impact is a blocked implementation task; it is reversible by correcting the task, not by removing the existing protection.",
    "evidence": "openspec/changes/plan-review-proportional/tasks.md:12 requires running install-openspec-workflow.mjs in this repository. team-config/README.md:115–117 identifies openspec/schemas/omp-gated as a symlink to the canonical schema. team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs:82–85 rejects symbolic links in the schema path and explicitly explains that this repository links its schema to the canonical copy. The existing test 'a symlinked schema directory' at install-openspec-workflow.test.ts:274–281 expects refusal.",
    "change": "Replace task 2.3 with verification that this repository’s existing symlink exposes the updated canonical schema. Exercise the installer only in an ordinary disposable repository with a real schema directory, as intended for the F1 fixtures and downstream installations. Do not remove the symlink guard."
  }
]
