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
The lane is active when the machine lane file exists and the repository configuration has `vm` (schema `app-qa/2`). The user decided on 2026-11-14: VM by default wherever set up. A routed command exits 2 naming `vm up TARGET` in any of these cases:
- no lease
- a lease that did not stage the target
- a lease whose clone is not running (`lume ls --format json`) or whose forward pid is dead
- SSH exiting 255 (no connection)

`--host` is the explicit escape. Android and `scan` stay on the host.
Alternative: route only when the host screen is locked. Rejected by the user: the lock can start mid-run, and simulator windows on the host disturb the user.

### D3. Machine lane file
`~/.omp/agent/app-qa-vm.json`, schema `app-qa-vm/1`, validated with the same strict `section()` helpers as the repository configuration. Fields:
- `image` (golden VM name)
- `user`
- `sshKey` (absolute path)
- `slots` (1 or 2)
- `idleMinutes`
- `ios.deviceType` (simulator device type name)

The path is fixed under `HOME`. The suite already runs the driver with a private `HOME`, so no environment override exists.
It is user-owned: `scripts/install-team-config.ts` removes only files it installed (ownership manifest, `install-team-config.ts:521-592`), so a deploy never deletes it.

### D4. Slots, leases and the table lock
- **Table lock:** `${TMPDIR}/app-qa/vm/table.lock`, an atomic `mkdir` plus `pid` in the pattern of `acquireLock`/`describeLock` (`qa.mjs:898-932`). It is held only for short reads and mutations of the slot table:
  - lease lookup and slot taking
  - busy registration and removal
  - the reclaim decision and the marking of the reclaimed lease as closing
  - the sweep
  - the state change of `vm down`

  It is never held across a clone, boot, copy or build. A stale table lock (dead pid) is taken over, because it guards only these short critical sections.
- **Slot directories:** `${TMPDIR}/app-qa/vm/slot-N` for N up to `slots`. Under the table lock, `vm up` first looks for this worktree's slot and otherwise creates a free one.
- **Lease record:** written as `lease.json` in the same critical section that creates the slot. It holds:
  - the worktree's real path
  - the clone name `app-qa-slot-N`
  - the owner pid
  - `state` (`starting`, `ready` or `closing`)
  - the staged targets
  - the forward pid and port
  - `lastUsed`

  A second `vm up` of the same worktree finds the lease and refreshes it. While the lease is `starting` with a live owner, that second `vm up` exits 2 naming the owner's pid.
- **Busy markers:** each routed command creates `busy/PID` and removes it after the run. `lastUsed` is set at both ends.
- **Refresh and teardown:** a `vm up` refresh or a `vm down` exits 2 naming the pid while a live busy pid exists in its lease.
- **Reclaim:** with no free slot, `vm up` reclaims the `ready` lease idle longest beyond `idleMinutes` that has no live busy pid. It marks that lease `closing` under the lock, deletes the clone outside the lock, and then frees the slot.
- **Sweep** (under the lock, by `vm up` and `vm status`):
  - A slot whose owner is alive is held, whatever `lume ls` shows.
  - Any of these cases has its clone deleted and its slot freed, each printed by name:
    - a `starting` slot whose owner is dead
    - a `ready` slot whose clone is gone
    - an `app-qa-slot-*` clone without a slot directory
- **Third worktree:** with every slot busy, starting or recently used, `vm up` refuses like the flow lock does: exit 2 with each holder's worktree and last use. It does not queue, because a waiting process would hold an agent turn for minutes without output.

### D5. Staging as a reconcile
`vm up TARGET... [--port N]` brings the lease to one desired state. It is safe to rerun.
1. **Build:** run each requested target's configured build on the host before taking a slot. The build is an argv in a repository-relative working directory, with `{port}` replaced by P (`--port`, else `backendPort(ctx)`, `qa.mjs:528`). Its output goes to a host temporary file. On a non-zero exit, or an artifact missing afterwards, print the last 40 lines redacted and exit 2. The build tool is the freshness authority: its up-to-date check decides on content, so no mtime comparison exists.
2. **Slot:** take or find the slot (D4).
3. **Clone:** with no clone, run `lume clone IMAGE app-qa-slot-N`. With the clone not running, run `lume run --detach --display none --vnc disabled`. Then wait for SSH. The guest is NAT-only (192.168.64.x), reachable from this host only.
4. **Copy:** delete the guest copy, then copy `git ls-files -z --cached --others --exclude-standard` as a tar stream over SSH into `~/work/NAME` and run `git init` there, without a commit. The guest driver needs only `--show-toplevel` and `--git-common-dir` (`qa.mjs:73-88`), which then resolve to the guest copy, so its worktree matching and its credentials path (`qa.mjs:303`) work unchanged.
5. **Driver:** stream the deployed driver directory, `scripts/vm/` included, to the same path in the guest.
6. **Credentials:** stream the configured credentials file through SSH stdin into the guest copy at its configured relative path, with umask 077. Its bytes never appear in arguments or output.
7. **Forward:** kill the recorded forward pid, then start `ssh -N -R P:127.0.0.1:P -o ExitOnForwardFailure=yes` and record its pid.
8. **Targets:** start them (D6), then set the lease `ready`.

