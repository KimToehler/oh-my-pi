---
name: integration-review
description: "Use when reviewing a feature branch or merged work as a whole: checks for cross-slice consistency, duplication, abstraction gravity, dead code, doc drift, and architectural soundness. This is the whole-diff composition-review stage, catching cross-lane seam defects that no single lane's per-slice review can see. Invoke at the end of multi-slice work, before opening a PR, when inheriting unfamiliar code, or as the before-merge integration check. Triggers: 'review the whole branch', 'integration review', 'is this ready to ship', 'second-opinion read', or as the whole-diff gate before merge."
---

# Integration Review

The whole-branch review that catches what per-slice / per-component review cannot see: cross-cutting inconsistencies, duplicated patterns, missing abstractions, dead code, doc drift, architectural smell.

## When to use

| Context | Use this skill? |
|---|---|
| End of multi-slice feature work (≥3 slices) | **Yes, strict** |
| End of 1-2 slice feature work | Advisory, judgment call |
| Before opening a PR on any non-trivial branch | Yes |
| Inheriting unfamiliar code (new contractor PR, legacy branch) | Yes |
| Manual quality pass mid-development | Yes |
| Single-file fix, typo, dependency bump | No |
| Per-slice review during execution | No, that is the implementation-audit reviewer on that slice's diff |
| Security audit | No, use the `security-research` skill, or `review-work`, which includes a security lane |
| Performance review | No, separate concern |

**This skill is not a code-quality scoring rubric.** It's a checklist of failure modes that show up only when you read the whole change at once. Findings are actionable, not graded.

## Who runs this

Run this skill from a session that can dispatch the implementation-audit reviewer: the orchestrator or a main session. In an omp plan's final verification wave this is F3, and the main agent owns it.

A delegated worker lane usually cannot dispatch that reviewer. If you are in such a lane, stop at once, do nothing else, and return exactly:

`BLOCKED: F3 must run from a session that can dispatch the reviewer`

The caller prepares the inputs. The reviewer does the reading. The reviewer has no shell, so it cannot run `git diff`: everything it needs arrives as files it can `read` plus one verbatim brief. If the reviewer cannot read the `/tmp` files, paste the diff, file list, and plan into the brief itself.

## The asymmetric premise

The reviewer must hold the *whole* change in working memory before forming opinions. Per-slice review optimizes for local quality; integration review catches the failures *of composition*: when each slice is fine on its own but the assembly isn't.

The reviewer must also be **slightly hostile** to the implementation. If something looks weird, flag it; let the user dismiss what's intentional. Findings are cheap; blockers are not: the blocking threshold in the brief decides what is Must-fix. Per the writing-plans skill's "trust but verify" principle: verify, don't defer.

## The process

### Step 1 - Prepare the inputs (caller)

```bash
git diff <base>...HEAD > /tmp/integration-review-<slug>.patch
git diff --name-only <base>...HEAD > /tmp/integration-review-<slug>.files
```

- `<base>` = the divergence point with the repository's integration branch (`dev` here; `main` in many repos), or the branch point if work was rebased. For features stacked on another feature, it's the parent branch.
- For uncommitted work, use `git diff <base>` (two-dot, picks up staged and unstaged changes) for the patch file. When a plan exists, commit the work first; F3 of a plan reviews committed state only.
- If the diff is large (>3000 lines), still keep it whole. The reviewer may chunk its *findings*, but it must see the whole change.
- Locate the plan if one exists: `.omo/plans/<slug>.md`. If the plan is gitignored and absent from the reviewer's working tree, use the path the reviewer can actually read.
- Write the seam list: each lane or slice, and the cross-slice contracts it touched (shared types, helpers, config keys, i18n keys, docs). The reviewer was not in the conversation, so this is its map of where the seams are.

### Step 2 - Dispatch ONE reviewer with the verbatim brief (caller)

When a plan exists, first run `GC baseline --sha HEAD`, `GC ready --lane F3`, then `GC snapshot --lane F3` (`GC` as in review-work Fix waves, `SKILL_DIR=~/.omp/agent/skills/review-work`); keep the snapshot path (first output line) and the `PLAN <path>` line; substitute that pinned path for `<plan path>` in the reviewer brief, since the source plan is not a review input for the wave. `NOT READY` or a refused snapshot → resolve, no dispatch. Prepare the Step 1 files only after the snapshot.

