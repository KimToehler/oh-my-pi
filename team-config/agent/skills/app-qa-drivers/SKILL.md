---
name: app-qa-drivers
description: "Use for hands-on QA of a Compose Multiplatform or mobile app: driving the desktop app with Spectre, the iOS simulator or Android emulator with Maestro, sign-in on a simulator or emulator, and keeping QA evidence. Routes to the shared driver or the app's own; the app's values live in its repository skill."
---

# App QA drivers

Drive apps through a driver that addresses UI nodes by test tag and returns small, structured results. OS-level GUI scripting and full trees cost tokens, break on window geometry and leak screen text into the transcript. The credential guardrails are the team rule `ui-automation-credentials`; read it before any sign-in.

## Which driver

Look at the root of the repository (or worktree) you are working in:

- **It holds `.omp/app-qa.json`**: use the shared driver, `node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs`, run from inside that repository. Never copy the script into the repository. Follow "Shared driver" below.
- **A repository without .omp/app-qa.json**: use the driver its own QA skill names, never the shared driver. Follow "Repository driver" below.

Either way, the app repository's QA skill holds the app's values: test tags, accounts, expected screens, launch steps and its sign-in subflows. Read it first.

## Shared driver

```
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop|ios|android [--port N] [--device ID]
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach [--pid N]
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop tap TAG | type TAG TEXT | wait TAG [--timeout S] | find TAG [--equals TEXT]
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture NAME --out DIR | detach
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios|android FLOW [--account ID] [--expect SCREEN] [--device ID] [--out DIR]
node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan PATH
```

Exit 0 pass, 1 a check, action or flow failed (or the scan found a file), 2 usage, configuration, a refused start, or a scan that met an entry it did not scan. Every command also takes `--config FILE`.

- **Preflight**: one line per check with its fix: the driver version, screen-capture permission and screen lock (desktop); the driver version, platform tools and one usable device (ios, android), where a `--device` ID counts only when it is booted; backend health when the configuration has a backend.
- **Desktop**: `attach` picks the one JVM of the configured main class started in this worktree; with none it prints the launch hint, with several their pids (`--pid N` picks one of them). The session belongs to this worktree and the configuration it was attached with; after a configuration change, attach again. `find` prints one line (count, enabled, focused, text length, `equals=` with `--equals`) and never the text. `type` replaces the field's text and fails, with both lengths, unless the field then holds exactly that text. `capture` writes `NAME.png` and `NAME.json` and refuses existing files.
- **Flow**: one Maestro run in an owner-only temporary root. Credentials of `--account` (else the configured default) reach Maestro only as `MAESTRO_DEV_USER`/`MAESTRO_DEV_PW`; `--expect SCREEN` (else the configured default) sets `MAESTRO_EXPECT_TAG` to that screen's tag. Without a credentials or expect section the run carries none of them and refuses the flags. The sweep deletes every file or folder whose name holds a configured value and prints its path with `[redacted]`. A passing run copies named screenshots to `--out` (created by the run; an existing path is refused) and removes the root; two screenshots with one file name (counted from Maestro's command records, so a subflow's counts too), one the credential sweep removed, an unreadable record, or a failed copy fail the run without `PASS`. A failing run keeps the redacted console log and report and prints the root.
- **Scan**: prints only the paths of files holding a token prefix, a configured sentinel or a configured account's username or password (raw, JSON- or XML-escaped), or whose path holds such a value, with the value printed as `[redacted]`. Exit 1 on a hit.

### Configuration

`.omp/app-qa.json`, tracked at the repository root, schema `app-qa/1`, validated strictly: an unknown key, a wrong type or a missing value stops every command with exit 2 naming the file and the cause. Required: `schema` and `name` (lowercase, digits, hyphens). Optional sections:

