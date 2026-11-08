# Design

## Context

See proposal.md for motivation. The starting point is onara's driver as merged on onara `main` at `a6807335b` (`app_kmp/scripts/qa.mjs`, 921 lines, and `qa.test.mjs`, 74 tests on fake `spectre`, `maestro`, `xcrun`, `adb`, `ioreg` and `ps`). Its app coupling, by line:

| Onara value | `qa.mjs` | Becomes |
|---|---|---|
| `MAIN_CLASS = 'eu.onara.app.MainKt'`, launch hint `./gradlew :desktopApp:run in app_kmp/` | `:40`, `:476-479` | `desktop.mainClass`, `desktop.launchHint` |
| `onara.devBackendPort` in `app_kmp/gradle.properties`, default 8080, `/actuator/health`, `backend_kt/` start hint | `:319-341` | `backend.*` (optional) |
| `.dev-credentials.env` at the main checkout's root, found from the script's own directory | `:134-139` | `credentials.file`, found from the working directory |
| `DEV_TEST_USERNAME[_N]`/`DEV_TEST_PASSWORD[_N]`, `--account 1\|2` | `:70-76`, `:709-732` | `credentials.accounts` |
| `EXPECT_TAGS = { home: 'home', onboarding: 'onboarding-welcome' }` | `:45` | `expect` (optional) |
| `sdk.dir` in `app_kmp/local.properties` for `adb` | `:250-261` | `android.sdkProperties` (optional) |
| `SENTINEL` | `:159`, `:222` | `scan.sentinels` (optional) |
| `${TMPDIR}/onara-qa/` (session file, `flow.lock`), prefixes `onara-qa-capture-`, `-out-`, `-flow-` | `:422-424`, `:504`, `:793-794` | fixed `app-qa` names (D4) |

Everything else (Spectre and Maestro invocation, version pins, redaction, sweep, scan, JUnit read, lock protocol, device choice) is app-independent and moves unchanged except where the requirements in `specs/app-qa-driver/spec.md` say otherwise. Team-config scripts run from the deployed copy under `~/.omp/agent/skills/` with plain `node` and no `node_modules`: every review-work script imports only Node built-ins (`team-config/agent/skills/review-work/scripts/*.mjs`), and `scripts/deploy-local.sh` mirrors `team-config/agent/**` without an install step.

Weaver's app (`/Users/tim/git/weaver/app`) has a desktop host `:shell` (main class `eu.weaver.app.shell.MainKt`, task `:shell:run`), Android `eu.weaver.app` and iOS `eu.weaver.app`, runs on fixtures and reaches no backend (`app/shell/build.gradle.kts:1-5`), so it uses the driver without backend and credentials.

## Goals / Non-Goals

**Goals:**
- One driver file both repositories run, its app values only in a configuration file each repository tracks.
- Onara's behaviour is reproducible with a configuration alone: every onara driver test passes against the shared driver and a fixture configuration with onara's values, except where a requirement of this change differs (screenshot name clash and swept screenshots, credential keys from the configuration, the desktop session per worktree, lock and temporary names).

**Non-Goals:**
- Changing the drivers or their pins (Spectre 0.9.0, Maestro 2.12.1).
- Sign-in subflows: they depend on the identity provider's page and stay in each app repository.
- Onara's cutover and weaver's adoption (separate changes).
- Windows or Linux hosts: the driver's checks (`ioreg`, `xcrun`) stay macOS-only as today.

## Decisions

### D1 Location and invocation
`team-config/agent/skills/app-qa-drivers/scripts/qa.mjs`, deployed with the skill and run as `node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs <command>` from anywhere inside an app repository or worktree. This is the review-work precedent (`node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs`, team-config README).
Alternatives: a copy per repository (the drift the proposal names); an npm package (needs a registry, a version bump per fix and an install in each repository; neither repository has a Node project at its root); a Git submodule (another moving part in every worktree, `seed-worktree` would have to initialise it).

### D2 Configuration file
`.omp/app-qa.json` at the root of the repository holding the working directory (`git rev-parse --show-toplevel`), overridable with `--config FILE`. `.omp/` is tracked in both repositories (`git check-ignore` finds no rule for the path in either). Schema `app-qa/1`:

