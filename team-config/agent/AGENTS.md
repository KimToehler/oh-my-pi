# Global Instructions

## Git Commits

Do not include `Co-Authored-By` lines in commit messages.

## Lessons and team rules

- After a correction from the user, capture the reusable lesson with `learn` (project scope). With a remote memory backend, personal context goes there only if the user agreed.
- Cross-project team policy or a hard guardrail becomes a reviewed rule in `team-config/agent/rules/`, never global memory. Extend an existing rule before adding another.

## Engineering Principles

- **Engineer properly, once**: prefer the deepest correct fix over a shallow one, even when it touches more files. Behaviour preservation is a test guarantee, not a reason to avoid restructuring.
- **No unrelated churn**: touch everything the correct design requires, and nothing it doesn't.
- **Honesty over agreement**: if the user's approach has a flaw or a wrong assumption, say so directly.

## UI automation with real accounts

Before driving a browser, simulator, emulator or desktop app that signs in with a real account, read `rule://ui-automation-credentials`. Its core: while a login or password-manager surface shows, take no snapshot, hierarchy, find or textbox read; sign in with one scripted step that echoes nothing; on any credential in tool output, stop and scrub.

## Tool output through the team router

The router (`router.onara.eu`) compresses large `tool_result` blocks (git, grep, find, diff) and prose, so oversized output gets mangled. Keep precision-critical output small: `git --stat`/`--oneline`/path-scoped, tightly scoped grep, test output filtered to failures; when exact bytes matter, write to a file and read the slice you need.
