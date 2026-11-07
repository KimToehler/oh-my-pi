---
name: app-qa-drivers
description: "Use for hands-on QA of a Compose Multiplatform or mobile app: driving the desktop app with Spectre, the iOS simulator or Android emulator with Maestro, sign-in on a simulator or emulator, and keeping QA evidence. Procedure and driver facts; the app's own commands and values live in its repository skill."
---

# App QA drivers

Drive apps through a driver that addresses UI nodes by test tag and returns small, structured results. OS-level GUI scripting and full trees cost tokens, break on window geometry and leak screen text into the transcript. The credential guardrails are the team rule `ui-automation-credentials`; read it before any sign-in. The app's commands (its driver script), test tags, accounts and expected screens are in the app repository's QA skill; look there first.

## Drivers and versions

| Target | Driver | Pinned version |
|---|---|---|
| Compose desktop (JVM) | Spectre (https://github.com/rock3r/spectre) | Spectre 0.9.0 |
| iOS simulator, Android emulator | Maestro | Maestro 2.12.1 |

- **Preflight first**, on every target and every session: the app's preflight command checks the driver version, screen-capture permission, screen lock, devices and backend health, one line per check with its fix.
- **Pinned installs.** Spectre: download `spectre-macosArm64.zip` from the v0.9.0 release, check sha256 `7bee663dbf4e7b8b089bd989cf93c327a2dbc4afa894c997f4407e18ad73371b`, put `spectre` on `PATH`. The brew tap tracks the newest release, so it is not the install path. Maestro: `curl -Ls https://get.maestro.mobile.dev | MAESTRO_VERSION=2.12.1 bash` (installs to `~/.maestro/bin`).
- **A driver failing at its pinned version:** stop and report the failing command and its output. Do not switch to OS-level scripting, another driver or hand input; a driver change is its own planned change.

## Procedure

- **Tags, not trees.** Look a node up by its test tag and require exactly one match; wait for a tag instead of sleeping; read one node's state (enabled, focused, text length, equality with an expected text). Never dump a tree, a Maestro hierarchy or a screenshot to find out where you are.
- **One flow per scenario**, not one Maestro run per step: each `maestro test` costs about 8-10 s. A sign-in flow names the screen it expects to land on and waits for that tag.
- **Assertions before screenshots.** Prove a state with a tag lookup, a text equality or a flow assertion. Take a screenshot only where a row is visual, and no `takeScreenshot` in a flow before its sign-in subflow has returned (the login page could be in it).
- **Scan evidence before keeping it**: run the app's evidence scan over every file or folder you keep or commit; it reports files holding a token prefix, a dev credential or a chat log sentinel by name only. Name sentinels in evidence in words, never by their literal.
- **No OS-level GUI scripting**: no `osascript`, System Events, CGEvent, `screencapture`, custom Swift accessibility helpers or coordinate clicks on the desktop app, and no hand-typed sign-in on a simulator or emulator.
- **Serialized flow runs.** Two Maestro runs against one device interfere, so the app's flow runner holds one host-wide lock. A refusal names the holder's pid: wait for it. A stale lock (dead or missing pid) is reported with its `rm -r` command; remove it by hand only after checking that no Maestro `test` process is alive.

## Signing in on a simulator or emulator

- Use the app's sign-in subflow through its flow runner; credentials reach Maestro only as `MAESTRO_`-prefixed environment variables of the Maestro process.
- **Prefilled web fields.** Maestro has no clear or select-all command, `inputText` appends, and `eraseText` deletes before the cursor, which leaves the tail of a value when the cursor sits inside it. Never use `eraseText` to clear a login field. Select the whole value, then `inputText` replaces the selection:
  - Android (Chrome Custom Tab): `tapOn` the input, `longPressOn` it (selects a word and opens the floating toolbar), tap the toolbar's overflow (`android:id/overflow`) when "Select All" is not visible, tap "Select All", then `inputText`.
  - iOS text field (WebKit): two `tapOn` at the input's left edge (`point: "3%,50%"` relative to the input, about 1.5 s apart) so the second tap hits the caret at the start of the value; the menu then shows Paste | Select | ›; tap › (index 0; its accessibility text is the device language's, `Weiter` in German, and the keyboard toolbar has a second one), then "Select All", then `inputText`.
  - iOS secure field: a `tapOn`, then `doubleTapOn` at the input's left edge selects the whole secure value; `inputText` replaces it. A long press opens no select-all item on either iOS field.
  - Menu labels are in the device language ("Select All", German "Alles auswählen"); the web page's own labels stay in the page's language. An empty field offers no select-all item: make those steps conditional.
  - Maestro has no sleep: a pause is `extendedWaitUntil` on a text that never appears, with `optional: true`.
- **Submit natively.** After the password's `inputText`, submit with `pressKey: Enter` while the field still has focus: no `hideKeyboard`, no tap on the page's sign-in button. On the iOS in-app SSO sheet that tap never submitted (most likely the on-screen keyboard took it), while Enter signed in on every run.
- **Live identity-provider session.** The system browser keeps the provider's session after a sign-in, and the provider then signs the app in without showing the form. A subflow that waits for the form fails there, which is the safe outcome: otherwise a different account would stay signed in unnoticed. Clear the browser's data before a sign-in on Android (`adb shell pm clear com.android.chrome`); its first-run screens can then return, so keep those steps conditional.
- Never read the hierarchy or take a screenshot while the SSO page shows; the flow's result line is the observation, and a wrong selection fails the sign-in.

## Driver facts (tested on Spectre 0.9.0 and Maestro 2.12.1)

- Spectre attaches to a running Compose desktop JVM (`spectre ps`, `attach <pid>`) without a permission prompt; input is synthetic AWT events and works without window focus. `click` takes a node key, not a tag, and keys change after recomposition: find, then act at once. Queries do not wait (`wait-for-node --tag` does). `capture --json` returns `captureJson` and `screenshotPng` paths. The JVM prints restricted-method warnings (`WARNING: A restricted method ...`) on stderr; drop them.
- Maestro `id:` matches Compose test tags on iOS; on Android only when the root sets `testTagsAsResourceId = true`. `inputText` typed exactly into a Compose text field, in bulk and character by character.
- On a terminal Maestro echoes every typed value; with piped stdio it prints only result lines, but a single flow run without `--format` may print `Input text <value>`: pass `--format junit --output FILE` and redact every console line anyway.
- `commands.json` holds every `MAESTRO_*` value from the variable definitions, even when the flow failed before typing; `maestro.log` holds them too. Failing steps write `screenshots/` and `screen-hierarchy/` (120 KB) below the test output directory. When `--debug-output` and `--test-output-dir` are both given, the latter wins for every artifact except the global `maestro.log`; a relative `takeScreenshot: NAME` lands in `<test-output-dir>/<timestamp>/<flow>/takeScreenshot/NAME.png`, and an absolute path fails.
- A Maestro hierarchy is about 20 KB for an app screen and 94 KB for an SSO sheet.

## Proving a QA instruction change

A change to this skill, the credentials rule or an app's QA skill is proven with fresh agent sessions: start a session without the authoring conversation's context, give it only a task text ("sign dev account 1 into the app on the iOS simulator", "type a message into the chat field of the desktop app"), and capture every tool call with its arguments. Judge the capture against the allowed workflow (preflight, the driver script, no tree or screenshot reads, no OS-level scripting, sign-in only through the subflow); a pattern match alone is not the verdict. Also run one session with the driver missing from `PATH`: it must stop at the failed preflight line and report its install hint.
