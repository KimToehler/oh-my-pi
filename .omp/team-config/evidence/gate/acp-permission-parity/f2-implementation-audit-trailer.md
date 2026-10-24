PASS

1. **Goal and behavioural contract**
   - Reviewed the ACP authorization cutover against the OpenSpec proposal, D1–D8 design decisions, three capability specs, merge-gate criteria, changed source/test paths, F3 report, and F1 real-surface artifact.
   - The implementation centralizes ACP authorization in `ExtensionToolWrapper` through ACP’s `ExtensionUIContext.approve`, preserves TUI approval resolution, defaults unconfigured ACP sessions to `write`, records scoped session denials, chains those denials into descendants, and derives a file-only bridge for non-isolated children.
   - The reviewed code aligns with the stated exclusions: no MCP tier change, no client terminal/dialog forwarding to subagents, and no “always reject” TUI choice.

2. **Correctness, regressions, architecture, wire contracts**
   - No blocker found.
   - `modes/acp/acp-approval.ts` validates selected option IDs against the exact offered options before mapping them to wrapper answers, and uses the wrapper call identity for permission-request construction. This preserves fail-closed behavior for unknown selections.
   - `extensibility/extensions/wrapper.ts`, `runner.ts`, and `tools/approval.ts` place session-denial lookup before prompting, retain the original approval resolver as the policy authority, and make inherited denial lookup live through `ApprovalDenialLedger`.
   - `main.ts` applies `cfgToolsApprovalMode.hostDefault(nextSettings, "write")`; the configuration implementation gives configured runtime/overlay/project/global values priority while leaving host defaults unconfigured, matching the intended ACP-only fallback.
   - `task/executor.ts` carries denial-ledger and reduced client-bridge state across ordinary execution; `task/persisted-revive.ts` covers persisted revival. The derived bridge retains only file read/write capabilities and omits client terminals, permission requests, and agent-initiated work.
   - `edit/index.ts` supplies a per-call override for delete/move operations outside yolo. `acp-approval.ts` derives edit locations from parsed edit operations, including move targets.
   - F3’s previously identified stale root README authorization wording is addressed by the changed README; no remaining issue from that F3 should-fix finding was substantiated in the reviewed material.
   - Residual accepted behavior remains as documented: a child outliving its ACP parent can encounter bridge failure; writes fail and reads may fall back to disk.

3. **Security and privacy delta**
   - `security_delta: yes`. This changes an authorization path, so it is correctly classified under the plan’s `auth-secrets-pii` mandatory class.
   - No authorization bypass was substantiated in the reviewed implementation. In particular, the removed ACP proxy/cache is not retained beside the shared wrapper gate, and descendant sessions consult the live parent denial chain before any local no-UI outcome could permit a denied tool.
   - No real credential, provider token, personal data recipient, or new external network recipient was introduced by the reviewed implementation or its QA fixture.

4. **Verification adequacy**
   - Reviewed targeted regression coverage for ACP v1/v2 permission mapping, no-form clients, mode defaults, destructive edit behavior, session denial semantics, direct/structured/vibe/eval child inheritance, warm/persisted revival, and reduced child bridge behavior.
   - The real ACP QA artifact `.omp/team-config/evidence/gate/acp-permission-parity/f1-qa.md` records PASS for scenarios a–e: exec approval, `reject_always` inheritance into a task child, no-form permission requests, unsaved-buffer reads by a child, and destructive-edit rejection.
   - The reviewed F3 report records no must-fix issue and covers cross-slice removal of the proxy gate, v1/v2 wire mapping, approval and bridge inheritance, documentation, and plan scope.
   - No commands were run in this audit, as required by the supplied read-only brief; evidence statements above are limited to inspected source, tests, and stored artifacts.

5. **Final `PASS | FAIL | INCONCLUSIVE`**
   - PASS. No realistic trigger was found that breaks the approval contract, the stated criteria, an affected consumer, or a protected asset.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-5.6-terra
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A derived subagent client bridge is capability-narrowing: inheriting parent file routing cannot retain terminal, permission-dialog, or agent-initiated-work authority.
  positive_witness: A non-isolated ACP child reads or writes through the editor’s file RPC while its local shell executes without terminal/create or session/request_permission traffic.
  negative_control: A child bridge exposing requestPermission, createTerminal, or agent-initiated turns MUST fail the criterion even if ordinary file reads succeed.
  observable: Child bridge capability flags and recorded ACP request methods show fs/read_text_file or fs/write_text_file only, with no terminal/create or session/request_permission request.
  boundary: createSubagentClientBridge and executor/persisted-revival client-bridge installation.
END-REVIEW-TRAILER