Dispatch a single omp `task` call with one item: `agent: "auditor"`, `solutionSpace: "Whole-diff review of a finished branch; defects unknown"`, `task:` the brief below unchanged, filling only the placeholders. The result is delivered automatically; do not poll. At integration-review time there is usually **no PR yet**, so the brief puts the reviewer in local mode up front; that stops it from improvising with `gh pr view`, `git fetch`, or its own discovery logic.

````markdown
**Local code review. No PR exists.** Do NOT run `gh pr view`, `gh pr diff`, or any remote fetch. Do NOT try to post comments to a PR. Do NOT try `gh pr list` or `gh pr create`. Review the local diff supplied below. Do not modify any files.

**Diff:** `/tmp/integration-review-<slug>.patch`
**Changed files:** `/tmp/integration-review-<slug>.files`
**Plan:** `<plan path>` (the pinned `PLAN` path from `GC snapshot`, never the source plan; if it exists, read it for the design rules, the "Out of Scope" list, and the "Verification" checklist)
**Seam list:** <each lane or slice and the cross-slice contracts it touched>

**Asymmetry constraint:** you have only the diff, the file list, the plan, and the seam list. You do not have my reasoning for any specific decision. Read the whole diff end to end before forming opinions. If something looks wrong, flag it; I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

## Walk the seven failure modes

For each mode, name a specific instance from the diff, or write "no instance found". Every mode ends in an instance or no instance found. Skipping a mode silently is a defect in the review.

1. **Duplication across slices/files.** Two near-identical helpers, components, SCSS blocks, or DTO conversions in different files. Ask: did slice N reinvent something slice M introduced? Are there two functions with different names doing the same thing? Two style rules with 80%+ overlap?
2. **Naming inconsistency.** Same concept, different word in different places (`kicker` / `label` / `tag`; `lede` / `subtitle` / `description`; `onSave` / `handleSave` / `submit`). Pick three nouns from the diff: do they use the same word for the same concept across files?
3. **Uneven API surface.** One component accepts `lede`, its sibling takes `subtitle`, a third has neither. One method returns `Observable<void>`, another `Promise<boolean>`. One DTO has `createdAt`, another `created`. One i18n key family uses `@@dialog_*`, another `@@confirm_dialog_*`. Would a union of all the inputs across these components look uniform?
4. **Mixed conventions.** Same concept implemented two ways across slices (`data-pill="primary"` vs `class="primary-pill"`; `signal()` vs `BehaviorSubject` for the same kind of state). Did later slices respect the pattern the first slice established? If they diverged, was it intentional?
5. **Missing abstractions (abstraction gravity).** Three or more near-identical patterns is a question, not always an obligation: would a fourth consumer copy-paste again? Is there a five-line block in 3+ files with only a field name changing? Also the inverse, premature abstraction: a one-consumer helper that should be inlined.
6. **Dead code.** Back-compat aliases with no consumers after a later cleanup slice, unused helpers, computed inputs nobody binds, CSS variables nobody references, translation keys not wired up. For each new helper, type, input, variable, class, or key, search the tree: is it used anywhere other than by tests or by code the diff deleted?
7. **Doc drift.** User-facing docs, locale and translation files, OpenAPI spec, README, CHANGELOG, and agent instruction files must match changed behavior. Did the diff change logic or a workflow that docs also explain? Are all new i18n keys present in every locale file the project ships? Was the OpenAPI spec file updated when the API changed?

## Surprise scope and the plan

Compare the changed files and touched symbols against the plan. Use targeted searches to check that the diff touched only the symbols the work intended to touch. Files changed outside the feature's surface area, or symbols modified that the plan does not list, are red flags to investigate.

If a plan exists:
- Walk every "Out of Scope" line. Confirm none of them got implemented.
- Walk every "Verification" checklist item. Confirm each was actually done.
- Walk every i18n key. Confirm each is present in every locale file the project ships.
- Walk every slice's "Files modified" list. Confirm only those files (plus their tests) appear in the diff.

## Seams

Check every contract in the seam list for consistency on both sides of the seam: producer and consumer, shared type and its users, config key and its readers, docs and the behavior they describe.

## Simplification pass over the merged whole

Look for cross-slice simplification candidates that no per-slice review could see: a helper introduced in slice 2 that collapses a five-line dance in slice 4, a computed from slice 3 that is unused after slice 7's cleanup, generated-looking boilerplate repeated across slices. Report each as Should-fix.