```json
{
  "schema": "app-qa/1",
  "name": "onara",
  "desktop": { "mainClass": "eu.onara.app.MainKt", "launchHint": "./gradlew :desktopApp:run in app_kmp/" },
  "backend": {
    "healthUrl": "http://127.0.0.1:{port}/actuator/health",
    "defaultPort": 8080,
    "portProperty": { "file": "app_kmp/gradle.properties", "key": "onara.devBackendPort" },
    "startHint": "SPRING_PROFILES_ACTIVE=local ./gradlew bootRun in backend_kt/ (SERVER_PORT=<port> when 8080 is taken)"
  },
  "credentials": {
    "file": ".dev-credentials.env",
    "accounts": {
      "1": { "user": "DEV_TEST_USERNAME", "password": "DEV_TEST_PASSWORD" },
      "2": { "user": "DEV_TEST_USERNAME_2", "password": "DEV_TEST_PASSWORD_2" }
    },
    "defaultAccount": "1"
  },
  "expect": { "default": "home", "tags": { "home": "home", "onboarding": "onboarding-welcome" } },
  "android": { "sdkProperties": "app_kmp/local.properties" },
  "scan": { "sentinels": ["SENTINEL"] }
}
```

- Required: `schema`, `name` (`[a-z0-9-]+`, the repository's name in messages, such as the holder named by a refused flow lock). Every section is optional; a command that needs an absent section (desktop commands without `desktop`, `--account` without `credentials`, `--expect` without `expect`) exits 2 naming it.
- Validation is strict: an unknown key at any level, a wrong type, a missing required value inside a present section, a `healthUrl` without `{port}`, a `defaultAccount` or `expect.default` the map lacks, or an absolute or `..` path in `file`/`sdkProperties` is a configuration error, exit 2, before any other action. A misspelled optional key would otherwise silently drop a check or a redaction.
- Paths in `backend.portProperty.file` and `android.sdkProperties` are relative to the repository (worktree) root; `credentials.file` is relative to the main checkout's root, as today (`qa.mjs:134-139`), found from the working directory's `git rev-parse --git-common-dir` instead of the script's directory, which is now outside the repository.
- The schema id is the compatibility contract between the deployed driver and the repository: a repository that needs a new field raises it to `app-qa/2` in the same team-config change that teaches the driver `app-qa/2`, and an older deployed driver stops with "redeploy team config" instead of ignoring the field.
Alternatives: JavaScript config module (executes repository code in the driver's process, which holds the credentials); keys in each repository's `gradle.properties` (desktop only, and weaver's backend-free build has nothing to say about credentials); lenient parsing with defaults (the failure mode above).

### D3 Credential values
The redaction, sweep and scan set is the values of every key `credentials.accounts` names, not onara's `DEV_TEST_*` key pattern (`qa.mjs:70-76`). The configuration is the one list of the accounts a flow can hand to Maestro; a value no account names never reaches Maestro, so the sweep has nothing of it to find. Onara's cutover configuration lists both of its accounts. The credentials file grammar stays onara's port of `DevPasswordSignIn.readCredentials` (onara change `kmp-qa-drivers`, design "credentials file read"). Without `credentials`, the flow environment drops any inherited `MAESTRO_DEV_USER`/`MAESTRO_DEV_PW` so a value exported in the caller's shell cannot reach a flow that redacts nothing; without `expect`, it likewise drops an inherited `MAESTRO_EXPECT_TAG`.

Holders and sinks, found by searching onara's `qa.mjs` at `a6807335b` for every read of the credentials file, the parsed object, the value set, `say`/`complain`, `process.env` and the child's streams and files:

| Holder or sink | `qa.mjs` | Guard in the shared driver |
|---|---|---|
| Credentials file bytes and parsed object | `:55-67`, `:141-148` | read once per command from the resolved path; never printed; a read error prints the path only |
| Credential value set | `:70-76` | `credentialValues(config, parsed)`: the values of every key of every configured account, selected or not; the only input of `redact`, `sweepRoot` and `fileHit` |
| Driver stdout and stderr | `:150-152` | every line through `redact` |
| Desktop and preflight lines, forwarded Spectre stderr | `:368-369`, `:437-438`, `:912-914` | the same value set loaded before the command runs, so forwarded tool output passes `redact` |
| Maestro's environment and argv | `:802-805`, `:810-811` | the selected account's two values in `MAESTRO_DEV_USER`/`MAESTRO_DEV_PW` only; argv holds no value |
| Maestro's stdout and stderr | `:811-818` | a line sink into `console.log` through `redact`; never the terminal |
| Maestro files in the root (`commands*.json`, `maestro.log`, `report.xml`, debug output, screenshots, JVM temp) | `:806-810`, `:840` | `sweepRoot` over the whole root before anything is kept or copied |
| Exported screenshots | `:849-860` | `fileHit` after the copy; a flagged copy is deleted and counts as not copied (D6) |
| `scan` output | `:208-227` | file names only |

Chokepoints: `credentialValues` (one set), `redact` (every printed or logged line), `sweepRoot` (every kept file), `fileHit` (sweep, export and scan). No other code reads the parsed credentials. Excluded: the lock's `pid` file and the desktop session record hold process ids, paths and Spectre's session id only.

### D4 Host-wide names
- `${TMPDIR}/app-qa/` (mode 0700) holds `flow.lock/` (a directory created with one atomic `mkdir`, then a `pid` file holding the holder's process id and the configuration's `name`) and `sessions/KEY.json`. The lock is one for the host because every repository's flows share the booted simulator and emulator.
- The desktop session belongs to a worktree, not to a name: `KEY` is the first 16 hex digits of the SHA-256 of the worktree root's real path (`git rev-parse --show-toplevel`, then `realpath`). Two worktrees of one repository get two sessions, because each may run its own build of the app; two repositories with the same `name` never share one. The record holds that root, the real path of the configuration file in force, `desktop.mainClass`, the attached pid and Spectre's session id. Every later desktop command, `detach` included, compares the root, configuration path and main class with its own; a difference exits 2 with "attached with CONFIG for MAINCLASS; attach again" and touches neither the record nor Spectre.
- Temporary prefixes `app-qa-flow-`, `app-qa-out-`, `app-qa-capture-`.
- An app script that drives a device takes the same lock with `mkdir "${TMPDIR%/}/app-qa/flow.lock"` and writes its pid into it, as onara's `maestro-onboarding.sh:61-95` does today for its own path; the skill documents the contract.

### D5 Backend health
URL from `healthUrl` with `{port}` replaced by `--port`, else the value of `portProperty` in its file, else `defaultPort`. Healthy means HTTP 2xx and, when the body is a JSON object with a string `status`, that status is `UP`; a reachable backend answering 2xx with `{"status":"DOWN"}` fails. Onara's actuator check (`qa.mjs:334-337`) is the case this keeps.

### D6 Named screenshot export
Before the sweep, the run records the manifest of named screenshots below `out/**/takeScreenshot/` (each file name with every source relative to the root). The sweep then runs as onara's does. The passing run groups the manifest by file name; a manifest entry the sweep deleted prints `flow: screenshot NAME removed by the sweep`, is not copied, and the run exits 1 without `PASS`; a name with several manifest sources stays a clash even when the sweep deleted one of them. Every copy is checked with `fileHit` after copying; a flagged copy is deleted, printed as `sweep:` with its name, and the run exits 1 without `PASS`. Otherwise grouping works as follows. A name with more than one source is not copied; the run prints `flow: screenshot NAME taken N times (SRC1, SRC2)`, sources relative to the root, copies the other names, removes the root and exits 1 without `PASS`. A copy that fails for another reason prints `flow: screenshot NAME not copied: CODE` and exits 1. Carried from onara's F2 implementation-audit N1 and its adversarial criterion.
Alternative: keep the relative path in the exported name. Rejected: callers name screenshots for the evidence they want (`home.png`); a renamed copy breaks that reference silently, a refusal does not.

### D7 Tests
`scripts/qa.test.mjs` beside the driver, ported from onara's suite with its fake binaries, using three fixture configurations written by the tests: `onara` (the values above, synthetic credentials), `foreign` (every section, with keys and names unrelated to onara: accounts `alpha` and `beta` keyed `QA_ALPHA_LOGIN`/`QA_ALPHA_SECRET` and `QA_BETA_LOGIN`/`QA_BETA_SECRET`, `defaultAccount` `beta`, `expect.default` `start` with tags `start: start-screen` and `welcome: welcome-card`, sentinel `CANARY`, a different main class and credentials file name) and `minimal` (`schema`, `name`, `desktop` only). Every credential, expect and scan test that has a populated configuration runs on `foreign`; onara's ported tests run on `onara`. A credential sentinel test runs one flow on `foreign` whose fake Maestro writes both accounts' values (the unselected `alpha` included) to stdout, stderr, `commands-x.json`, `maestro.log`, `report.xml` (XML-escaped), a binary screenshot and a JVM temp file, then asserts that the driver's stdout and stderr, every kept root file and every exported file hold none of them, raw, JSON-escaped or XML-escaped, on a failing and on a passing run; the `minimal` run with `MAESTRO_DEV_USER`, `MAESTRO_DEV_PW` and `MAESTRO_EXPECT_TAG` exported by the caller asserts the fake Maestro saw none. Broken copies through `QA_UNDER_TEST`: one keeping onara's `DEV_TEST_*` key pattern in `credentialValues`, one keeping account `1` and screen `home` as defaults, one redacting only the selected account; the suite fails each. `QA_UNDER_TEST` stays, so each negative control runs the suite against a broken copy. Added to `package.json` `test:team-config` (`bun test`), the runner the other team-config scripts use (`gate-convergence.test.mjs` is a `node:test` file run by it); the suite also runs under `node --test` because the driver itself runs under Node.

### D8 Skill
`app-qa-drivers/SKILL.md` gains the driver's command synopsis, the configuration schema and the lock contract, and drops "the app's preflight command"/"the app's evidence scan" wording in favour of the shared commands. The app repository's QA skill keeps tags, accounts, expected screens, launch steps and its sign-in subflows. "Submit natively" says a tap on the page's button can fail, citing onara's tap-submit control; "Proving a QA instruction change" keeps only tool-call arguments, driver output and the final report in a capture (onara F2 N4, strategic N1, N5).

### Build vs. adopt: configuration validation
- Repository: `zod` and `@sinclair/typebox` (`packages/omptype/package.json:35`) are installed in the workspace's `node_modules`, but only workspace packages can import them: the deployed skill runs from `~/.omp/agent/skills/` with no `node_modules`, and every review-work script imports only Node built-ins (`team-config/agent/skills/review-work/scripts/*.mjs`).
- Platform: `JSON.parse` (https://nodejs.org/api/globals.html, ECMAScript JSON); Node has no schema validator.
- Candidates: **ajv** (https://github.com/ajv-validator/ajv): 8.20.0, 2026-04-24 (npm, deps.dev), MIT, maintained. Reject, gap: the deployed skill runs from `~/.omp/agent` without `node_modules`, so ajv would have to be vendored into the skill or installed per machine, for a fixed schema of eight sections that a hand check covers with exact error messages.
- Decision: build, gap: validating one fixed, versioned configuration shape inside a dependency-free deployed script.

### Build vs. adopt: flow run lock
- Repository: `packages/utils/src/file-lock.ts:1-6,43-57` (`tryAcquireFileLock`, `acquireFileLock`) is a cross-process lock backed by the native module `@oh-my-pi/pi-natives` (`flock(2)` on macOS); it is a workspace package, so the deployed `qa.mjs`, which runs under `node` from `~/.omp/agent/skills/` without `node_modules`, cannot import it, and an app's Bash script (onara's `maestro-onboarding.sh`) cannot take the same lock: `flock(1)` does not ship with macOS. No other lock helper in `team-config/` or `scripts/`. Onara's `qa.mjs:621-652` holds the `mkdir` lock this change moves.
- Platform: Node's `fs.mkdirSync` fails with `EEXIST` when the directory exists (https://nodejs.org/api/fs.html#fsmkdirsyncpath-options), and POSIX `mkdir` is atomic, so Node and Bash share one lock.
- Candidates: **proper-lockfile** (https://github.com/moxystudio/node-proper-lockfile): 4.1.2, 2021-01-25 (npm, deps.dev), MIT, no release since 2021-01-25. Reject, gap: an npm dependency the deployed script cannot load, and it reclaims stale locks itself, which onara's lock contract forbids (a stale lock is reported with its removal command, D4).
- Decision: adopt the platform's atomic `mkdir`, in onara's implementation (`qa.mjs:621-652`) moved with D4's names.

### Build vs. adopt: evidence secret scan
- Repository: `packages/coding-agent/src/secrets/` (`patterns.ts:38-61` `CREDENTIAL_PREFIX_RULES`, `CREDENTIAL_PATTERNS`; `obfuscator.ts`) masks generic credential shapes in agent transcripts; it does not match known exact values with their JSON- and XML-escaped forms, and it is workspace TypeScript the deployed script cannot import. Onara's `qa.mjs:154-229` implements the exact-value scan this change moves.
- Platform: none; searched https://nodejs.org/api/ (no secret or pattern scanner beyond `RegExp`).
- Candidates: **gitleaks** (https://github.com/gitleaks/gitleaks): v8.30.1, 2026-02-21 (Go module `github.com/zricethezav/gitleaks/v8`, deps.dev), MIT, maintained (30.7k stars, deps.dev project). Reject, gap: it matches generic secret patterns; matching the configured accounts' values needs them in a gitleaks configuration file or argv, which the credential requirements forbid.
- Decision: build, gap: exact-value matching of the configured credentials (raw, JSON-escaped, XML-escaped) without placing a value in argv or a file; onara's implementation moved, its value set taken from the configuration (D3).

### Build vs. adopt: JUnit report read
- Repository: `packages/utils/src/xml.ts:54` (`XMLParser`) is workspace TypeScript, not importable by the deployed script. Onara's `qa.mjs:609-619` reads the two fields the driver needs.
- Platform: none; Node's standard library has no XML parser (searched https://nodejs.org/api/; `DOMParser` is browser-only).
- Candidates: **fast-xml-parser** (https://github.com/NaturalIntelligence/fast-xml-parser): 5.12.0, 2026-11-03 (npm, deps.dev), MIT, maintained. Reject, gap: an npm dependency the deployed script cannot load, to read two fields of a single-testcase report.
- Decision: build, gap: reading `testcase@time` and `failure@message` (the five XML entities decoded) from Maestro's one-testcase report; onara's implementation moved unchanged.

### Build vs. adopt: credentials file read
- Repository: `packages/utils/src/env.ts:267-287` (`parseEnvFile`) parses with the runtime's `util.parseEnv`, drops unsafe values and swallows read errors; workspace TypeScript, not importable by the deployed script. Onara's `qa.mjs:55-67` ports `DevPasswordSignIn.readCredentials`, the reader onara's desktop app signs in with.
- Platform: Node's `util.parseEnv` (https://nodejs.org/api/util.html#utilparseenvcontent): onara's change checked it on Node v26.13.0 with synthetic lines; it cuts an unquoted value at ` #`, ends a double-quoted value at an escaped quote, and lets an empty later definition replace an earlier value, each unlike `readCredentials`.
- Candidates: **dotenv** (https://github.com/motdotla/dotenv): 18.0.9, 2026-10-22 (npm, deps.dev), BSD-2-Clause, maintained. Reject, gap: an npm dependency the deployed script cannot load, and its grammar also treats ` #` as a comment.
- Decision: adopt onara's port of `readCredentials` unchanged. Gap of the platform reader: the values the driver hands to Maestro and redacts must equal, byte for byte, the values the app signs in with, or a password containing ` #` or a quote would leak unredacted.

### Scope
Two subsystems: the driver script with its tests, and the skill text that routes agents to it. They ship together because the skill documents the driver's commands and configuration; a skill without the driver, or the driver without its documented contract, routes agents to nothing.

## Risks / Trade-offs

- [The deployed driver is whatever `deploy-local.sh` copied last; a teammate who has not redeployed runs an older driver] → the schema id refuses a configuration the driver does not know, and the refusal names both schema ids and the redeploy (D2, spec "The driver runs only with a valid configuration").
- [Credential keys come from the configuration, so a third account added to the credentials file but not to the configuration is not redacted] → it cannot reach Maestro either (D3); the skill's configuration section says to list every account a flow uses.
- [Until onara's cutover, onara's driver locks `${TMPDIR}/onara-qa/flow.lock` and the shared driver `${TMPDIR}/app-qa/flow.lock`: a weaver flow and an onara flow could run on one emulator at once] → both still refuse an unlocked Maestro test run they can see in `ps` (`maestroTestPids`), which catches a run that already started; the window closes with onara's cutover change, which the proposal sequences right after this one.
- [`bun test` differs from `node --test` in corner cases of `node:test`] → task 1.9 runs the suite under both; a difference is fixed in the test, not by dropping one runner.
- [Test files and fixtures are deployed into `~/.omp/agent/skills/app-qa-drivers/scripts/` with the driver] → the review-work precedent ships its tests the same way; fixtures hold synthetic values only.

## Migration Plan

1. Merge and deploy (`scripts/deploy-local.sh`); nothing uses the driver yet.
2. Onara cutover change: `.omp/app-qa.json` with the values in D2, `maestro-onboarding.sh` on the `app-qa` lock, delete `app_kmp/scripts/qa.mjs` and its tests, repository skill and rule pointing to the shared driver.
3. Weaver adoption change: `.omp/app-qa.json` (`desktop` for `:shell`, `android.sdkProperties` if needed, no backend, no credentials), Android root `testTagsAsResourceId`, its app QA skill.
Rollback: revert this change and redeploy; no repository depends on it until step 2.
