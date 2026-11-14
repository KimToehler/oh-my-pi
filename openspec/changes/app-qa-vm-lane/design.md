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
The lane is active when the machine lane file exists and the repository configuration has `vm` (schema `app-qa/2`). The user decided on 2026-11-14: VM by default wherever set up.

A routed command is admitted in one critical section of the table lock (D4): the worktree's lease record exists, is complete and readable, is in state `ready`, and lists the target as staged. In that same critical section it registers `busy/PID`. After the lock is released it checks that the clone runs (`lume ls --format json`) and, when the lease has a forward, that the forward pid lives; a failed check removes the busy marker under the lock. A routed command exits 2 naming `vm up TARGET` in any of these cases:
- no lease, or a lease record that is missing, partial or unreadable
- a lease in state `starting` or `closing`
- a lease that did not stage the target, including one whose last refresh failed (D5)
- a clone that is not running, or a dead forward pid
- SSH exiting 255 (no connection)

`--host` is the explicit escape. Android and `scan` stay on the host.
Alternative: route only when the host screen is locked. Rejected by the user: the lock can start mid-run, and simulator windows on the host disturb the user.

### D3. Machine lane file
`~/.omp/agent/app-qa-vm.json`, schema `app-qa-vm/1`, validated with the same strict `section()` helpers as the repository configuration. Fields:
- `image` (golden VM name; a name starting with `app-qa-slot-` is refused, because that namespace belongs to the lane's clones)
- `user`
- `sshKey` (absolute path)
- `slots` (1 or 2)
- `idleMinutes`
- `ios.deviceType` (simulator device type name)

The path is fixed under `HOME`. The suite already runs the driver with a private `HOME`, so no environment override exists.
It is user-owned: `scripts/install-team-config.ts` removes only files it installed (ownership manifest, `install-team-config.ts:521-592`), so a deploy never deletes it.

### D4. Slots, leases and the table lock
- **Table lock:** `${TMPDIR}/app-qa/vm/table.lock`, an atomic `mkdir` plus `pid` in the pattern of `acquireLock`/`describeLock` (`qa.mjs:898-932`). Every read and every change of a lease record or busy marker happens under it, and each state change is one critical section. It is never held across a build, clone, boot, copy, stop or delete. A stale table lock (dead pid) is taken over; its holder died, so a slot directory it left without a complete `lease.json` is a partial slot.
- **Slot directories:** `${TMPDIR}/app-qa/vm/slot-N` for N up to `slots`. The clone of slot N is named exactly `app-qa-slot-N`; the lane never deletes, stops or runs a VM of any other name, and never the configured image.
- **Lease record:** `lease.json`, written to a temporary file in the slot and renamed, in the critical section that creates the slot. It holds:
  - the worktree's real path and the clone name
  - `state` and its holder pid: `starting` (owner, staging in progress), `ready` (routable), `closing` (closer, teardown in progress)
  - the staged targets (empty until a staging succeeds)
  - the build inputs of the staged artifacts (port and argv per target)
  - the forward pid and port, or none without a backend
  - `lastUsed`
- **State changes** (each one critical section):

| Transition | Condition | Effect |
|---|---|---|
| `vm up`, no lease, free slot | none | create slot, `starting`, owner = self, staged empty |
| `vm up`, own lease `ready` | no live busy pid | `starting`, owner = self, staged emptied before the build |
| `vm up`, own lease `starting` or `closing` | holder alive | exit 2 naming the holder pid |
| staging done | own `starting` | `ready`, staged = targets, build inputs recorded |
| build or staging failed | own `starting` | with a running clone: `ready`, staged empty; without a clone: slot removed |
| routed command start | `ready`, target staged | add `busy/PID`, `lastUsed` |
| routed command end | own busy marker | remove it, `lastUsed` |
| reclaim (other worktree's `vm up`, no free slot) | `ready`, idle beyond `idleMinutes`, no live busy pid | `closing`, closer = self |
| `vm down` | `ready` with no live busy pid | `closing`, closer = self |
| teardown done | own `closing`, clone absent from `lume ls` | slot removed (or handed to the reclaimer's new lease) |

  Once a lease leaves `ready`, no routed command can register in it, so a clone is deleted only when no routed command runs in it.
- **Teardown:** the closer kills the forward pid, runs `lume stop` and `lume delete` on the clone (an absent clone counts as deleted), checks that `lume ls` no longer lists it, and only then removes the slot under the lock.
- **Reset contract:** a fresh lease never reuses an earlier clone: a slot is freed only after its clone is gone from `lume ls`, so a slot name taken again is always cloned anew from the golden image, which holds no repository, credential or driver state (D9). A refresh keeps the clone and resets everything a routed command reads; it runs only while no routed command runs (table above), so nothing it deletes is in use.

| Entry | Fresh lease (new or reused slot name) | Refresh (`vm up` on the worktree's lease) | Teardown (`vm down`, reclaim, sweep) |
|---|---|---|---|
| clone: disk, guest `HOME`, guest `TMPDIR` | new clone of the golden image | kept | deleted |
| guest copy `~/work/NAME`, its credentials file included | created | deleted and copied again | deleted with the clone |
| guest driver directory | copied | copied again | deleted with the clone |
| guest driver state `${TMPDIR}/app-qa/` (desktop session records `qa.mjs:646`, flow lock `qa.mjs:647`) | absent (fresh clone) | deleted before the targets start, so a desktop command needs a new `desktop attach` | deleted with the clone |
| lease-private guest output folders and flow `TMPDIR` | absent | deleted | deleted with the clone |
| iOS simulator | created | deleted and created again (D6) | deleted with the clone |
| desktop app process | started | killed and started again (D6) | ends with the clone |
| port forward process | started | killed and started again | killed |
| lease record | created, `starting` | kept, `starting`, staged emptied | removed with the slot |
| slot `stage/` snapshot | created, deleted after the copy | created, deleted after the copy | removed with the slot |
| host return folders | none | none | never touched: each routed command creates a new one, and they are the caller's evidence |

- **Sweep** (by `vm up`, `vm down` and `vm status`; decisions under the lock, teardown outside it):
  - A lease whose holder is alive, or that is `ready` with a live busy pid, is never touched, whatever `lume ls` shows.
  - These become `closing` with the sweeper as closer and are torn down, each printed by name: a partial slot; a `starting` lease whose owner is dead; a `closing` lease whose closer is dead (teardown resumes from wherever it stopped: before stop, between stop and delete, or after delete before the slot was removed).
  - A `ready` lease whose clone is gone: its forward is killed and its slot removed.
  - A busy marker whose pid is dead is removed.
  - A VM named `app-qa-slot-N` with N up to 2 and no slot directory is deleted.
- **Third worktree:** with every slot busy, starting, closing or used within `idleMinutes`, `vm up` refuses like the flow lock does: exit 2 with each holder's worktree and last use. It does not queue, because a waiting process would hold an agent turn for minutes without output.

### D5. Staging as a reconcile
`vm up TARGET... [--port N]` brings the lease to one desired state. It is safe to rerun.
1. **Port:** with a `backend` section, P is `--port` or `backendPort(ctx)` (`qa.mjs:528`). Without one, no port exists: `--port` is refused with exit 2, and no forward is started.
2. **Lease:** take or refresh the lease (D4 table). From here the lease is `starting` with this process as owner, so a second `vm up` of the worktree exits 2 and routed commands are refused until step 9.
3. **Build:** run each requested target's configured build on the host: an argv without a shell in a repository-relative working directory, with `{port}` replaced by P. Its output is kept in memory only, as the last 40 lines, redacted with the host's values before they are kept; nothing is written to disk. On a non-zero exit, or an artifact missing afterwards, print those lines and apply the failure transition of D4, then exit 2. The build tool is the freshness authority: its up-to-date check decides on content, so no mtime comparison exists.
4. **Snapshot:** copy each artifact with `cp -c -R` (an APFS clone, no extra disk) into the slot's private `stage/` folder (0700) and check it there: it exists, and for `desktop` the cfg (D6) names a main class. Every later step reads the snapshot, never the worktree path, so the checked bytes are the staged bytes even if the worktree's artifact changes meanwhile.
5. **Clone:** with no clone (a fresh lease, see the reset contract in D4), run `lume clone IMAGE app-qa-slot-N`. With the clone not running, run `lume run --detach --display none --vnc disabled`. Then wait for SSH. The guest is NAT-only (192.168.64.x), reachable from this host only.
6. **Copy:** delete the guest copy, then stream as tar over SSH into `~/work/NAME`:
   1. the files of `git ls-files -z --cached --others --exclude-standard`;
   2. each artifact from the snapshot, to its repository-relative path in the guest copy (artifacts are usually git-ignored build output, so step 1 does not carry them);
   3. the deployed driver directory, `scripts/vm/` included, to the same path below the guest's `~/.omp/agent/skills/`;
   4. the configured credentials file through SSH stdin into the guest copy at its configured relative path, with umask 077. Its bytes never appear in arguments or output.

   On a refresh, the guest driver state and the lease-private output folders are deleted before the copy (reset contract, D4). Then run `git init` in the guest copy, without a commit. The guest driver needs only `--show-toplevel` and `--git-common-dir` (`qa.mjs:73-88`), which then resolve to the guest copy, so its worktree matching and its credentials path (`qa.mjs:303`) work unchanged. The snapshot is deleted after the copy.
7. **Forward:** with a backend, kill the recorded forward pid, then start `ssh -N -R P:127.0.0.1:P -o ExitOnForwardFailure=yes` and record its pid.
8. **Targets:** start them (D6).
9. **Ready:** apply the staging-done transition of D4.

A failure in steps 4 to 8 applies the failure transition too, so the lease never offers an older artifact after a failed refresh.

**Staging inventory** (everything that reaches the guest; nothing else does):

| Runtime file | Origin | Kind | Reaches the guest by |
|---|---|---|---|
| source files | worktree | tracked and untracked unignored | step 6.1 |
| artifacts (`vm.ios.artifact`, `vm.desktop.artifact`) | host build of step 3 | ignored, generated | snapshot, step 6.2 |
| driver and `scripts/vm/` | deployed `~/.omp/agent/skills/app-qa-drivers` | installed team config | step 6.3 |
| credentials file | configured `credentials.file` | ignored | SSH stdin, step 6.4 |
| other ignored files (build caches, `.gradle`, `local.properties`, `node_modules`) | worktree | ignored | not copied: the guest runs the built artifacts and never builds |

**Credential holders and sinks:**

| Holder or sink | Contents | Rule |
|---|---|---|
| configured credentials file on the host | values | unchanged; read by the host driver |
| host driver memory | redaction values (`loadRedaction`, `qa.mjs:323`) | never written |
| build stdout and stderr | may print values | kept in memory, redacted before it is kept or printed (step 3) |
| SSH stdin of step 6.4 | the file's bytes | never in an argument vector, a log or a temporary file |
| guest credentials file | values | 0600 inside the clone; deleted with the clone |
| guest target processes | the credentials path only (`{credentials}` property) | inside the clone |
| guest driver output and its kept files | handled by the guest driver's own redaction and `sweepRoot` (`qa.mjs:958`) | relayed through the host redaction (D7); returned flow roots pass `sweepRoot` with the host's values again |
| lease record, slot `stage/` folder, host return folders | paths, pids, artifacts, returned evidence | never a value; the sentinel test scans them |

### D6. Target start by one guest-side script
`scripts/vm/start-target.mjs ios|desktop` ships with the driver directory (step 6.3) and runs through one SSH command per target. It records each app pid in the guest, so the host sends no series of remote shell strings.
- **ios:**
  1. Delete the lane's earlier simulator, then create one of `ios.deviceType` on the guest's only iOS runtime and boot it. Recreating it on every `vm up` resets the sign-in state; a signed-in app or a live provider session would make the sign-in subflow fail (`SKILL.md:97`).
  2. Install the artifact.
  3. With a backend, open its health URL once to warm WebKit, then terminate Safari.

  Routed flow runs get `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000`.
- **desktop:**
  1. Kill the recorded app pid.
  2. Read the distributable's `Contents/app/*.cfg` (format and reader in "Build vs. adopt: launcher cfg reader") for `app.classpath`, `app.mainclass` and `java-options`. The host runs the same reader on the snapshot before step 5 and refuses a cfg without a main class.
  3. Run the app on the guest's JDK 21 (`/usr/libexec/java_home -v 21`) with `-Djava.awt.headless=false` and the configured `systemProperties`, replacing `{credentials}` with the guest credentials path.
  4. Start it with `sudo launchctl asuser UID sudo -u USER` in the console session, with the guest copy as working directory.

  The guest user has passwordless sudo from provisioning, so no password reaches the driver.

The script is tested in the suite with its existing fake `xcrun` and a fake `launchctl` and `java`.

### D7. Routed invocation and output return
Translation table, closed:

| Input | Routed form |
|---|---|
| working directory | guest copy plus the host working directory's path relative to the worktree |
| FLOW | resolved on the host against the host working directory, must lie inside the worktree, then sent relative to the working directory, so the guest driver's `resolve(flowArg)` (`qa.mjs:1124`) in the matching guest directory finds the same file; outside the worktree, exit 2 before SSH |
| `--config`, `--credentials` | refused with exit 2 naming `--host` |
| `--out` (desktop capture, flow) | host refusals first (existing flow `--out`, existing capture files); the guest writes to a lease-private folder; files return to the given host path |
| flow without `--out` | lease-private guest folder, returned to a new host `mkdtemp` folder, as the host driver's own default `app-qa-out-` folder (`qa.mjs:1209`) |
| kept flow root | guest flow runs get a lease-private `TMPDIR`; a kept root returns to a new 0700 host `mkdtemp` |
| every other argument | byte-identical |

- **Quoting:** each remote argv element is POSIX single-quoted. The fake `ssh` runs the joined command through `sh -c`, as sshd does, so the tests exercise the quoting.
- **Output:** stdout and stderr are relayed line by line through the host's redaction values (`loadRedaction`, `qa.mjs:323`), and printed guest paths are rewritten to host paths. The guest driver already redacts; the host pass also covers values the guest configuration lacks. The exit code is the guest's. A non-zero exit appends one line naming the clone and `vm up TARGET` as the way to restart the app, simulator or forward.
- **Return:** files come back as one tar stream into a 0600 file in the new host folder. The host lists it first (`tar -tvf`) and refuses the whole archive when an entry has an absolute path, a `..` component, or a type other than regular file or folder; only then it extracts with `tar -xf` into that folder and deletes the archive. A returned flow root then passes `sweepRoot` with the host's values (D5 table) before its path is printed.

### D8. Schema `app-qa/2`
`app-qa/1` plus `vm`: `{ ios?: { artifact, build }, desktop?: { artifact, build, systemProperties? } }`.
- At least one target is required.
- `artifact` is repository-relative (`relPath`).
- `build` is `{ argv: [non-empty strings], cwd: relPath }`. `{port}` may appear in an argv element only when the configuration has a `backend` section; otherwise it is refused as a value without a port.

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
- Repository: `packages/coding-agent/src/ssh/file-transfer.ts:191` (content streamed over `ssh` stdin) and `packages/coding-agent/src/skillshare/tar.ts` (tar reader and writer). Both are TypeScript modules of the omp runtime; the driver is a deployed Node script with builtins only (`qa.mjs:19-40`), so it cannot import them. Searched `team-config/`, `scripts/`, `packages/coding-agent/src/`, `packages/utils/src/` for `ssh`, `tar` and `ssh -R`.
- Platform: OpenSSH remote forwarding (`ssh -R`, https://man.openbsd.org/ssh#R) and bsdtar (`tar`, https://man.freebsd.org/cgi/man.cgi?tar(1)), both in macOS. bsdtar strips a leading `/` and refuses `..` on extraction by default; the host's listing check (D7) refuses such an archive before extraction anyway.
- Candidates: not searched, covered above.
- Decision: adopt OpenSSH `-R` with `ExitOnForwardFailure=yes`, stdin streaming as `file-transfer.ts` does, and `tar` over SSH with list-then-extract on the host.

### Build vs. adopt: launcher cfg reader
- Repository: none; searched `team-config/`, `scripts/`, `packages/coding-agent/src/` for `jpackage`, `app.mainclass` and `java-options`.
- Platform: the jpackage launcher reads `Contents/app/NAME.cfg` (INI-style sections `[Application]` with `app.classpath` and `app.mainclass`, `[JavaOptions]` with `java-options`, `$APPDIR` expanding to `Contents/app`), https://docs.oracle.com/en/java/javase/21/jpackage/. No JDK tool prints the parsed values, and the launcher itself starts the jlinked runtime that lacks `java.instrument` (Context), so the launcher cannot be used.
- Candidates: `ini`, https://github.com/npm/ini: 7.0.0, ISC, maintained (modified 2026-09-09). Rejected; gap: the driver is deployed without `node_modules` and runs on Node builtins only.
- Decision: build a reader for exactly those keys in those two sections with `$APPDIR` expansion; other sections and keys are ignored, a missing main class is refused, and repeated `app.classpath` and `java-options` lines keep their order. It lives in `scripts/vm/start-target.mjs` and is exported for the host check.

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
- [A slot is held while the build runs, so a long build keeps a third worktree out] → the lease must exist before the build so a refresh can withdraw the old targets and two starts in one worktree cannot overwrite each other's artifact; the third worktree is refused with the holder named, not queued.
- [A configured build argv runs on the host] → it comes from the tracked repository configuration, like the build commands the repository skill already tells the agent to run. It runs without a shell, and its output is redacted before any line is printed.
- [`vm up` takes the build time plus 2 to 3 minutes (clone 5 s, boot about 40 s, copy, simulator boot, WebKit warm-up)] → a rerun on a live lease skips clone and boot, and incremental builds are short.
- [A host reboot empties `${TMPDIR}` slots while lume keeps the clones] → the next sweep finds the `app-qa-slot-N` clones without a slot and deletes them.
- [A host that sleeps pauses the guest] → the skill names `power.sleepPrevention` `idle` or higher as a prerequisite.
- [lume behaviour changes between releases] → pinned version, checked by `vm up`.

## Migration Plan

1. Deploy with `scripts/deploy-local.sh`. Existing `app-qa/1` configurations keep working.
2. On the machine: build a clean golden image per `vm-image.md`. The PoC image `qa-mac-golden` holds an onara checkout and credentials, so it is deleted, not reused. Then write `~/.omp/agent/app-qa-vm.json`.
3. Rollback: delete the lane file. Every command then runs on the host as before.
