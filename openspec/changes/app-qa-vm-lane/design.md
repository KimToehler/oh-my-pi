# Design

## Context

See proposal.md - Why. The facts this design builds on come from the feasibility test of 2026-11-14 on an M5 Pro host (macOS 27.2.1, 48 GB) with lume 0.7.2 and a macOS 27.2.1 guest (8 CPU, 16 GB, 160 GB):

- The guest's own console session (autologin, no sleep, no screen lock) is unaffected by the host lock. Maestro, the simulator and Spectre work there.
- Gaps the PoC had to work around, each one now owned by a mechanism below:
  - GUI processes must start in the guest console session (`launchctl asuser`). A JVM started from SSH is headless.
  - The Compose distributable's jlinked runtime lacks `java.instrument`, which Spectre's agent needs.
  - TCC attributes a capture started over SSH to `sshd-keygen-wrapper`, so Screen Recording must be granted to it and to Spectre's helper. That needs SIP off, and lume 0.7.2's `sip off` fails on a non-English Recovery.
  - The shared folder (virtiofs) breaks Xcode's framework symlinks.
  - The first web view after a boot needs about 40 s.
  - Maestro's iOS driver needed `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` once.
  - A copied Xcode needed one reboot before Gatekeeper let `xcodebuild` run.
- The driver today: config loading and strict validation `qa.mjs:144-243`, the host-wide flow lock by atomic `mkdir` `qa.mjs:898-940`, redaction values `qa.mjs:323`, backend port resolution `qa.mjs:528`, credentials path `qa.mjs:303`, dispatch `qa.mjs:1290-1322`. Tests run fake tools from a test PATH (`qa.test.mjs:1-5`).
- Apple allows at most two macOS guests at a time per host.

## Goals / Non-Goals

**Goals:**
- The unchanged guest driver does the QA work. The host driver only leases, stages, routes and returns output.
- The commands, flags, exit codes and evidence rules stay as they are for the caller. The lane adds `vm up|down|status` and `--host` only.
- Fail closed: an active lane never silently tests on the host, never tests a stale artifact and never leaves credentials outside a leased clone.

**Non-Goals:**
- Android in the VM (no nested virtualisation for macOS guests), Linux runners, CI.
- Running omp sessions or omp's `computer` prelude inside the guest.
- Automating the SIP Recovery step. It stays one documented manual step per image, because it depends on Recovery screen geometry.
- onara's and weaver's own configuration and QA skill text (separate changes in those repositories).

## Decisions

### D1. Route commands to the unchanged guest driver over SSH
`preflight`, `desktop` and `flow` for `ios`/`desktop` run as `node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs <same args>` in the guest copy of the worktree, over SSH with the lane key. The guest has no lane file, so the guest driver runs locally there: no recursion, no second code path for checks, sweeps or the scan.
Alternatives: run the whole agent session in the guest (needs omp, model credentials and team config in the guest, and the session no longer edits the host worktree); host-side remote primitives (reimplements Spectre and Maestro handling). Both rejected.

### D2. Activation and fail-closed routing
The lane is active when the machine lane file exists and the repository configuration has `vm` (schema `app-qa/2`). The user decided on 2026-11-14: VM by default wherever set up. Without a lease, or with a lease that did not stage the target, a routed command exits 2 naming `vm up TARGET`. `--host` is the explicit escape. Android and `scan` stay on the host.
Alternative: route only when the host screen is locked. Rejected by the user: the lock can start mid-run, and simulator windows on the host disturb the user.

### D3. Machine lane file
`~/.omp/agent/app-qa-vm.json`, schema `app-qa-vm/1`, validated with the same strict `section()` helpers as the repository configuration. Fields:
- `image` (golden VM name)
- `user`
- `sshKey` (absolute path)
- `slots` (1 or 2)
- `idleMinutes`
- `ios.deviceType` (simulator device type name)
It is user-owned: `scripts/install-team-config.ts` removes only files it installed (ownership manifest, `install-team-config.ts:521-592`), so a deploy never deletes it.

