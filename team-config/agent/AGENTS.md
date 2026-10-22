# Global Instructions

Personal additions (profile, language, stack) go in `AGENTS.local.md` in the agent dir (default `~/.omp/agent`); it is never overwritten by `scripts/deploy-local.sh` and loads beside this file only while `contextFiles.extra` lists it (the seeded `config.yml` does; a pre-existing one needs it added by hand; a project-level `contextFiles.extra` replaces the user list).

## Git Commits

Do not include `Co-Authored-By` lines in commit messages.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter the harness's plan mode for ANY non-trivial task (3+ steps or architectural decisions), unless the pattern is already documented in the project's persistent rules with a proven approach
- For familiar patterns with documented rules/lessons: execute directly, verify at the end
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user, capture the reusable lesson.
- Personal or project-specific context MUST use `learn` with project scope; it stays local and unversioned.
- Cross-project team policy or a hard guardrail MUST become a reviewed rule in `team-config/agent/rules/`; NEVER use global memory as team policy.
- Extend an existing rule before adding another; keep concrete scope and verification.
- Review persistent team rules at session start.

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Engineering Principles

- **Engineer Properly, Once**: Design, implement, and fix for the correct, elegant, extensible, maintainable solution — even when it is more work or touches more files. Do NOT optimize for "minimal blast radius" / touching as few files as possible; that heuristic trades short-term safety for reworking the same code again and again. Behavior-preservation (no regressions) is a **test** guarantee — good tests, golden/characterization suites included, are exactly what make bold, correct refactoring safe; they are not a reason to avoid restructuring. "Frozen" / "off-limits" are risk heuristics to revisit when the correct design needs the change, not architectural law. Prefer the deepest correct fix over a shallow one that leaves the same weakness to be reworked later.
- **Simplicity First**: Make every change as simple as the problem allows — but no simpler. Simplicity is a property of the design, not of the diff size; the simplest *design* sometimes needs a larger, cleaner change.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **No Unrelated Churn**: Touch everything the correct design requires, and nothing it doesn't. Scope creep and gratuitous rewrites of untouched code are still defects. This — not "avoid the refactor the feature needs" — is the real meaning of "minimal impact": no *unrelated* changes.
- **Honesty Over Agreement**: If the user's approach has a flaw, an assumption is wrong, or there's a better alternative — say so directly. Don't sugarcoat or bury it. Disagreeing respectfully is more valuable than agreeing incorrectly. A good collaborator catches mistakes early, not after they've shipped.

## Tool Output Hygiene (keep outputs small)

The LLM transport runs through the team LLM router (`router.onara.eu`), which compresses large `tool_result` blocks (git/grep/find/diff) and prose. Large tool outputs get truncated/mangled — costing re-fetches. **Proactively keep outputs small so nothing is compressed away**, especially for precision-critical dev output (hashes, line counts, diff bodies, test results):

- **git**: prefer `--stat`, `--oneline`, `-<N>` line limits, `--name-only`, targeted `<path>` scoping over full `git show`/`git diff`/`git log`. Need a full body? Redirect to a file and read the file (`git show X > /tmp/x.txt` then Read).
- **grep/rg**: scope tightly (path + specific pattern); avoid repo-wide matches with many hits per file.
- **build/test**: pipe through `tail -N` / filter to the failing lines; don't dump full logs.
- **General**: when exact bytes matter and output could be big, capture to a file and Read it, or print a count (`wc -l`) first, then the slice you need.
- This is defense-in-depth on top of the router's own output caps — apply it regardless, since the client-side context-compaction layer is separate and not covered by those caps.
