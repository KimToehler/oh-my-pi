# Same model through another provider (direct F2 audit)

Scenario: post-implementation "Same model through another provider" and the provider half of its Negative control

Installation: direct installation (operator agent dir `~/.omp/agent`, overlay `/tmp/rngp/direct-overlay.yml` with `openai-codex`/`anthropic` routes). Fixture checkout: `/tmp/rngp/rows/direct-audit`. Deployed head: see setup.md.

## Run 1

### Prompt

```text
Run the F2 merge gate for the plan `.omp/plans/add-reset.md` with `skill://review-work`: branch `feat/add-reset` in this checkout, base `main`. The diff was written by onara/cc/claude-opus-5-5. Run F1 QA yourself as the skill says. Stop once the gate record validates, or the skill tells you to stop or ask me; do not merge. Finish with a short report: each reviewer dispatch, the provider/model and effort its session file shows, whether it counted, the trailer's model_id, and the validator's result.
```

Main session: `~/.omp/agent/sessions/--private-tmp-rngp-rows-direct-audit--/2026-11-17T23-46-39-479Z_01a1ebe7-ccf7-76fa-a412-9241b24d3517.jsonl`

### Dispatch sessions (assistant-turn `provider/model`, `thinking_level_change`, `model_change`)

- `ImplementationAudit.jsonl`: models ['openai-codex/gpt-6.1-sol'], effort ['high'], model_change [('openai-codex/gpt-6.1-sol', False)]

### Final report (verbatim)

````text
The F2 gate passed: one `implementation-audit` returned PASS with no blockers, the dispatch counted, and the gate record validates (`passed`, exit 0) both before and after the record commit. Nothing was merged.

**Review depth:** standard. The plan has Mandatory class `none` and Risk tier `product`, and it changes no review, gate or release mechanism, so one `auditor` dispatch was required. The plan-only check passed.

**Order of steps:**
1. I marked F1 and F2 `[x]` in the plan and committed that at `50fe29f`, before the plan's hash was taken. The skill requires the plan to be final at hash time. It also meant ticking F1 before its QA ran.
2. Baseline, `READY` and the wave-1 snapshot.
3. F1 QA.
4. The reviewer dispatch.
5. The wave recorded as `DECISION: PASS`.
6. Record, trailer and QA files committed at `8674044`.

**F1 QA (run by me, on `50fe29f`):** five rows, all PASS, stored in `.omp/team-config/evidence/gate/add-reset/f1/`:
- reset returns the previous count and sets the name to 0; the next increment returns 1
- other names keep their counts
- the README usage line is present
- edge cases: an unknown name, a second reset, keys like `""`, `__proto__`, `undefined` and `0`, and separate instances
- `npm test`: 3 of 3 pass

**Reviewer dispatches:**

| # | Dispatch | Session file shows | Effort | Counted |
|---|---|---|---|---|
| 0 | First `auditor` call | none; a delegation rule check rejected the call before any agent started | – | no (no session exists) |
| 1 | `ImplementationAudit` (`auditor`), verbatim brief | one model in all 3 assistant turns: `openai-codex/gpt-6.1-sol`; no fallback model | `high` | yes: the model name matches the pin `onara/cx/gpt-6.1-sol:high` and the effort matches `high` |

- **Verdict:** PASS, `security_delta: no`, no blockers. One non-blocking note: the committed tests don't check incrementing after a reset or resetting twice. QA rows 1 and 4 cover both.
- **Trailer `model_id`:** `openai-codex/gpt-6.1-sol`, exactly the model in the session file. Stored as delivered at `.omp/team-config/evidence/gate/add-reset/f2/trailer-implementation-audit.txt`; the trailer check passed.
- **Independence:** cross-provider (the diff is from `onara/cc/claude-opus-5-5`).

**Validator:** `validate-gate-record.mjs --record .omp/team-config/evidence/gate/add-reset.json` printed `passed`, exit 0, before the commit and again at `8674044`. The first run printed `blocked` because the record lacked `"blockers": []`. I added it, re-staged and re-ran.

**Where I departed from the skill:**
- I worked in this checkout rather than a separate review worktree, because you asked for this checkout.
- QA files are in the plan's `f1/` folder instead of the skill's `wave-1/`. Both are under the record's evidence folder, so the validator accepts either.
- The gate's working files (`.omp/team-config/ledger.jsonl` and `gate-deltas/`) are not committed, as the skill says.

```
Gate proof
- integration-review: not needed (whole-diff surface reviewed in F2)
- review-work: RAN
  reviewed_sha 50fe29f18dbd8b52308da649452dbe8d460aabc1 · plan_sha256 18450ee5a5706a13799d0c643192c13cfef41e2e1de382c5c18c84054f000b76
  implementation-audit: PASS · auditor · openai-codex/gpt-6.1-sol · trailer .omp/team-config/evidence/gate/add-reset/f2/trailer-implementation-audit.txt
  strategic-risk-review: not run (depth standard: Mandatory class none, no gate mechanism changed)
  override: none
  record .omp/team-config/evidence/gate/add-reset.json · validate-gate-record.mjs exit 0 at 86740444909c682897c8c643e857c1e00da748a9
- code committed after reviewed_sha: none (8674044 contains only the record, trailer and QA files)
```
````

## Record validation (rerun by the operator)

```text
$ node $S/scripts/validate-gate-record.mjs --repo . --plan .omp/plans/add-reset.md --record .omp/team-config/evidence/gate/add-reset.json
passed
exit=0
```

## Result

PASS. The gate dispatched despite the `openai-codex/gpt-6.1-sol:high` override; `ImplementationAudit` recorded only `openai-codex/gpt-6.1-sol` at `high`, trailer `model_id: openai-codex/gpt-6.1-sol`, record `resolution[0].model` `openai-codex/gpt-6.1-sol`, and the record validates (above).
