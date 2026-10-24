# s1 trailer check (worktree validator, head 727e46f95551a46a9e77699c9506381d7d116052)

Plan: `openspec/changes/review-trailer-repair` (change folder). Inputs under `/tmp/rtr-f1/inputs`; the repair reply is kept as `s1-repair-reply.md`.

Input `foreign-layout.md`:

```
Section 1-5 reviewed; no blocker.

REVIEW-TRAILER-v1
Reviewer: Auditor (openai/gpt-5.6-terra)
Invocation: implementation-audit
Sections covered: 1, 2, 3, 4, 5
Security delta: no
Verdict: PASS
END-REVIEW-TRAILER
```

Input `criterion-typo.md`:

```
Section 1-5 reviewed; no blocker.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: openai/gpt-5.6-terra
security_delta: no
verdict: PASS
blockers: none
adversarial_criterion:
- invariant: a reply whose trailer names another lane never counts for this lane
  positive_witness: the matching lane passes
  negative_control: the other lane's trailer is refused
  observable: exit code and stderr field
  boundary: validator process
END-REVIEW-TRAILER
```

Input `no-trailer.md`:

```
Section 1: read the diff.
Section 5: no blocker found.

Verdict: PASS
```

Input `repair-fail.md`:

```
Blocker B1: gate-convergence.mjs:537 records a FAIL without its trailer

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: openai/gpt-5.6-terra
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: a reply whose trailer names another lane never counts for this lane
  positive_witness: the matching lane passes
  negative_control: the other lane's trailer is refused
  observable: exit code and stderr field
  boundary: validator process
END-REVIEW-TRAILER
```

### foreign Reviewer: Auditor layout

```
$ check /tmp/rtr-f1/inputs/foreign-layout.md PASS
stdout: blocked
stderr: trailer.adversarial_criteria: trailer must carry an adversarial_criteria block
exit: 1
```

### adversarial_criterion typo

```
$ check /tmp/rtr-f1/inputs/criterion-typo.md PASS
stdout: blocked
stderr: trailer.adversarial_criteria: trailer must carry an adversarial_criteria block
exit: 1
```

### no trailer block

```
$ check /tmp/rtr-f1/inputs/no-trailer.md PASS
stdout: blocked
stderr: trailer: trailer is missing: no REVIEW-TRAILER-v1 / END-REVIEW-TRAILER block on its own line, so what the reviewer was asked cannot be established
exit: 1
```

### repair-shaped FAIL reply

```
$ check /tmp/rtr-f1/inputs/repair-fail.md FAIL
stdout: passed
stderr: 
exit: 0
```

## Verdicts

- foreign Reviewer: Auditor layout: as expected
- adversarial_criterion typo: as expected
- no trailer block: as expected
- repair-shaped FAIL reply: as expected

RESULT: PASS