### D4. Slots and leases
- **Slot directories:** `${TMPDIR}/app-qa/vm/slot-N` for N up to `slots`, taken with one atomic `mkdir` in the pattern of `acquireLock` (`qa.mjs:898`).
- **Lease record:** `lease.json` holds the worktree's real path, the clone name `app-qa-slot-N`, the staged targets, the forward's pid and port, and `lastUsed`. A lease is looked up by scanning the slots for the worktree's real path.
- **Busy markers:** each routed command creates `busy/<pid>` for its own run and removes it after the run. `lastUsed` is set at the start and at the end of each command.
- **Reclaim:** with no free slot, `vm up` reclaims the lease idle longest beyond `idleMinutes`, and only one with no live busy pid.
- **Sweep:** `vm up` and `vm status` delete every `app-qa-slot-*` clone listed by `lume ls --format json` that no lease holds, and remove every lease whose clone is gone.
- **Third worktree:** with every slot busy or recently used, `vm up` refuses like the flow lock does: exit 2 with each holder's worktree and last use. It does not queue, because a waiting process would hold an agent turn for minutes without output.

### D5. Staging
1. Validate the requested targets' artifacts before taking a slot. An artifact's build time is the newest mtime inside its bundle. The worktree's change time is the newest mtime of `git ls-files -z --cached --others --exclude-standard`. The artifact must be at least as new.
2. Take a slot, `lume clone IMAGE app-qa-slot-N`, then `lume run --detach --display none --vnc disabled`, and wait for SSH. The guest is NAT-only (192.168.64.x), reachable from this host only.
3. Copy the same file list as a tar stream over SSH into `~/work/<config name>`, run `git init` there and commit, so the guest copy is its own main checkout. The guest driver's worktree matching and credentials path then work unchanged.
4. Stream the deployed driver directory to the same path in the guest.
5. Stream the credentials file through SSH stdin into `~/work/<name>/<credentials.file>`, with umask 077. Its bytes never appear in arguments or output.
6. Start `ssh -N -R P:127.0.0.1:P` with `ExitOnForwardFailure=yes` for the backend port P (`--port`, else `backendPort(ctx)` `qa.mjs:528`) and record its pid.
7. Start the targets (D6).

A rerun on a live lease repeats steps 1 and 3 to 7 on the same clone. Before step 3 it deletes the old guest copy.

### D6. Target start in the guest
- **ios:** create one simulator of `ios.deviceType` on the guest's only iOS runtime, boot it, install the artifact, open the backend health URL once in the simulator to warm WebKit, then terminate Safari. Routed flow runs get `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000`.
- **desktop:**
  1. Read the distributable's `Contents/app/*.cfg` for `app.classpath`, `app.mainclass` and `java-options`.
  2. Run them on the guest's JDK 21 (`/usr/libexec/java_home -v 21`) with `-Djava.awt.headless=false` and the configured `systemProperties`, replacing `{credentials}` with the guest credentials path.
  3. Start it with `sudo launchctl asuser <uid> sudo -u <user>` in the console session, with the guest copy as working directory.
  4. Kill the previous instance by its recorded pid before a restart.

  The guest user has passwordless sudo from provisioning, so no password reaches the driver.

### D7. Output return
- **Output:** the guest command's stdout and stderr are relayed line by line through the host's redaction values (`loadRedaction`, `qa.mjs:323`). The guest driver already redacts; the host pass also covers anything the guest copy of the configuration lacks. The exit code is the guest's.
- **`--out`:** the host-side refusals (existing flow `--out`, existing capture files) run before the guest command. The guest writes to a lease-private folder. On exit the host copies the files back with a tar stream that rejects absolute paths, `..` and links, and rewrites printed guest paths to host paths.
- **Kept roots:** guest flow runs use a lease-private `TMPDIR`. A kept root is copied to a new `mkdtemp` (0700) host root, and its printed path is rewritten.

### D8. Schema `app-qa/2`
`app-qa/1` plus `vm`: `{ ios?: { artifact }, desktop?: { artifact, systemProperties? } }`, with at least one target and artifacts as repository-relative paths (`relPath`). `configErrors` accepts both ids, and `vm` under `app-qa/1` is an unknown key.

### D9. Image contract and provisioning
`team-config/agent/skills/app-qa-drivers/vm-image.md` documents the host steps:
1. `lume create --ipsw latest --unattended tahoe`.
2. Xcode streamed in with `tar` over SSH, not through virtiofs.
3. The iOS runtime added with `xcrun simctl runtime add`.
4. One reboot.
5. The manual SIP step: Recovery over VNC on localhost, language English, `csrutil disable`, then VNC off again.
6. `lume clone` to the golden name.

