---
description: File a lesson by where it APPLIES, not where it was learned — the directory is the scope, and the globs must match that scope
globs:
  - "**/.agents/rules/*.md"
  - "**/.omp/rules/*.md"
  - "**/.omp/agent/rules/*.md"
  - "**/.claude/rules/**/*.md"
---

# Lesson Scope — the directory IS the scope

A lesson's `Learned in:` field is **history**. It records the repo where the mistake
happened. It is not a filing instruction and never decides where the file belongs.

Two things determine whether a lesson ever fires, and they must agree:

| Question | Answered by |
|---|---|
| **Where does it apply?** | the directory it sits in |
| **When does it fire?** | its `globs` |
| Where did it come from? | `Learned in:` — never used for routing |

omp loads rules from three places, every scan **flat** (a `lessons/` subdirectory is never
read, so lessons are filed as `lesson-<slug>.md` next to the other rules):

- `~/.omp/agent/rules/*.md` — user level, every repo.
- `<cwd>/.omp/rules/*.md` — only the directory omp was started in, no walk-up.
- `<dir>/.agents/rules/*.md` — every directory from cwd up to the repo root. This is the
  project location that works from subdirectories and worktrees.

omp does not inject rules per touched file. It lists each rule's name, `globs`, and
`description` in the system prompt; the model reads `rule://<name>` when the globs fit the
work. A rule without `description` (and without `alwaysApply`) is never listed. Frontmatter
accepts `description`, `globs`, `alwaysApply`, `condition`, `scope`, `agents`,
`interruptMode` — `scope` is a TTSR tool/stream filter, **not** a filing location.

## THE RULE

- **Applies everywhere** → `~/.omp/agent/rules/lesson-<slug>.md` **with rootless globs**
  (`**/*Test.kt`, `**/*.spec.ts`, `**/.omo/plans/**/*.md`).
- **Applies to one repo** → `<repo>/.agents/rules/lesson-<slug>.md` with that repo's real paths.

Judge by the rule's *content*, not its origin. "Prove a QA probe red before trusting it"
is testing discipline in any language; it was learned in a TypeScript repo and belongs
global. "Read the `validate` lambda passed to `validatedLlmCall`" names a Kotlin symbol
that exists in exactly one codebase.

There are no per-subtree rule roots: a nested package (`services/billing/`) is reached
through the repo-root `.agents/rules/`. Express subtree scope with globs
(`services/billing/**/*.ts`).

## THE TWO FAILURE MODES

Both are silent. Neither produces an error.

| Content | Globs | Filed | Result |
|---|---|---|---|
| repo-specific | rootless | global | **fires everywhere, wrongly** |
| general | repo paths | one repo | **switched off in every other repo** |
| general | repo paths | global | **never fires at all** |

The first was observed: a lesson about which harness edition to prioritise, learned in
the harness repo, was injected into an unrelated product-repo session and cited a roadmap
file that does not exist there.

The second was the over-correction: filing all 18 lessons by `Learned in:` moved seven
general rules into single repos, switching them off everywhere else.

The third is the trap when fixing the second — **moving a lesson to the global store is
not enough**. Its globs move with it, and `backend_kt/**` or
`.agents/skills/opencode-qa/**` resolve nowhere else. Widen the globs in the same edit,
or the rule is filed correctly and still dead.

## CHECK IT

Filing is only correct if directory and globs agree. Verify both, not one:

```bash
# repo-local lesson with a rootless glob → fires in every repo, probably wrong
grep -l '"\*\*/' <repo>/.agents/rules/lesson-*.md

# global lesson naming a repo-specific path → fires nowhere
grep -lE '"(backend_kt|services|packages|src/hooks|\.agents)/' ~/.omp/agent/rules/lesson-*.md
```

Both should return nothing. A hit is not automatically wrong — but it must be a
deliberate, explainable choice, not the default that fell out of `Learned in:`.
