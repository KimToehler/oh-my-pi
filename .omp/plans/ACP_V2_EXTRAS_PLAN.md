# ACP protocol v2 extras (after baseline)

Status: draft scope. Detail it after `ACP_V2_BASELINE_PLAN.md` is merged, against the schema revision current at that time. Each item needs its own RED test and schema validation like the baseline.

## Scope

1. **Agent-owned display terminals.** For `bash`/`eval` tool calls, add `terminal` content references, `terminal_update` (command, absolute cwd, snapshot, exit), and base64 `terminal_output_chunk` for live bytes. Replay sends replacement snapshots.
2. **`tool_call_content_chunk`.** Stream tool content items instead of resending the whole array, using the omit/null/value patch semantics of `tool_call_update`, including key-level `_meta`.
3. **`notice`.** Recoverable failures (retried model requests, fallback model switches) that today go only to logs or chat text.
4. **Compaction.** `compaction_update` and `compaction_summary_chunk` for auto and manual compaction.
5. **Session extras.** `session/delete` behind `session.delete`, `additionalDirectories` behind its capability, and v2 `session/fork` once it is stable or properly negotiated.
6. **Stable message identity across replay.** Agent and thought ids derived from persisted entries, so clients can merge replay into existing history.
7. **Remove the `patch.diff` mirror key** once Air reads alpha.9 `text` (residual risk 1 of the baseline).

- Merge gate: not applicable (scope draft only; becomes a full plan with its own gate before execution)
