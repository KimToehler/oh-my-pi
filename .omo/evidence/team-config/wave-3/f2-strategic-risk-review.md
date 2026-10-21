Bottom line: The installer and deploy sequencing now hold architecturally, but the merge-gate enforcement contract does not: its deterministic `Gate proof` producer rule is referenced but absent, while ordinary completion language bypasses validation. This leaves a high-severity workflow blocker despite the strong installer, deployment, and QA evidence.

Action plan:

1. **Architecture:** `installTeamConfig()` has a coherent plan/apply/recovery model: source bytes are snapshotted, destination state is rechecked, affected paths are marked adopted before mutation, and partial/final state uses the common manifest writer (`scripts/install-team-config.ts:316-328,484-505,584-594`). `scripts/deploy-local.sh:72-100` also correctly smoke-tests the staged binary, synchronizes config, and publishes only afterward.

2. **Blocker — High: completion claims can bypass the merge gate.**  
   **class:** Completion-claim gate bypass caused by a missing canonical-marker contract.  
   **Evidence:** `CLAIM_PATTERNS` recognizes `Gate proof`, “ready to merge,” and a few fixed phrases, but not normal conclusions such as “The requested work is complete” (`team-config/agent/extensions/merge-gate.ts:52-60,73-74`). `session_stop` then returns without invoking the validator whenever classification misses (`team-config/agent/extensions/merge-gate.ts:225-226`).  
   **Violated contract:** The extension and plan promise that an unbacked completion claim is refused, not merely that selected merge phrases are refused.  
   **sites:** Search `Gate proof|merge-gate-proof|CLAIM_PATTERNS|isMergeClaim` across the repository found only `team-config/agent/extensions/merge-gate.ts:52-74,225-226`; the “merge-gate-proof rule” named at line 63 is not shipped anywhere. This is the sole `session_stop` enforcement entry point.  
   **Fix direction:** Ship the referenced always-applied rule requiring an exact `Gate proof` block on every completion or merge response, then add hook tests for a marker-backed completion and the honest `NOT RUN` retraction. Exercise it through the fresh installed binary using completion wording that does not contain “ready to merge.”

3. **Structural gap missed by the auditor:** The audit validated what happens after `isMergeClaim()` returns true, but not whether normal completion output reaches that branch. Existing tests cover only “Status: still working” and “Ready to merge” (`team-config/tests/merge-gate.test.ts:416-436`), so they conceal the missing producer rule.

4. **Highest-impact production failure:** Loss of locally edited agent configuration remains the most damaging direct runtime failure. It is addressed by adopted ownership, intent/partial manifests, copy-or-move backups, destination-state checks, and the reinstall/upgrade evidence. The documented same-user path-substitution and concurrent-deploy races remain accepted residual risks.

5. **Auditor disposition:** The control-file conclusion is consistent with the owner’s explicit `.team-config-manifest.json` contract. Its verification note that `OMP_SKIP_TEAM_CONFIG=1` lacks a separate demonstration is stale rather than a code defect: current QA row 11 exercises a malformed manifest, proves the installer is skipped, preserves every agent-dir hash, and publishes the binary.

Effort: Quick (<1h)

Confidence: high

Watch out for:
- The completion marker must be present in the installed rules, not only documented in the extension comment.
- This remains a cooperative workflow guard, not a security boundary against an agent deliberately ignoring its instructions.
- Config synchronization can still partially apply before a failed deployment; the current design reports that state and keeps the prior binary authoritative rather than promising cross-directory atomicity.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A binary-only deployment neither reads nor mutates the agent configuration, even when that configuration contains state that would make the installer reject.
  positive_witness: With OMP_SKIP_TEAM_CONFIG=1 and a malformed manifest, deployment publishes the built binary while every pre-existing agent-directory file retains its hash.
  negative_control: The binary-only deployment invokes the installer, fails on the malformed manifest, or changes any agent-directory file; this outcome must fail.
  observable: Deployment exit status, installer-log count, before-and-after agent-tree hashes, and the published binary hash.
  boundary: scripts/deploy-local.sh invoked with isolated OMP_BIN_DIR and PI_CODING_AGENT_DIR.
END-REVIEW-TRAILER
