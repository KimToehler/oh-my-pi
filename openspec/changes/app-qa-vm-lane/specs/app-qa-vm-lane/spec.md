# Spec Delta

## Purpose

Lets the shared app QA driver run a worktree's iOS simulator and Compose desktop QA inside a disposable, leased macOS VM, so autonomous sessions work while the host screen is locked and parallel worktrees do not share one simulator.

## ADDED Requirements

### Requirement: The lane is active only where the machine and the repository both configure it
The lane SHALL be active when the machine lane file exists and the repository configuration has a `vm` section. A machine lane file that is unreadable, not JSON, of another schema id, holds an unknown key or lacks a required value SHALL stop every command that would use it with exit 2, naming the file and the cause. Without the file or the section every command SHALL behave as before this change.

#### Scenario: Machine without a lane file
- **WHEN** a repository configuration has a `vm` section and the machine has no lane file
- **THEN** preflight, desktop and flow commands run on the host exactly as before, and `vm up` exits 2 naming the missing lane file

#### Scenario: Repository without a vm section
- **WHEN** the machine has a valid lane file and the repository configuration has no `vm` section
- **THEN** every command runs on the host as before

#### Scenario: Negative control
- **WHEN** the lane file misspells a key, lacks the image name, or names another schema id
- **THEN** any command running on the host or in a VM instead of exiting 2 with the file and the cause MUST fail this requirement

### Requirement: An active lane routes iOS and desktop commands to the worktree's lease and never to the host
With the lane active, `preflight`, `desktop` and `flow` for `ios` and `desktop` SHALL run in the VM leased by the current worktree. Without a ready lease that staged that target, or with its clone or port forward not running, they SHALL exit 2 naming the `vm up` command for that target, before touching any device, app or host lock. `--host` SHALL run that one command on the host. Android targets and `scan` SHALL always run on the host.

#### Scenario: Routed preflight
- **WHEN** the worktree holds a lease that staged `ios` and preflight for `ios` runs
- **THEN** the checks are the guest's, the first line names the lane and the leased VM, and no host device or the host flow lock is used

#### Scenario: No lease
- **WHEN** the lane is active, the worktree holds no lease and a desktop attach runs
- **THEN** it exits 2 naming `vm up desktop` and attaches to no JVM on the host

#### Scenario: Explicit host run
- **WHEN** the lane is active and preflight for `desktop` runs with `--host`
- **THEN** it runs the host checks as before this change

#### Scenario: Negative control
- **WHEN** the lane is active and the worktree holds no lease, only another worktree holds one, the lease staged `ios` and a desktop command runs, or the lease's port forward has died
- **THEN** a command running on the host without `--host`, in another worktree's VM, or exiting 0 MUST fail this requirement

### Requirement: Routed commands reach the guest driver with the caller's arguments and location
A routed command SHALL run the guest driver in the guest copy's directory matching the host working directory's path below the worktree, with every argument byte-identical. A flow file SHALL reach the guest driver as the same file of the guest copy, whatever subdirectory the command runs in, and one outside the worktree SHALL be refused with exit 2 before any guest command. `--config` and `--credentials` SHALL be refused with exit 2 naming `--host`.

#### Scenario: Text with shell characters
- **WHEN** a routed `desktop type` runs from `app_kmp/` with a text holding spaces, quotes, `$HOME` and `;`
- **THEN** the guest driver runs in the guest copy's `app_kmp/` and receives exactly that text as one argument

#### Scenario: Flow from a subdirectory
- **WHEN** a routed flow runs from `app_kmp/` naming a flow file below `app_kmp/` by its path relative to `app_kmp/`
- **THEN** the guest driver runs that same file of the guest copy

#### Scenario: Negative control
- **WHEN** a routed command's text holds `$(id)` or `;`, a flow file outside the worktree is named, or `--credentials` names a host file
- **THEN** the text being split or evaluated by a guest shell, the guest driver running for the outside flow or the foreign credentials, or an exit 0 MUST fail this requirement

### Requirement: Leases take one of a fixed number of host-wide slots, one lease per worktree
`vm up` SHALL take one host-wide slot atomically, at most the lane file's slot count and never more than two, and record its owner process and state (starting, ready, closing) when it takes it. Lease lookup, slot taking, reclaim, sweep and teardown SHALL be serialised host-wide, so a worktree holds at most one lease. With every slot held, busy or used within the idle limit, `vm up` SHALL exit 2 naming each holder's worktree and last use.