### D6. Target start by one guest-side script
`scripts/vm/start-target.mjs ios|desktop` ships with the driver directory (step 5) and runs through one SSH command per target. It records each app pid in the guest, so the host sends no series of remote shell strings.
- **ios:**
  1. Delete the lane's earlier simulator, then create one of `ios.deviceType` on the guest's only iOS runtime and boot it. Recreating it on every `vm up` resets the sign-in state; a signed-in app or a live provider session would make the sign-in subflow fail (`SKILL.md:97`).
  2. Install the artifact.
  3. Open the backend health URL once to warm WebKit, then terminate Safari.

  Routed flow runs get `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000`.
- **desktop:**
  1. Kill the recorded app pid.
  2. Read the distributable's `Contents/app/*.cfg` for `app.classpath`, `app.mainclass` and `java-options`. The host checks the cfg's main class before taking a slot.
  3. Run the app on the guest's JDK 21 (`/usr/libexec/java_home -v 21`) with `-Djava.awt.headless=false` and the configured `systemProperties`, replacing `{credentials}` with the guest credentials path.
  4. Start it with `sudo launchctl asuser UID sudo -u USER` in the console session, with the guest copy as working directory.

  The guest user has passwordless sudo from provisioning, so no password reaches the driver.

The script is tested in the suite with its existing fake `xcrun` and a fake `launchctl` and `java`.

### D7. Routed invocation and output return
Translation table, closed:

| Input | Routed form |
|---|---|
| working directory | guest copy plus the host working directory's path relative to the worktree |
| FLOW | resolved on the host, must lie inside the worktree, sent worktree-relative; otherwise exit 2 before SSH |
| `--config`, `--credentials` | refused with exit 2 naming `--host` |
| `--out` (desktop capture, flow) | host refusals first (existing flow `--out`, existing capture files); the guest writes to a lease-private folder; files return to the given host path |
| flow without `--out` | lease-private guest folder, returned to a new host `mkdtemp` folder, as the host driver's own default `app-qa-out-` folder (`qa.mjs:1209`) |
| kept flow root | guest flow runs get a lease-private `TMPDIR`; a kept root returns to a new 0700 host `mkdtemp` |
| every other argument | byte-identical |

- **Quoting:** each remote argv element is POSIX single-quoted. The fake `ssh` runs the joined command through `sh -c`, as sshd does, so the tests exercise the quoting.
- **Output:** stdout and stderr are relayed line by line through the host's redaction values (`loadRedaction`, `qa.mjs:323`), and printed guest paths are rewritten to host paths. The guest driver already redacts; the host pass also covers values the guest configuration lacks. The exit code is the guest's. A non-zero exit appends one line naming the clone and `vm up TARGET` as the way to restart the app, simulator or forward.
- **Return:** files come back as a tar stream extracted by the host, which rejects absolute paths, `..`, links and anything but regular files and folders.

### D8. Schema `app-qa/2`
`app-qa/1` plus `vm`: `{ ios?: { artifact, build }, desktop?: { artifact, build, systemProperties? } }`.
- At least one target is required.
- `artifact` is repository-relative (`relPath`).
- `build` is `{ argv: [non-empty strings], cwd: relPath }`, where `{port}` may appear in an argv element.

`configErrors` accepts both ids, and `vm` under `app-qa/1` is an unknown key.

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

### Build vs. adopt: host-wide slot table lock
- Repository: `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:898-932` (`acquireLock` and `describeLock`: atomic `mkdir` plus pid, with a starting holder's pid awaited).
- Platform: not searched, covered above.
- Candidates: not searched, covered above.
- Decision: adopt the existing `mkdir` lock pattern for the table lock; the slot directories and lease states built on it are project-specific glue.

## Risks / Trade-offs

- [A leaked lease keeps a VM with credentials running] → it is reclaimed by the next `vm up` after `idleMinutes` or by `vm down`. The skill requires `vm down` before the final report. A lease nobody reclaims lives until the next `vm up` or `vm status` on the machine (accepted residual, gate.md).
- [The guest has SIP off and grants Screen Recording to every SSH session] → NAT-only guest, key-only SSH, VNC off, disposable clone, dev accounts only. Documented in `vm-image.md`.
- [The idle limit reclaims a lease between two commands of a slow session] → the next routed command exits 2 naming `vm up`, so the session re-stages. No silent host run.
- [A build tool that reports up to date on changed inputs would stage an old artifact] → the build tool owns freshness, as it does for every host QA run today. No second freshness check exists.
- [A configured build argv runs on the host] → it comes from the tracked repository configuration, like the build commands the repository skill already tells the agent to run. It runs without a shell, and its output is redacted before any line is printed.
- [`vm up` takes the build time plus 2 to 3 minutes (clone 5 s, boot about 40 s, copy, simulator boot, WebKit warm-up)] → a rerun on a live lease skips clone and boot, and incremental builds are short.
- [A host reboot empties `${TMPDIR}` slots while lume keeps the clones] → the next sweep finds the `app-qa-slot-*` clones without a slot and deletes them.
- [A host that sleeps pauses the guest] → the skill names `power.sleepPrevention` `idle` or higher as a prerequisite.
- [lume behaviour changes between releases] → pinned version, checked by `vm up`.

## Migration Plan

1. Deploy with `scripts/deploy-local.sh`. Existing `app-qa/1` configurations keep working.
2. On the machine: build a clean golden image per `vm-image.md`. The PoC image `qa-mac-golden` holds an onara checkout and credentials, so it is deleted, not reused. Then write `~/.omp/agent/app-qa-vm.json`.
3. Rollback: delete the lane file. Every command then runs on the host as before.
