---
description: Migrating an adapter onto a shared engine silently drops the old API's guarantees
globs:
  - "**/*.ts"
  - "**/*.kt"
---

# Lesson: Migrating an adapter onto a shared engine silently drops the old API's guarantees

Recorded: 2026-08-28
Lesson id: migrating-an-adapter-onto-a-shared-engin-a05ae0db814ee653
Lesson hash: a05ae0db814ee653

## What went wrong
Migrating the OpenCode rules-injector from legacy `findRuleFiles` to the shared `findRuleCandidates` engine dropped project-root containment: the legacy API took a `projectRootRealPath` boundary, the engine API has no boundary parameter. A `.omo/rules` symlink pointing outside the repo then injected external instructions into the model. `packages/rules-engine/src/security-boundary.test.ts` passed the whole time, because it exercises the OLD function the adapter no longer calls. The same migration also dropped `sortCandidates` (inverting user-over-bundled precedence under first-wins dedupe), swapped non-throwing `safeRealpathSync` for throwing `realpathSync.native`, and dropped the `.instructions.md` filter. All four were invisible to the existing green suite.

## Rule for next time
When swapping a call site from one API to another, diff the OLD function's full parameter list and post-processing against the new one, and treat every dropped parameter as a lost guarantee until proven otherwise — especially boundary/containment args, sorts, and non-throwing wrappers. Tests targeting the old function do NOT cover the new path: re-point or duplicate them against the new call site, or they pass while the guarantee is gone. Also run every other consumer's suite of the shared engine.