#### Scenario: Two worktrees in parallel
- **WHEN** two worktrees each run `vm up ios` at the same time with two slots configured
- **THEN** each gets its own slot and VM, neither start deletes the other's clone, and a flow run in one does not wait for or touch the other's simulator

#### Scenario: Simultaneous starts for the last slot
- **WHEN** two worktrees run `vm up` at the same moment and one slot is free
- **THEN** exactly one of them takes it and the other exits 2 naming the holder

#### Scenario: Negative control
- **WHEN** both slots are held by leases used within the idle limit and a third worktree runs `vm up`, or one worktree runs `vm up` twice at the same moment
- **THEN** a third VM booting, a second slot for the same worktree, or an exit 0 for the third worktree MUST fail this requirement

### Requirement: Idle and orphaned VMs are reclaimed, busy and starting ones never
When no slot is free, `vm up` SHALL reclaim the ready lease idle longest beyond the idle limit and delete its clone. A lease running a routed command, or starting or closing with a live holder, SHALL never be reclaimed or swept. `vm up`, `vm down` and `vm status` SHALL delete every lane clone no slot holds and free every slot whose clone is gone, printing each. `vm up` refresh and `vm down` SHALL exit 2 naming the pid while a routed command of that lease runs.

#### Scenario: Idle lease reclaimed
- **WHEN** both slots are held, one lease was last used beyond the idle limit and no routed command runs in it, and a third worktree runs `vm up`
- **THEN** that lease's clone is deleted, its worktree is printed as reclaimed, and the third worktree gets the slot

#### Scenario: Crashed start
- **WHEN** a `vm up` was killed after taking a slot and cloning, and `vm status` runs
- **THEN** the clone is deleted, the slot is free, and both are printed by name

#### Scenario: Negative control
- **WHEN** a lease is idle beyond the limit while a flow run it routed is still running, another worktree's `vm up` is still starting while `vm status` runs, or `vm up` or `vm down` runs in the same worktree during a routed flow of its lease
- **THEN** deleting that clone, freeing that slot, reclaiming that lease, or an exit 0 of that `vm up` or `vm down` MUST fail this requirement

### Requirement: A routed command starts only in a ready lease, and a lease leaves ready only when none runs
Admitting a routed command SHALL check that the lease is ready and has staged the target, and register the command as running, in one serialised step. Marking a lease for teardown or refresh SHALL happen in such a step too, and only while no routed command runs in it. A lease record that is missing, partial or unreadable SHALL count as not ready.

#### Scenario: Teardown under way
- **WHEN** a lease has been marked for teardown and its clone still runs, and a routed command of that worktree starts
- **THEN** it exits 2 naming `vm up` and runs no guest command

#### Scenario: Negative control
- **WHEN** a routed command starts while its lease is starting, closing or partially written
- **THEN** the command running a guest command, or the clone being deleted while a routed command runs in it, MUST fail this requirement

### Requirement: Interrupted starts and teardowns are recovered by the next sweep
A slot whose holder died while it was starting or closing, or whose record is partial, SHALL be torn down by the next `vm up`, `vm down` or `vm status`: its clone is deleted first and its slot freed only once the clone is gone, both printed by name.

#### Scenario: Killed teardown
- **WHEN** a `vm down` was killed after marking its lease closing and before its clone was deleted, and `vm status` runs
- **THEN** the clone is deleted, the slot is free, and both are printed

#### Scenario: Negative control
- **WHEN** a teardown was killed before stop, between stop and delete, or after delete before freeing the slot; a process died between creating a slot and writing its record, leaving the table lock behind; or two sweeps and a `vm up` meet the same orphan clone
- **THEN** the clone or the slot surviving the next `vm status`, the slot being freed while the clone still exists, the stale table lock blocking the next command, or a clone of a starting lease being deleted MUST fail this requirement

### Requirement: The lane touches only its own clones
The lane SHALL delete, stop or run only VMs named as its slot clones, and never the golden image. A lane file whose image name lies in the slot clones' namespace SHALL be refused with exit 2 naming the file and the cause.

#### Scenario: Image named like a clone
- **WHEN** the lane file names the image `app-qa-slot-golden`
- **THEN** every lane command exits 2 naming the file and the image name, and no `lume` command runs

