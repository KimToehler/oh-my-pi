# Plan A: Evo2 reviewer checks (P1 generic checks, P4 domain rule)

## Context

Since 2026-10-18, omp reviews each `xd://propose` with the bundled `plan-reviewer` agent, a model from a different family. Its four mechanical checks miss most of the classes listed in `~/.omp/agent/notes/planning-rules-from-evo2.md`. This plan does three things:

1. It extends the bundled reviewer with Evo2 rules 1-6, 8 and 12 (P1, generic part).
2. It makes the reviewer usable on fix deltas through `task`, which Plan B needs.
3. It adds a local domain rule for evaluation and metaharness work (P4).

The process checks (abort rule, decided assumptions, cut at more than 2 subsystems) and the gate-phase changes (P2, P3) belong to Plan B: `/Users/tim/.omp/agent/sessions/-git-oh-my-pi/2026-10-18T21-44-49-514Z_01a150f9-7a6a-720b-b952-f2a85629e084/local/evo2-gate-process-plan.md`. Plan B starts only after this plan is merged and deployed.

### Cut (why two plans)

- Plan A changes one mechanism: what the reviewer checks and how it can be called. It edits the bundled prompt in this repo and one local rule.
- Plan B changes a second mechanism: the gate contract and the gate procedure. That is the merge-gate rule, the merge-gate extension and the `review-work` adapter, all of it local.
- Each plan gets its own proof. B depends on A in two places: the `structured: true` frontmatter flag and the delta line in the reviewer's method.

### Verified facts this plan builds on

- **Native review runtime cap.** The cap is 300 s (`REVIEW_MAX_RUNTIME_MS`, `packages/coding-agent/src/plan-mode/plan-review.ts:63`). Observed reviews took 20.8 s and 28.5 s. A longer prompt fits within the cap.
- **`plan-reviewer` is callable from execution through `task`.**
  - The main session spawn policy is `"*"` (`src/sdk.ts:2380`). `bypassSpawnPolicy` matters only for restricted parents (`src/task/structured-subagent.ts:307-314`).
  - Through `task`, a verdict object comes back only when `task.structured` is on (default `false`, `src/task/settings.ts:255-258`) or the agent declares `structured: true` (`structured-subagent.ts:411`). Today `plan-reviewer.md` has no `structured:` key, so a `task` call returns prose.
- **`plan.review.agent` cannot be path-scoped.**
  - Path scoping exists only for settings that declare `pathScoped`, and those are string arrays (`src/config/model-settings.ts:67-81`, resolver `src/config/settings.ts:495-524`). `plan.review.agent` is a plain string (`src/plan-mode/settings.ts:78-90`).
  - The project layer is only `<cwd>/.omp/config.yml`, with no walk-up (`src/discovery/builtin.ts:61-78`).
  - This is why P4 uses a rule instead of a second agent.
- **Rules reach the reviewer, filtered by agent name.**
  - Subagents receive the parent's rule set and re-bucket it under `agentName = agent.name` (`src/task/executor.ts:4508,4528`; `src/sdk.ts:2156-2176`).
  - The frontmatter key `agents:` filters rules by agent name (`src/capability/rule.ts:197-228`; `src/capability/rule-buckets.ts:60`).
  - Evidence: the PlanReview transcript of 2026-10-18 (`~/.omp/agent/sessions/-git-oh-my-pi/2026-10-18T21-51-33-056Z_01a150ff-a2c0-7553-9365-1923bcf07bac/PlanReview.jsonl`) contains the always-apply user rules.
  - A rule with `agents: [plan-reviewer]` reaches the native propose review and `task` dispatches of `plan-reviewer`, in TUI, ACP and `--plan-yolo` alike. It never reaches the main session.

### Entry-path parity (CHECK 6 applied to this plan)

| Path that runs the reviewer | Bundled prompt edits | Domain rule (`agents: [plan-reviewer]`) | Verdict object |
|---|---|---|---|
| Native propose, TUI | yes | yes | yes, already structured (`plan-review.ts:187`) |
| Native propose, ACP | yes, same `runStructuredSubagent` | yes | yes |
| Native propose, `--plan-yolo` | yes | yes | yes |
| `task` with `agent: "plan-reviewer"` (Plan B fix deltas, manual use) | yes | yes | only after Step 1 adds `structured: true` |

## Approach

### Step 0: Worktree and backup

