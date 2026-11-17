## 1. Architecture and cross-module seams

The architecture holds up overall. Reusing the same driver inside the guest avoids maintaining separate implementations of device selection, sign-in, redaction and flow-result handling. The main seams are explicit:

- **Repository configuration → host staging:** schema validation defines the build, artifact paths and desktop properties.
- **Lease table → external processes:** `starting`/`ready`/`closing` and busy markers serialize admission; clone deletion completes outside the table lock.
- **Provisioning → guest startup:** the image supplies Node, JDK 21, the console session, SSH policy and capture permissions expected by `start-target.mjs`.
- **Guest execution → host evidence:** arguments are quoted, output is withheld until dependency checks finish, and files pass through guest sanitization and host archive validation.
- **Skill → agent behavior:** rebuilding after edits, avoiding login captures and ending with `vm down` remain workflow obligations rather than automatically enforced properties.

The most important distinction is preserved: **transport authentication establishes which image answered; lease admission establishes which worktree may use it.** Neither substitutes for the other.

No substantiated blocker found.

## 2. Inconsistency, duplication and simplification

**Note N1 — Host-key provisioning produces malformed extra input.**  
`team-config/agent/skills/app-qa-drivers/vm-image.md:49` transforms every `ssh-keyscan` stdout line with `awk`, including the banner observed in wave 9. Filter comments and require the expected key fields before writing the pin file. **Non-blocking:** the supplied observation establishes that SSH skipped the malformed line and authenticated using the valid pinned key.

**Note N2 — Interrupted host-build ownership is weaker than clone ownership.**  
`qa.mjs:1431-1451` starts build children without recording their lifetime in the lease; `runBuilds` uses that helper at `qa.mjs:1991-2003`. Recovery at `qa.mjs:1755-1798` detects the dead driver, while teardown specifically reconciles surviving **lume mutations**, not host builds. Thus the code does not establish that a cancelled driver’s build has stopped before a replacement start is admitted. Consider extending process-lifetime ownership consistently rather than adding another independent cleanup convention. **Non-blocking:** surviving build work is a supported concern from the code, but an artifact-integrity failure also depends on the build tool’s cancellation, locking and write behavior; that consequence was not established here.

**Note N3 — The broader test timeout does not address the reported inner timeout.**  
`package.json:85` raises Bun’s timeout globally, while the supplied failures occurred at the interruption tests’ own 10-second marker wait. Prefer a narrowly scoped deadline for those tests if load tolerance is required. **Non-blocking:** the brief reports complete quiet-host passes; this is verification reliability and diagnostic precision, not an established runtime defect.

The configuration helpers and shared launcher reader are sensible reuse. Extracting more abstractions merely to shorten `qa.mjs` would not clearly improve maintainability; preserving clear state-transition and transfer boundaries matters more.

## 3. Highest-consequence failure

The worst failure is **sending a real dev credential to the wrong endpoint or returning credential-bearing evidence to the host**.

The implementation materially addresses that risk:

- Every lane SSH consumer uses the same strict host-key pin.
- Credentials travel through stdin, not command arguments.
- Clone deletion precedes slot reuse.
- Output is redacted before being retained.
- Returned content is sanitized inside the guest before the host archive is written.
- Absolute paths, parent traversal and non-file/non-directory archive members are rejected before extraction.

The supplied impostor-key control is especially valuable: it exercises refusal before copying rather than merely checking SSH option strings.

Remaining limits are accurately consequential: pixel sanitization is not provided, image preparation is a trusted manual operation, and abandoned ready leases retain credentials until teardown or reclaim. Those are documented workflow/security residuals, not newly discovered blockers.

**Note N4 — Foreign-VM exhaustion fails safely but opaquely.**  
`qa.mjs:2242-2259` reports an SSH-start timeout when the observed competing VM prevents the additional guest from becoming reachable. A preflight capacity diagnostic would make this much easier to distinguish from networking or image problems. **Non-blocking:** the reported run copied nothing and returned failure; the disruption is local and recoverable.

## 4. What line-level review misses

- **The trust boundary is assembled across files.** Correct SSH flags alone do not prove safe provisioning, and correct sanitization alone does not make a login screenshot safe. The image instructions, driver and agent instructions must remain aligned.
- **A host PID is not the lifetime of its work.** The fixes for orphaned routed commands and lume mutations recognize this; host builds remain the adjacent seam identified in N2.
- **Parallel capacity is machine-wide, not lane-wide.** Two available slot records do not prove that two macOS guests can actually boot when other sessions use the host.
- **Evidence summaries need careful interpretation.** S18’s live summary establishes successful parallel startup, not explicitly the stopped-listing/DHCP branch; that branch’s direct support is the named automated test. S31 describes creation of a clone, so it should not independently be presented as proof of same-clone refresh; the refresh test supplies that coverage. These are evidence-labeling cautions, not grounds to discard the supplied successful runs.
- **The parallel-flow result is qualified.** Wave 9’s successful concurrent sign-in used a scratch flow with a corrected alert/form wait. That supports lane concurrency, but does not establish reliability of onara’s unchanged sign-in flow under load.

Reviewed the supplied whole diff, plan and QA matrix, plus targeted repository source for credential handling, return validation and process recovery. No commands, network access, file modifications or independent test runs were performed.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3,4
model_id: onara/cx/gpt-6.1-sol
security_delta: yes
verdict: PASS
blockers: none
adversarial_criteria:
- invariant: Successful endpoint authentication must precede delivery of any repository or credential bytes, regardless of the discovered address.
  positive_witness: A clone presenting the pinned image key receives staging input and becomes usable.
  negative_control: A different SSH server answers at the discovered address and receives staging input despite presenting another key.
  observable: Strict authentication succeeds for the image key; the impostor attempt exits 2 before copying and leaves no staged target or guest credentials file.
  boundary: Shared SSH connection options and the staging admission boundary.
- invariant: Reusing a slot name must not allow execution left by its previous owner to mutate the replacement guest.
  positive_witness: Recovery ends surviving clone mutations and deletes the old clone before replacement staging.
  negative_control: A delayed mutation from a dead driver creates or deletes the replacement owner's clone.
  observable: Process termination and clone absence precede slot reuse; the replacement lease remains intact.
  boundary: Lease recovery and external-process teardown.
- invariant: A guest success message must not become an authoritative app result when the execution infrastructure was lost.
  positive_witness: An intact run returns its guest result after dependency checks.
  negative_control: A guest emits success while its forward or connection is lost and the host publishes that success as an ordinary result.
  observable: Infrastructure loss produces exit 2 and prefixes retained guest outcome lines as non-app results.
  boundary: Host result publication after routed execution.
END-REVIEW-TRAILER