#### Scenario: Negative control
- **WHEN** a VM that is not a slot clone of this lane exists while `vm status` sweeps
- **THEN** that VM being stopped, deleted or changed MUST fail this requirement

### Requirement: Staging builds on the host and copies the worktree, the artifacts and the credentials into the leased clone only
`vm up TARGET...` SHALL withdraw the lease's staged targets, build each target on the host, and exit 2 with the redacted output tail when the build fails or leaves no artifact. It SHALL then copy the worktree's tracked and untracked unignored files, the checked artifacts, the deployed driver and the credentials file (owner-only) into the clone, forward the backend port when one is configured, and only then mark the targets staged.

#### Scenario: First staging
- **WHEN** `vm up ios` runs in a worktree without a lease and the build passes
- **THEN** the guest holds the worktree's files and the built app, credentials are readable by the guest user only, and the guest's backend port reaches the host's backend

#### Scenario: Refresh after a code change
- **WHEN** the worktree holds a lease, a source file changes and `vm up ios` runs again
- **THEN** the build runs, the same VM is reused, the guest copy holds the changed file and the simulator runs the rebuilt app

#### Scenario: Negative control
- **WHEN** the build exits non-zero, or exits 0 without the configured artifact, on a worktree without a lease or on one whose lease staged an earlier build
- **THEN** a slot left held or a VM booted for a worktree without a lease, or a later routed command reaching the older artifact, MUST fail this requirement

### Requirement: Staging stages exactly the checked artifact and stores no credential outside the clone
The artifact `vm up` copies SHALL be the bytes it checked, including git-ignored build output, whatever happens to the worktree's artifact path meanwhile. Build output SHALL be redacted before it is kept or printed and SHALL NOT be written to disk. A configuration without a backend SHALL stage without a port forward.

#### Scenario: Ignored artifact
- **WHEN** the configured artifact lies in a git-ignored build folder and `vm up` runs
- **THEN** the guest copy holds the artifact at its repository-relative path

#### Scenario: Negative control
- **WHEN** the worktree's artifact changes after `vm up` checked it, a build prints a configured credential, or the configuration has no backend section
- **THEN** staging bytes other than the checked ones, the credential printed or found in any file outside the clone and the credentials file, or `vm up` failing for want of a backend port, MUST fail this requirement

### Requirement: Every vm up leaves each staged target in one known state
Each `vm up` SHALL reconcile its lease to one state: a stopped clone started again, one port forward (an earlier one stopped first), for `ios` one freshly created and booted simulator with the app installed and its web view warmed (sign-in state reset), for `desktop` one app process started in the guest's logged-in console session on a JDK that allows Spectre's agent, with the configured system properties and the guest copy as working directory.

#### Scenario: Desktop sign-in in the guest
- **WHEN** `vm up desktop` has run and the routed desktop attach, wait and tap commands of a sign-in run
- **THEN** attach finds one JVM, the commands pass as they do on an unlocked host, and a routed capture lands in the host `--out` folder

#### Scenario: Slot name reused
- **WHEN** a worktree's lease is taken down and another worktree's `vm up` takes the same slot
- **THEN** the new clone comes from the golden image and holds none of the earlier worktree's files, driver state or simulator

#### Scenario: Second vm up
- **WHEN** `vm up ios desktop` runs twice in one lease and a routed iOS sign-in flow follows
- **THEN** the guest has one booted simulator and one desktop JVM, one port forward runs on the host, and the sign-in flow passes

#### Scenario: Negative control
- **WHEN** the desktop app is started from the SSH session, on the distributable's own runtime, a second `vm up` keeps the old simulator, app or forward running beside the new one, or a slot name is reused after a teardown
- **THEN** `vm up` exiting 0 while attach finds no JVM, a headless JVM or two JVMs, a routed flow seeing two booted simulators, two forwards running, a desktop command after a refresh acting on the previous app's session record, or a new lease seeing a file, session record or flow lock of an earlier lease MUST fail this requirement

### Requirement: Routed output reaches the caller redacted and files return under the host's rules
A routed command SHALL print the guest's lines, redacted with the host's values, and exit with its code; a non-zero exit SHALL add one line naming the clone and the `vm up` command that restarts the target. `--out` files SHALL return to the host path under the host's refusals; a flow without `--out` and a failing flow's kept root SHALL return to new owner-only host temporary folders whose paths are printed. No guest path SHALL be printed as evidence.

