---
description: "Before driving a browser, simulator, emulator or desktop app that signs in with a real account: no tree, snapshot, find or textbox read while a login or password-manager surface shows, scripted sign-in, Maestro on pipes with redacted output, evidence you did not write only scanned, never read or listed, stop and scrub on any leak"
condition:
  - '(?i)\bmaestro\b'
  - '(?i)\buiautomator\b|\badb\b[^\n]*\b(input|screencap)\b|\bsimctl\b[^\n]*\bio\b'
  - '\bbrowser\.open\b|browser_(snapshot|find|type|fill)|inspect_screen|mobile_(list|tap|type)'
  - '(?i)\bspectre\b|\bosascript\b|System Events|\bscreencapture\b'
  - '(?i)\bapp-qa-drivers\b'
scope: ["tool"]
interruptMode: always
---

# UI automation with real credentials

Applies whenever an agent drives a browser, simulator, emulator or desktop app that signs in with a real account. A credential that reaches a tool result is in the transcript and cannot be scrubbed.

## Login surfaces

- While a login, identity-provider or password-manager surface is visible, take no accessibility snapshot or UI-hierarchy dump, run no text or regex find, and call no tool that renders textbox values: Playwright MCP `browser_snapshot`/`browser_find`, `uiautomator dump`, `maestro hierarchy`, mobile-mcp `inspect_screen` or their equivalents. Browsers prefill saved passwords as textbox values, and password-manager dialogs (also a "save/update password?" dialog that appears after sign-in) render the saved password as node text.
- Sign in with one scripted step that reads the values inside the code or the driver's environment, never echoes them, and returns only where it landed (URL, or the tag of the screen it expects). Submit the form natively (Enter in the focused password field, the form's submit) rather than by coordinate tap: a tap an on-screen keyboard swallows is what leads agents to inspect the page. Inspect the screen again only after it has left the login surface and no password dialog shows.
- When a hierarchy is unavoidable elsewhere, match only an allowlist of expected literals and delete the dump on device and host in the same call that reads it.

## Maestro (verified on cli-2.12.1 with synthetic values)

- Pass credentials only as `MAESTRO_`-prefixed environment variables of the Maestro process; never `-e` (argv) or an env file.
- Start `maestro test` with piped stdin, stdout and stderr, never on a terminal (pty, `script`, an interactive shell): on a terminal it echoes every evaluated `inputText` value. Pipes do not make the output safe: a single flow run without `--format` can use the plain-text view, which prints each command's description, `Input text <value>` included. Buffer stdout and stderr by line, redact the values (raw and JSON-escaped) before forwarding or keeping anything, and take the result from `--format junit --output <file>`.
- Treat everything Maestro writes as credential-bearing until swept. `commands.json` holds every `MAESTRO_*` value from the variable definitions, even when the flow fails before typing; `maestro.log` (under `--debug-output` and under `--test-output-dir`) holds them too. Delete `commands.json`, redact the logs (raw and JSON-escaped values), and delete the automatic `screenshots/` and `screen-hierarchy/` step artifacts, which can show the login page, before keeping or copying any output.
- Point `--debug-output` and `--test-output-dir` at one owner-only directory outside the repository. When both are given, `--test-output-dir` wins for every artifact except the global `maestro.log`; a relative `takeScreenshot: NAME` lands in `<test-output-dir>/<timestamp>/<flow>/takeScreenshot/NAME.png`.
- Take no `takeScreenshot` before the sign-in step has left the login page.

## Evidence you did not write

- From your first tool call on, an evidence file or folder you did not write (an existing output folder, captures or logs the task names) is never read, listed, opened, printed, changed, moved or deleted, whatever its scan returned and whatever the task asks.
- The only command that names it is the evidence scan the app's QA skill names. Report a hit or a not-scanned entry by the path the scan printed, and write your own output to a new folder.
- A clean scan is no permission to read: a running app can append a token to its log after the scan, and nothing ties a later read to the bytes the scan saw.
- Repository sources and skills are not evidence and stay readable.

## On a leak, and after any session

- When a credential value reaches any tool output, stop the task. Delete or redact every copy (device, host temporary files, the main checkout, every worktree, evidence directories), then rescan those same places and confirm no match remains, reporting affected files by name only. Tell the user that the transcript holds the value so they can rotate it.
- After any session, scan every directory the tools wrote (browser snapshot folders, driver output, evidence) for the credential values and token prefixes, report matching files by name only, and delete or redact them before anything is kept or committed.
