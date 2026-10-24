INTEGRATION-REVIEW-REPORT-v1
**Must-fix:**

None.

**Should-fix:**

- **README.md:558, 560, 567** — **what:** The ACP overview still says writes are permission-gated and that “edits and commands” ask, while the changed default is `write` and the shared approval resolver prompts only calls that resolve to `prompt` (for example exec-tier calls and destructive edits). **why:** Users and ACP integrators following the root README receive materially incorrect authorization expectations, including omission of newly gated `eval`, `task`, and similar exec-tier tools. This does not block because runtime behavior and the dedicated approval documentation are correct. **fix:** Rewrite the ACP paragraph/table to distinguish routing (`fs/*`, terminal) from approval, say that unconfigured ACP uses `write`, and link to `docs/approval-mode.md#acp-sessions` for the resolver’s complete permission matrix.  
  **class:** stale ACP authorization documentation  
  **sites:** `functions.grep(pattern: "writes are gated by|edits and commands still ask|edit, bash.*session/request_permission", path: "README.md;docs/**/*.md;packages/coding-agent/CHANGELOG.md", case: false, gitignore: true)` → `README.md:558,560,567` only.

**Nit:**

None.

**Checked:**

- **Duplication across slices/files:** no instance found. Permission option conversion, request construction, and edit-location extraction are centralized in `modes/acp/acp-approval.ts`; the reduced subagent bridge is shared by ordinary spawn and persisted revival.
- **Naming consistency:** no instance found. The three reviewed concepts—approval prompt/options, session denial/ledger, and client bridge—use consistent names across the ACP UI, wrapper, runner, executor, docs, and tests.
- **Uneven API surface:** no instance found. v1 and v2 consume the same `ClientBridgePermissionToolCall` and option list; `acpPermissionOptions()` is the single source of option-id/kind mapping.
- **Mixed conventions:** no instance found. ACP now supplies `ExtensionUIContext.approve`; it no longer retains a parallel proxy/cache convention beside `ExtensionToolWrapper`.
- **Missing/premature abstractions:** no instance found. The new helpers have multiple production responsibilities without duplicate implementations; the new `ApprovalDenialLedger` and reduced-bridge helper carry cross-spawn contracts rather than merely wrapping one callsite.
- **Dead code:** no instance found. The helper-consumer search found `createAcpApprove` installed in `createAcpExtensionUiContext`, location extraction used by request construction, denial ledger passed through the session/executor chain, and `createSubagentClientBridge` used by normal and persisted revival paths. Removed proxy symbols have no remaining matches.
- **Doc drift:** instance reported above. `docs/approval-mode.md`, `docs/tools/task.md`, and the changelog match the changed behavior; no i18n keys or locale catalogs were introduced.
- **Surprise-scope walk:** the changed source, tests, wire fixtures, OpenSpec artifacts, and docs map to the plan’s D1–D8 surface and supplied seams. `AGENTS.md` is the explicitly authorized one-line out-of-feature change. No unplanned implementation area found.
- **Plan walks:** out-of-scope areas were not implemented: no advisor-session changes, no `/forget-approvals` session-denial behavior, no subagent permission forwarding/terminals/progress rendering, and no MCP-tier change. All slices’ intended source surface is represented, with supporting tests/fakes. No i18n keys exist. Checklist items 5.1 and 5.3 remain unchecked, so their test and manual-QA execution is **not confirmed** by this static review; 5.2 is this F3 review and still needs its report artifact written by the caller.
- **Seam list:** reviewed producer/consumer pairs for prompt call identity; `deny-session` mapping and session checks; ACP UI-context installation without form elicitation; factory default-mode override; v1/v2 permission mapping; proxy-gate deletion; client-bridge and denial-ledger inheritance through normal, structured, vibe, warm-revive, and persisted-revive paths.
- **Simplification pass:** no further cross-slice simplification candidate found.
- **Verification evidence:** static diff/repository review only; no build, test, formatter, or manual QA execution is claimed.

PASS