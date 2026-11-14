# Review

- **Verdict**: REJECT
- **Reviewed digest**: 2f2ef032de6dabf44634a4f34f7b213cf433013ae7e136bf354f3c986e6b6f74
- **Depth**: risky
- **Reviewer**: plan-reviewer, PlanReviewA1, PlanReviewB1
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewA1 onara/cx/gpt-6.1-sol, PlanReviewB1 onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PlanReviewA1)

1. **DOMAIN 2 — D5 / task 3.1: runtime staging inventory**
   - defect: The specified staging source does not cover the built artifacts that the guest must execute. D5 copies the Git-selected source files, the driver and credentials, but specifies no additional artifact transfer. An ordinary ignored build output can therefore pass the host artifact check yet be absent in the guest, preventing the lane from starting its target. This is recoverable by correcting staging.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93-100 specifies the complete staging sequence; line 96 selects files with `git ls-files -z --cached --others --exclude-standard`, with no separate artifact step. tasks.md:26 explicitly expects both exclusion of ignored files and presence of the artifact. specs/app-qa-vm-lane/spec.md:85 requires copying the artifacts. The required `Runtime file | origin | tracked/untracked/ignored/generated | in identity? | mounted?` inventory is absent.
   - change: Define one staging inventory/manifest that explicitly includes source files, configured artifacts and their runtime contents, the deployed driver and credentials, with exclusions explained. Specify how ignored/generated artifact bytes reach their guest paths, and exercise a real ignored artifact rather than only an unignored fixture.
   - triage: not triaged: the verifier has not returned

2. **Correctness — D5 / task 3.1: failed refresh leaves stale QA available**
   - defect: A failed refresh exits before looking up or changing an existing ready lease. After a successful staging, a source change and a failed rebuild, subsequent routed commands still satisfy every D2 health condition and can test the previously staged artifact. This directly violates the negative control forbidding later testing of an older artifact after a failed build. The false QA result is reversible only by rebuilding and rerunning it.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93 exits on build failure; lease lookup happens afterwards at line 94. D2 at lines 39-43 checks lease existence, staged target, clone/forward liveness and SSH, but no failed-refresh invalidation. specs/app-qa-vm-lane/spec.md:95-97 explicitly says a later routed command testing an older artifact must fail the requirement.
   - change: Before rebuilding, atomically make any existing lease's affected targets unavailable without taking a new slot. Keep them unavailable on build or staging failure, and publish readiness only after successful reconciliation. Add a successful-stage → failed-refresh → routed-command control.
   - triage: not triaged: the verifier has not returned

3. **CHECK 4 — D2/D4: admission is not restricted atomically to ready leases**
   - defect: The routing predicate omits lease state, and busy registration is not defined as an atomic readiness check plus registration. During normal idle reclamation, a lease can be marked closing while its clone and forward remain alive; a routed command can then register and begin before the reclaimer deletes that clone. A similar window exists during refresh. This breaks the promise never to reclaim a running routed command and invalidates its QA run; rerunning is required.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:39-43 lists routing refusal conditions without `state !== ready`. Lines 80-82 separately describe busy registration and marking an idle lease closing before deletion outside the lock. tasks.md:32 repeats the routing conditions without a state check. specs/app-qa-vm-lane/spec.md:70 and 80-82 prohibit deletion during a routed command.
   - change: Define one fail-closed admission predicate covering missing/unreadable/partial records and starting/closing leases. Under the table lock, require ready state and register the busy holder in the same transaction; refresh, reclaim and down must change state under that same lock before releasing it. Add a control paused between marking closing and deleting the clone.
   - triage: not triaged: the verifier has not returned

