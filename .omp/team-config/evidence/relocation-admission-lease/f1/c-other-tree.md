# F1 c — B's own parked subagent is unaffected by A's move

Head: `b3c022805c41bab805d6d2fd6f6fbc65e63e10e5`.
Surface, fixture, driver and command: the same one-process/two-session ACP run recorded in `b-acp-peer.md`.

B submitted peer messages to HelperA and HelperB at gate timestamp `1793026365081`, while A's real `/move .worktrees/a` was still rescoping. The observed receipts were:

```text
1793026365330 HelperB: Queued for HelperB (was parked; revived).
1793026365350 A /move prompt response
1793026365370 HelperA: Queued for HelperA (was parked; revived).
```

HelperB therefore revived and accepted B's message before A's relocation settled; HelperA remained held until after settlement. HelperB's transcript stayed under B's unchanged artifacts directory:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc3--/2026-10-26T14-52-04-181Z_01a178b2-76d5-71d9-a64a-8637b887d7b6/HelperB.jsonl`

Its observed entries include the peer `irc:incoming`, its `write` reply of `pong-b`, and final text `pong-b`. This is the negative scope control: A's tree lease did not admit or delay B's tree.

RESULT c unaffected
