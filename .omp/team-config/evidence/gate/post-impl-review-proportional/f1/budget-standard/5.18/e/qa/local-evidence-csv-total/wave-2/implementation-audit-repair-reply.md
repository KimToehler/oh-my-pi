REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: a read failure never prints a cause that is not the actual one
  positive_witness: a file with mode 000 prints a message containing `permission denied`
  negative_control: the same run prints `no such file`
  observable: stderr of the CLI for a file the caller may not read
  boundary: the CLI process boundary
END-REVIEW-TRAILER
