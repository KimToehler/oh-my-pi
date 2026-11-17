## 1. Goal and behavioural contract

Reviewed the complete supplied diff, plan, C1–C18 criteria and QA matrix against the worktree’s driver and adjacent configuration, redaction, flow, deployment and credential rules.

The default path implements the intended separation: repository and machine configuration activate the lane; routed commands require the current worktree’s staged lease; Android, `scan` and explicit `--host` remain local. Lease admission and state transitions share the table lock, while slow staging and teardown run outside it.

No blocking deviation was substantiated. The accepted residuals—persistent unused leases, reduced guest security and build-tool freshness authority—were treated as accepted, not rediscovered as blockers.

## 2. Correctness, regressions, architecture, wire contracts

The cross-module seams are consistent on the ordinary path:

- All requested builds finish before snapshotting or guest replacement (`scripts/qa.mjs:1992`, `:2217–2261`).
- Host snapshot validation and guest startup use the same launcher parser.
- Remote arguments are quoted individually; guest execution preserves the worktree-relative working directory.
- Flow roots are lease-private without moving the guest’s shared flow lock.
- Guest output remains buffered until dependency checks finish. File return sanitizes before transfer, rejects unsafe archive entries, then sanitizes again.
- Dead busy registrations preserve the orphan indication before removal, allowing subsequent recreation rather than an unsafe refresh.

**Note N1 — configuration-override seam.** `qa.mjs:2712` loads `--config`, and `cmdVm` passes that context into `vmUp` without rejecting the override (`:2361–2383`). Staging copies the repository’s files (`:2093–2104`), but guest startup reads the fixed `.omp/app-qa.json` (`scripts/vm/start-target.mjs:215`) and takes desktop properties from it (`:190`). Thus `vm up --config OTHER` can build using one configuration and launch using another. Prefer rejecting the override for staging, consistent with routed invocation, or explicitly defining how it becomes the guest configuration. **Non-blocking:** this is an alternative lane configuration invocation, not the documented default workflow; the substantiated consequence is local, reversible misconfiguration/start failure.

**Note N2 — capacity diagnostic.** The supplied third-VM observation reaches the generic SSH timeout at `qa.mjs:2257`. A host already running another macOS guest therefore gets little help distinguishing capacity exhaustion from guest boot/network failure. **Non-blocking:** this fails closed; the reported observation copied no credentials and produced no app result. A capacity hint would improve recovery.

## 3. Security and privacy delta

**Security delta: yes.** The change transports real dev-account credentials across a VM boundary and authenticates the recipient.

I checked every `sshBin()` consumer in `qa.mjs`: reachability, upload, forward creation/probe, target startup through `sshRun`, routed execution, return packing and post-run probing all use `sshBase`. The reviewed code consistently supplies strict host-key checking, the dedicated known-hosts file, image-name alias and keepalives.

Credential upload uses stdin rather than argument values, and guest creation uses `umask 077`. Returned content goes through the guest’s credential sweep before archive bytes reach the host. The documentation correctly distinguishes byte sanitization from removing credentials rendered in screenshot pixels.

**Note N3 — host-key pin instructions.** `vm-image.md:45` applies `awk` to every stdout line from `ssh-keyscan`. The supplied live observation establishes that a banner becomes a malformed additional known-hosts entry. Filter comment lines, for example with `!/^#/`. **Non-blocking:** the observation confirms one valid key was pinned and SSH skipped the malformed line; this does not weaken strict authentication.

No additional security blocker meeting the changed-exposure threshold was substantiated.

## 4. Verification adequacy

The added tests exercise meaningful executable boundaries: shell-interpreted fake SSH, real archive operations, concurrent driver processes, interrupted state publication, orphaned execution, predecessor shutdown, credential-bearing synthetic output and transport authentication—not merely generated command prose.

The supplied matrix reports final quiet-host results of **226/226 driver tests** and **991/991 team-config tests**, alongside real locked-host iOS/desktop runs, negative controls, concurrent leases and fresh-agent sessions. It also discloses the modified parallel sign-in fixture and discarded capacity-contended attempts rather than silently counting them.

**Note N4 — load-sensitive test synchronization.** `qa.test.mjs:556` retains a 10-second `waitFor` default. The supplied runs show both interrupted-return cases timing out under load, then passing independently and in the quiet full runs. **Non-blocking:** this is disclosed test instability, not evidence of a production return-sanitization failure. Increasing the suite-wide timeout does not itself address the shorter internal wait.

Independent adversarial criterion:

- **Invariant:** A successful first build followed by a failing second requested build must not partially replace the existing guest copy.
- **Positive witness:** Both successful builds precede guest replacement; a second-build failure leaves the previous guest files untouched and publishes no staged target.
- **Negative control:** The first target is uploaded or guest state is reset before the second build fails.
- **Observable:** Build ordering, SSH call log, guest marker file and final lease targets.
- **Boundary:** Host multi-target staging orchestration.

The current ordering satisfies this by inspection; a focused multi-target failure test would strengthen coverage.

I ran no commands or tests and did not open existing QA evidence artifacts. Runtime results above are attributed to the supplied matrix, not represented as independently reproduced.

## 5. Final verdict

No blockers. The remaining findings are the non-blocking notes above.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: A successful first build followed by a failing second requested build must not partially replace the existing guest copy.
  positive_witness: Both successful builds precede guest replacement; a second-build failure leaves previous guest files untouched and publishes no staged target.
  negative_control: The first target is uploaded or guest state is reset before the second build fails.
  observable: Build ordering, SSH call log, guest marker file and final lease targets.
  boundary: Host multi-target staging orchestration.
END-REVIEW-TRAILER