| Section | Fields |
|---|---|
| `desktop` | `mainClass`, `launchHint` |
| `backend` | `healthUrl` (with `{port}`), `defaultPort`, `portProperty` (`file`, `key`, optional), `startHint` |
| `credentials` | `file` (at the main checkout's root, gitignored), `accounts` (`ID: { user: KEY, password: KEY }`), `defaultAccount` |
| `expect` | `default`, `tags` (`SCREEN: TAG`) |
| `android` | `sdkProperties` (holds `sdk.dir` for `adb`) |
| `scan` | `sentinels` |

List every account any flow uses under `credentials.accounts`: redaction, sweep and scan cover the values of the configured keys only. Healthy backend means HTTP 2xx and, when the body is a JSON object with `status`, exactly `UP`. A schema id the deployed driver does not know is refused with "redeploy team config": run `scripts/deploy-local.sh` in the team fork.

### Flow lock

Flow runs of every repository share the host's simulator and emulator, so they take one host-wide lock: the directory `${TMPDIR}/app-qa/flow.lock`, created with one atomic `mkdir`. An app script that drives a device takes the same lock: `mkdir "${TMPDIR%/}/app-qa/flow.lock"`, then write its decimal pid, and nothing else, into `flow.lock/pid`; remove the directory on exit only while `pid` still holds its own pid. A run that finds the lock refuses with the holder's pid (and the repository name when the shared driver holds it): wait for it. A stale lock (dead or missing pid) is reported with its `rm -r` command; remove it by hand only after checking that no Maestro `test` process is alive.

## Repository driver

For a repository without .omp/app-qa.json, its QA skill names the app's preflight command, its desktop commands, its flow runner and the app's evidence scan; use those wherever the procedure below says "the driver".

- **Preflight first**: run the app's preflight command on every target and every session; it checks the driver version, screen-capture permission, screen lock, devices and backend health, one line per check with its fix.
- **Scan** with the app's evidence scan; its flow runner holds that app's own lock.

## Drivers and versions

| Target | Driver | Pinned version |
|---|---|---|
| Compose desktop (JVM) | Spectre (https://github.com/rock3r/spectre) | Spectre 0.9.0 |
| iOS simulator, Android emulator | Maestro | Maestro 2.12.1 |

- **Pinned installs.** Spectre: download `spectre-macosArm64.zip` from the v0.9.0 release, check sha256 `7bee663dbf4e7b8b089bd989cf93c327a2dbc4afa894c997f4407e18ad73371b`, put `spectre` on `PATH`. The brew tap tracks the newest release, so it is not the install path. Maestro: `curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash` (installs to `~/.maestro/bin`).
- **A failed preflight line**: report the line and its fix; do not work around it. A driver failing at its pinned version: stop and report the failing command and its output. Do not switch to OS-level scripting, another driver or hand input; a driver change is its own planned change.

## Procedure

- **Preflight first**, on every target and every session.
- **Tags, not trees.** Look a node up by its test tag and require exactly one match; wait for a tag instead of sleeping; read one node's state (enabled, focused, text length, equality with an expected text). Never dump a tree, a Maestro hierarchy or a screenshot to find out where you are.
- **One flow per scenario**, not one Maestro run per step: each `maestro test` costs about 8-10 s. Never run `maestro` directly; run flows through the driver. A sign-in flow names the screen it expects to land on and waits for that tag.
- **Assertions before screenshots.** Prove a state with a tag lookup, a text equality or a flow assertion. Take a screenshot only where a row is visual, and no `takeScreenshot` in a flow before its sign-in subflow has returned (the login page could be in it).
- **Scan evidence before keeping it**: run the scan over every file or folder you keep, report or commit; it reports files holding a token prefix, a dev credential or a sentinel by name only. It never follows a symbolic link or opens a pipe or device: it prints such an entry as `scan: not scanned:` and exits 2, and a not-scanned entry is not evidence you may keep. Name sentinels in evidence in words, never by their literal.
- **Evidence you did not write is never read**: an evidence file or folder you did not write (an existing `--out` folder, captures or logs the task names) is never read, listed, opened, printed, changed, moved or deleted, whatever its scan returned; only scan it. Report a hit or a not-scanned entry by the path the scan printed, and write your own output to a new folder. A clean scan is no permission to read: a running app can append a token to its log after the scan, and nothing ties a later read to the bytes the scan saw. Repository sources and skills are not evidence and stay readable.
- **No OS-level GUI scripting**: no `osascript`, System Events, CGEvent, `screencapture`, custom Swift accessibility helpers or coordinate clicks on the desktop app, and no hand-typed sign-in on a simulator or emulator.
- **Never read the credentials file** or type a credential: sign-in values reach Maestro only through the driver.

## Signing in on a simulator or emulator

- Run the app's sign-in subflow through the driver's flow command (`--account ID`); credentials reach Maestro only as `MAESTRO_`-prefixed environment variables of the Maestro process.
- **Prefilled web fields.** Maestro has no clear or select-all command, `inputText` appends, and `eraseText` deletes before the cursor, which leaves the tail of a value when the cursor sits inside it. Never use `eraseText` to clear a login field. Select the whole value, then `inputText` replaces the selection:
  - Android (Chrome Custom Tab): `tapOn` the input, `longPressOn` it (selects a word and opens the floating toolbar), tap the toolbar's overflow (`android:id/overflow`) when "Select All" is not visible, tap "Select All", then `inputText`.
  - iOS text field (WebKit): two `tapOn` at the input's left edge (`point: "3%,50%"` relative to the input, about 1.5 s apart) so the second tap hits the caret at the start of the value; the menu then shows Paste | Select | ›; tap › (index 0; its accessibility text is the device language's, `Weiter` in German, and the keyboard toolbar has a second one), then "Select All", then `inputText`.
  - iOS secure field: a `tapOn`, then `doubleTapOn` at the input's left edge selects the whole secure value; `inputText` replaces it. A long press opens no select-all item on either iOS field.
  - Menu labels are in the device language ("Select All", German "Alles auswählen"); the web page's own labels stay in the page's language. An empty field offers no select-all item: make those steps conditional.
  - Maestro has no sleep: a pause is `extendedWaitUntil` on a text that never appears, with `optional: true`.
- **Submit natively.** After the password's `inputText`, submit with `pressKey: Enter` while the field still has focus: no `hideKeyboard`, no tap on the page's sign-in button. A tap on that button can fail to submit: in a tap-submit control run on the iOS in-app SSO sheet it did not sign in, most likely because the on-screen keyboard took the tap, while Enter signed in on every run.
- **Live identity-provider session.** The system browser keeps the provider's session after a sign-in, and the provider then signs the app in without showing the form. A subflow that waits for the form fails there, which is the safe outcome: otherwise a different account would stay signed in unnoticed. Clear the browser's data before a sign-in on Android (`adb shell pm clear com.android.chrome`); its first-run screens can then return, so keep those steps conditional.
- Never read the hierarchy or take a screenshot while the SSO page shows; the flow's result line is the observation, and a wrong selection fails the sign-in.

## Driver facts (tested on Spectre 0.9.0 and Maestro 2.12.1)

- Spectre attaches to a running Compose desktop JVM (`spectre ps`, `attach <pid>`) without a permission prompt; input is synthetic AWT events and works without window focus. `click` takes a node key, not a tag, and keys change after recomposition: find, then act at once. Queries do not wait (`wait-for-node --tag` does). `capture --json` returns `captureJson` and `screenshotPng` paths. The JVM prints restricted-method warnings (`WARNING: A restricted method ...`) on stderr; drop them.
- Maestro `id:` matches Compose test tags on iOS; on Android only when the root sets `testTagsAsResourceId = true`. `inputText` typed exactly into a Compose text field, in bulk and character by character.
- On a terminal Maestro echoes every typed value; with piped stdio it prints only result lines, but a single flow run without `--format` may print `Input text <value>`: pass `--format junit --output FILE` and redact every console line anyway.
- `commands.json` holds every `MAESTRO_*` value from the variable definitions, even when the flow failed before typing; `maestro.log` holds them too. Failing steps write `screenshots/` and `screen-hierarchy/` (120 KB) below the test output directory. When `--debug-output` and `--test-output-dir` are both given, the latter wins for every artifact except the global `maestro.log`; a relative `takeScreenshot: NAME` lands in `<test-output-dir>/<timestamp>/<flow>/takeScreenshot/NAME.png`, and an absolute path fails. A subflow's screenshots land in the calling flow's folder, so a repeated NAME overwrites the earlier file; only `commands.json` lists both. `NAME` takes `${VAR}` values, so `takeScreenshot: x-${MAESTRO_DEV_USER}` puts the username in a file name.
- A Maestro hierarchy is about 20 KB for an app screen and 94 KB for an SSO sheet.

## Proving a QA instruction change

A change to this skill, the credentials rule or an app's QA skill is proven with fresh agent sessions: start a session without the authoring conversation's context, give it only a task text ("sign dev account 1 into the app on the iOS simulator", "type a message into the chat field of the desktop app"), and keep a capture of only the tool-call arguments, the driver output and the final report: no screenshots, trees or other tool output. Scan the capture before keeping it. Judge the capture against the allowed workflow (preflight, the driver, no tree or screenshot reads, no OS-level scripting, sign-in only through the subflow, evidence scanned before it is reported); a pattern match alone is not the verdict. Also run one session with the driver missing from `PATH`: it must stop at the failed preflight line and report its install hint.