4. **Correctness/security — D4 sweep can select the golden image**
   - defect: The sweep treats every `app-qa-slot-*` VM without a slot directory as disposable, while the configurable golden image name has no reserved-namespace restriction or explicit exclusion. A valid machine configuration naming its golden image `app-qa-slot-golden` causes `vm status` or `vm up` to select it for deletion. This destroys the image disk, is not merely a reversible QA failure, and contradicts the golden-image invariant.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:49-55 allows a configured image name; line 88 sweeps an `app-qa-slot-*` clone without a slot directory. tasks.md:21 repeats that selection. specs/app-qa-vm-lane/spec.md:130 and 136-138 prohibit changing the golden image.
   - change: Make destructive selection explicitly exclude the configured golden image and establish ownership of disposable clones rather than relying on a broad prefix alone. Refuse conflicting image/clone names before mutation, and add a control with a golden image whose name matches the sweep prefix.
   - triage: not triaged: the verifier has not returned

5. **CHECK 1 — D5/D7: credential holders and sinks are incomplete**
   - defect: The plan moves real credentials but provides no search-derived holder/sink inventory or end-to-end sentinel control. A concrete uncovered sink is the host temporary build-output file: D5 writes output there and only redacts the tail when printing it, without specifying redaction before storage, private permissions or disposal. Task 3.1 itself anticipates a build printing a configured credential. The new raw credential copy can therefore survive outside the leased clone; deleting that copy cannot undo any disclosure.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93 stores build output in a host temporary file and redacts only printed lines. tasks.md:26 plants a credential in build output but checks only printed redaction and argument vectors. D7 at design.md:134 covers routed stdout/stderr, not all new persistent sinks. Existing `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:323-326` only loads redaction values; flow log storage separately redacts before writing at lines 1215-1217.
   - change: Inventory the source credential file, host memory, build and SSH processes and their stdout/stderr, temporary files, guest credential file, target processes/logs, Maestro roots, returned files and paths. Name the inherited redaction/storage chokepoints and exclusions. Redact build output before retaining it, define permissions and cleanup on every exit, and plant sentinels across every producing path while scanning all retained artifacts.
   - triage: not triaged: the verifier has not returned

6. **CHECK 5 — D5 / tasks 2.1 and 3.1: checked build bytes are mutable before use**
   - defect: Artifact validation is followed by later copying from mutable worktree paths, with builds occurring before lease exclusion. The plan explicitly supports simultaneous `vm up` calls in one worktree. Two such calls with different build inputs, such as different `{port}` values, can both build into the same artifact path; one call can validate its output and then copy the other call's overwritten bytes. Its recorded forward/build context no longer describes the app being tested. The resulting QA is recoverable only by rebuilding and rerunning.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93-96 places build/check before slot acquisition and later copy. tasks.md:20 requires simultaneous starts in one worktree, but its exclusion occurs after those builds. D6 at design.md:112 also checks the desktop cfg on the host before later guest consumption. No pinned copy or change-between-check-and-use control is defined.
   - change: Serialize the relevant build/check/copy transaction per worktree, or pin the successful artifact and checked cfg into a run-owned immutable copy and stage that copy. Include all build inputs in that binding. Add a simultaneous-start control that changes the shared artifact between validation and transfer and requires rejection or use of the original verified bytes.
   - triage: not triaged: the verifier has not returned

7. **Correctness — D7 / task 4.2: flow paths break below the repository root**
   - defect: The design preserves the caller's subdirectory but passes FLOW relative to the worktree root. The unchanged guest driver resolves FLOW relative to its current working directory. A normal invocation from `app_kmp/` therefore resolves a root-relative flow under `app_kmp/` again and fails to find it, or can run a different same-named file. This breaks supported subdirectory invocation and is reversible after correcting translation.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:125-126 combines preserved relative working directory with worktree-relative FLOW. tasks.md:33 repeats both choices. `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:1115-1118` uses `resolve(flowArg)` and tests that path. For example, host cwd `<root>/app_kmp`, FLOW `maestro/signin.yaml`, becomes `<guest-root>/app_kmp/app_kmp/maestro/signin.yaml` after the specified root-relative translation.
   - change: Translate FLOW relative to the preserved guest working directory, or pass its absolute guest-copy path, and update the requirement's path exception accordingly. Cover a flow launched from a nested directory, not just a desktop command launched there.
   - triage: not triaged: the verifier has not returned

