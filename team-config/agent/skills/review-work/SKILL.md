---
name: review-work
description: "Post-implementation merge gate: run manual QA on the real surface yourself, then use orchestrator-decided review depth (auditor, optionally oracle) with verbatim briefs, stored trailers, and an omo.merge-gate/v2 record validated by validate-gate-record.mjs. Use before calling work done, before a PR handoff or merge, or when the user asks to review completed work."
---

Validator: `$SKILL_DIR/scripts/validate-gate-record.mjs`, where `SKILL_DIR=~/.omp/agent/skills/review-work`. Always pass `--repo <repo root>` (Phase 0.6 `--plan-only`, Phase 5 full run).

Convergence: `$SKILL_DIR/scripts/gate-convergence.mjs` (see Fix waves).

omp rules for this skill:

- Dispatch with the `task` tool; one item per reviewer (`agent: "auditor"` / `agent: "oracle"`). Several items in one `tasks[]` run in parallel. Never use generic `task` workers as reviewers.
- `auditor` and `oracle` have no shell. Put the diff, changed-file list, and QA matrix into the brief itself.
- Store each reviewer's trailer verbatim at a tracked path, compute `trailer_sha256` with `shasum -a 256`, never retype it.
- `implementation_models`: the models that wrote the diff, from the session (main model and any `task` subagent's model badge), e.g. `onara/cc/claude-opus-5-5`, `onara/cc/claude-sonnet-5-5`. `model_id` comes from the reviewer's own trailer.
- Record path: `.omo/evidence/gate/<plan-basename>.json` or the repo's convention (`docs/evidence/<slug>/merge-gate.json` in onara). The record and every trailer must be staged before validating.

# Review Work - Gate Review Orchestrator

One reviewer by default, never an implicit panel. A single reviewer holding full context catches what a fan-out of narrow reviewers misses between seams. Add a second invocation when consequence or uncertainty earns it, and always for four mandatory classes. Each invocation resolves to exactly one named omp agent (`auditor`, `oracle`), never a generic worker.

| Lane | Who runs it | Question it answers |
|------|-------------|---------------------|
| Manual QA | You, orchestrator, on real surface | Does it actually work? |
| `implementation-audit` | One resolved implementation-audit invocation | Is implementation correct, safe, complete, and adequately verified? |
| `strategic-risk-review` (conditional) | One resolved strategic-risk-review invocation | Does architecture hold and which high-consequence risk did line-level audit miss? |

Review completed implementation work through manual QA you run yourself plus reviewer invocations this change actually needs. You decide how much review that is - see Phase 0.5. Review passes only when QA matrix has no failing row AND every invocation you ran returns `PASS`; the only other outcome that permits merge is the user-authorized override in Phase 4.

---

## Phase 0: Gather Review Context

Before running anything, collect these inputs. Extract from conversation history first - the user's original request, constraints discussed, and decisions made are usually already in the thread. Only ask if truly missing.

<required_inputs>

- **GOAL**: The original objective. What was the user trying to achieve? Pull from the initial request in this conversation.
- **CONSTRAINTS**: Rules, requirements, or limitations. Tech stack restrictions, performance targets, API contracts, design patterns to follow, backward compatibility needs.
- **BACKGROUND**: Why this work was needed. Business context, user stories, related systems, prior decisions that informed the approach.
- **CHANGED_FILES**: Auto-collect via `git diff --name-only HEAD~1` or against the appropriate base (branch point, specific commit).
- **DIFF**: Auto-collect via `git diff HEAD~1` or against the appropriate base.
- **FILE_CONTENTS**: The full content of each changed file plus the neighboring files that show the established patterns. Required verbatim when the resolved reviewer cannot read files; when your surface's gate reviewer can read files and run commands, pass the paths and the diff instead of pasting everything.
- **RUN_COMMAND**: How to start/run the application. Check `package.json` scripts, `Makefile`, `docker-compose.yml`, or ask the user.
- **CONTEXT_MINING**: What the history and the trackers say about this area (collected below).

</required_inputs>

Review PRs and branches from a dedicated review worktree only: create or attach one with `git worktree add <path> <branch>` before collecting changed files, diff, file contents, or running checks, then immediately lock it with `git worktree lock <path> --reason "review:<pr-or-branch>"`. The main worktree is read-only context; never checkout, test, or edit the review branch there.

**Auto-collection sequence:**

```bash
# 1. Get changed files
git diff --name-only HEAD~1  # or: git diff --name-only main...HEAD

# 2. Get diff
git diff HEAD~1  # or: git diff main...HEAD

# 3. Detect run command
# Check package.json -> "scripts.dev" or "scripts.start"
# Check Makefile -> default target
# Check docker-compose.yml -> services

# 4. Mine the context the implementation may have missed (keep the output short)
git log --oneline -20 -- <each changed file>            # recent changes and their reasons
git log --all --oneline --grep="<keywords from goal>"    # related commits, reverts
gh issue list --search "<keywords>" --state all           # related issues (when gh is available)
gh pr list --search "<keywords>" --state all              # related PRs and their review comments
rg -n "TODO|FIXME|HACK" <changed files>                   # warnings left by previous authors
# plus: files that import the changed modules, tests touching the same paths,
# docs and config that reference the changed behavior
```

Record CONTEXT_MINING as a short list: source -> finding -> why it matters for this change. Slack, Notion, and Discord searches belong here too when those tools exist.

For GOAL, CONSTRAINTS, BACKGROUND - review the full conversation history. The user's original message almost always contains the goal. Constraints often emerge during discussion. If anything critical is ambiguous, ask ONE focused question - not a checklist.

---

## Phase 0.5: Decide the review depth

Read plan's `## Merge gate` section as input, not a command. Final diff, history, consequence, and implementation uncertainty decide depth. Choose one option and record one-line `decision_reason`, including when no reviewer runs.

| Option | Use when |
|---|---|
| No reviewer | Mechanical change with no runtime, generated-artifact, dependency-resolution, security, schema, API, or user-visible effect. State skip and reason. |
| `implementation-audit` | Default for real work. One auditor, one structured brief. |
| `implementation-audit` + `strategic-risk-review` | Consequence or uncertainty is high. |

Docs-only is not automatically skippable. Instructions, skills, config docs, runbooks, and generated contracts change behaviour. "Dependency bump" and "revert" are not inherently safe. Judge consequence, never filename or commit message.

Discretion does not apply to these classes. Always run both invocations:

1. auth, secrets, PII
2. schema or migration
3. wire contract or public API shape
4. concurrency or state machine

Judgement habituates toward "does not need it". Across 400 repeat reviewers and 11,429 reviews, approval drifted from 30.1% to 36.8%, inline comments fell 22%, and word count fell 28%, while rising approval negatively correlated with comment effort ([Habituation at the Gate](https://arxiv.org/abs/2606.22721)). These four classes remain immune to that drift, supported by [OWASP ASVS](https://github.com/OWASP/ASVS) and [OWASP Top 10](https://owasp.org/www-project-top-ten/).

## Phase 0.6: Resolve and record

Before anything is dispatched, run the plan half of the validator against the plan alone: `node $SKILL_DIR/scripts/validate-gate-record.mjs --repo <repo root> --plan-only --plan <plan-path>`. It runs the `## Merge gate` criteria check the full validation runs at the end, plus two plan-time rules the full run does not repeat: the opt-out decision (only a top-level `- Merge gate: not applicable (<reason>)` outside code fences counts) and the abort-rule fields `Accepted residual risks` and `Out of scope for blocking`, each with concrete text or `none (<reason>)`. A plan that fails it would fail the gate only after every reviewer was paid for, so fix the plan first, before `plan_sha256` is taken.

A plan written before the abort-rule fields existed fails this check. Reassess it, then add both fields honestly. Use `none (plan predates abort-rule fields; reassessed before F2)` only when the reassessment found nothing to name.

Resolve each invocation to one named agent. Record invocation, agent, exact resolved model ID, and the independence label before dispatch.

```
implementation_models = models that materially authored or rewrote the reviewed diff
review_model          = the exact resolved model used for the review
vendor(m)             = family of the MODEL NAME in m, routing prefix and variant suffix discarded

same-model     = vendor-bare name of review_model appears in implementation_models
same-provider  = vendor(review_model) appears among the implementation vendors
cross-provider = it does not
unprovable     = any model ID is `unresolved` or matches no known family
```

In omp, `auditor` runs on GPT-5.6 via `@review` and `oracle` via `@oracle`; a diff written by Claude models (main model or `task` subagents) therefore yields `cross-provider`, while a diff written by a GPT model yields `same-model` or `same-provider`. This records, it does not block. Purpose-built reviewer contract matters more than diversity alone. Same-model review is labelled `same-model`, never "cross-engine". When both model families materially implemented, record independence as unprovable rather than fabricating it.

Resolve the model ID from the reviewer, not from a config file. The harness states the exact resolved model in the subagent's own context, so the trailer asks the reviewer to echo it; that is the authoritative value and it is the one the record must carry. An agent name or alias such as `auditor` or `@review` is a roster entry, not a model ID, and recording one produces an independence claim nothing can check. When the reviewer cannot state its exact ID, record the literal `unresolved` and `independence: "unprovable"`. Never substitute a plausible-looking alias.

Independence is derived, never asserted. Record `implementation_models` - the models that materially authored or rewrote this diff - and let the validator compute the label:

| Label | Meaning |
|---|---|
| `cross-provider` | reviewer and implementer come from different vendors: two samples, the cross-engine lane |
| `same-provider` | same vendor, different model, such as Sonnet implementing and Opus or Fable reviewing |
| `same-model` | one model on both sides, variant suffix ignored |
| `unprovable` | a model ID is `unresolved`, or names no known family |

`same-provider` is a legitimate outcome, not a lesser one. A reviewer sharing the implementer's vendor still reads the diff under a purpose-built contract, and often reads it better for knowing the idiom. The label records which kind of review happened; it blocks nothing on its own. A mismatch between your claim and the derivation does block.

The vendor comes from the **model name**, never from the routing prefix. `anthropic/claude-opus-5`, `openrouter/anthropic/claude-opus-5`, `github-copilot/claude-opus-5` and `<provider>/cc/claude-opus-5` are one model behind four prefixes, so all four read as Anthropic and pair as `same-model`. A variant suffix is a reasoning-effort knob on one model: `gpt-5.6-sol:medium` and `gpt-5.6-sol:xhigh` are `same-model`. A name matching no known family, which is what a roster alias such as `auditor` is, yields `unprovable` rather than a guess.

Models exhibit self-preference bias, and capability does not reliably reduce it ([Panickssery et al.](https://arxiv.org/abs/2404.13076)). Structured multi-dimensional judging cut measured bias about 31.5% in high-bias models ([Yang et al.](https://arxiv.org/abs/2604.22891)), which is one reason Phase 2 uses sectioned briefs.

An unresolvable invocation is recorded loudly with its reason and becomes `INCONCLUSIVE`. Never fan it out to generic `task` workers in place of the purpose-built reviewer.

## Phase 1: Manual QA (you run it)

You are the QA lane. Do not delegate hands-on QA to a sub-agent: the orchestrator owns the real-surface proof, and the record's `qa` rows are written under your name.

When this review is a plan's merge gate (F2), run Fix waves step 1 first.

1. **Reuse first.** If this session already captured real-surface evidence for the FINAL tree (an evidence directory from this plan's execution, a `visual-qa` verdict on this same build), consume it as QA rows instead of re-running. A fix committed after a capture stales that capture: re-run the rows it covered.
2. **Pick the channel that faithfully exercises the surface** and capture the artifact:
   - HTTP: `curl -i` (or an API request context) - status line, headers, body.
   - CLI / TUI: a real pty - drive the command and keep the transcript; for color or layout evidence render through a browser-based terminal, never a `tmux capture-pane` dump.
   - Web: the real page in a real browser - omp's `browser` global in the `eval` tool (docs: `xd://eval/browser`) - action log plus screenshot (`read` the PNG to inspect it).
   - Desktop / GUI: OS-level automation against the running app - action log plus screenshot.
   - Library / SDK: a script that imports and exercises the public API - transcript.
   - Data-shaped work (migrations, configs, generated files): the resulting artifact itself, diffed or dumped.
3. **Cover at least**: the happy path the goal names, the riskiest edge (empty, boundary, malformed, or concurrent input), and one regression on adjacent behavior the change could have broken. Add a row for every stated success criterion.
4. **Build the QA matrix** - one row per scenario:

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|

A row without an artifact path is not PASS. If the application cannot even start, that is an immediate FAIL.

Any FAIL ends the review here: report **REVIEW FAILED** with the failing rows and skip the gate reviewer - reviewing code that does not work wastes the reviewer. Fix first, then re-enter at Phase 0 with the delta. When this review is a plan's merge gate (final verification wave F2), each fix is first appended to the plan as an `N.` row under `## TODOs` (mirrored as a todo) before it is dispatched, so its completion is read as an implementation lane, not as a final-wave reviewer result with a missing verdict. Record the wave first (Fix waves step 3), then fix through Fix waves.

---

## Phase 2: Launch the reviewers

Launch invocations selected in Phase 0.5. Each is a leaf, read-only reviewer. It does not modify reviewed branch, fetch network context, or spawn sub-reviewers. Dispatch with the `task` tool and continue only independent report preparation while it runs; results are delivered automatically, so never poll.

### `implementation-audit`

What is forbidden is the fan-out copy: the same brief sent to several reviewers **on the same model**, split by scope. That produces correlated samples, duplicate repository reads, inconsistent scope boundaries, and verdicts needing reconciliation. Ensemble value depends on error independence ([Verga et al., Jury](https://arxiv.org/abs/2404.18796)); three lanes on one model is theatre. Do not split one audit into three same-model scope lanes.

What is welcome is a lane that differs in a way that makes its errors independent. Parallel background invocations are the right shape whenever reviewer **provider family**, system contract or specialized tool access, evidence source or review surface, required output methodology, or context isolation genuinely exceeding usable attention differs. Two reviewers on two vendors are two samples; two reviewers on one vendor are one sample twice. Folded scopes are recorded as **covered by one invocation**, never `SKIPPED`.

An extra lane does not need the largest model. A narrow, well-defined scope on a smaller model from a different vendor adds more than a second lane on the implementer's own model, and costs less. Judge the lane by scope fit and vendor, never by model size.

**Send the brief below verbatim.** Folding five lanes into one brief removed the trace a dropped lane used to leave: an omitted section produces no missing row, so the reviewer answers what it received, returns `PASS`, and nothing on disk records that a third of the assignment was absent. Paraphrasing or summarising the section list reintroduces exactly that hole. Substitute the `{...}` inputs and change nothing else. Fill `{F3 REPORT PATH}` with the integration-review report path from F3, or `none: <Whole-diff review field value>`. Put the diff, changed-file list, and QA matrix into the brief itself: `auditor` and `oracle` have no shell, so they cannot run `git diff`. A brief soliciting `APPROVE` or `REJECT` instead of the verdict token breaks the mapping the record depends on.

Dispatch: `task` with one item: `agent: "auditor"`, `solutionSpace: "Review of a finished diff; defects unknown"`, `task:` the brief below (the text between the fences).

```
Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.

Inputs:
- Goal, constraints, and behavioural contract: {GOAL, CONSTRAINTS, BACKGROUND}
- Changed files and reviewed diff: {CHANGED_FILES, DIFF}
- Repository context and plan: {FILE PATHS, CONTEXT_MINING, PLAN}
- Manual QA matrix and artifacts: {QA MATRIX}
- Author-supplied behavioural criteria: {CRITERIA WITH FIVE FIELDS}
- Whole-diff review report and its class list, when F3 ran: {F3 REPORT PATH}

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Review exactly these five sections:
1. Goal and behavioural contract
2. Correctness, regressions, architecture, wire contracts
3. Security and privacy delta
4. Verification adequacy
5. Final `PASS | FAIL | INCONCLUSIVE`

Generate at least one adversarial behavioural criterion of your own using Phase 2.5 fields, and make every criterion you emit your own - the validator rejects a trailer carrying any criterion whose invariant is restated from the plan, so quoting one back beside an original does not satisfy the rule. Author-supplied criteria are inputs, never complete review scope.

Security scope: a finding blocks only when it cites changed lines in DIFF_RANGE, or shows change altered exploitability or exposure of pre-existing code. Otherwise label it `PRE-EXISTING / OUT-OF-SCOPE` as a note.

Brief guard: if this message did not carry all five numbered sections, or withheld the QA matrix, return INCONCLUSIVE and name what was missing. Do not answer a narrower brief as if it were the whole assignment.

Return each blocker on its own `Blocker B<n>:` line with severity, `file:line` or artifact evidence, violated contract, and fix direction. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Confirm each listed class is closed at every site; do not re-derive classes F3 already closed. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: <numbers you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no from your own section 3>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER
```

### `strategic-risk-review`

When selected, launch one resolved strategic-risk-review invocation after implementation-audit findings are available. This reviewer is read-only and cannot run commands. Paste diff, changed-file list, QA matrix, and implementation-audit findings inline. It does not re-derive those findings.

Pass this exact brief to resolved strategic-risk-review agent:

Dispatch: `task` with one item: `agent: "oracle"`, `solutionSpace: "Strategic risk review of a finished diff; failure modes open"`, `task:` the brief below (the text between the fences).

```
Read-only strategic risk review. Do not run commands, fetch network context, modify files, or spawn sub-reviewers.

Changed files:
{CHANGED_FILES}

Diff:
{DIFF}

Manual QA matrix:
{QA MATRIX}

Implementation-audit findings:
{AUDITOR FINDINGS}

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Answer four questions:
1. Does change hold up architecturally against rest of system?
2. What does auditor's line-level view structurally miss?
3. Which failure mode would hurt most in production, and is it addressed?
4. Is any auditor finding a false positive on unchanged behaviour?

Brief guard: if this message did not carry all four questions, the diff, the changed-file list, the QA matrix, and the implementation-audit findings, return INCONCLUSIVE and name what was missing.

Do not re-derive auditor findings. Start each blocker with its own `Blocker B<n>:` line. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: <numbers of the questions you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - did this change move a data class somewhere new>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER
```

Store each reviewer's trailer verbatim at a tracked path (copy it from the delivered result or `read agent://<id>`; never retype it) and point the record's `trailer_artifact` at it. The validator reads its facts from that file, so a trailer you paraphrase, trim, or write yourself is a fabricated review record, not a formatting shortcut.

Normalize verdicts before aggregation: reviewer `APPROVE` maps to `PASS`; `REJECT` maps to `FAIL`; anything else, including narrative without verdict token, maps to `INCONCLUSIVE` and blocks. A trailer whose `verdict` field carries `APPROVE` blocks outright - that token means the brief solicited the wrong vocabulary, so re-run the invocation with the verbatim brief instead of translating the answer.

A returned `INCONCLUSIVE` naming missing brief sections is not a reviewer failure to retry around. It means the dispatched brief was incomplete: re-send the verbatim brief with the missing sections, then re-review.

## Phase 2.5: Criteria discipline

Every behavioural criterion carries five fields:

```
Invariant:        what must remain true
Positive witness: a representative valid outcome
Negative control: a plausible broken outcome that MUST fail the criterion
Observable:       the runtime evidence distinguishing them
Boundary:         the layer where the result is checked
```

Worked example:

```
Invariant:        the notice describes one coherent disposition for every omitted item.
Positive witness: "X was left out because only 3 sets can be included."
Negative control: "X was left out. Capped at 3 sets."
Observable:       the rendered sentence assigns no item both omitted and included-under-cap.
Boundary:         rendered UI copy, not source-key containment.
```

Root cause: each verification was built by same person, in same sitting, from same mental model as fix. A test derived from a belief tests belief. Those defects survived 15,715 green tests, clean typecheck, mutation testing, and real-harness probe.

Five fields are mandatory for semantic, policy, authorization, transformation, fallback, and boundary criteria. They are not required for mechanical criteria. "Generated file byte-equals canonical artifact" already discriminates. Reviewer must generate at least one adversarial criterion of its own. Author-supplied criteria are inputs, never complete review scope.

## Phase 3: Wait & Collect

Results arrive automatically; use `wait` only when blocked on them, and do independent root work meanwhile. Timeout, ack-only reply, empty result, missing deliverable, or explicit `BLOCKED:` is never `PASS`. Apply one bounded fresh-context retry; if unresolved, record `INCONCLUSIVE` with reason. Never fan out or use a long-lived reviewer carrying stale context.

A rejecting invocation must name its blockers inline, each on its own `Blocker B<n>:` line citing the violated criterion or requirement plus an evidence pointer. A FAIL whose `Blocker B<n>:` lines and trailer `blockers:` field disagree is incomplete: re-dispatch it like a missing trailer; never edit the reply. A bare `FAIL` token without findings is not a verdict: treat it as inconclusive, apply one bounded respawn, then record `INCONCLUSIVE` with that reason. A reply carrying no trailer is the same case - without it, what the reviewer was asked cannot be established.

Review evidence must be safe to share. Redact or mask secrets and sensitive user data before putting evidence into records, logs, or handoffs. Never include raw tokens, credentials, auth headers, cookies, API keys, env dumps, private logs, or PII; summarize with lengths, hashes, and short non-sensitive prefixes when identity is needed.

Store variable invocation results independently:

| Invocation | Agent | Model | Independence | Verdict | Notes |
|---|---|---|---|---|---|
| Manual QA | orchestrator | - | - | `PASS` / `FAIL` | rows and artifact paths |
| `implementation-audit` when run | resolved named agent | exact model ID | `cross-provider` / `same-provider` / `same-model` / `unprovable` | `PASS` / `FAIL` / `INCONCLUSIVE` | findings |
| `strategic-risk-review` when run | resolved named agent | exact model ID | `cross-provider` / `same-provider` / `same-model` / `unprovable` | `PASS` / `FAIL` / `INCONCLUSIVE` | findings |

A re-review after fixes is a new `task` call (never `write agent://<id>` to a reviewer that already returned a verdict) and starts fresh at Phase 0 and sees delta plus current evidence. Any commit touching reviewed code invalidates all verdicts; a commit that only stores this record's own evidence does not.

## Phase 4: Deliver Verdict

Gate passes only when QA matrix has no failing row and every invocation actually run returned `PASS`. The one other outcome that permits merge is an override: QA passed, every invocation returned `PASS` or `FAIL` with a stored trailer, the user agreed in this session, and the record names them in `override.by` and carries one `downgrades` entry per blocker of every FAIL trailer. An override is reported as overridden, never as PASS. Without that, one `FAIL` or `INCONCLUSIVE` blocks. No-review decision can pass only with clean QA and recorded `decision_reason`, unless mandatory class requires both invocations.

Used as the final gate before a merge, a PR handoff, or a plan's completion, this skill is **blocking**. A timeout, ack-only reply, missing deliverable, explicit `BLOCKED:`, or `INCONCLUSIVE` lane is not a pass. Treat it as failed: investigate the underlying uncertainty with the `debugging` skill when runtime behaviour may be wrong, fix with evidence through Fix waves, and re-run the affected invocation before claiming completion or merging.

Re-classify `mandatory_class` against the **final diff**, not against the plan. The plan's class was set before the work existed and goes stale the moment a wave adds something. Re-classify when any of these appear anywhere in the final diff, whether or not the plan predicted them: a new external network recipient, a new field in a persisted or transmitted structure, a new data class reaching an existing recipient, a new authentication or authorisation path, a schema or migration step, a changed wire contract, or new shared mutable state. A reviewer reporting a security delta while the record says `none` blocks, and correctly so - the reviewer saw the final diff and the plan did not.

**Downgrades.** A reviewer blocker the gate leaves unfixed ends only in `override` plus exactly one `downgrades` entry per blocker id of every FAIL trailer, never silently. `rule` says why it may stay: `below-threshold` when you judge that the finding misses both (a) and (b) of the blocking threshold, with `reason` naming the missing trigger or asset, and the user agreed; `accepted-residual` when the plan's `Accepted residual risks` covers it; `out-of-scope` when `Out of scope for blocking` covers it; `frozen` when the user chose freeze at a convergence STOP. `disposition` is `residual` or `follow-up`; a follow-up names where it is tracked in `reason`.

**Write and validate the gate record here, as the last step before merging.** Phase 5 defines the record. Write the record and the reviewer trailers, **stage them**, then run the validator: it requires the artifacts to be in the index, because a file nobody added vanishes from every other checkout and takes the evidence with it.

Committing that evidence afterwards does not invalidate the record. The reviewed target is the **code**: commits on top of `reviewed_sha` are tolerated while they touch only the record, the trailers it cites, and the plan - the files whose existence storing the record causes, each of which the validator also reads and requires to be tracked. Anything else among them blocks, which is the point. Without that rule the gate would demand durable evidence and then reject the record for having been stored, and the cheap way out would be to leave the evidence untracked.

`qa[].artifact` is **not** exempt, deliberately. Write your QA artifacts before validating. A QA row that points at the file its QA exercised is ordinary, and honouring it would let one free-form path silently exempt reviewed source from the binding.

**A path is exempt only because the validator authenticated its bytes, never because the record named it.** The exemption set is a by-product of that authentication: the record is admitted from the `--record` path you passed, the plan and each trailer are admitted when their recorded digest matches. A path the validator did not verify cannot be exempted, so adding a new path field to the record cannot widen what counts as reviewed. `plan_sha256` covers the plan and `verdicts[].trailer_sha256` covers each trailer artifact - compute both with `shasum -a 256 <file>`. Reading a trailer constrains only the region between the markers, so without the digest one file could carry a genuine reviewer reply beside reviewed source, and the path exemption would cover the source half: an authorization rule could be rewritten after the review with the gate still passing. A digest mismatch means the review is stale, so re-review.

The plan is bound by **content**, not just by path: `plan_sha256` is the digest of the exact bytes the reviewers were given. The plan is a review input and it is mutable, and each adversarial criterion is checked against the plan as it stands - so without the digest, deleting an invariant after the review would relicense a criterion the reviewer had copied as its own work. Where the plan is git-ignored, as `.omo/plans/` commonly is, that edit needs no commit at all and nothing in git would show it. Compute it with `shasum -a 256 <plan>`. If the plan legitimately changes, the review is stale: re-review against the plan as it now stands.

The plan must already be in its final state, including its own merge-gate checkbox (final verification wave F2) marked `[x]`, at the moment reviewers are dispatched and this digest is taken - no plan edit may follow. `plan_sha256` binds whatever bytes existed at hash time, so hashing before that mark would seal an unfrozen plan and let the gate's own required output invalidate its own binding.

A commit touching reviewed code after the review still invalidates everything. Re-review the delta.

```markdown
# Review Work - Final Report

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

Decision reason: <one line>
Mandatory class: <none or class>

| Invocation | Agent | Exact model ID | Independence | Verdict | Confidence |
|---|---|---|---|---|---|
| Manual QA (N rows, M artifacts) | orchestrator | - | - | PASS/FAIL | - |
| implementation-audit, if run | <agent> | <model> | cross-provider/same-provider/same-model/unprovable | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| strategic-risk-review, if run | <agent> | <model> | cross-provider/same-provider/same-model/unprovable | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |

## Blocking Issues
[Failing QA rows first, then reviewer blockers, deduplicated in fix order]

## Covered by one invocation
[Correctness, architecture, wire contracts, security/privacy, verification scopes folded into implementation-audit]

## Key Findings
[Top findings grouped by theme]

## Recommendations
[If blocked: exact fixes in priority order. If passed: short non-blocking notes.]
```

## Fix waves: delta review and convergence (F2)

Applies when this review is a plan's merge gate. `GC` = `node $SKILL_DIR/scripts/gate-convergence.mjs --repo <repo root> --plan <plan path>`, with the plan path from Phase 0.6. A wave is Phase 1 plus, when it passes, Phases 2-3, all on the snapshot taken in step 1. `.omo/gate-deltas/` holds review artifacts; never commit it.

1. Before Phase 1:
   - `GC baseline --sha HEAD` (prints the existing baseline when F3 already set one);
   - `GC ready --lane F2`; `NOT READY` → resolve every listed reason and dispatch nothing;
   - `GC snapshot --lane F2`; it refuses uncommitted tracked changes. Its first output line is the snapshot path; keep it for step 3.
2. Until the wave is recorded, change nothing tracked. QA artifacts go under `.omo/evidence/<plan basename>/wave-<n>/` and stay uncommitted during waves; `.omo/` is untracked in these repos, so the snapshot's clean-tree check is unaffected. They are staged with the record in Phase 5. Between waves commit only fix code. A commit without a delta review blocks the next wave.
3. After the wave's verdicts, before any fix, run `GC wave --lane F2 --snapshot <path from step 1>` with:
   - `--outcome qa=PASS|FAIL`, plus `--outcome <invocation>=PASS|FAIL|INCONCLUSIVE` for each invocation that ran, normalised as in Phases 2-3;
   - one `--blocker QA<n>` per failing QA row;
   - one `--blocker <class>=<site>,<site>…` per distinct reviewer blocker class, with sites from its `sites:` line;
   - `@fix` appended to an id (`QA2@fix`, `stale-cache@fix=src/a.ts:4`) when the row passed in the previous F2 wave, or when the finding names a fix row or fix commit as its cause.

   Then act on the decision:
   - `DECISION: PASS` → Phase 4.
   - `CONTINUE` → step 4.
   - `STOP` (exit 3) → no fix. `ask` the user, showing the ledger numbers. The options:
     - freeze, only when QA passed and every invocation returned PASS or FAIL with a stored trailer: write the Phase 4 record with the validator's `override`, with one `downgrades` entry per remaining reviewer blocker (rule `frozen`);
     - re-plan: a separate plan for the affected mechanism;
     - continue: one more fix wave.

     Record the answer with `GC decide --lane F2 --choice freeze|replan|continue --by <user> --reason <text>`. The script refuses freeze after failing QA or an INCONCLUSIVE invocation, because the record requires passing QA rows and a trailer per invocation. Without `ask` UI, report the numbers and options and stop.
4. Each fix is first an `N.` row under `## TODOs`. A fix that adds a subsystem (process, proxy, store, staging tree, daemon, endpoint) is not a row: stop and plan it separately. Implement and commit.
5. Review each contiguous commit range once, naming every row it implements:
   a. `GC patch --base <base> --head <head> --out .omo/gate-deltas/F2-<first row>-<head12>-<UTC yyyymmddHHMMSS>`. It writes one read-only patch per commit plus a manifest, and prints the manifest path.
   b. Dispatch one `task` item: `agent: "plan-reviewer"`, `solutionSpace: "Review of a fix delta; defects unknown"`, `task:` the delta brief below.
   c. Write the reviewer's structured result verbatim (copy the delivered payload or `read agent://<id>`, never retype it) to `verdict.json` in that directory, then run `GC delta --lane F2 --dir <dir> --row <id> [--row <id>…]`.
   d. REJECT: amend with new commits, then review the whole range `<base>..<new head>` in a fresh `task` (never `write agent://`). A range holding only the amendment leaves the rejected commits open. `delta` exit 3 (second REJECT on these commits): `ask` the user: amend again, accept (`GC accept --lane F2 --dir <dir> --by <user> --reason <text>`), or re-plan.
   e. No structured verdict (failure, timeout): one fresh retry; still none → stop and tell the user. Record nothing; `ready` stays `NOT READY`.
6. Back to step 1.

Delta brief (substitute the `{...}` inputs, change nothing else):

```
Review this fix delta. Workspace root: {REPO ROOT}. Plan: {PLAN PATH}.
Plan invariants, verbatim from the plan's ## Merge gate (feature-specific criteria, accepted residual risks, out of scope for blocking; a field the plan lacks reads "<field>: not in plan"):
{PLAN INVARIANTS}
Fix entries this delta implements, verbatim from the plan's ## TODOs:
{FIX ROWS}
Commit range {BASE SHA}..{HEAD SHA}, commits {FIX SHAS}.
The diff is one patch file per commit, in commit order, each with its commit header. Read {MANIFEST PATH}, then read every patch file it lists completely before you decide. Judge the cumulative effect as well: a later commit can revert or replace an earlier one.
```

## Phase 5: Gate record

Write reviewer-readable Markdown to plan's `Evidence:` path. As the last step before merging, write the JSON gate record to `.omo/evidence/gate/<plan-basename>.json`, where `<plan-basename>` is the plan filename without `.md`. Before reusing a lane's coverage after a continuation or compaction, re-read the record and require the exact invocation and SHA pair; chat history or an unstamped report is not coverage.

**The record and every trailer artifact must be tracked by git, not merely un-ignored.** The validator checks the index: a path that is un-ignored but was never added still disappears for the next reader, so it blocks. Stage the artifacts before validating. If your project ignores `.omo/`, either un-ignore `.omo/evidence/` or place the record somewhere tracked and use that path consistently. Record schema is `omo.merge-gate/v2`:

```json
{
  "schema": "omo.merge-gate/v2",
  "plan": ".omo/plans/<plan>.md",
  "plan_sha256": "<sha256 of the exact plan bytes the reviewers were given>",
  "reviewed_sha": "<full 40-hex current HEAD>",
  "diff_base": "<full 40-hex merge-base>",
  "reviewers_run": ["implementation-audit", "strategic-risk-review"],
  "decision_reason": "<one line>",
  "mandatory_class": "none",
  "implementation_models": ["<model that authored or rewrote this diff>"],
  "qa": [{ "name": "<QA scope>", "passed": true, "artifact": "<non-empty artifact path>" }],
  "whole_diff": { "run": false, "reason": "<reason when not run>" },
  "resolution": [{ "invocation": "implementation-audit", "agent": "auditor", "model": "<exact resolved model ID, or unresolved>", "independence": "cross-provider" }],
  "verdicts": [{ "invocation": "implementation-audit", "verdict": "PASS", "trailer_artifact": "<tracked path to the reviewer's verbatim trailer>", "trailer_sha256": "<sha256 of that artifact's bytes>", "note": "<artifact or finding pointer>" }],
  "blockers": [{ "id": "B1", "severity": "high", "location": "path:line", "coverage": "path::test name", "fix_sha": "<full 40-hex fix SHA>" }],
  "downgrades": [{ "invocation": "implementation-audit", "blocker": "B1", "rule": "below-threshold", "reason": "<missing trigger or asset, one line>", "disposition": "residual" }],
  "override": { "by": "<non-empty attributable identity>", "reason": "<non-empty reason>" }
}
```

`v1` records are rejected. They predate the trailer contract, so no honest retrofit exists: re-run the review rather than editing an old record. `implementation_models` names the models that materially authored or rewrote the reviewed diff, and the validator derives each `independence` label from it.

`reviewers_run` is an empty array when no reviewer runs. `mandatory_class` must be exactly one of `none`, `auth-secrets-pii`, `schema-migration`, `wire-contract-api`, or `concurrency-state`; absence or any other value blocks the gate. `qa` must contain at least one row, every row must set `passed` to `true`, and every row must name a non-empty `artifact`. Omit `override` for a normal pass. An override must have non-empty `by` and `reason`, may accompany `FAIL` verdicts only (an `INCONCLUSIVE` invocation is re-run, never overridden), and must not accompany a full set of `PASS` verdicts. Blocker `coverage` is `path::test name` or `not-testable:<reason>`.

`downgrades` appears only with an override over a FAIL verdict and holds exactly one entry per blocker id of each FAIL trailer. A FAIL trailer's `blockers:` field must equal the reply's `Blocker B<n>:` lines; a PASS or INCONCLUSIVE trailer carries `none` or omits the line. `rule` is `below-threshold`, `accepted-residual`, `out-of-scope`, or `frozen`; `disposition` is `residual` or `follow-up`; `reason` is one line.

Every invocation in `reviewers_run` needs its **own** `trailer_artifact`, and the validator derives its facts from that file rather than from this JSON. Two verdicts may not cite the same file, and each trailer's `invocation` field must name the lane the record cites it for. Without both rules one dispatched reviewer satisfies every recorded invocation: the section sets nest, so an audit trailer covers the strategic set, and the model check only discriminates when the two lanes resolved to different models. The validator also requires the full section set for the invocation (`1,2,3,4,5` for `implementation-audit`, `1,2,3,4` for `strategic-risk-review`), complete five-field adversarial criteria, every one of whose invariants is the reviewer's own rather than restated from the plan, agreement between the trailer's `verdict` and `model_id` and the record's, and blocks `mandatory_class: "none"` against any trailer reporting `security_delta: yes`. A repeated scalar field blocks as ambiguous, so an honest narrow answer cannot be overridden by appending one permissive line - and the same rule holds at every level of both artifacts: a repeated field inside a criterion, a second criterion appended beside a copied one, a second trailer block, and a duplicate key in the record itself all block. That is one rule, applied at every level of the structure - and each level was found only after the previous fix left the next one open, so treat the rule as the invariant rather than the list as complete. A missing trailer block blocks: without it, what the reviewer was asked cannot be established.

Markers are matched as whole lines, so a reviewer may quote `REVIEW-TRAILER-v1` or `END-REVIEW-TRAILER` inside its findings as `file:line` evidence without making its own reply unstorable. An artifact must carry exactly one such block: a second one blocks, because appending a block is otherwise enough to override the verdict the reviewer actually wrote while its real answer sits verbatim in the same file.

The validator reads files; it cannot witness the dispatch. A wholly fabricated trailer therefore passes. That is the deliberate boundary: an omitted brief section used to leave no trace at all, and now producing a passing record requires authoring a reviewer reply that never happened, per invocation, under your own name. Validate record manually from repository root as the last step before merge:

```bash
node $SKILL_DIR/scripts/validate-gate-record.mjs \
  --repo <repo root> \
  --record .omo/evidence/gate/<plan-basename>.json \
  --plan <plan-path>
```

Validator binds the plan and every trailer artifact by content and the reviewed code by SHA, requires both invocations for mandatory classes, requires QA evidence, requires a complete reviewer trailer per invocation, requires every artifact to be tracked, derives independence from `implementation_models`, and prints one outcome word on stdout: `passed` (exit 0) for a valid full PASS record, `overridden` (exit 0) for FAIL verdicts with an attributable override and one downgrade per blocker, `blocked` (exit 1) otherwise, with the blocking field and reason on stderr. `--plan-only` prints `passed` or `blocked` the same way. Missing records, invalid records, `v1` records, untracked or ignored record and trailer paths, artifacts resolving outside the repository, a plan whose bytes no longer match `plan_sha256`, a trailer whose bytes no longer match its `trailer_sha256`, incomplete briefs, unrecognized mandatory classes, non-PASS verdicts without a legal override, an override over `INCONCLUSIVE`, and every error path are `blocked`. A commit touching anything beyond the record's own evidence paths invalidates it and requires fresh review.

## Enforcement

The `merge-gate` extension (`~/.omp/agent/extensions/merge-gate.ts`) runs the validator on the newest `omo.merge-gate/v2` record whenever a final reply claims completion or asks for a merge, and refuses the stop until it exits 0. It also runs `--plan-only` on every plan that plan mode proposes, opt-out plans included: the validator, not the extension, decides whether the opt-out is real. Do not try to word around it: either the gate passes, or say plainly that it has not. Arbitrary shell merges remain possible; universal enforcement would require a git hook or server-side gate.
