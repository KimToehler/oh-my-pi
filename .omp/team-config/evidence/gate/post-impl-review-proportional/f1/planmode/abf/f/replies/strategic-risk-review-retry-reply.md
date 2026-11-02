## 1. Architecture and cross-file seams

The change holds up within the repository’s existing design. Policy remains in the pure `decide` function; file loading, output, and exit codes remain in the CLI adapter (`scripts/gate.ts:17–39`). No interfaces, dependencies, or additional policy layers were introduced.

The seams agree:
- **Implementation → tests:** tests invoke the real decision function without mocks and assert admission or the required rejection reason.
- **Implementation → README:** both require passing checks and two distinct non-author reviewers.
- **Implementation → CLI:** the existing decision union, output format, and exit statuses remain unchanged.
- **Implementation → plan:** author exclusion, reviewer deduplication, threshold, and failing-check precedence match both feature-specific criteria.

Repository search for `decide\(|Candidate|no approval|independent approvals|scripts/gate\.ts|REQUIRED_APPROVALS`, excluding retained review evidence, found no additional production consumer requiring migration. Language-server references also identified the CLI call to `decide`.

## 2. Consistency, duplication, and simplification

No material naming inconsistency, duplicated policy implementation, dead code, mixed convention, or documentation drift was found. `REQUIRED_APPROVALS` supplies both the threshold and its diagnostic. A `Set` is sufficient; extracting another helper would add indirection without another consumer.

**Note — durable positive-edge coverage:** `scripts/gate.test.ts:11–41` lacks automated admission cases containing redundant author or duplicate records alongside two qualifying reviewers. Those cases matter because an overstrict implementation could reject otherwise valid candidates. Add the inputs from QA6 and QA7 as unit tests. This does not block: the implementation handles them correctly, and both real-CLI transcripts record admission.

## 3. Most consequential failure mode

The highest-impact failure would be admitting an under-reviewed candidate by counting approval records rather than distinct independent reviewers.

That failure is handled at `scripts/gate.ts:22–26`: author entries are removed, reviewer strings are deduplicated, and the distinct count must reach two. Failed checks still reject first (`scripts/gate.ts:18–21`), regardless of approval count.

The supplied matrix covers duplicate approvals, self-approval, author-only approvals, and failing checks with surplus approvals. I also inspected the QA2 and QA4 transcripts, which record the expected rejection text and exit status at the supplied head.

Identity authenticity is not established by this algorithm. Exact identity comparison and trust in the candidate file are explicit accepted residual risks, not new guarantees or regressions.

## 4. What a line-level reading could miss

- **The admission rule is monotonic with respect to redundant records:** adding an author approval or repeated reviewer must not invalidate two qualifying reviewers. QA6 and QA7 directly exercise this through the CLI; their inspected transcripts record `ADMIT`, exit 0.
- **The observable contract includes exit status**, not just the returned object. The CLI preserves this contract, and the matrix includes successful, rejected, and usage-error invocations.
- **Discrimination and evidence binding are separate concerns:** QA10–QA11 report old-code controls; they are not evidence that the committed unit tests themselves were observed failing before the fix.
- **Checked plan boxes are not independent validation evidence.** This review does not certify the SHA-bound merge-gate record or its validator; it assesses the supplied implementation and available QA evidence.

No substantiated blocker was found. No commands, modifications, network requests, or sub-reviewers were used.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: unresolved
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Redundant approval records cannot grant eligibility to an insufficient reviewer set or revoke eligibility from a sufficient one.
  positive_witness: With passing checks, ann+bob+cy and bob+bob+cy both admit when ann is the author.
  negative_control: With passing checks, bob+bob must not admit merely because two approval records exist.
  observable: Inspected QA6 and QA7 transcripts record ADMIT with exit 0; QA2 records REJECT needs 2 independent approvals, got 1 with exit 1.
  boundary: Candidate JSON processed through the CLI stdout and exit-status contract.
END-REVIEW-TRAILER
