# Proposal

## Why

Agents run app QA autonomously, but the shared driver needs the host's own GUI session: desktop preflight fails on a locked screen (`team-config/agent/skills/app-qa-drivers/scripts/qa.mjs:619-620`), Spectre and the simulator need a logged-in WindowServer, and every flow run on the host takes one host-wide lock (`openspec/specs/app-qa-driver/spec.md:160`), so parallel worktrees queue on one simulator. A feasibility test on 2026-11-14 (`~/lume-qa/README.md`, not tracked) ran onara's iOS sign-in flow with Maestro and its desktop sign-in with Spectre inside a lume macOS VM, twice each, while the host screen was locked (`CGSSessionScreenIsLocked=Yes` before and after every run). The user decided on 2026-11-14 that QA runs in such a VM by default wherever the machine has one set up, each run on a disposable clone, two at a time, onara first.

## What Changes

- A VM lane in the shared driver. On a machine with a lane configuration (a machine-local file naming a golden lume image, an SSH key and the slot count) and in a repository whose configuration has a `vm` section, `preflight`, `desktop` and `flow` for `ios` and `desktop` run inside a VM leased by the current worktree; without a lease they refuse with the command that starts one, never falling back to the host. `--host` runs one command on the host as today.
- New commands `vm up TARGET...`, `vm down` and `vm status`. `vm up` takes one of at most two host-wide slots, clones the golden image, boots it without a display or VNC, copies the worktree's files, the host-built artifacts the configuration names, the driver itself and the dev credentials into the clone, forwards the backend port from the guest to the host, installs the iOS app on a guest simulator or starts the desktop app in the guest's console session. Rerun on a live lease, it refreshes the copy and restarts the apps. `vm down` deletes the clone with everything copied into it.
- An artifact older than the newest file of the worktree's copied files is refused, so a stale build is never tested.
- Output of a routed command reaches the caller redacted with the host's configured values, `--out` files are copied back to the host path under the host's existing rules, and the evidence scan stays a host command.
- Leases belong to one worktree. A third `vm up` refuses naming the holders, unless a lease has been idle longer than the configured limit, which it then reclaims. A clone without a lease is deleted by the next `vm up` or `vm status`.
- Android targets stay on the host (macOS guests cannot run the emulator).
- Configuration schema `app-qa/2`: `app-qa/1` plus the optional `vm` section (artifact paths per target, desktop system properties with a `{credentials}` placeholder). The driver accepts both ids.
- Image provisioning: a reference document and guest scripts in the skill for building the golden image once per machine (unattended lume setup, pinned tools, Xcode and the iOS runtime streamed in, SIP off by one documented manual Recovery step, Screen Recording granted to Spectre's capture helper and the SSH responsible process). The image holds no repository and no credential.
- The team skill tells an agent to start the lane before QA, rebuild and refresh after a code change, and take it down at the end of the session.
- **Not in this change** (assumptions, recorded): onara's own configuration and QA skill get their `vm` section and build lines in a separate onara change; weaver follows later. Linux runners and Android are not covered. omp's `computer` prelude keeps acting on host windows only.

## Capabilities

### New Capabilities
- `app-qa-vm-lane`: running the shared driver's iOS and desktop commands for one worktree inside a disposable, leased macOS VM: lane configuration, leases and slots, staging, routing, output return, teardown and the image contract.

### Modified Capabilities
- `app-qa-driver`: the requirement "The driver runs only with a valid configuration of the current repository" accepts the schema ids `app-qa/1` and `app-qa/2` instead of one.

## Impact

- Changed: `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs` (schema 2, `vm` commands, routing, `--host`), its tests `qa.test.mjs` with fake `lume` and `ssh` on the test PATH, `team-config/agent/skills/app-qa-drivers/SKILL.md` (new section "VM lane", synopsis and configuration table), new `team-config/agent/skills/app-qa-drivers/vm-image.md` and `team-config/agent/skills/app-qa-drivers/scripts/vm/` (guest provisioning and grant scripts).
- New machine prerequisite where the lane is used: lume (pinned version) and a golden image; omp's `power.sleepPrevention` at least `idle`, because a sleeping host pauses the guest.
- Credentials: the dev credentials file is copied into a leased clone for the lease's lifetime. See gate.md.
- Deployment: `scripts/deploy-local.sh` mirrors `team-config/agent/**`; the machine-local lane file is user-owned and never installed.
- Consumers: every session using the shared driver; the routing changes behaviour only where both the machine file and a repository `vm` section exist.
