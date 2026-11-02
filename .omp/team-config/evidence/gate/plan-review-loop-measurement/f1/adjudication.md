# F1 inspection — blinded independent adjudication (task 2.2)

Run directory `runs/plan-review-loop-measurement-20261102` (`R`, gitignored). Commands and outputs below are copied from the session that ran them.

## Blind inputs and ordering

One adjudicator per plan item, pinned `onara/cc/claude-opus-5-5:high`, read-only (`read, grep, glob, yield`), no sub-agent spawns. Each brief contains the item's fresh findings under neutral IDs in a seeded shuffle (seed 20261102, mulberry32), plus the item's full target ledger. Arm, model, effort, cost, trial ID, verifier verdict and dispatch order are absent from every brief.

The adjudicator contract itself (`.omp/agents/measurement-adjudicator.md`, sha256 `d54354fba27c80aa21e33b0b21461288969ff6625b23954bc5e2c752842264a9`) was written at this stage, after the reviewer-input freeze of task 1.1, and frozen before the first adjudicator dispatch. It is registered as `experiment-agent/measurement-adjudicator` in the input manifest with that provenance, which is why `check` counts 140 sources rather than the 139 present during the reviewer stage. It is an experiment-local definition; no production agent, model role or schema was changed.

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

Round-1 adjudication cost 9.9907 USD. Every candidate received exactly one judgment and every target exactly one current-severity assessment; the unblinding step rejected unknown neutral IDs, duplicates and unknown target IDs, and reported none.

## Round 2: the findings of the resumed cells

The resumed cells (`f1/replays.md`) produced 45 further fresh findings. They were blinded the same way under a second seed (`20261103 + item code`, map `R/blind-map-round2.json`), with new neutral IDs (`Smt2-01` …), and judged by five fresh adjudicators on the same pin. Round-1 judgments were never shown to them and never revised.

```
$ bun -e '…blind-map-round2.json… session-move-tool'
[{"neutral":"Smt2-01","finding":"TrialSSmt1.1","trial":"S-Smt-1"},{"neutral":"Smt2-02","finding":"RerunSSmt2.3","trial":"S-Smt-2"},
 {"neutral":"Smt2-03","finding":"TrialSSmt1.4","trial":"S-Smt-1"},{"neutral":"Smt2-04","finding":"RerunSSmt2.4","trial":"S-Smt-2"}]
$ shasum -a 256 R/adjudicator-briefs/Adj2*.md
b44c4a362c59005f0a8122bf0f28ecaef3aa255de4c6fd3a9b766659f38e2215  Adj2App.md
5142332c9185149a27384c43ae8110bf4e8bb2ba6c04742d48383bf0f04ab9ea  Adj2Fmp.md
924b233067968f57d51c3f872db86ebb6a05ceb080ecdf9f5b6db43d7ecadf68  Adj2Rtr.md
df4fb2844a71335a7d0669a95b71ee4a754bbf3eb3413954eece914f08b04a25  Adj2Smt.md
a4c75d8ade8cbbdaf55f0d35561eb888b299dce919deb113150f9f6f703a6d8c  Adj2Spt.md
```

| attempt | item | judgments / candidates | target assessments | cost USD |
|---|---|---|---|---|
| Adj2Rtr | review-trailer-repair | 7/7 | 18/18 | 1.16 |
| Adj2Smt | session-move-tool | 9/9 | 14/14 | 1.90 |
| Adj2App | acp-permission-parity | 13/13 | 11/11 | 2.21 |
| Adj2Fmp | finish-modality-program-route | 8/8 | 10/10 | 1.59 |
| Adj2Spt | strength-progression-targets | 8/8 | 32/32 | 3.04 |

Round-2 cost 9.91 USD; total adjudication 19.90 USD across 100 fresh findings.

### Repeat reliability of the target ledger

Round 2 re-assessed all 85 targets independently on the same frozen ledger. It agreed with round 1 on **83 of 85** (97.6 %). Both disagreements move a target from `blocking` to `below-threshold`: `strength-progression-targets|R05.1` and `|R10.1` (`R/target-agreement-round2.json`). Round 1 stays authoritative because it was fixed before the round-2 findings existed; had round 2 been used instead, the blocking denominator would be 22 rather than 24. Since F2 wave 1 these assessments are published as normalized `targetRepeats` rows and the agreement is computed by the scorer (`report.md`, `Target severity repeats`) rather than asserted in prose.

