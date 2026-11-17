# lease-simul

Run 2026-11-17 on head `7a3687e8267cbbf3ef5ac275e1eff3e28bf362da` (deployed, `f2/wave-9/deployed-rev.txt`). *Test* row: no live command; the named tests are cited from `f2/wave-9/qa-test-log.txt` (`node --test` of `qa.test.mjs` on this head: 226 tests, 225 pass, 1 fail; the failure is `route: interrupt - a host killed after the extraction ...`, a 10 s wait for its fake tar to reach its hold point that ran out at host load about 45, and passed 3 of 3 times when run alone, `f2/wave-9/qa-test-rerun.txt`; it is not one of the tests this row cites).

Tests (`team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`):

- `lease: simultaneous - two worktrees started together for one free slot give one holder, one build and one clone`: two starts on one free slot.
- `lease: same-worktree - two vm up started together give one slot, one build and one exit 2 naming the owner`: two starts in one worktree.

Observation: both named tests are listed as passing (`✔`) in the log on this head.

Verdict: PASS
