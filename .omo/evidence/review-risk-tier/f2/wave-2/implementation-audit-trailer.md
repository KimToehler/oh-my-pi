REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A final integrated QA witness must exercise the same installed workflow dependencies that will ship, rather than combining observations captured before a dependency changed.
  positive_witness: The installed reviewer, snapshot producer, and wave recorder are exercised together on the post-F3 tree, with their identities recorded.
  negative_control: A reviewer trial from before a convergence-script change is reused as the final integrated witness without rerunning that trial.
  observable: Runtime inventory and trial artifacts identify the tested tree and show the pinned-plan review and wave refusal in the same run.
  boundary: Installed-target Verification 5 and its QA matrix.
END-REVIEW-TRAILER