#### Scenario: Passing capture
- **WHEN** a routed desktop capture runs with a host `--out` folder the session created
- **THEN** the PNG and JSON exist in that host folder, the printed paths are host paths, and the exit code is the guest's

#### Scenario: Flow without an output folder
- **WHEN** a routed flow that takes a named screenshot passes without `--out`
- **THEN** the screenshot exists in a new host folder whose path is printed, and no guest path is printed

#### Scenario: Negative control
- **WHEN** a guest line holds a configured username or password, a returned flow root or capture JSON holds one, the return is interrupted after the archive reached the host, a host `--out` path already exists for a flow run, a capture's file exists in the host folder, or a returned archive holds an absolute path, `..` or a link
- **THEN** printing the value, writing a file holding the value anywhere on the host, overwriting a host file, writing outside the target folder, or exiting 0 MUST fail this requirement

### Requirement: Losing the VM or the port forward during a routed command is reported as infrastructure loss
When the lease's clone stops, its port forward dies or the SSH connection drops while a routed command runs, the command SHALL exit 2 with a line naming the lost dependency and the `vm up` command, whatever the guest driver returned.

#### Scenario: Forward lost mid-flow
- **WHEN** the lease's port forward is killed while a routed sign-in flow runs
- **THEN** the command exits 2 with the infrastructure line, and the flow's sanitized files still return to the host

#### Scenario: Negative control
- **WHEN** the forward dies or the clone stops during a routed command that the guest driver reports as passed
- **THEN** an exit 0 or a printed pass without the infrastructure line MUST fail this requirement

### Requirement: Teardown removes the clone and everything copied into it
`vm down` SHALL stop the port forward, stop and delete the current worktree's clone and release its slot, and exit 0 when the worktree holds no lease. The driver SHALL never boot, change or copy a file into the golden image; credentials SHALL exist only inside leased clones.

#### Scenario: Session ends
- **WHEN** `vm down` runs in a worktree holding a lease
- **THEN** the clone no longer exists, no port forward process of that lease runs, and `vm status` shows the slot free

#### Scenario: Negative control
- **WHEN** a lease is taken down, or `vm up` runs on a machine whose golden image is stopped
- **THEN** the clone or its port forward surviving `vm down`, or any change to the golden image's disk or a credentials file inside it, MUST fail this requirement

### Requirement: A routed QA run succeeds while the host screen is locked
On an image built by the skill's provisioning document, a routed desktop preflight, attach, tap, wait and capture, and a routed iOS preflight and sign-in flow with an expected screen, SHALL pass while the host session is locked, as they pass on an unlocked host.

#### Scenario: Locked host
- **WHEN** the host reports its screen locked before and after the run, and onara's sign-in runs through the lane on iOS and on the desktop
- **THEN** both runs pass and their screenshots show the signed-in home screen

#### Scenario: Negative control
- **WHEN** the host is locked and a routed preflight checks the host's screen lock, Spectre's capture permission is missing in the guest, or the guest console session is not logged in
- **THEN** reporting this requirement as met MUST fail

### Requirement: The team skill leads a fresh agent through the lane
With the lane active, the team skill `app-qa-drivers` SHALL lead an agent session without prior context to run `vm up` for its targets before QA (which builds them on the host), rerun it after every code change before the next QA command, run QA with the unchanged commands, and run `vm down` before its final report. A refused `vm up` SHALL be reported with its holders, never answered with `--host` unless the user asked for the host.

#### Scenario: iOS sign-in with the lane
- **WHEN** a fresh session in a repository with a `vm` section on a machine with a lane file is asked to sign account 1 into the app on the iOS simulator
- **THEN** its tool calls run `vm up ios`, the routed preflight and the sign-in flow, and `vm down`, in that order

#### Scenario: Visible change tested through the lane
- **WHEN** a fresh session is asked to change a visible text of the app and show it on the iOS simulator
- **THEN** its tool calls edit the source, then run `vm up ios`, then a routed QA command whose screenshot shows the new text, then `vm down`

#### Scenario: Negative control
- **WHEN** a fresh session's tool calls run QA with `--host` after a refused `vm up` without the user asking, skip `vm down`, or test after a code change without a new `vm up`
- **THEN** reporting this requirement as met MUST fail
