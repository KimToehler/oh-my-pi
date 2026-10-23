**Bottom line:** The shared parser, fail-closed tier binding, one-way re-tiering, and final-record constraints are architecturally coherent. However, the snapshot protocol can rebind completed review results to different plan bytes, and the automatic interpretation of `security_delta` contradicts the protected-asset definition of the tier; these are blocking contract defects.

Blocker B1: **class: state-machine / evidence-binding. sites: single instance:** `team-config/agent/skills/review-work/scripts/gate-convergence.mjs`, `commands.snapshot` is the sole snapshot writer for both lanes, with `commands.wave` as its paired consumer; the dispatch contracts are in `team-config/agent/skills/review-work/SKILL.md` Fix waves steps 1–3 and `team-config/agent/skills/integration-review/SKILL.md` steps 2 and 4. **Trigger:** a reviewer reads plan A, then—before that wave is recorded—the same-tier source plan is legitimately edited and `snapshot --lane <same lane>` is rerun for the still-unrecorded wave. **Preconditions:** the wave number has not advanced and the tracked tree remains ready. `snapshot()` deliberately chmods and replaces `${lane}-wave-${wave}.plan.md`, overwrites the identically named snapshot JSON, and prints the same path; `wave()` then validates only the replacement copy and current source. Outcomes and the supplied reviewer-trailer shape carry no snapshot identity or plan digest. **Impact:** old reviewer results can be recorded against plan B even though the reviewer consumed plan A, violating the pinned-plan invariant and potentially bypassing changed criteria, residual-risk boundaries, or protected-asset classification. The local overwrite is reversible, but a merge authorized by the falsely bound evidence can produce irreversible production effects. This does not require concurrent runs or deliberate file corruption; it is a normal recovery sequence after a plan edit.

Blocker B2: **class: classification-contract mismatch. sites: single instance:** `team-config/agent/skills/review-work/SKILL.md`, Phase 0.5 introduces the sole automatic promotion rule—“a reviewer’s `security_delta: yes` therefore means the work is product”—and Phase 4 routes the resulting block back to that rule. It conflicts with the protected-asset definitions in `team-config/agent/rules/plan-merge-gate.md`, `team-config/agent/rules/lesson-size-gate-to-audience.md`, and PROCESS 5 in `team-config/agent/rules/plan-review-process.md`. **Trigger:** eligible internal tooling moves a non-protected data class, such as a synthetic credential used only by a disposable local service, so the reviewer correctly answers `security_delta: yes` under the trailer definition “did this change move a data class somewhere new.” **Preconditions:** no production credential, authentication path, third-party personal data, or other protected asset is reachable. **Impact:** the skill nevertheless requires re-tiering to product, contradicting the feature criterion that classification depends on the asset and its reach and that such synthetic credentials may remain internal tooling. The implementation-audit supplied with this review demonstrates the semantic instability by marking `security_delta: yes` for review-control changes while simultaneously finding no security blocker. The damage is reversible procedural escalation, but it breaks the stated cost-reduction goal for an explicitly supported class of changes.

### Answers

1. **Does the change hold up architecturally against the rest of the system?**  
   Mostly at the component level. `plan-contract.mjs::readRiskTier` provides one parser for both `validate-gate-record.mjs` and `gate-convergence.mjs`; `readLedger` owns persisted tier state; `gateState` fails closed on plan/ledger disagreement; and `retier` permits only the safe direction from internal tooling to product. The architecture does not yet hold at the end-to-end protocol boundary because snapshot identity is mutable and reviewer output is not bound to a particular snapshot attempt.

2. **What does the auditor’s line-level view structurally miss?**  
   It misses temporal composition. Each individual digest comparison in `commands.wave` is correct, but those comparisons cannot distinguish the bytes originally dispatched from bytes installed by a later same-wave `commands.snapshot` call. It also misses the cross-document semantic mismatch between the broad trailer bit `security_delta` and the narrower protected-asset definition used to determine Risk tier.

3. **Which failure mode would hurt most in production, and is it addressed?**  
   The worst case is protected-asset work receiving the reduced internal-tooling gate because its effective review inputs no longer correspond to the plan ultimately recorded. The parser, PROCESS 5, mandatory-class restriction, implementation audit, and upward-only re-tier address initial misclassification well, but B1 leaves the reviewer-to-plan evidence chain unproven after a same-wave re-snapshot.

4. **Is any auditor finding a false positive on unchanged behaviour?**  
   No. The auditor’s filename-collision note concerns newly introduced snapshot behavior and is correctly non-blocking under the stated threshold. Its `security_delta: yes` trailer value is overbroad under this assignment’s data-movement definition, but that is classification metadata rather than a defect finding about unchanged behavior; it is evidence of B2’s ambiguous contract.

### Action plan

1. Make every snapshot attempt append-only and uniquely identified—include a digest or generated attempt ID in both snapshot and plan-copy filenames; never replace an earlier attempt.
2. Carry that snapshot ID and `plan_sha256` through the reviewer result/trailer, and have `commands.wave` reject outcomes not bound to the supplied snapshot.
3. Add a regression scenario: reviewer consumes A, source changes to same-tier B, snapshot reruns, and A’s result against B must fail without writing `gate_wave`.
4. Replace “`security_delta: yes` therefore means product” with “re-run Risk tier and mandatory-class classification”; require product only when the delta reaches a protected asset or triggers a mandatory class.
5. Add positive and negative policy witnesses for a synthetic disposable credential versus a real provider or production credential.

**Effort:** Short (1–4h).

**Confidence:** Medium. Both blockers follow directly from the supplied implementation and contracts, but the no-command constraint prevented a repository-wide search for additional snapshot writers or trailer-binding fields outside the supplied diff.

**Watch out for:**
- Unique snapshot names should also eliminate the auditor’s non-blocking cross-plan lane/wave filename collision.
- Re-tiering after an already dispatched review must always create a new snapshot identity and require a fresh reviewer result.
- Preserve the intentional fail-closed behavior for legacy snapshots lacking plan fields.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-5.6-sol
security_delta: yes
verdict: FAIL
blockers: B1, B2
adversarial_criteria:
- invariant: A same-lane re-snapshot must not permit reviewer results produced from earlier plan bytes to be recorded against later plan bytes.
  positive_witness: Every snapshot attempt has immutable unique files, and wave accepts only a reviewer result carrying that attempt's identity and plan digest.
  negative_control: After a reviewer reads plan A, the source changes to same-tier plan B and snapshot runs again; recording A's result against B must fail without a gate_wave.
  observable: Snapshot and trailer identities, wave exit status and stderr, and absence of a gate_wave event.
  boundary: gate-convergence.mjs snapshot/wave protocol and the review-work reviewer-result contract
END-REVIEW-TRAILER
