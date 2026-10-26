# F1 b — peer message to A's parked subagent is held through A's move

Head: `b3c022805c41bab805d6d2fd6f6fbc65e63e10e5`.
Surface: one real ACP stdio process from the worktree source build, with sessions A and B in `/tmp/ral-f1/qa-bc3`.
Fixture: one-commit git repository, registered `.worktrees/a`, `task.agentIdleTtlMs: 2000`. The target worktree contained 6000 disposable project skills so the real headless rescope kept the relocation window open long enough to observe externally.
Driver: `/tmp/ral-f1/peer.ts`, using raw ACP JSON-RPC. It spawned HelperA under A and HelperB under B, waited 5 seconds for both to park, then made one B eval call wait on a gate file. After A's `/move .worktrees/a` began, the driver opened the gate and the eval concurrently called `write agent://HelperA` and `write agent://HelperB`.
Command: `cd /tmp/ral-f1 && timeout 500 bun peer.ts /tmp/ral-f1/qa-bc3 qa-bc3 > /tmp/ral-f1/bc3.log 2>&1`.

Observed ACP timings from `/tmp/ral-f1/bc3.log` (epoch milliseconds):

```text
1793026364372 MOVE-START /move .worktrees/a
1793026365081 gate opened; B submitted both peer messages
1793026365330 HelperB receipt: Queued for HelperB (was parked; revived).
1793026365350 A /move prompt response: Moved to /tmp/ral-f1/qa-bc3/.worktrees/a.
1793026365370 HelperA receipt: Queued for HelperA (was parked; revived).
```

HelperA's receipt completed after A's relocation response, while HelperB's completed before it. HelperA's transcript was revived from the relocated path:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc3-.worktrees-a--/2026-10-26T14-52-03-896Z_01a178b2-75b8-749f-b6f6-7c6ac3cdaf16/HelperA.jsonl`

Its observed entries include the pre-move `ready` response, the peer `irc:incoming`, a `write` reply of `pong-a`, and final text `pong-a`. A's old artifacts directory

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc3--/2026-10-26T14-52-03-896Z_01a178b2-75b8-749f-b6f6-7c6ac3cdaf16/`

was absent after the move; no transcript or other file was written there. The source bucket retained only the root session lease sidecar, outside the old artifacts directory.

RESULT b held delivered