1. Create the worktree: `git -C /Users/tim/git/oh-my-pi worktree add .worktrees/evo2-reviewer-checks -b evo2-reviewer-checks HEAD`. All repo edits, builds and tests run there. The main checkout has 46 dirty paths that belong to other work; do not touch them.
2. In the worktree, run `bun install --frozen-lockfile`. Then check that `bun packages/coding-agent/src/cli.ts --version` runs. If it fails on the native addon, run `bun --cwd=packages/natives run build`. That is the same command `scripts/deploy-local.sh` uses.
3. Back up the local setup before changing anything: `TS=$(date +%Y%m%d-%H%M%S); cp -a ~/.omp/agent/rules ~/.omp/agent/rules.bak-evo2-reviewer-checks-$TS; cp -a ~/.omp/agent/agents ~/.omp/agent/agents.bak-evo2-reviewer-checks-$TS`. Discovery reads only `<agentDir>/rules` and `<agentDir>/agents`, so these sibling directories are never loaded.

### Step 1: Bundled reviewer works on deltas and returns a verdict through `task`

File: `packages/coding-agent/src/prompts/agents/plan-reviewer.md`, plus one test assertion. Do the test first (RED), then the prompt edits.

1. In `packages/coding-agent/test/bundled-agent-parsing.test.ts`, in the existing `it("parses plan-reviewer as a read-only agent ...")`, add `expect(planReviewer?.structured).toBe(true);` directly after the `tools` assertion. Above the assertion, add this comment: `// review-work's fix-delta dispatch runs plan-reviewer through task, where task.structured defaults off; without the flag the verdict arrives as prose the gate cannot read.`
2. RED: run `bun test packages/coding-agent/test/bundled-agent-parsing.test.ts` against the unchanged prompt. Expected: this test fails on `structured` (received `undefined`). Save the output to `.omo/evidence/evo2-reviewer-checks/red-structured.txt` in the worktree. If it passes, stop: the flag already exists and the assertion does not discriminate.
3. In the frontmatter of `plan-reviewer.md`, add the line `structured: true` directly after `model: "@advisor"`.
4. In the frontmatter `description`, replace the text with: `"Read-only plan content reviewer: checks a proposed plan or a fix delta (fix entry plus diff) for claims, design, verification and security against the repo and returns an OKAY or REJECT verdict"`.
5. In the output schema, replace the `blockers.elements.properties.area.metadata.description` value with `"correctness | architecture | quality | security | executability | CHECK n | a check label defined by a rule loaded for you"`. This changes metadata only. The schema shape stays the same, so `verdictSchema` (`plan-review.ts:65-71`) and `planReviewSchema()` keep working.
6. In `<method>`, replace the sentence `The plan arrives inline in your assignment. Work targeted:` with:
   `The plan arrives inline in your assignment, or as one file path you read once. An assignment may instead carry a delta: one fix entry plus its diff, with the plan's invariants as context. Review a delta like a plan: its claims are the fix entry and the diff, and every check applies to what the delta adds, changes or removes. Work targeted:`
7. GREEN: rerun the test from 1.2. Expected: pass. Save the output next to the RED file as `green-structured.txt`.

### Step 2: Bundled reviewer checks Evo2 rules 1-6, 8 and 12

Same file. Replace the whole `<mechanical_checks>` block (from `<mechanical_checks>` through `</mechanical_checks>`) with this text, verbatim:

