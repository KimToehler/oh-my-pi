**Bottom line:** No blockers. Architecturally, the change establishes one canonical folder snapshot and bundle representation shared by convergence and final validation, while centralizing gate grammar in `plan-contract.mjs`; the remaining reviewer-to-bundle attestation gap is explicitly deferred to P3a rather than introduced or widened here.

### Four questions

1. **Does the change hold up architecturally against the rest of the system?**  
   Yes. `folder-plan.mjs` owns filesystem traversal and canonical bundle construction through `snapshotFolder`, `buildBundle`, and `bundleDigest`. `validate-gate-record.mjs` then feeds one snapshot through `validateOpenSpecFiles`, gate classification, digest verification, and path pinning in `loadFolderPlan`; `gate-convergence.mjs` uses the same bundle builder for its immutable plan copy and wave comparison. Moving criteria, abort-field, and value grammar into `plan-contract.mjs` also avoids a second validation convention. File-plan behavior remains on its existing branch.

2. **What does the auditor’s line-level view structurally miss?**  
   The principal system-level concern is identity across the human review boundary: `plan_sha256` proves which folder bundle the record pins, but individual reviewer trailers do not attest that digest. The supplied QA even distinguishes classification enforcement from reviewer-to-bundle binding. That gap is real but belongs to the explicitly excluded P3a work and is not worsened by this change. Within P4b, the exemption envelope is appropriately narrow: `verifyAndPinArtifact` pins only files present in the snapshot, so unrelated post-review source remains subject to the existing `reviewed_sha` check.

3. **Which failure mode would hurt most in production, and is it addressed?**  
   The worst outcome would be a silent false-positive gate: altered requirements, a downgraded mandatory class, or unrelated implementation changes passing after review and allowing unsafe code into production. Folder byte drift is addressed by the manifest-backed bundle digest and convergence wave comparison; classification drift is addressed by `checkFolderClassification`; unrelated changes remain outside the folder pin set. The separate question of proving that each reviewer actually read that exact bundle remains deferred to P3a.

4. **Is any auditor finding a false positive on unchanged behaviour?**  
   No. The auditor’s non-blocking reason-grammar observation concerns a loose checker rule that predates this patch, but the new folder-plan integration makes `gate.md` part of the final merge contract and therefore exposes the authoring-versus-record-validation asymmetry. It is a valid note, not a blocker: the failure is visible, local, reversible, and cannot produce a passing invalid record.

### Action plan

1. Preserve the trailer below verbatim as the strategic-risk-review artifact.
2. Do not open a P4b fix wave; no supplied merge-gate invariant is violated.
3. Keep reviewer-to-bundle attestation in P3a, where the plan already assigns it.
4. Treat stricter empty-reason grammar as optional follow-up hardening rather than a merge condition.

**Effort:** Quick (<1h)

**Confidence:** Medium — the supplied diff, plan, QA matrix, and audit cover the changed architecture comprehensively, but this assignment explicitly prohibited inspecting unchanged call sites or independently executing the evidence.

**Watch out for:**
- P3a remains necessary if trailers must cryptographically attest the exact bundle each reviewer read.
- The accepted local-writer TOCTOU risks remain outside this change’s protection.
- Existing local change folders using `Review tier` require the intentional clean-cutover migration to `Risk tier`.

PASS

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: The folder-plan path exemption admits only the exact reviewed folder entries and cannot absorb unrelated implementation changes committed after reviewed_sha.
  positive_witness: An unchanged folder first committed with its record and evidence validates while the reviewed implementation remains unchanged.
  negative_control: A post-review commit that adds or edits source outside the folder alongside an otherwise valid folder and record MUST fail.
  observable: validate-gate-record.mjs reports a reviewed_sha or unpinned-path failure rather than passed.
  boundary: verifyAndPinArtifact's folder target set against the post-reviewed_sha Git-diff enforcement in validate-gate-record.mjs.
END-REVIEW-TRAILER
