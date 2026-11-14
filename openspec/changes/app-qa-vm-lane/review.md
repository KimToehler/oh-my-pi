# Review

- **Verdict**: REJECT
- **Reviewed digest**: cc15dd2e41a4045978b7ae5b486c89cc613f76c991ce71fc3143d46cb12df689
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanReviewA2, PlanReviewB2
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewA2 onara/cx/gpt-6.1-sol, PlanReviewB2 onara/cx/gpt-6.1-sol
- **Round**: 2
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PlanReviewA2)

1. **Correctness — D4 orphan sweep and task 2.2**
   - defect: An orphan clone is deleted outside the table lock without first reserving its slot as closing. After an interrupted run or the documented loss of TMPDIR state, two concurrent sweeps can select the same orphan. One sweep can finish deletion and allocate a fresh clone under that name before the other executes its delayed stop/delete, destroying the new starting lease. This breaks the starting/busy lease protection; recovery requires rebuilding the disposable lease.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:106-111 puts sweep decisions under the lock and teardown outside it. Line 108 explicitly marks partial/starting/closing slots as closing, but line 111 merely deletes a clone with no slot directory. Allocation at design.md:77 requires only a free slot. The interrupted-run state is explicitly anticipated at design.md:256. This conflicts with specs/app-qa-vm-lane/spec.md:74-86, which forbids sweeping a starting lease with a live holder.
   - change: Under the table lock, claim every orphan cleanup by creating a closing slot record with its closer before releasing the lock. Allocation and competing sweeps must respect that reservation until deletion completes. Add an interleaving control with one orphan deletion paused while another sweep and vm up attempt to use the slot.
   - triage: not triaged: the verifier has not returned

2. **CHECK 1 — D5 credential inventory and D7 output return**
   - defect: The return path has no sanitization chokepoint covering all files before they are persisted on the host. An ordinary desktop capture can contain a configured username in captureJson; the unchanged guest capture implementation does not sweep it. D7 returns that file unchanged. Moreover, the explicitly anticipated unswept flow-root case is first written as a plaintext host archive and extracted, then swept. An interruption before the sweep leaves credential-bearing host files. This reaches real credentials and contradicts the stated confinement goal; local copies can be removed, but subsequent evidence disclosure cannot be undone.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:154 claims guest kept files are handled by redaction and sweepRoot. In fact, team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:759-773 copies the capture PNG and JSON directly, without sweepRoot or content redaction. design.md:190 persists the returned archive and extracts it before applying a host sweep, and applies that sweep only to returned flow roots. tasks.md:34 explicitly anticipates a returned root containing a password that the guest did not sweep. design.md:25 promises never to leave credentials outside a leased clone. The inventory at design.md:146-155 also omits the SSH private-key holder and the plaintext return-archive sink.
   - change: Define one return-file sanitization boundary covering captures, flow exports, kept roots, filenames and transfer intermediates before credential-bearing bytes are persisted outside the clone. Correct the inventory to include the SSH key/SSH process, return archives, extracted files and subprocess output sinks, with explicit exclusions where justified. Extend the sentinel control to all configured account fields and every return path, including an interruption before extraction/sanitization completes.
   - triage: not triaged: the verifier has not returned

3. **DOMAIN 3 — D2 admission and D5/D7 forwarding lifecycle**
   - defect: The plan checks the VM and forward only before invoking the guest driver. If the forward dies during an ordinary sign-in flow, the unchanged guest driver can report an application/test failure, and the host returns that result without identifying infrastructure loss. Conversely, an action not needing the backend can return success after the forward has died. There is no dependency-lifetime inventory or mid-run loss control. This compromises the QA result's provenance; rerunning can recover execution but does not correct an already reported result.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:41 checks clone status and forward PID after admission, before SSH execution. design.md:128 records the detached forward PID. design.md:189 says the exit code is the guest's, with only a restart hint on failure. The unchanged result decision at team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:1253-1268 uses Maestro status/report and does not know the host forward's state. tasks.md:32 covers a dead forward before routing, not loss during execution.
   - change: Add the required dependency table naming lifetimes, holders, checks before/after and the phase on loss for the VM, forwarding connection and other required runtime services. Establish forwarding readiness before ready, detect loss across the routed run, and classify it visibly as infrastructure failure rather than an app outcome. Include a control that removes the forward during a real routed flow and verifies that its result is not accepted as an application result.
   - triage: not triaged: the verifier has not returned

4. **DOMAIN 1 — D5/D9 remote verification environment contract**
   - defect: The delivered driver executes verification through SSH in a managed VM, so the environment-contract check applies. The plan provides scattered host/guest descriptions but no required phase table specifying network, runtime/platform, commands and whether each phase's needs are met. In particular, image provisioning, host builds, guest startup and guest sign-in have different network and runtime requirements. The missing contract leaves the required environment proof incomplete before implementation.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:35 places the actual QA commands in the guest over SSH; design.md:118-129 separates host build, guest copy, forwarding and target startup; design.md:202-209 introduces image provisioning and tool installation. No Phase | Network | Runtime/Platform | Commands | Need met? table is provided. The locked-host controls in tasks.md:103-105 are useful real-surface controls, but do not supply this inventory.
   - change: Add the phase/environment table for provisioning, host build, staging/startup and routed verification. State the necessary backend and identity-provider connectivity and guest tool/runtime requirements, place each guard in the environment it protects, and bind the existing host-versus-guest negative control to this contract.
   - triage: not triaged: the verifier has not returned