```
<mechanical_checks>
Eight binary checks. Each applies ONLY when the plan contains its trigger. When a check is triggered and the plan lacks the required answer, that is a blocker: name the check number and the exact plan slot (section, todo id, or quoted line). Rules loaded for you may define further checks under their own labels in the same form. When more than three blockers exist, keep them in this order: review-scope correctness, then CHECK 1-8 by number, then rule-defined checks, then the remaining review-scope items.

- **CHECK 1, holders and sinks.** Trigger: a protected value (credential, token, PII) or "X must never reach / leak to / appear in Y". Required: an inventory, derived by search, of every holder of X (process, env, file, argv, request body, in-memory object) and every sink (file, DB column, log, path name, error message, diff, and the stdout/stderr of every holder, because a holder is a sink for everything it prints); ONE named chokepoint new paths inherit automatically, or a reason a sink is excluded; and a negative control that plants a sentinel in every input field and scans every artifact for zero hits.
- **CHECK 2, complete identity.** Trigger: a hash, digest, cache key, fingerprint, identity, or recorded provenance field used to decide sameness. Required: every input that influences the result, each bound or excluded with a reason; for every recorded provenance field the value it is compared against (a field only checked for presence binds nothing); and a control per input: two runs differing only in that input must be told apart.
- **CHECK 3, enumerated forbidden set.** Trigger: a rule that lists forbidden characters, strings, paths, fields, error types, or spellings. Required: inversion to an allow-set, delegation to existing tooling (parser, canonicaliser, type), or an argument why the enumeration is complete; and a control over the whole input space (for example every printable non-word character), not a few examples.
- **CHECK 4, decision predicate.** Trigger: a predicate the plan defines or relies on as a decision (gate, admission, or acceptance criterion), such as "complete", "ready", "safe", "matched", "valid", "eligible". A test runner's pass/fail status ("bun test -> all pass") is not a trigger. Required: a one-sentence definition; the result for each of these input states the input can be in: missing, corrupt or unreadable, still running or partial, lossy, with rejection (or a visible "undecidable" value) as the default; and a negative control covering at least "missing" and, where it applies, "still running".
- **CHECK 5, verified bytes are used bytes.** Trigger: the plan checks, validates, scans, or hashes an object and later uses, copies, mounts, or executes it. Required: per check, the checked object and the used object are the same bytes (read once, verify, then use that copy), or the mutable reference is pinned (tag to digest, path to a run-owned copy); and a control that changes the source between check and use and expects rejection or the old verified bytes.
- **CHECK 6, entry-path parity.** Trigger: more than one path creates or consumes the same entity or runs the same check (launch and resume, two modes, CLI/API/TUI/ACP, local and registry source). Required: the list of paths with every new check and field marked per path, each exception with a reason; and a control per path that only that path takes.
- **CHECK 7, one truth per concept.** Trigger: two places derive the same concept independently (what runs and what is hashed, what is checked and what is copied, one value computed in two modules). Required: one shared function or artifact both consume, or a reason they cannot share one. Two derivations that "should agree" are a blocker even if they agree today.
- **CHECK 8, narrow defaults, explicit choice, no silent runtime fallback.** Trigger: a new exposing option (bind address, permission, visibility, retention), an implicit selection that decides a result (which run, which pair, latest-wins, ordering), or runtime code that substitutes a value or path when the intended one fails. Required: the narrowest default; the selection settable explicitly and reported back; ties broken deterministically; every substitution visible to the caller, never silent.

Also: every `## Merge gate` criterion's `Boundary:` must name a real code location you can find (file, function, handler). A boundary you cannot locate is a blocker.
</mechanical_checks>
```

Leave everything else in the file as it is, including `<identity>`, `<review_scope>`, `<decision>` and `<output>`. The phrase "Four binary checks" disappears with the replaced block. Run `grep -rn "Four binary checks\|four mechanical checks" packages/coding-agent/src docs`. If it finds a hit outside the replaced block, change the count to "eight" there.

### Step 3: Domain rule for evaluation work (P4, local)

Create `~/.omp/agent/rules/plan-review-eval-domain.md` with exactly this content:

```
---
description: Plan-review domain checks for evaluation, benchmark and metaharness work - environment contract, executed files, liveness, metric scope, replacement, run identity
agents: [plan-reviewer]
alwaysApply: true
---

# Domain checks: evaluation runs

Trigger for this whole rule: the plan or delta changes files under `packages/metaharness/`, or plans a run of an agent, verifier or benchmark inside a container, on a remote host, or through a runner or manager process. Otherwise ignore this rule entirely.

Labels are DOMAIN 1-6. Same form as CHECK n: each check fires only on its trigger; a triggered check without the required answer is a blocker naming the label and the plan slot. Blockers are ordered by severity; among equal severity, DOMAIN blockers follow CHECK 1-8.

On a fix delta, check the diff before the tables: for every removed or weakened line in a triggered area (a `DELETE`, cleanup, reset, guard, check, or refusal), state what it protected and whether the delta replaces it. A removal without a replacement is a correctness blocker that names the removed line and the concrete scenario it breaks; a missing table is a separate, lower blocker.

