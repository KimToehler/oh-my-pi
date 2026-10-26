# F1 b — peer message to A's parked subagent is held through A's move

Head: `df2a0e6917f3ff2a2319b6fced268536bf238d59` (merged `main` at `9c075012392644690a351983316004a70b90c5f6`; later evidence/task commits do not change runtime code).
Surface: one real ACP stdio process from the worktree source build, with sessions A and B in `/tmp/ral-f1/qa-bc4`.
Fixture: one-commit git repository, registered `.worktrees/a`, `task.agentIdleTtlMs: 2000`. The target worktree contained 6000 disposable project skills so the real headless rescope kept the relocation window open long enough to observe externally.
Driver: `/tmp/ral-f1/peer.ts`, using raw ACP JSON-RPC. It spawned HelperA under A and HelperB under B, waited 5 seconds for both to park, then made one B eval call wait on a gate file. After A's `/move .worktrees/a` began, the driver opened the gate and the eval concurrently called `write agent://HelperA` and `write agent://HelperB`.
Command: `cd /tmp/ral-f1 && timeout 500 bun peer.ts /tmp/ral-f1/qa-bc4 qa-bc4 > /tmp/ral-f1/bc4.log 2>&1`.

Observed ACP timings from `/tmp/ral-f1/bc4.log` (epoch milliseconds):

```text
1793030938995 MOVE-START /move .worktrees/a
1793030939699 gate opened; B submitted both peer messages
1793030940150 HelperB receipt: Queued for HelperB (was parked; revived).
1793030940187 A /move prompt response: Moved to /tmp/ral-f1/qa-bc4/.worktrees/a.
1793030940213 HelperA receipt: Queued for HelperA (was parked; revived).
```

HelperA's receipt completed after A's relocation response, while HelperB's completed before it. HelperA's transcript was revived from the relocated path:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc4-.worktrees-a--/2026-10-26T16-08-20-193Z_01a178f8-49e1-76e1-9bb3-8ac0e2fcf47a/HelperA.jsonl`

Its observed entries include the pre-move `ready` response, the peer `irc:incoming`, a `write` reply of `pong-a`, and final text `pong-a`. A's old artifacts directory

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc4--/2026-10-26T16-08-20-193Z_01a178f8-49e1-76e1-9bb3-8ac0e2fcf47a/`

was absent after the move; no transcript or other file was written there. The source bucket retained only the root session lease sidecar, outside the old artifacts directory.

RESULT b held delivered