## Deviation from design D3: historical findings are not adjudicated

D3 asks for historical findings to be mixed in as blinded reference checks. The normalized dataset stores historical findings as placeholders only (`"Historical annotated finding F61SptCor.1; complete claim remains in local raw source."`, `R/dataset.json`), because the original claim text was never extracted into the frozen corpus. Blinding them would have required re-extracting 110 claims from local sessions and roughly tripling adjudication cost. All 100 fresh findings were adjudicated; the 110 historical rows keep their descriptive annotation labels (`kind: known-target`, `blocking: unresolved`, mechanism `historical-annotation/...`), which the scorer never treats as current-threshold truth. What is lost is the calibration signal of the adjudicator against historical labels; arm blinding is unaffected.

Since F2 wave 1 that distinction is enforced by the data model rather than by this note: the 44 historical rows that carry a target match are stored with `validity: "annotated"`, a value the scorer keeps out of every precision figure and rejects outside a historical-reference trial. Before the change they were stored as `valid`, which published a measured-looking `false positive 0/24` and `0/20` for arms nobody ever adjudicated.

## Source-checked positive match

`Smt-02` (unblinded: `TrialTSmt1.1`, arm T) matched `session-move-tool|R08.1`, mechanism `M-terminal-abort-cancels-siblings`, severity `blocking`. Its cited line was re-read independently in the frozen snapshot:

```
$ sed -n '3923,3929p' <local snapshot worktree>/packages/coding-agent/src/session/agent-session.ts
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

`Smt-01` and `Smt-03` (different trials, different arms) both report mechanism `M-missing-worktree-parent-dir`: the plan admits a missing target only when its parent's realpath equals `realpath(<primaryRoot>/<worktree.repoDir>)`, and never states what happens when `.worktrees` itself does not exist, which is the state of a fresh checkout. The adjudicator rated both `valid`, `blocking`, `kind: additional-defect`, and recorded that no target in the 14-row ledger describes this mechanism. They therefore raise no recall numerator and are counted once as a distinct additional mechanism, not as a match. Across both rounds, 39 of the 100 fresh findings are independently valid and blocking without a matching target (S 32 of 75, T 7 of 25).

## Verifier-loss disposition

The experiment produced **no false drop against the frozen ledger**: `falseDrop` is 0 in every trial with triage available, and the arm rows report `0/36` (S) and `0/10` (T) across all 20 triaged trials.

Since F2 wave 4 there is no target-level post-triage loss at all. Three discovered targets are not retained automatic blockers although a match of theirs survived triage, and the scorer counts each as `survivingNonBlocker`:

- `S-Spt-3` finding `Replacement1SSpt3.8` → target `strength-progression-targets|R22.1`: the verifier confirmed the finding as blocking; the adjudicator rated both the finding and the target below the current threshold. The verifier kept the finding, so this is no verifier downgrade and no residual loss, and the target is no retained automatic blocker either. Post recall stays 3/32.
- `T-Smt-1` finding `TrialTSmt1.4` → target `session-move-tool|R02.2`: same shape; post recall stays 1/14.
- `S-App-1` finding `RerunSApp1.5` → target `acp-permission-parity|R07.1`: the finding is independently blocking and survived, the target itself is below threshold. The same finding also matches the blocking target `|R02.2`, which is retained.

Before wave 4 the first two were published as `downgraded` + `legitimateResidual`, which reads as a verifier loss although the verifier had retained both findings; the frozen contract's downgrade is the verifier's own `confirmed-but-nonblocking` call. `protected`, `undecided`, `pending` and `unresolvedDrop` are 0 in every triaged trial.

The verifier did drop one blocking finding, outside that ledger. `Replacement1SSpt3.9` (S/Spt) was adjudicated `valid`, `blocking`, `kind: additional-defect`, matching no target; the verifier refuted it, unprotected. Counted per mechanism, the verifier kept 24 of 25 such discoveries in S and 5 of 5 in T. Since F2 wave 2 the scorer reports this separately (`report.md`, `Blocking discoveries outside the frozen ledger`), because the frozen contract's `false drop` is defined over targets and would otherwise leave the only verifier loss of the run unreported.

## Verification

```
$ bun scripts/score-plan-review-replay.ts check runs/plan-review-loop-measurement-20261102
ok: 140 sources, 5 items, 40 trials, 88 attempts, 210 findings
```