- **DOMAIN 1, environment contract.** Trigger: a command placed in a phase (build, agent, verifier, calibration, prod). Required: a table `Phase | Network | Runtime/Platform | Commands | Need met?`; a check that guards a phase runs in that phase's environment; a control that runs in the target environment, where a host-only success must fail.
- **DOMAIN 2, executing is a sink.** Trigger: a run in a foreign environment. Required: an inventory `Runtime file | origin | tracked/untracked/ignored/generated | in identity? | mounted?` that covers ignored, generated and built files (native addons, generated JS); a control that starts the real agent in the target environment, not fixtures.
- **DOMAIN 3, liveness is provenance.** Trigger: a runtime dependency (proxy, token, gateway, network) or a detached process. Required: `Dependency | lifetime | holder | check before | check after | phase on loss`; loss is an infrastructure failure, never the subject's result; state held only in a parent's memory does not survive the parent's restart; a control that removes the dependency mid-run, after which the trial must not count as a model outcome.
- **DOMAIN 4, one number, one scope.** Trigger: a compared or optimised metric. Required: `Metric | scope | source | deduplicated over | missing value =`; sibling metrics share one scope; a control where a variant shifts work into subagents and every metric moves alike.
- **DOMAIN 5, replacing means dominating.** Trigger: a record that replaces an earlier one (replay, snapshot, retry, upsert). Required: `Key | order | tie | conflict`; replace only when at least as rich in every component; a conflict keeps the old record and is counted; a control with a later replay missing a field and one with an equal total but a different split.
- **DOMAIN 6, run identity.** Trigger: any change to run naming, claim, upsert, cleanup or launch. Required: `Entry | may reuse an existing name? | deleted | kept`; only explicit resume re-enters an existing run; a control where a finished run has trials, a fresh launch reuses its name, and no old reward appears. Ask first: after this change, can a fresh launch under a used name read rows, files or rewards of the old run?
```

`parseRuleAgents` lowercases names, and `ruleAppliesToAgent` matches `plan-reviewer` exactly (`src/capability/rule.ts:197-228`). No code change is needed.

Plan change during F2 (2026-10-19): the ordering sentence came from F3 round 2, and the fix-delta paragraph plus the DOMAIN 6 question came after F2 round 1 (v1 backup `.omo/evidence/evo2-reviewer-checks/plan-review-eval-domain.v1.md`).

### Step 4: One plan reviewer (cut momus, local)

`~/.omp/agent/agents/momus.md` is a stale copy of the reviewer prompt. Rule 12 says one truth per concept. After Step 1, `plan-reviewer` accepts a path, so momus is no longer needed.

1. Delete `~/.omp/agent/agents/momus.md`. The copy in `agents.bak-evo2-reviewer-checks-$TS` from Step 0 stays.
2. In `~/.omp/agent/rules/delegation.md`, line 14, replace `` `momus` for plans. `` with `` `plan-reviewer` for plans and fix deltas. ``.
3. Run `grep -rn "momus" ~/.omp/agent/rules ~/.omp/agent/skills ~/.omp/agent/extensions ~/.omp/agent/AGENTS.md ~/.omp/agent/config.yml`. Expect no output. If there is a hit, replace it with `plan-reviewer` in the same way.

### Step 5: Repo tests, then merge and deploy after user consent

1. In the worktree, run:
   - `bun test packages/coding-agent/test/bundled-agent-parsing.test.ts packages/coding-agent/test/plan-review.test.ts packages/coding-agent/test/plan-review-dispatch.test.ts packages/coding-agent/test/plan-review-settings.test.ts`
   - `bun run check:ts`
2. Run the Verification section (F1) on the worktree head.
3. Commit, merge and deploy only after the user explicitly approves (AGENTS.md says no commits unless asked). Use `ask` with the exact actions:
   1. Commit the two repo files on `evo2-reviewer-checks`.
   2. Merge into `main`.
   3. Run `scripts/deploy-local.sh main`.
   4. Restart the IntelliJ ACP sessions.

## Verification

Prerequisites:
- Run from the worktree source: `OMP=/Users/tim/git/oh-my-pi/.worktrees/evo2-reviewer-checks/packages/coding-agent/src/cli.ts`.
- Use the session dir `/tmp/evo2-qa/sessions`.
- Put fixtures in `/tmp/evo2-qa/`.

Dispatch prompt, with `<F>` replaced by the fixture path:

```
Dispatch exactly one task item: agent "plan-reviewer", task "Review the plan at <F>", solutionSpace "plan review; defects unknown". Then reply with the subagent's verdict JSON verbatim and nothing else.
```

Command: `cd <cwd> && bun $OMP --print --session-dir /tmp/evo2-qa/sessions "<prompt>"`.

Read the verdict from the child result file of that run: `grep -rl '"verdict"' /tmp/evo2-qa/sessions --include='*.json' | xargs ls -t | head -1 | xargs jq '{verdict, areas: [.blockers[]?.area]}'`. Before each run, record `ls /tmp/evo2-qa/sessions` so the newest file is attributable to this run.

Per-run outcome (fail-closed):
- **match**: the result file of this run exists, parses as JSON, has `verdict` `OKAY` or `REJECT`, and the expectation holds (REJECT rows: some `blockers[].area` equals the label; OKAY/negative rows: no blocker with that label).
- **mismatch**: everything else. That includes no new result file, a file that does not parse, a missing or other `verdict`, a REJECT without `blockers`, a run that timed out or was aborted, and a reply that is prose instead of the verdict object.

Row predicate: run once. On match, the row passes. On mismatch, run two more times; the row passes only with 2 matches in 3 runs. Any other result fails the row. A row with fewer than 3 recorded runs after a mismatch counts as failed, not as passed.

### Fixtures

- **F-A1, CHECK 5 positive** (`cwd` = worktree). A plan of about 10 lines:
  - Step 1 computes the sha256 of the approved snapshot `local://approved/<sha256>-<name>` and compares it with the reviewed digest.
  - Step 2 later builds the executor prompt by reading `local://approved/<sha256>-<name>` again by path.
  - It has no verified-bytes table and carries `- Merge gate: not applicable (fixture)`.
  - Expected: REJECT with at least one `area` equal to `CHECK 5`.