8. **Correctness — D5/D8: backend-free configurations cannot stage**
   - defect: The new schema permits a desktop VM target without a backend section, but D5 unconditionally falls back to `backendPort(ctx)` when `--port` is absent. That helper destructures `ctx.config.backend` without an optional-section guard. A valid backend-free desktop configuration therefore throws during ordinary `vm up desktop`, before staging. This is a recoverable failure of a supported configuration.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93 selects P using `--port`, otherwise `backendPort(ctx)`; D8 at lines 137-142 adds no backend prerequisite. The existing backend section is optional in `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:148-157`, while `backendPort` at lines 529-531 immediately destructures it. The existing backend-free desktop fixture is in qa.test.mjs:121-124.
   - change: Decide the backend-free contract explicitly: do not resolve or start a forward when no backend is configured, and define whether `{port}` is invalid in that case; alternatively introduce and document an appropriate validated prerequisite. Preserve backend-free desktop support and add that configuration to staging coverage.
   - triage: not triaged: the verifier has not returned

9. **Correctness — D4 / tasks 2.2–2.3: closing leases have no crash recovery**
   - defect: A crash after marking a lease closing leaves a state that neither idle reclaim nor sweep handles. This can occur during ordinary cancellation or failure of `vm down` or reclamation. Other worktrees can then lose a slot indefinitely, and the clone can retain credentials despite subsequent `vm status`/`vm up` sweeps. Capacity can be recovered manually, but any destroyed evidence or exposed credential cannot be recovered that way.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:82 marks a reclaimed lease closing before deletion outside the lock. Its sweep at lines 83-88 handles dead starting owners, ready leases with missing clones and clones without slots, but not dead closing owners. tasks.md:22 likewise marks closing before stopping/deleting the clone, with no interrupted-closing recovery.
   - change: Define ownership and recovery for closing state, including interruption before stop, between stop and delete, and after delete but before slot release. Make the common sweep resume compensating teardown for a dead closing owner without admitting new routed work or freeing a slot before deletion succeeds.
   - triage: not triaged: the verifier has not returned

10. **DOMAIN 3 — D2/D5/D7: dependency loss is checked only before a run**
   - defect: The lane depends on a detached SSH forward, guest reachability and the host backend, but specifies only pre-command liveness checks and forwarding the guest command's exit status. If the forward or backend disappears during a long sign-in flow, its assertion failure is returned as an ordinary QA failure rather than a distinct infrastructure failure; a cached/local assertion could also finish without establishing dependency health. This misattributes the run's outcome and requires rerunning it.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:42 checks the forward pid before routing; line 99 starts the detached forward; line 134 returns the guest exit code. tasks.md:32 tests a forward that is already dead, not loss during execution. The required `Dependency | lifetime | holder | check before | check after | phase on loss` inventory and mid-run-loss control are absent.
   - change: Specify holders and lifetimes for the clone, SSH connection/forward, backend and guest console session. Check relevant dependencies before and after execution, distinguish infrastructure loss from an app/model outcome, and add a control removing the forward or backend during a real routed run.
   - triage: not triaged: the verifier has not returned

11. **Build vs. adopt — D6 and the file-transfer adoption record**
   - defect: The plan introduces parsing of the distributable's launcher cfg format without a Build vs. adopt subsection for that mechanism. In addition, the file-transfer subsection's Repository entry says only that the driver currently opens no channel; it does not record repository/dependency search paths as the mandated form requires. These omissions break the required adoption value proof before implementation.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:112 and tasks.md:27 introduce reading `Contents/app/*.cfg` for classpath, main class and Java options. The only adoption subsections are design.md:166-184, none covering that format parser. Its file-transfer Repository entry at line 175 gives neither a PATH:LINE provider nor `none` plus paths searched. `openspec/schemas/omp-gated/schema.yaml:204-219` requires a subsection per covered mechanism and specifies those fields.
   - change: Add the repository → platform → maintained-library record for interpreting the launcher cfg format, with a decided adoption/build outcome and any required gap. Complete the file-transfer Repository entry with the actual searches and account for safe archive interpretation/extraction in the adopted mechanism.
   - triage: not triaged: the verifier has not returned

