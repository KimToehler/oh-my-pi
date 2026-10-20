---
description: Verify the constraint that rules out the simple solution, before building the complex one
globs:
  - "**/*.ts"
  - "**/*.kt"
  - "**/*.py"
---

# Lesson: Verify the constraint that rules out the simple solution, before building the complex one

Recorded: 2026-09-05
Lesson id: verify-the-constraint-that-rules-out-the-a912aa58ed0d8f1c
Lesson hash: a912aa58ed0d8f1c

## What went wrong
Task: stop four read-only review agents (auditor, oracle, librarian, explore) from mutating repos they audit. The simple fix was denying the bash tool outright. I rejected it in the first minute on an unverified assumption - that librarian's method depends on `gh repo clone` / `gh api` / `gh search` - and instead built a curated git/gh command allowlist matched as globs over the command string. Three adversarial review rounds each proved a different escape from that mechanism: a shell redirect (`git log > FILE`), an option-level write (`git diff --output=FILE`), and finally arbitrary code execution (`git difftool --extcmd=<any command>`, where the `git diff*` prefix glob silently swallowed the `difftool` sibling subcommand). Each round I fixed exactly the reported hole and re-verified, which felt like progress, so the mechanism itself was never put on trial - three different escapes from one mechanism is evidence about the mechanism, not a list of holes to plug. Roughly 700 lines accumulated: allowlist, a new tool-guard hook, a config schema entry, argv tokenization, a flag denylist, a composition regex. The user then asked whether we were overcomplicating it. One live probe disproved the founding assumption: with no shell at all, librarian answered a real research question completely and with citations using websearch/context7/grep_app_searchGitHub/webfetch. Final fix: 43 lines adding `bash` and `interactive_bash` to four deny lists on both permission paths. All three bypasses died by construction, since a denied tool has no command string to match against.

## Rule for next time
Simplest correct solution first. When an assumed constraint is the only thing ruling the simple solution out, spend one cheap probe verifying that constraint BEFORE building the complex alternative, not after the third review round. Concretely: when a tool or capability seems load-bearing for an agent, actually run that agent without it and read the tool-call log from the engine's own store, rather than reasoning from its documented method or trusting its prose self-report. And treat repeated distinct bypasses as a verdict on the approach: if two independent reviews escape the same mechanism in two different ways, stop patching the specific holes and re-price the simple option. A pattern or glob over a command string is never a security boundary, because the shell's grammar is richer than the pattern's - prefer removing the capability over enumerating its safe uses.