- **F-A1-fixed, CHECK 5 negative control.** The same plan, but Step 2 uses the in-memory bytes read in Step 1. It adds the line `Verified bytes: snapshot read once in Step 1 | same buffer used in Step 2 | identical | no window`.
  - Expected: no blocker with `area` `CHECK 5`.
- **F-A2, CHECK 6 positive** (`cwd` = worktree). A plan that adds a new check `assertPlanSize` to the TUI plan-approval path only. It names TUI and ACP as two entry paths but marks the check for TUI only, with no reason given.
  - Expected: REJECT with an `area` of `CHECK 6`.
- **F-A3, small plan, REJECT-loop control.** A plan that renames the local constant `REVIEW_MAX_RUNTIME_MS` to `PLAN_REVIEW_MAX_RUNTIME_MS` in `packages/coding-agent/src/plan-mode/plan-review.ts` (declared at line 63, used at line 191), with one step, a `bun test packages/coding-agent/test/plan-review.test.ts` check, and `- Merge gate: not applicable (rename)`.
  - Expected: OKAY.
- **Per-check pairs for CHECK 1-4, 7, 8 and DOMAIN 1-5** (`cwd` = worktree; DOMAIN fixtures name files under `packages/metaharness/` so the rule triggers). Each fixture is a plan of 5-10 lines carrying `- Merge gate: not applicable (fixture)`. The positive plan has the trigger and lacks the required answer. The negative plan is the same text plus the one line given in the last column. Positive expectation: REJECT with a blocker whose `area` is the label. Negative expectation: no blocker with that `area`.

  | Label | Positive plan (trigger, answer missing) | Line added for the negative control |
  |---|---|---|
  | CHECK 1 | Add `OMP_DEMO_TOKEN` to the env of a spawned helper process and persist the helper's stdout to `run.log`; "the token must never appear in logs" | `Holders/sinks: env of helper, helper stdout -> run.log via redactSecrets() chokepoint; sentinel token planted in env, body, path, job name; scan of run.log and every artifact = 0 hits` |
  | CHECK 2 | Cache key for model lists = sha256(provider id) | `Key inputs: provider id (bound), base URL (bound), API key fingerprint (bound), request time (excluded: does not affect the result); control per input: two keys differing only in it must differ` |
  | CHECK 3 | Reject job names containing `/`, `..` or a space | `Allow-set instead: job names match ^[a-z0-9-]{1,64}$; control: every printable ASCII character outside the set is rejected` |
  | CHECK 4 | Admit a run as "complete" when `result.json` exists | `complete := result.json parses and status = "done"; missing -> reject, corrupt -> reject, running/partial -> reject, lossy (dropped lines > 0) -> reject; controls: missing file, status "running"` |
  | CHECK 7 | Module A lists the staged files with `git ls-files`; module B hashes the files it lists itself with `readdir` | `Both consume stagedFiles() from src/stage.ts; neither enumerates on its own` |
  | CHECK 8 | New server option `bind`, default `0.0.0.0`; with no run id given, the latest run is used | `Default bind 127.0.0.1; run id required in the request (400 when missing), response echoes the run id used; ties ordered by (created_at, id)` |
  | DOMAIN 1 | The verifier phase runs `bun install` before its tests; the verifier container has no network | `Phase table: build (network, runs bun install) / verifier (no network, runs tests only): need met; control: verifier run in the container, host-only success fails` |
  | DOMAIN 2 | Bind-mount the source tree into the agent container; identity = sha of the tracked diff | `Runtime files: tracked, untracked, ignored native addons and generated JS listed with origin, identity and mount columns; control: real agent start in the container` |
  | DOMAIN 3 | The runner starts a token proxy and spawns detached agents that use it | `Dependency table: proxy, lifetime of manager, held by manager, liveness probe before and after, phase on loss = infra_failure; control: stop the proxy mid-run, trial is not a model outcome` |
  | DOMAIN 4 | Report `tokensDelta` from all agents and `costDelta` from the main agent only | `Metric table: tokens and cost both scoped main+subagents, from transcript usage, deduplicated per request, missing cost = null; control: a variant that delegates moves both alike` |
  | DOMAIN 5 | A later transcript replay replaces the stored one when its total tokens are higher | `Replace table: key trial id, order = component-wise dominance over every usage bucket and cost, tie keeps known values, conflict keeps the old record and increments task_snapshot_conflicts; controls: replay without cost, replay with equal total but different split` |

  Same 2-of-3 rule as above. A positive that fails 2 of 3 means the check's text does not make the reviewer see the trigger. Sharpen only that check's `Required:` sentence and rerun its pair plus F-A3. A negative that fails 2 of 3 means the trigger fires on form. Narrow only that check's `Trigger:` sentence and rerun its pair plus F-A3.