12. **DOMAIN 1 — D5/D6/D9 and tasks 3–6: environment contract is missing**
   - defect: The plan schedules host builds, guest provisioning, guest target startup and remote verification but supplies no phase environment contract. Network access and runtime/platform requirements are left implicit across those phases, although they determine whether the selected build, provisioning and QA commands can run. The existing locked-host rows distinguish host from guest for one case, but do not supply the required phase inventory.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:93-114 assigns commands to host and guest; lines 145-157 introduce image/tool provisioning. tasks.md:26-42 and 6.1 schedule those commands. No `Phase | Network | Runtime/Platform | Commands | Need met?` table or equivalent complete inventory appears in the plan.
   - change: Add the required phase table for host build, image provisioning, staging/startup and routed verification. Place each guard in the environment it protects and identify target-environment controls that cannot pass through a host-only execution.
   - triage: not triaged: the verifier has not returned

13. **DOMAIN 6 — D4/D5/D6: reused launch identity has no reset contract**
   - defect: This change introduces reusable slot names and both fresh launch and in-place refresh, but does not answer whether a fresh launch under a used name can observe old files or state, or provide the required deleted/kept matrix and reuse control. The source tree, simulator, desktop process, guest driver sessions, temporary roots and recorded process identities have different reset lifetimes; they are not inventoried as one launch contract.
   - evidence: openspec/changes/app-qa-vm-lane/design.md:72 reuses `app-qa-slot-N`; line 79 refreshes an existing lease; lines 96 and 105-114 reset selected guest state. The existing guest driver independently retains desktop session records at `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:674-684,746-749`. No `Entry | may reuse an existing name? | deleted | kept` matrix or finished-run/name-reuse control is provided.
   - change: Answer the fresh-launch reuse question explicitly. Define the fresh, refresh, reclaim, interrupted-start, teardown and sweep paths and enumerate their retained/deleted state. Distinguish deliberate refresh/resume from a fresh lease, and prove that a completed prior lease's outputs, sessions and authentication state cannot be mistaken for the new lease's result.
   - triage: not triaged: the verifier has not returned

### Scope B (PlanReviewB1)

14. **Verification — failed refresh of an existing lease (3.1, F1)**
   - defect: The failure controls cover initial staging, not a failed refresh followed by routed QA. After a successful vm up, a source change and failed rebuild could leave the old app usable; every listed test could pass while subsequent QA tests the old artifact. This breaks the explicit stale-artifact negative control. The false QA result is reversible by rebuilding and rerunning, but invalidates the value proof.
   - evidence: openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:95-97 explicitly forbids “a later routed command testing an older artifact” after a failed build. tasks.md:26 tests failed builds with “no slot directory”; tasks.md:84 similarly requires “no slot taken.” Neither attempts a routed command after failure on an already-ready lease. The successful refresh at tasks.md:83 does not exercise that transition.
   - change: Add tests and an F1 control that first stage a working lease, then fail its refresh through both nonzero build and missing artifact, then attempt routed QA. Assert that the old app cannot produce a successful QA result; retain the refusal and lease-state observations.
   - triage: not triaged: the verifier has not returned

15. **Verification — refresh while a routed command is busy (2.2, F1)**
   - defect: The plan requires same-worktree vm up refresh to refuse while QA is running, but tests only third-worktree reclaim, sweep and vm down. An implementation that guards those paths but allows refresh to replace the guest files, simulator or forward during a flow would pass the listed verification. Overlapping refresh and QA is a realistic concurrent-use case; the disrupted run is recoverable but violates the lease's material safety contract.
   - evidence: openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:70 explicitly requires both “vm up refresh and vm down” to exit 2 while a routed command runs. tasks.md:21 lists busy reclaim and down-busy tests, but no busy refresh. F1 reclaim-nc at tasks.md:81 invokes a third worktree's vm up and the busy lease's vm down, not that lease's vm up.
   - change: Hold a routed flow open and invoke vm up in the same worktree. Assert exit 2 naming the busy pid, no staging/target/forward mutation, and successful completion of the original flow. Include this control in the selected lease tests and F1 evidence.
   - triage: not triaged: the verifier has not returned

