# Review

- **Verdict**: REJECT
- **Reviewed digest**: f325724e61df7369a85a63591c1628d1f3d4783a3572bd9f28b23ab527948628
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanReviewDelta3b
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewDelta3 onara/cx/gpt-6.1-sol (no verdict), PlanReviewDelta3b onara/cx/gpt-6.1-sol
- **Round**: 3
- **Awaiting**: triage
- **Override**: none

## Blockers

### Delta (PlanReviewDelta3b)

1. **CHECK 1 — D7 return sanitization / task 4.3**
   - defect: The new return boundary still leaks credential-bearing filenames for captures and other non-flow output. For example, a capture named after a configured alphanumeric username produces USER.json. scanPaths flags that filename, but neutralize only rewrites its contents; the credential remains in the filename and then in the host archive's headers and extracted paths. This violates credential confinement during ordinary supported capture naming. Local files are removable, but disclosure through retained evidence is not reversible.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:197 and tasks.md:34 prescribe only scanPaths plus neutralize for non-flow files. team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:392-396 detects path hits, whereas :400-406 changes text contents or deletes a binary file without renaming a text file. desktopCapture at :753-770 accepts alphanumeric names and writes NAME.json. The separate path-deletion pass in sweepRoot at :972-976 is not included in the prescribed non-flow boundary.
   - change: Apply credential-bearing path removal or safe renaming to every returned tree before tar serialization, not only flow roots. Include directory names and archive member names. Add a capture-name control using a configured synthetic username and verify that neither the host archive nor any extracted or final path contains it, including interruption checkpoints.
   - triage: not triaged: the verifier has not returned

2. **Security and privacy — F1 out-nc**
   - defect: The added real-surface negative control deliberately captures a sign-in screen containing a real configured username. Its JSON may be redacted, but the PNG still visibly contains the username: the proposed sanitizer searches encoded file bytes, not rendered pixels. A clean byte scan therefore cannot establish that this evidence is safe. This introduces unsafe verification and can return credential-bearing visual evidence to the host; deleting local copies cannot undo subsequent disclosure.
   - evidence: openspec/changes/app-qa-vm-lane/tasks.md:95 requires a capture of the sign-in screen with account 1's username in its field, followed by a clean scan. design.md:197 applies scanPaths and neutralize to captures. team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:353-363 searches raw bytes, while :765-770 copies both the capture JSON and PNG. The loaded ui-automation-credentials rule forbids login-surface hierarchy capture; desktop capture also obtains the captureJson tree.
   - change: Replace this real-account login capture with a credential-free synthetic fixture or guest-output fixture that exercises the same capture return boundary. Keep real-account visual QA after successful sign-in. State explicitly that byte scanning is not visual redaction and that credential-bearing login captures must not be returned or retained.
   - triage: not triaged: the verifier has not returned

3. **DOMAIN 3 — D7 outcome publication / task 4.1**
   - defect: The new no-PASS controls contradict the retained line-by-line relay design. When the forward dies during a backend-independent portion of a routed flow, the guest can still print PASS. D7 relays that line immediately and only afterward checks dependencies and changes the exit code. The later infrastructure line cannot retract the published PASS. This breaks task 4.1's negative control and the stated promise not to report a pass over a lost dependency. A rerun recovers execution, but not the already published outcome.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:196 requires line-by-line stdout/stderr relay; :48 and :202-208 place dependency classification after the guest command. tasks.md:32 requires the passing fake guest plus mid-run dependency loss to produce no PASS, and :70 repeats that requirement for F1. The unchanged guest emits PASS before returning at team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:1269-1270.
   - change: Define an outcome-publication boundary: retain or explicitly classify terminal guest outcome lines until dependency checks finish, and publish an application outcome only when those checks succeed. Keep ordinary progress output streaming. Make the specification, design and no-PASS controls agree on that behavior.
   - triage: not triaged: the verifier has not returned

4. **DOMAIN 3 — Forward readiness / D5 step 7**
   - defect: The fix still does not establish forwarding readiness before marking the lease ready, as the recorded fix entry requires. The revised dependency table checks only whether the forward process exists. An alive but not-yet-established forwarding process can therefore satisfy both checks while a backend-independent routed action succeeds, despite the lease not having established its promised connection. This compromises readiness and QA provenance; restarting the lease is reversible but does not validate the earlier result.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:131-133 starts the forward, records its PID and proceeds to ready without an establishment check. The new table at :204 defines both checks solely as PID liveness. tasks.md:28 likewise tests only that one process remains alive. Scope A fix entry 3 explicitly requires: 'Establish forwarding readiness before ready'.
   - change: Name and implement an observable forwarding-establishment check before publishing ready, with failure classified as infrastructure failure. Add a selected test whose forward process stays alive while establishment is withheld or refused; vm up must not publish a routable lease merely because that PID exists.
   - triage: not triaged: the verifier has not returned

5. **PROCESS 4 — Scope B entry 7 / task 3.1**
   - defect: The added memory-only test still misses short-lived output files created during completion or cleanup. Its observations occur while the fake build is paused and after cleanup. A driver that keeps output in memory during execution, writes a temporary output spool when the build closes, and deletes it before returning passes every stated observation while violating the no-disk requirement and potentially persisting credentials. The added mutation only proves detection of a spool that remains present at a sampling point. Local removal is reversible, but earlier credential disclosure is not.
   - evidence: openspec/changes/app-qa-vm-lane/tasks.md:26 specifies scans 'while it pauses' and 'after a successful and after a failing build's cleanup', and a variant that spools output and deletes it at the end. It specifies no observation of intervening writes. specs/app-qa-vm-lane/spec.md:137 prohibits any build-output disk write. Scope B entry 7 specifically requires observing writes through success/failure cleanup, including short-lived files.
   - change: Record output-file writes throughout the command and cleanup, using an appropriate write-recording seam rather than only filesystem snapshots. Exercise a variant that writes and deletes the marker/password spool entirely between the existing observation points, and demonstrate that the committed test fails against it. Retain the paused and final scans as additional checks.
   - triage: not triaged: the verifier has not returned

6. **PROCESS 4 — Scope B entry 8 / task 2.2**
   - defect: The publication-recovery addition substitutes a constructed state containing a clone for the requested interrupted-publication control. On a fresh start, death between slot mkdir and lease publication occurs before building or cloning, so the relevant state has no clone. An implementation that recovers a partial slot only when its clone is listed can pass the specified new test while leaving an actual interrupted fresh allocation stranded. Recovery is manually possible, but that breaks the next-sweep guarantee.
   - evidence: openspec/changes/app-qa-vm-lane/tasks.md:21 defines the publication fixture as an empty slot, a dead-PID table lock, and app-qa-slot-1 already listed. It does not add the requested deterministic kill barrier. design.md:68 and :79 publish the lease during allocation; :120-123 place build and clone afterward. specs/app-qa-vm-lane/spec.md:99-100 requires recovery of partial slots, not only partial slots with a clone. tasks.md:82 still performs its real kill only after the clone appears.
   - change: Add a deterministic test barrier after slot mkdir and before lease publication, kill the actual owner there, and run vm status. Prove stale-lock takeover, removal of the partial slot when no clone exists, and subsequent slot usability. Keep the constructed clone-present case for clone-before-slot teardown ordering, and select/cite both controls in Verify and F1.
   - triage: not triaged: the verifier has not returned

## Residuals

none
