# Retry chain switches a reviewer mid-run

Scenario: "Retry chain switches a reviewer mid-run"

Installation: router installation `$TMPDIR/rngp-home`, fresh ordinary session in `/tmp/rngp/seeded-repo`; no agent dispatched. Seeded files (tracked next to this row):

- `f1/seeded/switch/PlanReviewScopeA.jsonl`: models ['onara/cc/claude-opus-5', 'onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False), ('onara/cc/claude-opus-5', True)]
- `f1/seeded/switch/PlanReviewScopeA2.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]
- `f1/seeded/switch/PlanReviewScopeB.jsonl`: models ['onara/cx/gpt-6.1-sol'], effort ['high'], model_change [('onara/cx/gpt-6.1-sol', False)]

## Prompt

```text
Do not dispatch any agent and do not write or commit anything. Get the review instruction of the OpenSpec change `add-reset` with `openspec instructions review --change add-reset --json` and read it whole. Its dispatches for this round have already finished; their session files are listed below and stand in for the path `read history://<subagent id>` would print. The round is `risky`: two plan-reviewer items, scope A and scope B. Scope A's first dispatch `PlanReviewScopeA` was switched by the runtime's retry chain partway through and returned REJECT; its fresh retry `PlanReviewScopeA2` (same brief, new task call) returned OKAY; scope B `PlanReviewScopeB` returned OKAY.

- PlanReviewScopeA: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeA.jsonl
- PlanReviewScopeA2: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeA2.jsonl
- PlanReviewScopeB: /Users/tim/git/oh-my-pi/.worktrees/route-neutral-gate-pins/.omp/team-config/evidence/gate/route-neutral-gate-pins/f1/seeded/switch/PlanReviewScopeB.jsonl

Apply the instruction exactly as written, running its commands (the jq list, `model-name.mjs`, the pin lookup in this installation's configuration and agent definitions). Report: for each dispatch the jq output, both `model-name.mjs` outputs and the pin with its source, and whether it counts; the action the instruction prescribes next; and the review.md fields the instruction requires for this round as it stands (Verdict, Reviewer, Verifier, Models, Awaiting, and the marker each blocker carries under `## Blockers`), each with the instruction sentence it follows.
```

## Runs

- run 1: deployed head `acaf0ea77f` (superseded by a later head)
- run 2: deployed head `2fcb711078` (superseded by a later head)
- run 3: deployed head `4f92bdb783` (final, report below)

## Final report (run 3, verbatim)

````text
I applied the instruction to the three session files: Scope A's first dispatch does not count, the retry and Scope B do, and the round as it stands records OKAY with no blockers. Before acting on that, check one conflict: the change's committed `gate.md` says **standard**, not risky. I wrote nothing, committed nothing and dispatched nothing.

**The depth conflict.** `openspec/changes/add-reset/gate.md:4` reads `- **Depth**: standard (the class is none and no review, gate or release mechanism changes)`, and that file is committed with no local changes. The instruction takes depth from gate.md ("dispatch the round for the depth step 2 read"), and a standard round is one plan-reviewer item with the all-scopes paragraph. The first message in all three session files also reads `(all-scopes brief)`, not the Scope A or Scope B paragraph. If the round really is risky, `gate.md` must say so. Then step 3's admission check would also apply: "when gate.md makes the change `risky` … and the change folder holds no consultation.md … dispatch nothing and run step 2a". The folder has no consultation.md, so the architecture consultation would have had to run before these reviewers. Everything below follows your risky framing.

## Model check per dispatch
The pin is the same for all three: **`onara/cx/gpt-6.1-sol:high`**, from the `plan-reviewer` entry of `omp config get task.agentModelOverrides` (`{"reviewer":"@review","plan-reviewer":"onara/cx/gpt-6.1-sol:high"}`). The config's `agents/` folder has no `plan-reviewer.md`, which doesn't matter because the override is checked first. `model-name.mjs` on the pin prints `gpt-6.1-sol`.

| Dispatch | jq output | `model-name.mjs` on the jq list | Counts? |
|---|---|---|---|
| PlanReviewScopeA | `onara/cc/claude-opus-5`, `onara/cx/gpt-6.1-sol` | `claude-opus-5`, `gpt-6.1-sol` (two lines) | **No.** Its REJECT is discarded. |
| PlanReviewScopeA2 | `onara/cx/gpt-6.1-sol` | `gpt-6.1-sol` | **Yes**: OKAY |
| PlanReviewScopeB | `onara/cx/gpt-6.1-sol` | `gpt-6.1-sol` | **Yes**: OKAY |

The rules applied:
- **Scope A fails the check:** "the dispatch ran on its pin only when the first prints exactly one line, equal to the second's". Two lines is a failure.
- **Its verdict doesn't count:** "A dispatch that ran on any other model counts as a dispatch without a structured result, whatever it returned". In its session file it starts on `cx/gpt-6.1-sol`, then a `model_change` switches it to `cc/claude-opus-5`, which produced the final answer.
- **The retry is the one allowed:** "gets one fresh retry with the same brief, in a new task call; the other result stands". That retry is PlanReviewScopeA2, and it delivered a verdict on the pinned model, so the round is complete.

## What the instruction says to do next
- **The round is OKAY:** "A round with no blocker and nothing carried is OKAY; go to step 7." Scope A's REJECT findings never enter the round, so verifier triage (step 4) doesn't happen.
- **Step 7:** write `review.md` from the template, with step 2's digest, Depth, and Round 1 ("the first round of this review is 1 … never for a retry").
- **Step 8:** "Run `V --reviewed <change-dir>`."

I did neither, as you asked.

## review.md fields for this round
- **Verdict**: `OKAY`, from "Verdict is OKAY when no confirmed blocking finding, no untriaged finding and no finding awaiting an answer remains open, otherwise REJECT."
- **Reviewer**: `plan-reviewer, PlanReviewScopeA2, PlanReviewScopeB`, from "the reviewer ids in dispatch order (scope A then scope B; a retried reviewer is listed with its retry's id)".
- **Verifier**: `blocker-verifier, none`, from "`blocker-verifier` and its subagent id (`none` when no finding needed triage)".
- **Models**: `PlanReviewScopeA onara/cx/gpt-6.1-sol onara/cc/claude-opus-5 (no verdict)`, `PlanReviewScopeA2 onara/cx/gpt-6.1-sol`, `PlanReviewScopeB onara/cx/gpt-6.1-sol`. This follows "`- **Models**:` with one entry per dispatch of this round, retries, attempts that counted as having no result … included, as `<subagent id> <provider/model>` with every further model that dispatch ran on appended and `(no verdict)` after an attempt whose result did not count". I listed Scope A's models in the order it ran on them; the jq output's `sort -u` puts them in alphabetical order instead. The instruction doesn't say how to separate entries.
- **Awaiting**: `none`, from "`- **Awaiting**:` naming what is open when you write it (`none`, `exception`, `exhaustion`, `incomplete`, `scope` or `triage`)". Nothing is open.
- **`## Blockers`**: `none`, so no blocker carries a marker. This follows "`## Blockers`: `none` for OKAY". The markers `not triaged: the verifier failed twice` and `not triaged: the round is incomplete` apply only when Awaiting is `triage` or `incomplete`. Scope A's REJECT findings are recorded neither as blockers nor as residuals, because that dispatch "counts as a dispatch without a structured result, whatever it returned".
````

## Result

PASS. Scope A's first dispatch (last turns on `onara/cc/claude-opus-5`) does not count; the retry `PlanReviewScopeA2` and `PlanReviewScopeB` count; the round continues with the retry's verdict, Reviewer lists `PlanReviewScopeA2`, and Models lists both scope A attempts with the switched one marked `(no verdict)`. The fixture's gate.md says `standard` while the seeded round is a risky scope A/B pair; the session flags that mismatch, which is a property of the fixture, not of the check.