## Class rule

A finding is one instance of a defect class. For EVERY finding write:
- `class:` a short name for the defect class, and `sites:` every site of that class across the WHOLE tree, with the exact search command you ran (not only the files in the diff); or
- `single instance: <reason>` when you searched and the class has no other site.

Report the whole class in one round. Do not leave sibling sites for a later round.

## Blocking threshold

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

## Report format

Output a markdown report with three buckets:
- **Must-fix:** every finding that meets the blocking threshold, each on its own `Blocker B<n>:` line. Nothing else is Must-fix.
- **Should-fix:** findings below the threshold: correctness and security findings without a realistic trigger on a protected asset, dead code, consistency issues, missing abstractions, naming drift, doc drift, premature abstractions, cross-slice simplification candidates.
- **Nit:** style, optional polish, taste calls.

Each finding carries: `file:line` (or symbol name plus path); **what** the issue is, in one sentence; **why** it matters, in one sentence; **fix**, in 1-3 lines or a small snippet; and its `class:` / `sites:` or `single instance:` line.

Empty buckets are still a deliverable. Finish with a **Checked** list naming the seven modes (each with its instance or "no instance found"), the surprise-scope walk, the plan walks, the seam list, and the simplification pass.

## Closing rule

End the report with exactly one line containing only PASS or FAIL. FAIL when any Must-fix exists. Nothing may follow that line.
````

Rules for the dispatch:

- Send the brief verbatim. Do not summarize it, trim it, or add your own reasoning about why a decision was made; the reviewer's value is that it has not seen the conversation.
- Never tell the user to "open the PR first so the reviewer can run". The point is to catch issues before the PR exists.
- If the dispatch lands in PR mode anyway (a stale PR existed), reject the output and re-dispatch with the same brief.
- For diffs over ~3000 lines, the review still happens whole-diff in one pass. Do not fall back to PR mode because of size.
- Save the report to a file and keep its path. The review-work implementation-audit brief takes it as the `{F3 REPORT PATH}` input, together with the class list.

### Step 3 - Delta rounds

When a plan exists, first run `GC ready --lane F3` and `GC snapshot --lane F3`, then regenerate the Step 1 files; a refusal → no dispatch. After fixes land, re-dispatch the same brief with one addition: the previous report path and its class list. The reviewer first confirms each class is closed at every listed site, then looks for new findings. The delta report ends with the same bare PASS or FAIL line.

### Step 4 - Read the verdict

The last line of the report is the verdict: `PASS` means no Must-fix remains, `FAIL` means at least one does. A report without that final line is not a verdict. Re-dispatch and ask for the closing line; do not infer the verdict from the buckets.

When a plan exists, record every verdict before anything else: `GC wave --lane F3 --snapshot <path> --outcome f3=PASS|FAIL|INCONCLUSIVE` (a report still without its closing line after one re-dispatch is INCONCLUSIVE). After a cleanup commit, also pass `--outcome verification=PASS|FAIL` from the Step 5 verification gate and one `--blocker VERIFY<n>` per failing check. Add one `--blocker <class>=<sites>` per Must-fix class; Should-fix and Nit never count; `@fix` works as in review-work Fix waves step 3. `DECISION: PASS` → F3 done. `CONTINUE` → Step 5. `STOP` (exit 3) → no Step 5; `ask` the user: freeze (the named Must-fix classes become follow-ups, listed in the report F2 receives as `{F3 REPORT PATH}`), re-plan, or continue, and record it with `GC decide --lane F3 --choice freeze|replan|continue --by <user> --reason <text>`. Without `ask` UI, report and stop. Under Risk tier `internal-tooling` a STOP at wave 3 or later is the fix-round cap: offer freeze or re-plan only; `GC decide` refuses continue there.

A clean report reads:

> **Must-fix:** none.
> **Should-fix:** none.
> **Nit:** [optional minor items].
> **Checked:** [the seven modes, surprise scope, plan walks, seams, simplification pass].
>
> PASS

### Step 5 - Apply fixes as one cleanup commit via a worker lane

