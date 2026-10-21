Bottom line: The installer’s recovery model is coherent, but the deploy orchestration is not a safe publication boundary: `scripts/deploy-local.sh:77-83` publishes the new binary and deployment marker before team-config synchronization can fail or partially apply. The gate should remain blocked on that version-skew risk and the missing real-deploy witness; the auditor’s manifest-extra-field blocker overstates the documented managed-path contract, although strict schema rejection would remove the ambiguity safely.

Action plan:
1. **Architecture:** The core installer holds up: `installTeamConfig()` snapshots source bytes, verifies planned destination state, writes an intent manifest, and records partial progress on failure (`scripts/install-team-config.ts`). Its tests cover recovery, local edits, adoption, symlinks, and manifest-write failures. The weak seam is the outer deployment transaction, not that state machine.
2. **Structural blocker — High:** `scripts/deploy-local.sh:77-83` runs `mv -f "$TARGET.new" "$TARGET"` and writes `omp.deployed` before invoking `bun scripts/install-team-config.ts`.  
   **class:** Premature deployment publication.  
   **single instance:** `scripts/deploy-local.sh` is the only reviewed orchestrator that both publishes the live binary and invokes the config installer; `installTeamConfig()` itself does not publish binary state.  
   **Violated contract:** A deployed binary and its installed team config are represented as coming from the same ref.  
   **Fix direction:** Run config synchronization before replacing the live binary, and write `omp.deployed` only after both operations succeed. A failed synchronization must leave the prior binary and marker authoritative and report that config may require a convergent rerun.
3. **Highest-impact production failure:** A config error after one or more applied steps leaves a new live binary, old or mixed config, and a marker claiming the new commit was deployed. The intent/partial manifest makes a later retry recoverable, but nothing prevents users or restarted integrations from running the skewed state before that retry.
4. **Auditor classification:** The missing deploy-to-runtime witness is valid. The manifest-content finding is not established as a blocker by the plan: `.team-config-manifest.json` is generated control state, while the preservation invariant explicitly covers managed paths. An unknown top-level `"notes"` member is not a supported extension contract. Still, `parseManifest()` should reject unknown top-level fields and malformed entries before mutation rather than silently canonicalizing them; preserve exact v1 migration support.
5. Add a failure-path deployment control using isolated `OMP_BIN_DIR` and `PI_CODING_AGENT_DIR`: force the installer to reject its manifest, then prove non-zero exit, unchanged live binary, unchanged `omp.deployed`, and no successful deployment message.
6. Satisfy the auditor’s integration gap with a real deployment from reviewed head into isolated directories, followed by execution of that exact installed binary against that exact installed agent directory. Re-run both review lanes after the code and QA artifacts are final.

Effort: Short (1–4h)

Confidence: high

Watch out for:
- Reordering publication does not make the multi-file config install fully atomic; document failure as recoverable rather than claiming rollback.
- Preserve `OMP_SKIP_TEAM_CONFIG=1` as an explicit binary-only publication path.
- Strict manifest validation must continue accepting exact prior v1 bytes used by existing installations.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
adversarial_criteria:
- invariant: A failed team-config synchronization does not advance either the live omp binary or the deployment-success marker.
  positive_witness: Team-config synchronization exits successfully, after which the live binary and omp.deployed both identify the selected reviewed commit.
  negative_control: The installer is forced to fail after the binary build, yet the live binary or omp.deployed advances to the selected commit; this outcome MUST fail.
  observable: Deploy exit status, live-binary hash before and after, omp.deployed bytes before and after, and the installer failure transcript.
  boundary: scripts/deploy-local.sh publication sequence exercised with isolated OMP_BIN_DIR and PI_CODING_AGENT_DIR.
END-REVIEW-TRAILER
