# F1 c — B's own parked subagent is unaffected by A's move

Head: `df2a0e6917f3ff2a2319b6fced268536bf238d59` (merged `main` at `9c075012392644690a351983316004a70b90c5f6`; later evidence/task commits do not change runtime code).
Surface, fixture, driver and command: the same one-process/two-session ACP run recorded in `b-acp-peer.md`.

B submitted peer messages to HelperA and HelperB at gate timestamp `1793030939699`, while A's real `/move .worktrees/a` was still rescoping. The observed receipts were:

```text
1793030940150 HelperB: Queued for HelperB (was parked; revived).
1793030940187 A /move prompt response
1793030940213 HelperA: Queued for HelperA (was parked; revived).
```

HelperB therefore revived and accepted B's message before A's relocation settled; HelperA remained held until after settlement. HelperB's transcript stayed under B's unchanged artifacts directory:

`~/.omp/agent/sessions/--private-tmp-ral-f1-qa-bc4--/2026-10-26T16-08-20-478Z_01a178f8-4afd-77dd-af04-a79dbbb1d7fb/HelperB.jsonl`

Its observed entries include the peer `irc:incoming`, its `write` reply of `pong-b`, and final text `pong-b`. This is the negative scope control: A's tree lease did not admit or delay B's tree.

RESULT c unaffected