The caller never edits product files. Turn each Must-fix (and each Should-fix you chose to take) into one fix todo per class, and each todo inherits that class's `sites:` list so the whole class is fixed at once. Append each fix todo to the plan as an `N.` row under `## TODOs` (and mirror it in the todo list) before dispatching it; while only final-wave rows are pending, a lane result without its own row is read as a reviewer result with a missing verdict. Dispatch the todos to a worker lane that makes **one cleanup commit**, `refactor(<scope>): integration cleanup`, not silent edits to prior slice commits. The commit history should preserve the per-slice work and add one cleanup pass on top.

Nits are user judgment calls. List them in the report, let the user decide.

After the cleanup commit, run the verification gate below and save its output. When a plan exists, review the cleanup commit range once with every row it implements, per review-work Fix waves step 5 with lane F3 and directory prefix `F3-`. Then run the delta round from Step 3 and pass the gate's result to its wave as `--outcome verification`. The verification gate:
- `npm run lint:check` (or project equivalent)
- `npm run build` (or project equivalent)
- The plan's global verification checklist if a plan exists.
- Visual smoke test of the feature's main surfaces (for UI work).

If verification fails after the cleanup commit, the cleanup itself broke something. Have the worker lane fix forward as a new `N.` row with its own delta review; do not re-roll the cleanup commit.

## Skill priority

When invoked from an omp plan's final verification wave (F3), this skill **inherits** the plan at `.omo/plans/<slug>.md` as authoritative context. When invoked standalone:
- If a plan exists, use it as a constraint.
- If no plan exists (manual review of unplanned work), the seven failure modes still apply. Leave out the "Out of Scope / Verification" walks in the brief.

## Red flags inside the review process

| Thought | Reality |
|---|---|
| "Per-slice review caught everything, this is overkill" | **STOP.** Per-component verification doesn't compose. Cross-slice failure modes only show up at the seam. |
| "I'll skip the dispatch since the per-slice reviews ran a code-reviewer subagent already" | **STOP.** Those reviewers had only their slice's context. The whole-diff reviewer is the only one with the assembly. |
| "I'm a worker lane, I'll read the diff and write the report myself" | **STOP.** Return `BLOCKED: F3 must run from a session that can dispatch the reviewer`. A review the caller wrote itself is not independent. |
| "I'll paraphrase the brief to save tokens" | **STOP.** Verbatim. The class rule, the closing line, and the "no instance found" walk are what make the report usable. |
| "The plan didn't change, no need to verify Out-of-Scope" | **STOP.** Out-of-scope work slips in *most often* when the implementer was tempted by an opportunity mid-slice. The brief walks it every time. |
| "No PR yet, I'll let the reviewer run in PR mode, it'll figure it out" | **STOP.** Use the local-mode brief. Default mode will fail or grab the wrong diff. |
| "The diff is too big to review whole" | **STOP.** Supply it whole anyway. Chunk the *findings* report, not the input. |
| "Looks clean, no findings to write up" | **STOP.** The report with empty buckets and a `PASS` line is the audit trail. |
| "The report has no PASS or FAIL line but it looks fine" | **STOP.** No closing line means no verdict. Re-dispatch. |
| "I'll fix the Must-fix items myself, it's quicker" | **STOP.** Fixes go to a worker lane as one todo per class. The orchestrator does not edit product files. |
| "I can fold the cleanup into the last slice's commit" | **STOP.** Separate commit. Preserves history; flags what was caught at the seam vs. what was caught during the slice. |

## What this skill is NOT

- Not a replacement for per-slice review during execution (that is the implementation-audit reviewer on the slice diff).
- Not a security review (use the `security-research` skill, or `review-work`, whose security lane covers it).
- Not a performance audit.
- Not a graded score. It's a checklist with actionable findings.
- Not a substitute for the user's own taste; the report surfaces issues, the user decides what to apply.

## Related skills

- omp plan mode and the plan's `## Final verification wave`: invoke this skill as F3, the whole-diff gate, after the lanes land and before merge.
- `refactor` / `remove-ai-slops`: the worker lane may use them if installed while applying the cleanup commit; the reviewer's simplification pass is already part of the brief.
- Implementation-audit reviewer: dispatched once per round by the caller with the verbatim brief (Step 2); also the per-slice reviewer during execution, which is a different timing, not a different verdict.
- `review-work`: manual review and record-validation stage, invoked *after* this skill; it receives this skill's report path and class list.
- `git-master` + `git worktree remove`: PR/merge and worktree retirement, last.
