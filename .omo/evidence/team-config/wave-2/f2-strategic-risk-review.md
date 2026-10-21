Bottom line: The implementation now holds architecturally: `scripts/deploy-local.sh` establishes the required config-before-binary publication boundary, while `installTeamConfig()` provides coherent planning, backup, intent, partial-recovery, and final-manifest phases. The auditor’s sole blocker is a false positive under the documented contract: `.team-config-manifest.json` is reserved installer control state, whereas preservation applies to managed paths; `parseManifest()` rejects unsupported additions, and reserializing a supported v1/v2 control record is not loss of user-managed content.

Action plan:
1. **Architecture:** Keep the current design. `installTeamConfig()` snapshots source bytes, verifies destination state, marks affected paths adopted before mutation, and persists partial progress; QA scenarios 9–10 show that `scripts/deploy-local.sh` publishes only after successful synchronization and preserves the previous binary and marker when synchronization fails.
2. **Structural point missed by the auditor:** The ownership boundary is semantic, not byte-provenance-based. `team-config/README.md` under “What lands where” identifies `.team-config-manifest.json` as the installer’s record, while the plan’s preservation invariant explicitly covers a “managed path”; requiring proof of who typed otherwise valid control bytes would introduce an unverifiable provenance subsystem rather than strengthen managed-file safety.
3. **Highest-impact production failure:** Loss of a local edit because a managed path is incorrectly treated as installer-owned. This is addressed by `ManifestEntry.adopted`, destination-state verification, copy/move backups, and the intent/partial-manifest recovery logic in `scripts/install-team-config.ts`; the remaining same-user path-substitution race is explicitly accepted in the plan.
4. **Auditor disposition:** The claimed loss of `{"files":{},"version":2}` is only canonicalization of supported control state. Extra keys, duplicate members, malformed hashes, and unsupported entry fields are rejected before mutation by `parseManifest()`, so the row-19 contract is satisfied without backing up every manifest serialization.
5. Do not add manifest backup churn or a provenance marker for this finding. Resolve the audit lane with the explicit reserved-control-file contract; no additional strategic blocker is present in the supplied diff or QA evidence.

Effort: Quick (<1h)

Confidence: high

Watch out for:
- If `.team-config-manifest.json` is ever redefined as user-editable data, the ownership model and documentation must change together; that is not the current contract.
- The accepted concurrent-deploy and same-user path-substitution races remain real operational residuals.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: PASS
adversarial_criteria:
- invariant: A no-op reinstall preserves the adopted ownership classification of every byte-identical managed path the installer has never written.
  positive_witness: A pre-existing byte-identical AGENTS.md remains adopted after two unchanged installs, and a later source update backs up its original bytes before replacement.
  negative_control: An unchanged reinstall clears the adopted flag, causing the later source update to overwrite the pre-existing bytes without backup; this outcome must fail.
  observable: The manifest entry after each install, the later InstallReport.backupDir, and the bytes stored at backupDir/AGENTS.md.
  boundary: installTeamConfig() across an adopt, no-op reinstall, and subsequent source-update transition on a real temporary filesystem.
END-REVIEW-TRAILER
