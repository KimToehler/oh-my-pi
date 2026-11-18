# Substituted verifier

Scenario: "Substituted verifier"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/verifier/BlockerVerifier1.jsonl`: models ['onara/cc/claude-opus-5-5'], effort ['medium'], model_change [('onara/cc/claude-opus-5-5', True)]
- `f1/seeded/verifier/BlockerVerifier2.jsonl`: models ['onara/cc/claude-opus-5-5'], effort ['medium'], model_change [('onara/cc/claude-opus-5-5', True)]
- `f1/seeded/verifier/PlanReviewAddReset.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]

## Prompt

```text
Do not dispatch any agent and do not write or commit anything. Get the review instruction of the OpenSpec change `add-reset` with `openspec instructions review --change add-reset --json` and read it whole. Its dispatches for this round have already finished; their session files are listed below and stand in for the path `read history://<subagent id>` would print. The round is `standard`: one plan-reviewer item `PlanReviewAddReset` returned REJECT with two blockers; the record committed before triage exists. The blocker-verifier dispatch `BlockerVerifier1` and its fresh retry `BlockerVerifier2` each returned one result per index.

- PlanReviewAddReset: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/verifier/PlanReviewAddReset.jsonl
- BlockerVerifier1: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/verifier/BlockerVerifier1.jsonl
- BlockerVerifier2: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/verifier/BlockerVerifier2.jsonl

Apply the instruction exactly as written, running its commands (the jq list, `model-name.mjs`, the pin lookup in this installation's configuration and agent definitions). Report: for each dispatch the jq output, both `model-name.mjs` outputs and the pin with its source, and whether it counts; the action the instruction prescribes next; and the review.md fields the instruction requires for this round as it stands (Verdict, Reviewer, Verifier, Models, Awaiting, and the marker each blocker carries under `## Blockers`), each with the instruction sentence it follows.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (superseded by a later head)
- run 3: deployed head `4f92bdb783` (final, report below)

## Final report (run 3, verbatim)

````text
Nothing was dispatched, written or committed. The instruction (`openspec instructions review --change add-reset --json`, schema `omp-gated`, 443 lines) was read in full.

## Per-dispatch model check

These are the commands from step 3's model-check paragraph. Pin lookup: `omp config get task.agentModelOverrides` returned `{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`. It has no `blocker-verifier` entry, so that agent's pin comes from its definition, `$(omp config path)/agents/blocker-verifier.md`.

| Dispatch | jq output | `model-name.mjs` on the jq list | Pin (source) | `model-name.mjs <pin>` | Counts |
|---|---|---|---|---|---|
| PlanReviewAddReset | `onara/cx/gpt-6.1-sol` | `gpt-6.1-sol` | `onara/cx/gpt-6.1-sol:high` (`task.agentModelOverrides.plan-reviewer`) | `gpt-6.1-sol` | **Yes**: one line, and it equals the pin's |
| BlockerVerifier1 | `onara/cc/claude-opus-5-5` | `claude-opus-5-5` | `onara/cx/gpt-6.1-sol:medium` (`model:` in `agents/blocker-verifier.md`; no override) | `gpt-6.1-sol` | **No**: it ran on another model name |
| BlockerVerifier2 | `onara/cc/claude-opus-5-5` | `claude-opus-5-5` | same as above | `gpt-6.1-sol` | **No**: it ran on another model name |

The rule applied: "the dispatch ran on its pin only when the first prints exactly one line, equal to the second's; the provider takes no part … A dispatch that ran on any other model counts as a dispatch without a structured result, whatever it returned."

Both verifier sessions have `"resolvedModelIsFallback":true` in their `model_change` entry. That is the silent fallback the instruction warns about. Both returned a full result (index 1 `confirmed`/blocking, index 2 `refuted`), but those results don't count and can't be recorded.

## Next action

Step 4 applies: "Any other result, any task without a structured result, and any task that ran on another model name gets one fresh retry with the same brief. … If the retry is also missing or incomplete, … Rewrite the record committed before the dispatch (step 7) so every untriaged blocker carries `not triaged: the verifier failed twice` instead and `- **Models**:` adds both verifier attempts, keeping Verdict REJECT and Awaiting `triage`, and commit it … Then tell the user which triage failed and stop: dispatch nothing further, ask nothing and edit no artifact."

So the next steps are:
1. Rewrite the pre-triage record and commit it (I didn't do this, because you said not to write or commit).
2. Report that the blocker-verifier triage failed twice (BlockerVerifier1 and BlockerVerifier2).
3. Stop. Nothing goes to step 5: no classification, fix or ask.

## review.md fields for this round

- **Verdict: `REJECT`.** The step 4 rewrite is "keeping Verdict REJECT". Step 7 agrees: OKAY only when "no untriaged finding … remains open, otherwise REJECT."
- **Reviewer: `plan-reviewer, PlanReviewAddReset`.** Step 7 calls for "the reviewer ids in dispatch order". In a `standard` round the template's `<scope A or only reviewer id>` is the only reviewer.
- **Verifier: `blocker-verifier, none`.** Template: "none when no verifier result stands: no finding needed triage, or this record was written before the dispatch". No verifier result stands, and the rewrite keeps the pre-dispatch value.
- **Models:** `PlanReviewAddReset onara/cx/gpt-6.1-sol`, `BlockerVerifier1 onara/cc/claude-opus-5-5 (no verdict)`, `BlockerVerifier2 onara/cc/claude-opus-5-5 (no verdict)`. Step 4 says "`- **Models**:` adds both verifier attempts". Step 7 requires one entry per dispatch "including attempts that counted as having no result … and `(no verdict)` after an attempt whose result did not count", plus "every entry of an earlier record of this round that this one replaces".
- **Awaiting: `triage`.** Step 4: "keeping Verdict REJECT and Awaiting `triage`".
- **Marker under `## Blockers`:** both blockers ("Verification — F1 evidence" and "Verification — README usage") appear verbatim under the reviewer's subsection, each with `not triaged: the verifier failed twice`. Step 4: "so every untriaged blocker carries `not triaged: the verifier failed twice` instead". Step 7: "or `not triaged: the verifier failed twice` when Awaiting is `triage`". The subsection heading has the form `### <Scope> (PlanReviewAddReset)`. The instruction gives no scope label for the single `standard` item; "All scopes" would come from its paragraph name, but that's my inference.
- **Unchanged from the pre-triage record:** Reviewed digest, Depth `standard`, Round, Override `none` and `## Residuals` (`none`). Step 4 says to rewrite only the markers and Models.

Two things to check:
- **No review.md in the change folder:** `/tmp/rngp/seeded-repo/openspec/changes/add-reset/` holds only `gate.md`, `proposal.md`, `specs` and `tasks.md`. The instruction's `existingOutputPaths` is `[]`, and the folder's only commit is `f419f20`. So the pre-triage record you said was committed isn't in this checkout. The field values above follow from the instruction and the session files either way.
- **Retries won't fix this:** the verifier keeps falling back to `claude-opus-5-5` (`resolvedModelIsFallback: true`), so another retry or a resume would probably land on the same substitute until whatever forces that fallback is fixed.
````

## Result

PASS. Both verifier attempts ran on `onara/cc/claude-opus-5-5` against the `blocker-verifier` pin `onara/cx/gpt-6.1-sol:medium`; neither counts, the round is REJECT with Awaiting `triage`, both findings carry `not triaged: the verifier failed twice`, and Models lists both verifier attempts.
