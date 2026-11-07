---
description: "UI automation with real credentials: never read a login page's tree or textbox values, run Maestro on pipes only, and sweep its command record and logs before keeping any output"
globs:
  - "**/maestro/**"
  - "**/*.maestro.yaml"
  - "**/scripts/**"
  - "**/*.sh"
  - "**/docs/evidence/**"
  - "**/tests/smoke/**"
  - "**/.omp/team-config/evidence/**"
---

# UI automation with real credentials

Applies whenever an agent drives a browser, simulator, emulator or desktop app that signs in with a real account. A credential that reaches a tool result is in the transcript and cannot be scrubbed.

## Login surfaces

- On a login or identity-provider page, take no accessibility snapshot or UI-hierarchy dump, run no text or regex find, and call no tool that renders textbox values: Playwright MCP `browser_snapshot`/`browser_find`, `uiautomator dump`, `maestro hierarchy`, mobile-mcp `inspect_screen` or their equivalents. Browsers prefill saved passwords as textbox values, and password-manager dialogs render the saved password as node text.
- Sign in with one scripted step that reads the values inside the code or the driver's environment, never echoes them, and returns only where it landed (URL, or the tag of the screen it expects). Inspect the screen again only after it has left the login surface.
- When a hierarchy is unavoidable elsewhere, match only an allowlist of expected literals and delete the dump on device and host in the same call that reads it.

## Maestro (verified on cli-2.12.1 with synthetic values)

- Pass credentials only as `MAESTRO_`-prefixed environment variables of the Maestro process; never `-e` (argv) or an env file.
- Start `maestro test` with piped stdin, stdout and stderr, never on a terminal (pty, `script`, an interactive shell): on a terminal it echoes every evaluated `inputText` value; on pipes it prints only `[Passed]`/`[Failed]` summary lines.
- Treat everything Maestro writes as credential-bearing until swept. `commands.json` holds every `MAESTRO_*` value from the variable definitions, even when the flow fails before typing; `maestro.log` (under `--debug-output` and under `--test-output-dir`) holds them too. Delete `commands.json`, redact the logs (raw and JSON-escaped values), and delete the automatic `screenshots/` and `screen-hierarchy/` step artifacts, which can show the login page, before keeping or copying any output.
- Point `--debug-output` and `--test-output-dir` at one owner-only directory outside the repository. When both are given, `--test-output-dir` wins for every artifact except the global `maestro.log`; a relative `takeScreenshot: NAME` lands in `<test-output-dir>/<timestamp>/<flow>/takeScreenshot/NAME.png`.
- Take no `takeScreenshot` before the sign-in step has left the login page.

## After any session

Scan every directory the tools wrote (browser snapshot folders, driver output, evidence) for the credential values and token prefixes, report matching files by name only, and delete or redact them before anything is kept or committed.
