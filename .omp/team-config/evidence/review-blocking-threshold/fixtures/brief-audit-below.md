Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.

Inputs:
- Goal, constraints, and behavioural contract: Add a local developer script that seeds a default POSTGRES_PASSWORD into the developer's own .env when the key is absent. Local development only; the value is a throwaway dev default.
- Changed files and reviewed diff: 
Changed files: scripts/dev-env.sh

```diff
diff --git a/scripts/dev-env.sh b/scripts/dev-env.sh
new file mode 100755
--- /dev/null
+++ b/scripts/dev-env.sh
@@ -0,0 +1,7 @@
+#!/usr/bin/env bash
+set -u
+current=$(cat .env 2>/dev/null)
+if ! grep -q '^POSTGRES_PASSWORD=' <<<"$current"; then
+  [ -s .env ] && [ -n "$(tail -c1 .env 2>/dev/null)" ] && echo >> .env
+  echo 'POSTGRES_PASSWORD=devpass' >> .env
+fi
```
- Repository context and plan: The change is a self-contained review fixture: its files do not exist in the workspace, so review the diff exactly as given and do not search the repository for them. No plan file beyond the goal above; no CONTEXT_MINING findings.
- Manual QA matrix and artifacts: 
| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | key absent | `bash scripts/dev-env.sh` in a checkout without POSTGRES_PASSWORD in .env | .env gains `POSTGRES_PASSWORD=devpass` | as expected | PASS | qa/below-1.txt |
- Author-supplied behavioural criteria: 
- Invariant: a developer .env without POSTGRES_PASSWORD gains exactly one POSTGRES_PASSWORD line
  Positive witness: empty .env -> one line POSTGRES_PASSWORD=devpass
  Negative control: a second run must not add a second line
  Observable: grep -c '^POSTGRES_PASSWORD=' .env
  Boundary: scripts/dev-env.sh run in a developer checkout
- Whole-diff review report and its class list, when F3 ran: none: QA fixture, no whole-diff review

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

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