# s1 trailer check (worktree validator, head 9c23851b72cfe68e216d5c0934a65ea5784553ba)

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
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --repo /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair --trailer /tmp/rtr-f1/inputs/foreign-layout.md --invocation implementation-audit --verdict PASS --plan openspec/changes/review-trailer-repair
stdout: blocked
stderr: trailer.adversarial_criteria: trailer must carry an adversarial_criteria block
exit: 1
```

### adversarial_criterion typo

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --repo /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair --trailer /tmp/rtr-f1/inputs/criterion-typo.md --invocation implementation-audit --verdict PASS --plan openspec/changes/review-trailer-repair
stdout: blocked
stderr: trailer.adversarial_criteria: trailer must carry an adversarial_criteria block
exit: 1
```

### no trailer block

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --repo /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair --trailer /tmp/rtr-f1/inputs/no-trailer.md --invocation implementation-audit --verdict PASS --plan openspec/changes/review-trailer-repair
stdout: blocked
stderr: trailer: trailer is missing: no REVIEW-TRAILER-v1 / END-REVIEW-TRAILER block on its own line, so what the reviewer was asked cannot be established
exit: 1
```

### repair-shaped FAIL reply

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs --repo /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair --trailer /tmp/rtr-f1/inputs/repair-fail.md --invocation implementation-audit --verdict FAIL --plan openspec/changes/review-trailer-repair
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
