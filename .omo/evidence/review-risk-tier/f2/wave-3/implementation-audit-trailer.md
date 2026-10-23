REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: An unrecorded wave snapshot cannot be silently reused after HEAD advances to a different commit with the same tree.
  positive_witness: Repeating snapshot at the original commit and unchanged plan reprints the existing snapshot.
  negative_control: After an empty commit changes HEAD without changing the tree, snapshot must not reuse or overwrite the prior snapshot.
  observable: Snapshot command exit status and retained snapshot commit SHA.
  boundary: gate-convergence.mjs snapshot command.
END-REVIEW-TRAILER
