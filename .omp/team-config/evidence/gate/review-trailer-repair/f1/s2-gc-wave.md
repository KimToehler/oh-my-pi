# s2 GC wave (worktree gate-convergence.mjs, head 727e46f95551a46a9e77699c9506381d7d116052)

Scratch repository `/tmp/rtr-f1-gc-bQ75`, plan `.omp/plans/demo.md`.

Snapshot: `/tmp/rtr-f1-gc-bQ75/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.snapshot.json`

### PASS outcome without --trailer

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/gate-convergence.mjs --repo /tmp/rtr-f1-gc-bQ75 --plan .omp/plans/demo.md wave --lane F2 --snapshot /tmp/rtr-f1-gc-bQ75/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.snapshot.json --outcome qa=PASS --outcome implementation-audit=PASS
stdout: 
stderr: gate-convergence: implementation-audit is PASS but no --trailer implementation-audit=<path> was given; store and check the reviewer's trailer first
exit: 1
```

Ledger gate_wave events after: PASS without trailer

```
(none)
```

### PASS outcome with a FAIL trailer

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/gate-convergence.mjs --repo /tmp/rtr-f1-gc-bQ75 --plan .omp/plans/demo.md wave --lane F2 --snapshot /tmp/rtr-f1-gc-bQ75/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.snapshot.json --outcome qa=PASS --outcome implementation-audit=PASS --trailer implementation-audit=.omp/team-config/evidence/demo/f2/trailer-implementation-audit-fail.txt
stdout: 
stderr: gate-convergence: trailer.implementation-audit.verdict: trailer reports FAIL but the expected verdict is PASS
exit: 1
```

Ledger gate_wave events after: PASS with FAIL trailer

```
(none)
```

### PASS outcome with a passing trailer

```
$ node /Users/tim/git/oh-my-pi/.worktrees/review-trailer-repair/team-config/agent/skills/review-work/scripts/gate-convergence.mjs --repo /tmp/rtr-f1-gc-bQ75 --plan .omp/plans/demo.md wave --lane F2 --snapshot /tmp/rtr-f1-gc-bQ75/.omp/team-config/gate-deltas/F2-b216e7fd56b0-wave-1.snapshot.json --outcome qa=PASS --outcome implementation-audit=PASS --trailer implementation-audit=.omp/team-config/evidence/demo/f2/trailer-implementation-audit.txt
stdout: DECISION: PASS
WAVE F2 1 total=0 fix_induced=0 unlocated=0
stderr: 
exit: 0
```

Ledger gate_wave events after: PASS with passing trailer

```
{"ts":"2026-10-24T21:24:56.123Z","event":"gate_wave","plan":".omp/plans/demo.md","lane":"F2","wave":1,"reviewed_sha":"0c7b976f83f7cdf91ceb4dc855b64e024cb7e194","outcomes":{"qa":"PASS","implementation-audit":"PASS"},"blockers_total":0,"blockers_fix_induced":0,"fix_induced":[],"unlocated":[],"decision":"PASS"}
```

## Verdicts

- PASS outcome without --trailer: as expected
- PASS outcome with a FAIL trailer: as expected
- PASS outcome with a passing trailer: as expected

RESULT: PASS
