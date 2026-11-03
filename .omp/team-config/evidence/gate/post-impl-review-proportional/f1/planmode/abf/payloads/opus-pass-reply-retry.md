PASS

Fresh review of the five sections against the brief's diff (`scripts/gate.ts`, `scripts/gate.test.ts`, `README.md`, plan ticks), the plan's `## Merge gate` criteria and the QA matrix.

1. Goal and behavioural contract. `decide` now rejects with `needs 2 independent approvals, got <n>` unless at least two distinct reviewer names other than `candidate.author` approved, and still rejects any failed check first. This matches the plan goal and both feature-specific criteria. The CLI prints `ADMIT` / `REJECT <reason>` and exits 0 / 1 as before.

2. Correctness, regressions, architecture, wire contracts. The approvals are collapsed through a `Set` of reviewer strings after filtering the author, so duplicates and self-approval cannot inflate the count. Check order is unchanged (checks first, approvals second), so existing consumers that read the first reason see the same text for failing checks. The change touches one module and its test; no cross-module seams. The candidate JSON shape is unchanged. No duplication or simplification opportunity beyond the named `REQUIRED_APPROVALS` constant already used.

3. Security and privacy delta. No credential, authentication path or personal data is touched. Reviewer identity is trusted as given (case-sensitive); that is a named accepted residual risk of the plan. Not a blocker.

4. Verification adequacy. The unit tests cover the admit path, a failing check with enough approvals, zero approvals, duplicate approvals and self-approval. The QA matrix exercises the same scenarios through the real CLI with stdout and exit status artifacts. Adequate for the stated criteria.

5. Verdict: PASS. No blockers.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cc/claude-opus-5
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: an approval that names the candidate author, repeated alongside one genuine reviewer, never lifts the independent count to two.
  positive_witness: author `ann` with approvals `ann`, `bob`, `cy` counts two independent reviewers and prints ADMIT.
  negative_control: author `ann` with approvals `ann`, `ann`, `bob` must print REJECT with `got 1` and exit 1.
  observable: stdout line and process exit status of the gate CLI for each candidate file.
  boundary: the `scripts/gate.ts` command-line entry reading a candidate JSON file.
END-REVIEW-TRAILER