- **F-D1, R81 replay, DOMAIN 6.**
  - `cwd`: a detached worktree at the pre-R81 state, created with `git -C /Users/tim/git/oh-my-pi worktree add --detach .worktrees/evo2-qa-0720 0720de8d94`.
  - The fixture text: the fix entry `R-x: repair the job-name claim (packages/metaharness/src/store.ts, server.ts)`, then the output of `git -C /Users/tim/git/oh-my-pi show 0720de8d94 -- packages/metaharness/src/store.ts packages/metaharness/src/server.ts`, which removes `DELETE FROM trials WHERE job_name = ?`, followed by `- Merge gate: not applicable (fixture)`.
  - Expected after Step 3: REJECT with a blocker whose text says a fresh launch under an existing job name keeps or inherits the old trials or rewards (area `DOMAIN 6` or `correctness`).
  - Baseline: run once before Step 3 and record the result. If the baseline already shows the same blocker, keep both results as evidence. The criterion then rests on F-D1 together with F-A3 (no domain blocker on a non-metaharness plan).
- **Rule scoping on the real surface.** Count the domain rule title `Domain checks: evaluation runs` in the F-D1 session files:
  - the main session JSONL must give 0;
  - the reviewer child JSONL in the same session directory must give 1.
  - Command: `grep -c "Domain checks: evaluation runs" <main>.jsonl <dir>/<child>.jsonl`.
- **Native path still binds a verdict** (`cwd` = a scratch repo created with `mkdir /tmp/evo2-qa/scratch && git -C /tmp/evo2-qa/scratch init`):
  - Run `bun $OMP --plan-yolo --print --session-dir /tmp/evo2-qa/sessions "Add a README.md containing the single line hello"`.
  - Then run `grep -h '"customType":"plan-review"' /tmp/evo2-qa/sessions/*/*.jsonl | jq -c '.data.outcome'`. Expected: `"okay"`, `"reject"` or `"cap"`, never `"unreviewed"`.
  - If the merge-gate extension refuses the proposal for a missing `## Merge gate`, the planner is expected to add the opt-out line and propose again. That retry is part of the expected flow.
- Clean up with `git -C /Users/tim/git/oh-my-pi worktree remove .worktrees/evo2-qa-0720` (this repo created it) and `rm -rf /tmp/evo2-qa`. Copy the evidence first.
- Evidence path: copy the verdict JSONs and the grep outputs to `/Users/tim/git/oh-my-pi/.worktrees/evo2-reviewer-checks/.omo/evidence/evo2-reviewer-checks/` before cleanup.

## Assumptions & contingencies

- **Hybrid placement (user delegated the choice).** The generic checks go into the bundled prompt, which is upstream-able and covers every entry path. The user-specific and domain checks go into `agents:`-scoped user rules. If the bundled edit is rejected upstream later, nothing local breaks: the bundled file in this fork stays the source.
- **momus removal.** This removes the stale second reviewer prompt. If the user wants to keep momus, skip Step 4 and accept two diverging reviewer prompts. The backup restores it either way.
- **Natives in the worktree.** If `bun --cwd=packages/natives run build` fails in the worktree, run the Verification with the main checkout's natives. Do this by setting `CARGO_TARGET_DIR=/Users/tim/git/oh-my-pi/target` as the deploy script does, and do not edit the main checkout.
- **F-A3 stays OKAY.** If F-A3 is REJECTed in 2 of 3 runs because of a CHECK trigger, the trigger wording is too broad. Narrow only that check's `Trigger:` sentence and rerun F-A1 through F-A3. Do not add a cap.

