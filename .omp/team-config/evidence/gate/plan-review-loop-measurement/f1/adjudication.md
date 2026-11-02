# F1 inspection — blinded independent adjudication (task 2.2)

Run directory `runs/plan-review-loop-measurement-20261102` (`R`, gitignored). Commands and outputs below are copied from the session that ran them.

## Blind inputs and ordering

One adjudicator per plan item, pinned `onara/cc/claude-opus-5-5:high`, read-only (`read, grep, glob, yield`), no sub-agent spawns. Each brief contains the item's fresh findings under neutral IDs in a seeded shuffle (seed 20261102, mulberry32), plus the item's full target ledger. Arm, model, effort, cost, trial ID, verifier verdict and dispatch order are absent from every brief.

Blind map `R/blind-map.json`, first four rows of `session-move-tool` (order verbatim):

```
{"neutral":"Smt-01","finding":"TrialTSmt1.2","trial":"T-Smt-1"}
{"neutral":"Smt-02","finding":"TrialTSmt1.1","trial":"T-Smt-1"}
{"neutral":"Smt-03","finding":"TrialSSmt3.3","trial":"S-Smt-3"}
{"neutral":"Smt-04","finding":"TrialSSmt3.2","trial":"S-Smt-3"}
```

T-arm and S-arm findings interleave and the per-trial index order is broken (TrialTSmt1.2 before TrialTSmt1.1), so neither position nor neighbourhood identifies an arm.

Brief digests (`shasum -a 256 R/adjudicator-briefs/*.md`):

```
2a4ba2c68822d2391e918df0f6132fa8fb50b7fefeaaeb7ef88a8341c9b82ab6  adjudicator-briefs/AdjApp.md
0dfcd4a1cc8c931801e501027829f48748983d6b27701314b99eb952d14003f2  adjudicator-briefs/AdjFmp.md
480c9b5cd8321bec3470f050f671e60fcaa44aafcaa012f4c68a6daa90c92ee1  adjudicator-briefs/AdjRtr.md
87985c9fc4fcfda63fc79c29d2c0dba0dbd7dadf5038122ac085ff1a102470bf  adjudicator-briefs/AdjSmt.md
eac7899f88d61e4564c11c4681e74e49a5500ae6542af033ef99d23ae51825ba  adjudicator-briefs/AdjSpt.md
```

Returned judgments, one row per dispatched adjudicator; every run completed on its intended pin, so none is excluded:

| attempt | item | judgments / candidates | target assessments / targets | cost USD |
|---|---|---|---|---|
| AdjApp | acp-permission-parity | 6/6 | 11/11 | 1.49 |
| AdjRtr | review-trailer-repair | 7/7 | 18/18 | 1.21 |
| AdjSmt | session-move-tool | 9/9 | 14/14 | 1.39 |
| AdjFmp | finish-modality-program-route | 9/9 | 10/10 | 1.62 |
| AdjSpt | strength-progression-targets | 24/24 | 32/32 | 4.29 |

Total adjudication cost 9.9907 USD, inside the 10 USD the user authorised for this stage. Every candidate received exactly one judgment and every target exactly one current-severity assessment; the unblinding step rejected unknown neutral IDs, duplicates and unknown target IDs, and reported none.

## Deviation from design D3: historical findings are not adjudicated

D3 asks for historical findings to be mixed in as blinded reference checks. The normalized dataset stores historical findings as placeholders only (`"Historical annotated finding F61SptCor.1; complete claim remains in local raw source."`, `R/dataset.json`), because the original claim text was never extracted into the frozen corpus. Blinding them would have required re-extracting 110 claims from local sessions and roughly tripling adjudication cost. The 55 fresh findings were adjudicated; the 110 historical rows keep their descriptive annotation adjudications (`kind: known-target`, `blocking: unresolved`, mechanism `historical-annotation/...`), which the scorer never treats as current-threshold truth. What is lost is the calibration signal of the adjudicator against historical labels; arm blinding is unaffected.

## Source-checked positive match

`Smt-02` (unblinded: `TrialTSmt1.1`, arm T) matched `session-move-tool|R08.1`, mechanism `M-terminal-abort-cancels-siblings`, severity `blocking`. Its cited line was re-read independently in the frozen snapshot:

```
$ sed -n '3923,3929p' /Users/tim/git/oh-my-pi/.worktrees/measurement-smt/packages/coding-agent/src/session/agent-session.ts
		if (event.type === "tool_execution_end" && this.#isTerminalYieldToolResult(event)) {
			const alreadyTerminated = this.#synchronouslyTerminatedYieldToolCallIds.delete(event.toolCallId);
			if (!alreadyTerminated) {
				this.#advisors.prepareForTerminalYieldAdvisorDrain();
				this.#markTerminalYieldToolCall(event.toolCallId);
				this.agent.abort(TERMINAL_TOOL_RESULT_ABORT_REASON);
			}
```

The terminal-yield path does call `agent.abort(...)`, which is the premise of the claim that D1's "the batch finishes" promise is unachievable on the reused path. The match is accepted as a true positive against the frozen target.

## Near miss: valid finding with no target

`Smt-01` and `Smt-03` (different trials, different arms) both report mechanism `M-missing-worktree-parent-dir`: the plan admits a missing target only when its parent's realpath equals `realpath(<primaryRoot>/<worktree.repoDir>)`, and never states what happens when `.worktrees` itself does not exist, which is the state of a fresh checkout. The adjudicator rated both `valid`, `blocking`, `kind: additional-defect`, and recorded that no target in the 14-row ledger describes this mechanism. They therefore raise no recall numerator and are counted once as a distinct additional mechanism, not as a match. Across all items, 20 of the 55 fresh findings are independently valid and blocking without a matching target.

## Verifier-loss disposition

The experiment produced **no false drop**: `falseDrop` is 0 in every trial with triage available, and the arm rows report `0/17` (S) and `0/4` (T). No false drop is asserted where none occurred.

Two post-triage losses exist, and both are legitimate residual, not verifier error:

- `S-Spt-3` finding `Replacement1SSpt3.8` → target `strength-progression-targets|R22.1`: the verifier confirmed it as blocking, the independent adjudicator rated the target `below-threshold` at current severity. Post recall 4/32 → 3/32, counted as `downgraded` + `legitimateResidual`.
- `T-Smt-1` finding `TrialTSmt1.4` → target `session-move-tool|R02.2`: same shape; post recall 2/14 → 1/14.

In both cases the loss comes from the independent severity assessment of the target, not from the verifier dropping a finding the adjudicator considers blocking. `protected`, `undecided`, `pending` and `unresolvedDrop` are 0 in every triaged trial.

## Verification

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 112 sources, 5 items, 40 trials, 61 attempts, 165 findings
```
