# Proposal

## Why

Agents run app QA autonomously, and the shared driver runs it in the host's own GUI session, where three things stop them. (1) A locked screen blocks desktop evidence: `preflight desktop` refuses it (`team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:619-620` on `main`, the host check before this change), and Spectre's window capture fails while the host is locked, although Spectre's tag-based input and tree queries and iOS flows with their screenshots pass on a locked host (baseline of 2026-11-15, `.omp/team-config/evidence/gate/app-qa-vm-lane/host-locked-baseline.md`). (2) Every flow run on the host takes one host-wide lock (`openspec/specs/app-qa-driver/spec.md:160`), so parallel worktrees queue on one simulator. (3) Worktrees and the user share the host's simulators and app state, so one session's sign-in state or app build leaks into another's run and the simulator windows disturb the user. A feasibility test on 2026-11-14 (`~/lume-qa/README.md`, not tracked) ran onara's iOS sign-in flow with Maestro and its desktop sign-in with Spectre, captures included, inside a lume macOS VM, twice each, while the host screen was locked (`CGSSessionScreenIsLocked=Yes` before and after every run). The user decided on 2026-11-14 that QA runs in such a VM by default wherever the machine has one set up, each run on a disposable clone, two at a time, onara first, and confirmed on 2026-11-15, after the host baseline, that the lane stays as planned for these three reasons.

## What Changes

- A VM lane in the shared driver. On a machine with a lane configuration (a machine-local file naming a golden lume image, an SSH key and the slot count) and in a repository whose configuration has a `vm` section, `preflight`, `desktop` and `flow` for `ios` and `desktop` run inside a VM leased by the current worktree; without a lease they refuse with the command that starts one, never falling back to the host. `--host` runs one command on the host as today.
- New commands `vm up TARGET...`, `vm down` and `vm status`. `vm up` takes one of at most two host-wide slots (or its worktree's existing lease, whose targets it withdraws first), runs the configuration's build for each target on the host, clones the golden image, boots it without a display or VNC, copies the worktree's files, a snapshot of the built artifacts, the driver itself and the dev credentials into the clone, forwards the backend port (when the configuration has a backend) from the guest to the host, installs the iOS app on a freshly created guest simulator or starts the desktop app in the guest's console session. Rerun on a live lease, it rebuilds, refreshes the copy and brings every target, the simulator and the port forward back to one known state. `vm down` deletes the clone with everything copied into it.
- A failed build or a missing artifact stops `vm up` before any VM starts, and on an existing lease leaves no target staged, so a stale build is never tested.
- Routed commands keep the caller's arguments byte for byte and its position in the worktree; `--config` and `--credentials` are refused in the lane. Output of a routed command reaches the caller redacted with the host's configured values, `--out` files are copied back to the host path under the host's existing rules, and the evidence scan stays a host command.
- Leases belong to one worktree. A third `vm up` refuses naming the holders, unless a lease has been idle longer than the configured limit, which it then reclaims. A clone without a lease is deleted by the next `vm up` or `vm status`.
- Android targets stay on the host (macOS guests cannot run the emulator).
- Configuration schema `app-qa/2`: `app-qa/1` plus the optional `vm` section (per target the artifact path and the build command, with a `{port}` placeholder, and desktop system properties with a `{credentials}` placeholder). The driver accepts both ids.
- Image provisioning: a reference document and guest scripts in the skill for building the golden image once per machine (unattended lume setup, pinned tools, Xcode and the iOS runtime streamed in, SIP off by one documented manual Recovery step, Screen Recording granted to Spectre's capture helper and the SSH responsible process). The image holds no repository and no credential.
- The team skill tells an agent to start the lane before QA, rebuild and refresh after a code change, and take it down at the end of the session.
- **Not in this change** (assumptions, recorded): onara's own configuration and QA skill get their `vm` section and build lines in a separate onara change; weaver follows later. Linux runners and Android are not covered. omp's `computer` prelude keeps acting on host windows only.

## Capabilities

### New Capabilities
- `app-qa-vm-lane`: running the shared driver's iOS and desktop commands for one worktree inside a disposable, leased macOS VM: lane configuration, leases and slots, staging, routing, output return, teardown and the image contract.

### Modified Capabilities
- `app-qa-driver`: the requirement "The driver runs only with a valid configuration of the current repository" accepts the schema ids `app-qa/1` and `app-qa/2` instead of one.

## Impact

- Changed: `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs` (schema 2, `vm` commands, routing, `--host`), its tests `qa.test.mjs` with fake `lume` and `ssh` on the test PATH, the guest-side `scripts/vm/start-target.mjs`, `team-config/agent/skills/app-qa-drivers/SKILL.md` (new section "VM lane", synopsis and configuration table), new `team-config/agent/skills/app-qa-drivers/vm-image.md` and `team-config/agent/skills/app-qa-drivers/scripts/vm/` (guest provisioning and grant scripts).
- New machine prerequisite where the lane is used: lume (pinned version) and a golden image; omp's `power.sleepPrevention` at least `idle`, because a sleeping host pauses the guest.
- Credentials: the dev credentials file is copied into a leased clone for the lease's lifetime. See gate.md.
- Deployment: `scripts/deploy-local.sh` mirrors `team-config/agent/**`; the machine-local lane file is user-owned and never installed.
- Consumers: every session using the shared driver; the routing changes behaviour only where both the machine file and a repository `vm` section exist.
