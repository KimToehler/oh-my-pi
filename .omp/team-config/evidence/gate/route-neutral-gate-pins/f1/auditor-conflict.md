# Configuration overrides the pin

Scenario: "Configuration overrides the pin"

Installation: router installation `/tmp/rngp/homes/auditor-conflict` (one change, see setup.md). Fixture checkout: `/tmp/rngp/rows/auditor-conflict`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Run the F2 merge gate for the plan `.omp/plans/add-reset.md` with `skill://review-work`: branch `feat/add-reset` in this checkout, base `main`. The diff was written by onara/cc/claude-opus-5-5. Run F1 QA yourself as the skill says. Stop once the gate record validates, or the skill tells you to stop or ask me; do not merge. Finish with a short report: each reviewer dispatch, the provider/model and effort its session file shows, whether it counted, the trailer's model_id, and the validator's result.
```

Main session: `/tmp/rngp/homes/auditor-conflict/.omp/agent/sessions/--private-tmp-rngp-rows-auditor-conflict--/2026-11-17T23-46-39-492Z_01a1ebe7-cd04-734d-b928-c1eddf5c3fc0.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- none dispatched

### Final report (verbatim)

````text
**The gate did not run, and there is no gate record.** I stopped before dispatching any reviewer because the auditor's model setting conflicts with its pin. Nothing was merged, committed or staged.

**Why it stopped (Phase 3 model check):**
- `~/.omp/agent/agents/auditor.md` sets the auditor to `onara/cx/gpt-6.1-sol:high`.
- `omp config get task.agentModelOverrides` sets it to `"auditor": "onara/cx/gpt-6.1-sol:medium"`.
- `model-name.mjs` gives the same model name (`gpt-6.1-sol`) for both, but the effort differs (`high` vs `medium`).
- When the model or effort differs, the skill says to dispatch nothing and tell you.

**Done before the stop:**
- The plan check (`validate-gate-record.mjs --plan-only`) printed `passed`, exit 0.
- `main` (`c5de16d`) is already an ancestor of HEAD `469755f`, so no merge was needed.
- Review depth is `standard`: no mandatory class, Risk tier `product`, and nothing touches a gate mechanism. That means one `implementation-audit` reviewer.
- I did not run `GC baseline` or `GC snapshot`, so the gate log has no entries.

**F1 QA (run on HEAD `469755f`, Node v25.9.0).** Evidence is in `.omp/team-config/evidence/gate/add-reset/f1/`, untracked, along with the `qa.mjs` that drove the rows.

| Row | Observed | Verdict |
|---|---|---|
| R1: reset returns the old count and leaves 0 | `reset("a")` → 2, `get("a")` → 0 | PASS |
| R2: other names keep their counts | `get("b")` 3 → `reset("a")` → 2 → `get("b")` 3 | PASS |
| Happy path: start a period over | `reset("period")` → 3, next `increment` → 1, `total` stays 1 | PASS |
| Edge cases: unknown name, reset twice, empty name, `__proto__` | 0; 1 then 0; 0; 2 then `get` → 0 | PASS |
| Adjacent behaviour: `node --test test/counter.test.js` | 3/3 pass, exit 0 | PASS |
| The plan's two negative controls (tests run against changed copies of the code) | Returning 0 and clearing the whole map each make the reset test fail | PASS |

**`npm test` is broken, but not by this change.** `npm test` (`node --test test/`) fails with `Cannot find module …/test`, and fails the same way on `main` (`preexisting-npm-test-on-main.txt`). `package.json` is unchanged by the diff, so this comes from the Node 25 test runner, not from `reset`. It does mean task 1's "Verify: `npm test`" can't pass in this environment as written.

**Your report items:**
- **Reviewer dispatches:** none, so there are no session files and no provider/model or effort to report, and nothing counted.
- **Trailer `model_id`:** none, since no trailer exists.
- **Validator result:** the plan-only check printed `passed`. The full record check was not run because no record was written.

**Decision for you:** to unblock, either remove the `auditor` entry from `task.agentModelOverrides`, or change it to `onara/cx/gpt-6.1-sol:high`; a different provider prefix with the same model and effort is allowed. Then I can rerun F2. The F1 evidence can be reused, since nothing has been committed since it was captured. I left the F1/F2 checkboxes in the plan unticked.
````

## Result

PASS. `auditor` overridden to `onara/cx/gpt-6.1-sol:medium`; the gate dispatched nothing (no dispatch session) and named the setting and both ways to resolve it.