5. **DOMAIN 2 — D5 staging inventory**
   - defect: The runtime inventory covers copied worktree material but omits the golden image's runtime files and does not state identity membership or explicit exclusions. Normal execution uses the image's Node, JDK, Xcode/iOS runtime, Spectre, Maestro and guest helpers, not just the copied files. Consequently the required inventory of what actually executes in the foreign environment is incomplete.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:136-142 lists source, built artifacts, deployed driver, credentials and ignored worktree files. It has no identity-membership column and no golden-image runtime entries. Those additional executing dependencies are explicitly used at design.md:160-169 and installed at design.md:203-209. The F1 real guest runs do exercise the real driver, but do not replace the runtime-file inventory.
   - change: Extend the inventory to include image-provided runtime/tool components and generated or built runtime dependencies. For each entry record origin, tracked/untracked/ignored/generated status, whether and how it is included in the run identity or why excluded, and how it reaches the executing guest. Retain the planned real guest-driver control.
   - triage: not triaged: the verifier has not returned

6. **Build vs. adopt — incomplete research record**
   - defect: The covered launcher-cfg mechanism's candidate record does not give the candidate's release date: a repository modification date is not the newest release's publication date. Its build Decision also lacks the required explicit gap statement. The transfer subsection cites the repository tar implementation without the required line anchor. These are mandatory value-proof fields under the supplied design instruction, not optional documentation improvements; applying the plan would build the parser without the complete required record.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:238 lists ini 7.0.0 with 'modified 2026-09-09', not a release date. design.md:239 selects building the reader but does not state the Decision's gap. design.md:230 cites packages/coding-agent/src/skillshare/tar.ts without a line number. openspec/schemas/omp-gated/schema.yaml:216-221 requires PATH:LINE, newest release and its date, and a build verdict naming its gap.
   - change: Complete the candidate record with the newest release and its verified publication date, state the build gap explicitly in the Decision, and anchor the existing tar offering to its relevant source lines.
   - triage: not triaged: the verifier has not returned

### Scope B (PlanReviewB2)

7. **Quality / task 3.1 — memory-only build output**
   - defect: The planned tests can pass when build output is written to disk. Task 3.1 scans for passwords only after the run: a permanently retained redacted build log, or an unredacted temporary log deleted during cleanup, escapes that check. This leaves an explicit requirement unproved during ordinary builds; the latter variant also risks credential persistence. Retained files are removable, but a final clean scan cannot establish that no earlier disclosure occurred.
   - evidence: openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:137 requires build output to be redacted before retention and never written to disk. tasks.md:26 specifies an after-run password scan, not observation of build-output writes. The F1 stage-nc row at tasks.md:85 and final evidence check at tasks.md:111 do not close this gap.
   - change: Add a discriminating test for output persistence using a noncredential output marker as well as synthetic credentials. Observe writes during a paused build and through success/failure cleanup, using a write-recording seam if necessary to detect short-lived files. Demonstrate failure against a variant that spools output to disk and later deletes it; retain the final secret scan as an additional check.
   - triage: not triaged: the verifier has not returned

8. **Quality / tasks 2.1–2.2 and F1 — interrupted publication recovery**
   - defect: No listed test proves recovery when a process dies inside the table critical section, leaving a stale table lock or a slot without a complete lease record. The partial-record test proves only routing refusal, and the crash tests kill processes outside that critical section. An implementation that strands these slots or requires manual table-lock removal can therefore pass all listed recovery tests. Abrupt termination during slot publication breaks the promised next-sweep recovery; manual cleanup is possible but violates the requirement.
   - evidence: tasks.md:20 promises automatic dead-pid table-lock takeover. tasks.md:21 tests routed refusal for a truncated lease, but does not test sweeping that partial slot. F1 reclaim-crash at tasks.md:81 kills after cloning; reclaim-nc at tasks.md:82 cites the existing teardown tests. specs/app-qa-vm-lane/spec.md:100 explicitly requires partial-slot recovery. The adopted flow-lock precedent in team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:898-932 reports stale locks for manual removal, so it supplies no automatic-recovery proof.
   - change: Add selected tests for stale table-lock takeover and partial-slot sweeping. Include a deterministic barrier that kills the owner after slot mkdir but before lease publication, then run vm status and prove recovery, clone-before-slot teardown ordering where applicable, and subsequent slot usability. Include these tests in the task Verify selectors and F1 test citations.
   - triage: not triaged: the verifier has not returned

## Residuals

none
