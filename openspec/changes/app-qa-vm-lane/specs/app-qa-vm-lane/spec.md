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
With the lane active, `preflight`, `desktop` and `flow` for `ios` and `desktop` SHALL run in the VM leased by the current worktree. Without such a lease, or with a lease that did not stage that target, they SHALL exit 2 naming the `vm up` command for that target, before touching any device, app or host lock. `--host` SHALL run that one command on the host. Android targets and `scan` SHALL always run on the host.

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
- **WHEN** the lane is active and the worktree holds no lease, or only another worktree holds one, or the lease staged `ios` and a desktop command runs
- **THEN** a command running on the host without `--host`, in another worktree's VM, or exiting 0 MUST fail this requirement

### Requirement: Leases take one of a fixed number of host-wide slots, one lease per worktree
`vm up` SHALL take one host-wide slot atomically, at most the lane file's slot count and never more than two, and bind it to the current worktree. A worktree SHALL hold at most one lease. With every slot held by a lease that is busy or was used within the idle limit, `vm up` SHALL exit 2 naming each holder's worktree and last use, without booting anything.

#### Scenario: Two worktrees in parallel
- **WHEN** two worktrees each run `vm up ios` with two slots configured
- **THEN** each gets its own slot and VM, and a flow run in one does not wait for or touch the other's simulator

#### Scenario: Simultaneous starts for the last slot
- **WHEN** two worktrees run `vm up` at the same moment and one slot is free
- **THEN** exactly one of them takes it and the other exits 2 naming the holder

#### Scenario: Negative control
- **WHEN** both slots are held by leases used within the idle limit and a third worktree runs `vm up`, or one worktree runs `vm up` twice
- **THEN** a third VM booting, a second slot for the same worktree, or an exit 0 for the third worktree MUST fail this requirement

### Requirement: Idle and orphaned VMs are reclaimed, busy ones never
When no slot is free, `vm up` SHALL reclaim the lease idle longest beyond the lane file's idle limit and delete its clone. A lease running a routed command SHALL never be reclaimed. `vm up` and `vm status` SHALL delete every lane clone that no lease holds and remove every lease whose clone is gone, printing each by name.

#### Scenario: Idle lease reclaimed
- **WHEN** both slots are held, one lease was last used beyond the idle limit and no routed command runs in it, and a third worktree runs `vm up`
- **THEN** that lease's clone is deleted, its worktree is printed as reclaimed, and the third worktree gets the slot

#### Scenario: Orphaned clone
- **WHEN** a lane clone exists without a lease after a crashed `vm up`
- **THEN** the next `vm status` deletes the clone and prints its name

#### Scenario: Negative control
- **WHEN** a lease is idle beyond the limit while a flow run it routed is still running, or a clone belongs to a live lease
- **THEN** deleting that clone or reclaiming that lease MUST fail this requirement

### Requirement: Staging copies the worktree, fresh artifacts and the credentials into the leased clone only
`vm up TARGET...` SHALL refuse with exit 2, before taking a slot, a target whose configured artifact is missing or older than the newest copied worktree file. It SHALL copy the worktree's tracked and untracked unignored files, the target artifacts, the deployed driver and, when credentials are configured, the credentials file (owner-only) into the clone, and forward the backend port. Rerun on a live lease, it SHALL refresh all of them.

#### Scenario: Fresh artifacts
- **WHEN** the iOS artifact was built after the last change to the worktree and `vm up ios` runs
- **THEN** the guest holds the worktree's files, the app is installed on one guest simulator, and the guest's backend port reaches the host's backend

#### Scenario: Refresh after a rebuild
- **WHEN** the worktree holds a lease, a source file changes, the artifact is rebuilt and `vm up ios` runs again
- **THEN** the same VM is reused, the guest copy holds the changed file and the simulator runs the rebuilt app

#### Scenario: Negative control
- **WHEN** a configured artifact is missing, or a worktree file was changed after the artifact was built
- **THEN** taking a slot, booting a VM, or a later routed command testing the old artifact MUST fail this requirement

### Requirement: Staged targets are ready for the unchanged guest driver
After `vm up ios`, the guest SHALL have one booted simulator with the staged app installed and its web view warmed. After `vm up desktop`, the staged desktop app SHALL run in the guest's logged-in console session, on a JDK that allows Spectre's agent, with the configured system properties and the guest copy of the worktree as its working directory, so the guest driver's attach finds exactly that JVM.

#### Scenario: Desktop sign-in in the guest
- **WHEN** `vm up desktop` has run and the routed desktop attach, wait and tap commands of a sign-in run
- **THEN** attach finds one JVM, the commands pass as they do on an unlocked host, and a routed capture lands in the host `--out` folder

#### Scenario: Negative control
- **WHEN** the desktop app is started from the SSH session instead of the console session, on the distributable's own runtime, or twice
- **THEN** `vm up desktop` exiting 0 while attach finds no JVM, a headless JVM, or two JVMs MUST fail this requirement

### Requirement: Routed output reaches the caller redacted and files return under the host's rules
A routed command SHALL print the guest command's lines and exit code, each line redacted with the host's configured values, and SHALL return `--out` files to the host path with the host's refusal of existing paths and files. A failing flow's kept root SHALL be copied to a new owner-only host temporary root whose path is printed. No guest path SHALL be printed as evidence.

#### Scenario: Passing capture
- **WHEN** a routed desktop capture runs with a host `--out` folder the session created
- **THEN** the PNG and JSON exist in that host folder, the printed paths are host paths, and the exit code is the guest's

#### Scenario: Negative control
- **WHEN** a guest line holds a configured username or password, a host `--out` path already exists for a flow run, or a capture's file exists in the host folder
- **THEN** printing the value, overwriting the host file, or exiting 0 MUST fail this requirement

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
With the lane active, the team skill `app-qa-drivers` SHALL lead an agent session without prior context to build the artifacts on the host, run `vm up` for its targets before QA, rerun it after a rebuild, run QA with the unchanged commands, and run `vm down` before its final report. A refused `vm up` SHALL be reported with its holders, never answered with `--host` unless the user asked for the host.

#### Scenario: iOS sign-in with the lane
- **WHEN** a fresh session in a repository with a `vm` section on a machine with a lane file is asked to sign account 1 into the app on the iOS simulator
- **THEN** its tool calls build the iOS artifact, run `vm up ios`, the routed preflight and the sign-in flow, and `vm down`, in that order

#### Scenario: Negative control
- **WHEN** a fresh session's tool calls run QA with `--host` after a refused `vm up` without the user asking, skip `vm down`, or test after a code change without a new build and `vm up`
- **THEN** reporting this requirement as met MUST fail