16. **Verification — fresh-agent rebuild behaviour (5.2, F1)**
   - defect: Neither fresh-session task changes code, so the sessions cannot establish that the delivered skill makes an agent refresh its VM after an edit. A skill that teaches initial vm up and teardown but omits post-edit refresh can pass both sessions and every listed grep. Normal edit-then-QA work could therefore test stale guest code while this requirement is reported as proven; the damage is reversible through a proper refresh and rerun.
   - evidence: openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:152 requires rerunning vm up after every code change, and :159 expressly names testing after an edit without vm up as a negative control. tasks.md:105 asks only for sign-in; :106 repeats that task with occupied slots. The Verify command at tasks.md:40 checks marker strings but not the post-edit instruction.
   - change: Add deterministic coverage of the refresh instruction and a fresh real-session task requiring a small visible app change followed by QA. Retain the edit, subsequent vm up, routed QA showing the changed behaviour, and teardown. Judge those actual interactions directly; no model-behaviour re-scoring tool is necessary.
   - triage: not triaged: the verifier has not returned

17. **Verification — successful desktop preflight on a locked host (5.1, F1)**
   - defect: F1 never explicitly runs a successful routed desktop preflight while the host is locked. Its desktop positive run begins with attach; its routed desktop preflight appears only in the permission-denied control. A regression that makes desktop preflight fail on the host lock could survive all listed positive observations, leaving part of the central locked-host requirement unproven. This is a recoverable verification gap, but it breaks the stated criterion.
   - evidence: openspec/changes/app-qa-vm-lane/specs/app-qa-vm-lane/spec.md:141 requires routed desktop preflight, attach, tap, wait and capture to pass while locked. tasks.md:88 starts target-desktop with attach, and :100 reuses that sign-in for locked-desktop. tasks.md:101 expects desktop preflight to fail. The successful routed preflight at tasks.md:67 is iOS.
   - change: Add routed preflight desktop to locked-desktop before attach, with exit 0 and the guest's passing screen-lock/capture checks retained alongside the before/after host-lock observations. Keep the existing permission-denied and host-only negative controls.
   - triage: not triaged: the verifier has not returned

18. **Final verification — deployment precedes final integration (5.3, 6.1)**
   - defect: The only explicit deploy-and-compare step occurs before F1's conditional merge of main. When that merge changes the driver, scripts or skill, F1 can exercise the previously deployed revision while claiming evidence for the final head. This realistically occurs when main advances during implementation. The evidence can be repaired by redeploying and rerunning affected rows, but the current task sequence does not establish the claimed final-tree proof.
   - evidence: openspec/changes/app-qa-vm-lane/tasks.md:41 deploys the then-current HEAD and compares its files with ~/.omp/agent. tasks.md:108 subsequently permits a new merge commit before F1. The real runs use the deployed driver, including the explicit ~/.omp/agent path in :108. scripts/deploy-local.sh:44 resolves the supplied commit, and :95-97 installs configuration from its dedicated deployment worktree; later branch changes do not update that deployment automatically.
   - change: Perform final integration before task 5.3, or require redeploying and repeating its comparisons after any relevant integration change and before F1. Record the deployed revision and comparisons with the final-head evidence.
   - triage: not triaged: the verifier has not returned

19. **Executability — incompatible unchanged configuration test (1.1)**
   - defect: Task 1.1 cannot both accept app-qa/2 and keep all existing config tests unchanged and passing. The existing newer-schema test deliberately rejects a valid minimal app-qa/2 configuration. A correct implementation therefore fails the mandated Verify command. This is reversible by migrating the obsolete test rather than preserving its old unsupported-schema input.
   - evidence: openspec/changes/app-qa-vm-lane/tasks.md:15 says configErrors accepts app-qa/1 and app-qa/2 and that “the existing config: tests stay unchanged and pass.” team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:527-538 constructs the minimal configuration with schema app-qa/2 and asserts exit 2, no output checks and no tool calls.
   - change: Explicitly migrate that existing newer-schema test to app-qa/3 and assert that both supported ids are reported. Preserve the remaining app-qa/1 regression tests, and add successful app-qa/2 cases.
   - triage: not triaged: the verifier has not returned

## Residuals

none