## Final verification wave
- [x] F3. Whole-diff review: `integration-review` over `main...evo2-reviewer-checks`, with the local files inline in the brief (`~/.omp/agent/rules/plan-review-eval-domain.md`, the `delegation.md` diff against its backup, and the deletion of `agents/momus.md`), because the change spans the bundled prompt, user rules and user agents. Done in 4 rounds (auditor, fresh per round): R1 FAIL blocker order, R2 FAIL domain-rule order + evidence truncation, R3 FAIL display claim, R4 PASS.
- [x] F1. Manual QA on the real surface, on head `3a04d82b09`: positive rows 11/11 pass 3/3 (`score-v2.txt`); F-A1 vs F-A1-fixed and F-A3 OKAY pass; negative rows DOMAIN 2-5 pass, CHECK 1-4, 7, 8 and DOMAIN 1 fail (accepted residual risk, see Merge gate); rule scoping main 0 / child 1; native `--plan-yolo` path OKAY round 1 and file written; RED/GREEN for `structured` and full evidence sites. Evidence: `.omo/evidence/evo2-reviewer-checks/`.
- [x] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated (record `.omo/evidence/gate/evo2-reviewer-checks.json`). Round 1 implementation-audit FAIL (R81 substance not proven); criterion corrected by user decision 2026-10-19, see Merge gate. Round 2 FAIL: reviewer blocker fields reached the planner with raw harness tags (pre-existing, widened by the uncapped fields); fixed in `74513097e6` (`escapeHarnessTags` in `sanitizeReviewField`, RED/GREEN T5-n), native `--plan-yolo` row re-run on that head. F3 covered up to `3a04d82b09`; the `74513097e6` delta is reviewed by the round-3 audit over the whole diff. Round 3 FAIL: after the round cap the planner does not receive the open blockers (pre-existing, outside the blocking list below); scope frozen and the finding moved to Plan C Step 2a by user decision 2026-10-19. Round 4 (fresh audit plus strategic-risk-review) runs against the abort rule below.

## Merge gate
- Author's risk assessment:
  - A longer reviewer prompt raises the chance of REJECT on small plans. The cap of 2 rounds bounds the cost.
  - A broken frontmatter would make every native review end as `unreviewed/no-verdict` (fail-open, silent). The parsing test guards this.
  - Reviewer blocker fields reach the planner uncapped. Without escaping, a reviewer answer could open or close a harness tag (`<system-*>`, `<irc>`) in the planner's tool result (found in F2 round 2, fixed in `74513097e6`).
- Mandatory class: none
- Whole-diff review: needed: the change spans three layers (bundled agent prompt in the repo, user rules, user agents) and changes what every plan review checks
- Abort rule (user decision 2026-10-19, after 3 F2 rounds with 1 blocker each; Evo2 note "Abbruch und Konvergenz"):
  - Blocking invariants, the only findings that may block this merge: (1) the Feature-specific criteria below; (2) reviewer text never reaches the planner with an active harness tag, on every path this branch changed; (3) a REJECT inside the round cap hands the planner every blocker field whole; (4) the native review stays fail-open (every failure is `unreviewed` and passes); (5) `plan-reviewer` stays read-only (`read, grep, glob`) and its verdict schema keeps the shape `planReviewSchema()` expects.
  - Not blocking, already named: the accepted residual risks below.
  - Every other finding becomes a follow-up in Plan B or Plan C and is recorded as an override in the gate record with reviewer, finding and target plan. Planned follow-up: after the round cap the planner does not receive the open blockers (`#announcePlanReviewPass`, `"reject"` case sends them only through the UI-only `emitNotice`); predates this branch; fixed in Plan C Step 2a, which rewrites that branch.
  - Convergence: if round 4 brings a new finding inside the blocking list, fix it and run one more round; if a fix itself causes a new blocker, stop and ask the user before fixing again.
