# Proposal

## Why

The team skill `app-qa-drivers` tells agents to drive Compose Multiplatform apps through a driver script that addresses nodes by test tag, but the only such script is onara's `app_kmp/scripts/qa.mjs`. Weaver's app (`app/`, desktop, Android and iOS hosts of `:shell`) has no driver, and copying the 921-line script would leave two copies of the credential handling (redaction, sweep, scan) to drift apart. Only a handful of values in it are onara's: the desktop main class and launch command, the backend port property and health URL, the credentials file and its account keys, the expected-screen tags, the temporary-path prefixes and the chat sentinel. Everything else is driver mechanics every app needs.

## What Changes

- New shared driver `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs`, deployed with the skill to `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` and run from inside an app repository. Same commands as onara's driver: `preflight`, `desktop attach|tap|type|wait|find|capture|detach`, `flow`, `scan`.
- Per-repository configuration `.omp/app-qa.json` at the repository root (or `--config FILE`), versioned by a schema id. It names the desktop app (main class, launch hint), the optional backend (health URL, port property, start hint), the optional dev-credentials file and its accounts, the optional expected-screen tags, the optional Android SDK properties file and the optional scan sentinels. An unknown schema id, an unknown key or a missing required value stops every command with exit 2, so a deployed driver older than the repository's configuration fails loudly instead of running with defaults.
- Backend and credentials become optional: without a backend section preflight has no backend line; without a credentials section a flow runs with no credential in the driver's environment and refuses `--account`; the scan then looks for the token prefix and the configured sentinels only.
- One host-wide flow lock for every repository, `${TMPDIR}/app-qa/flow.lock` (pid file inside), because all repositories share the simulator and the emulator. App scripts that drive a device take the same lock.
- The desktop session belongs to the worktree and the configuration it was attached with, so two repositories or worktrees never act on each other's app, whatever their configurations are named.
- Fixes carried over from onara's merged change `kmp-qa-drivers` (non-blocking findings in its F2 record):
  - A flow whose named screenshots share a file name no longer loses one silently: the run copies none of them, names the file name and exits non-zero; any other copy error is reported as itself. A named screenshot the credential sweep deletes is reported and fails the run instead of disappearing.
  - The skill's "Submit natively" paragraph says a tap on the page's sign-in button can fail instead of "never submitted".
  - The skill's fresh-agent proof captures only tool-call arguments, driver output and the final report.
- Tests move with the driver (`qa.test.mjs`, fake `spectre`, `maestro`, `xcrun`, `adb`, `ioreg`, `ps`) and run in `bun run test:team-config`, against three fixture configurations: onara's values, a populated one with unrelated keys, accounts and screens, and a minimal one (desktop app only).
- The team skill documents the driver commands, the configuration file and the lock; the app repository's QA skill keeps only app values (tags, accounts, expected screens, launch steps, sign-in subflows).

Not in this change: onara's cutover (its config file, deleting `app_kmp/scripts/qa.mjs`, the onboarding runner's lock path) and weaver's adoption (its config file, Android test tags as resource ids, its app QA skill). Each is its own change in its own repository, after this one is merged and deployed.

## Capabilities

### New Capabilities
- `app-qa-driver`: the shared, configuration-driven QA driver for Compose Multiplatform apps (desktop through Spectre, iOS simulator and Android emulator through Maestro), its per-repository configuration, credential handling, flow lock and evidence scan, and the team skill that routes agents to it.

### Modified Capabilities

## Impact

- New: `team-config/agent/skills/app-qa-drivers/scripts/qa.mjs`, `qa.test.mjs` and test fixtures beside them; `package.json` `test:team-config` gains the test file.
- Changed: `team-config/agent/skills/app-qa-drivers/SKILL.md`.
- Deployment: `scripts/deploy-local.sh` already mirrors `team-config/agent/**`; nothing new to install. Drivers stay external and pinned (Spectre 0.9.0, Maestro 2.12.1); Node with global `fetch`, no npm dependencies.
- Consumers: none until onara and weaver add `.omp/app-qa.json`. Onara keeps running its own `app_kmp/scripts/qa.mjs` and its `${TMPDIR}/onara-qa/flow.lock` until its cutover change, so during that window the two drivers do not exclude each other on one device.
- Credentials: the driver reads real dev passwords of a remote identity provider (onara's Keycloak realm) from the main checkout's gitignored file and hands them to Maestro; its redaction, sweep and scan are the guard.
- Onara's roadmap follow-ups for the screenshot export (N1 and its adversarial criterion), the team skill's tap claim (N4 and strategic N1) and the fresh-agent captures (N5) are resolved here; onara's cutover change takes them into its own `## Follow-ups taken` so its archive removes them from `docs/roadmap/compose-multiplatform-migration.md`.