`scripts/vm/provision-guest.sh` runs in the guest. It installs the pinned Spectre 0.9.0 (sha256 checked), Maestro 2.12.1, JDK 21 and Node, sets passwordless sudo for the lane user, turns off Setup Assistant's post-update screens and checks that sshd accepts keys only. `scripts/vm/grant-screen-capture.sh` writes the two `kTCCServiceScreenCapture` rows with their code requirements.

The image holds no repository and no credential. The driver only clones it and never boots it.

`vm up` checks `lume --version` against the pinned 0.7.2 and refuses another version with the install hint.

### D10. One change, not three
The driver routing, the provisioning scripts and the skill text share one contract: the guest user, the paths, passwordless sudo, the TCC grants and the console session. A driver without a matching image cannot be exercised, and an image without the driver has no consumer. onara's configuration is a separate onara change. Its F1 rows use an onara QA worktree with the `vm` section added locally.

### D11. Sequencing with `feat/app-qa-computer-use-exception`
That branch changes `SKILL.md` and MODIFIES the routing requirement of `app-qa-driver`. This change MODIFIES only the configuration requirement and adds a new capability, so the spec deltas do not overlap. Apply starts after rebasing onto `main` once that branch has merged, and resolves the `SKILL.md` text there.

### Build vs. adopt: VM manager for macOS guests
- Repository: none; searched `packages/`, `team-config/`, `scripts/` for lume, tart and Virtualization.framework.
- Platform: https://developer.apple.com/documentation/virtualization. Using it directly means writing a VM manager (restore-image install, NVRAM, disk clone, unattended setup), so it is not adopted directly.
- Candidates:
  - lume, https://github.com/trycua/cua (libs/lume): lume-v0.7.2 of 2026-11-12, MIT, maintained (pushed 2026-11-14). Adopt: unattended Tahoe preset, APFS clone, headless run with VNC off, JSON listing; proven in the 2026-11-14 test.
  - tart, https://github.com/openai/tart: 2.41.1 of 2026-10-15, FSL-1.1-ALv2 (not an OSI licence), maintained. Rejected; gap: no unattended setup preset for current macOS in the CLI, and the source-available licence restricts redistribution in team tooling.
- Decision: adopt lume 0.7.2.

### Build vs. adopt: guest-to-host port forward and file transfer
- Repository: none; the driver opens no network channel today.
- Platform: OpenSSH remote forwarding (`ssh -R`, https://man.openbsd.org/ssh#R) and `tar` streamed over SSH, both in macOS.
- Candidates: not searched, covered above.
- Decision: adopt OpenSSH `-R` with `ExitOnForwardFailure=yes`, and `tar` over SSH.

### Build vs. adopt: host-wide slot lock
- Repository: `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:898` (`acquireLock`, atomic `mkdir` plus pid).
- Platform: not searched, covered above.
- Candidates: not searched, covered above.
- Decision: adopt the existing `mkdir` lock pattern, one directory per slot.

## Risks / Trade-offs

- [A leaked lease keeps a VM with credentials running] → it is reclaimed by the next `vm up` after `idleMinutes` or by `vm down`. The skill requires `vm down` before the final report. A lease nobody reclaims lives until the next `vm up` or `vm status` on the machine (accepted residual, gate.md).
- [The guest has SIP off and grants Screen Recording to every SSH session] → NAT-only guest, key-only SSH, VNC off, disposable clone, dev accounts only. Documented in `vm-image.md`.
- [The idle limit reclaims a lease between two commands of a slow session] → the next routed command exits 2 naming `vm up`, so the session re-stages. No silent host run.
- [The mtime check misses a change that keeps old mtimes (for example `git checkout` of an older file)] → the check compares against every copied file's mtime, and checkout sets the current time. Accepted: a deliberately back-dated file is out of scope.
- [`vm up` takes 2 to 3 minutes (clone 5 s, boot about 40 s, copy, simulator boot, WebKit warm-up)] → a rerun on a live lease skips clone and boot.
- [A host that sleeps pauses the guest] → the skill names `power.sleepPrevention` `idle` or higher as a prerequisite.
- [lume behaviour changes between releases] → pinned version, checked by `vm up`.

## Migration Plan

1. Deploy with `scripts/deploy-local.sh`. Existing `app-qa/1` configurations keep working.
2. On the machine: build a clean golden image per `vm-image.md`. The PoC image `qa-mac-golden` holds an onara checkout and credentials, so it is deleted, not reused. Then write `~/.omp/agent/app-qa-vm.json`.
3. Rollback: delete the lane file. Every command then runs on the host as before.