- Accepted residual risks:
  - LLM verdicts are not deterministic, so a triggered check can be missed in a single run. The gate waves remain the backstop.
  - Plan change after F1 (user decision 2026-10-19): the negative controls for CHECK 1, 2, 3, 4, 7, 8 and DOMAIN 1 do not stay silent. Each failing row's findings were read and the load-bearing ones verified against the repo (e.g. `provider-files.ts:89,134` second reuse keys, `autoresearch/storage.ts:521` `abandoned_at IS NULL`, `service-reports.ts:179-184` two independent selections): the fixture answers were incomplete, not the checks over-triggering. The "stays silent" half of the criterion rests on F-A1-fixed, DOMAIN 2-5 and F-A3. A check that fires on a complete answer would surface as a REJECT the planner can contest with evidence.
  - Plan change after F2 round 1 (user decision 2026-10-19): the reviewer does not reliably name the concrete R81 defect. On the R81 replay F-D1 it names "old trials stay attached when a fresh launch reuses a job name" in 1 of 3 runs with domain rule v2 and 1 of 1 run without the rule (`.omo/evidence/evo2-reviewer-checks/f-d1-analysis.md`). The domain rule reliably adds the DOMAIN 6 finding (6/6), which tells the planner the run-identity table and fresh-name control are missing. Gate waves remain the backstop for the concrete defect.
- Out of scope for blocking:
  - what the planner receives after the round cap (the `"reject"` case of `#announcePlanReviewPass` and `plan-review-status.md`); added 2026-10-19 with the abort rule, fixed in Plan C Step 2a
  - the oh-my-openagent validator
  - path-scoped `plan.review.agent`
  - momus wording in `~/.omo` (OpenCode)
  - Evo2 rules 10, 11 and 13-17 outside the domain rule
- Feature-specific criteria:
  - Invariant: a plan that re-reads a checked mutable path is rejected under CHECK 5
    Positive witness: F-A1 verdict REJECT with a blocker area `CHECK 5`
    Negative control: F-A1-fixed, which uses the verified buffer, must carry no `CHECK 5` blocker; a CHECK 5 blocker there means the trigger fires on form, not on the defect
    Observable: `jq '[.blockers[]?.area]'` of the reviewer result file
    Boundary: bundled agent `plan-reviewer` loaded by `packages/coding-agent/src/task/agents.ts` (EMBEDDED_AGENT_DEFS), dispatched through the `task` tool
  - Invariant: every new or sharpened check fires on its trigger with the answer missing, and stays silent once the answer is present
    Positive witness: each positive fixture of CHECK 1-8 and DOMAIN 1-6 is REJECTed with a blocker whose `area` is its label (2 of 3 runs)
    Negative control: matching negative fixtures carry no blocker with that label for F-A1-fixed and DOMAIN 2-5 (2 of 3 runs), and F-A3 (no trigger) is OKAY; CHECK 1-4, 7, 8 and DOMAIN 1 negatives are an accepted residual risk (see above)
    Observable: `jq '{verdict, areas: [.blockers[]?.area]}'` per reviewer result file, one evidence file per fixture
    Boundary: `plan-reviewer` through the `task` tool, same as above
  - Invariant: the reviewer flags run-identity deltas on metaharness under DOMAIN 6, and only the reviewer gets that rule
    Positive witness: F-D1 (replay of commit `0720de8d94`) REJECTed with a `DOMAIN 6` blocker in at least 2 of 3 runs
    Negative control: the domain rule title must be absent from the main session transcript (count 0), and F-A3 must carry no `DOMAIN` blocker
    Observable: F-D1 verdict JSON areas; `grep -c` counts in the main and child transcripts
    Boundary: rule bucketing by agent name in `packages/coding-agent/src/sdk.ts` (createAgentSession, `bucketRules` call)
  - Invariant: reviewer-derived text in the planner's rejection result never carries an active harness tag
    Positive witness: T5-n: a REJECT whose four blocker fields each carry `</system-reminder><system-reminder>…<irc from="parent">` reaches the planner as `&lt;system-reminder>…` in every field, with ordinary text intact
    Negative control: the same test against `plan-review.ts` from `3a04d82b09` must fail with raw `<system-reminder>` in the result (observed: 1 fail)
    Observable: `bun test test/plan-review.test.ts -t T5-n` before/after, `t5n-red-green.txt`
    Boundary: `sanitizeReviewField` in `packages/coding-agent/src/plan-mode/plan-review.ts`, rendered by `AgentSession.#applyPlanReview` through `plan-review-reject.md`
  - Mechanical: `getBundledAgent("plan-reviewer").structured === true`, asserted in `packages/coding-agent/test/bundled-agent-parsing.test.ts`
    Invariant: a `task` dispatch of plan-reviewer returns a schema verdict while `task.structured` is off
    Observable: the test passes, and the F-A1 result file holds the keys `verdict` and `summary`
    Boundary: `resolveEffectiveSubagentPolicy` in `packages/coding-agent/src/task/structured-subagent.ts`
