# Review

- **Verdict**: REJECT
- **Reviewed digest**: d573bf5a7141329c9f6b155b8411950d2c70881c2c8151f65839e7f107a27226
- **Depth**: risky
- **Reviewer**: plan-reviewer, GdeR1A, GdeR1B
- **Verifier**: blocker-verifier, none
- **Models**: GdeR1A onara/cx/gpt-6.1-sol; GdeR1B onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (GdeR1A)

1. **Area**: CHECK 7 — design.md D-3: canonical left-out directory
   **Defect**: The writer and verifier require different representations of the same directory. In normal operation, `patch` writes a trailing slash, but `delta` and `accept` must accept only the exact imported `EVIDENCE_DIR` value, which has no trailing slash. Following both instructions makes every new-form directory fail verification before its verdict can be recorded. This blocks the intended workflow; the damage is reversible rework, not data loss.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/design.md:62 requires `"left_out": ".omp/team-config/evidence/"`; design.md:64-66 accepts the exact `EVIDENCE_DIR` value and refuses every other value. team-config/agent/skills/review-work/scripts/gate-layout.mjs:17-20 defines that value as `path.join(".omp", "team-config", "evidence")`, without a trailing slash. The specification also requires the slash-terminated serialized value at openspec/changes/gate-delta-evidence-elision/specs/post-implementation-review/spec.md:34-36. Both affected consumers call the shared verifier at gate-convergence.mjs:404 and :436.
   **Change**: Define one canonical serialized directory value derived from `EVIDENCE_DIR`, including the trailing slash required by the specification, and require both manifest generation and verification to consume it. Distinguish an absent legacy field from every unsupported value. Include a successful new-form patch-to-delta round trip that exercises this exact serialization.
   **Triage**: not triaged: the verifier has not returned

### Scope B (GdeR1B)

2. **Area**: Quality and verification — tasks 1.2 and 3.1
   **Defect**: No planned test records a verdict from an intact new-form directory containing evidence-elided patches. A verifier that validates the left_out value but always recomputes full patches would pass the listed tests while refusing the mixed code/evidence ranges this change must unblock. This affects ordinary fix rounds and reversibly stops their gate.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/tasks.md:11 specifies successful delta only for the hand-written legacy directory; the new-form cases are edited-patch and foreign-manifest refusals. tasks.md:19 repeats those scenarios and explicitly does not record the real review's verdict in the ledger. Existing successful delta/accept tests use source-only commits: team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs:206-227,344-380. Keeping the existing full-patch recomputation at gate-convergence.mjs:239 while adding the foreign-value guard would therefore escape the planned checks, contrary to specs/post-implementation-review/spec.md:32-35.
   **Change**: Add positive round-trip tests using actual mixed and evidence-only commits: generate the new directory, assert the exact left_out field, then successfully record its verdict. Exercise accept on an intact new-form directory after recording its REJECT, and cover legacy accept compatibility. Include a deployed-script F1 round-trip row; the existing refusal cases should remain.
   **Triage**: not triaged: the verifier has not returned

3. **Area**: Quality and verification — task 2.1
   **Defect**: The two substring greps do not prove the required delta-brief text or its placement. An incomplete edit that retains those fragments but omits the evidence inspection command, puts the explanation outside the dispatched brief, or drops the existing complete-reading instruction still passes this task's Verify. This can leave the shipped reviewer instructions incomplete; correction is reversible.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/tasks.md:15 checks only 'left out; a patch that changes any ends with their listing by directory' and 'leaves out the hunks of files under ...'. Neither check establishes the contents of the Delta brief block. design.md D-4 requires the fixed evidence path, the git show command, and otherwise unchanged brief text; specs/post-implementation-review/spec.md:5-8 requires the brief to describe the patch contract. The existing complete-reading instruction is at team-config/agent/skills/review-work/SKILL.md:512. The existing tests contain no assertion of this brief's content.
   **Change**: Make task 2.1 deterministically check the actual step 5a and fenced Delta brief blocks against their expected text, including the fixed path, directory listing explanation, inspection command, and preserved manifest/complete-reading/cumulative-effect instructions. Verify the deployed blocks in F1 as well. Keep model behaviour judged through the real session rather than a semantic scoring command.
   **Triage**: not triaged: the verifier has not returned

4. **Area**: Quality and executability — task 3.1 F1 evidence
   **Defect**: F1's Verify accepts any nonempty row containing 'Verdict: PASS', including rows left from an earlier implementation head or incomplete captures. It checks none of the head, captured outputs, patch observations, or structured reviewer result that the task requires. The real-session row also retains only the final reply, not the dispatched brief and successful reading interactions needed to establish the changed workflow. Ordinary fix-and-rerun iterations can therefore mark F1 complete without final-tree proof; recapture is reversible.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/tasks.md:19 requires evidence naming the head, commands, captured output and observations, plus a fresh reviewer with a verbatim structured verdict. Its Verify loop checks only test -s and grep '^Verdict: PASS' for each file. Consequently unchanged PASS files from the previous head satisfy the command after another code commit. openspec/schemas/omp-gated/schema.yaml:291 requires deterministic verification of artifact presence and evidence integrity. The review-work skill's Change verification section calls for retaining relevant outputs and successful tool interactions, not just an asserted model outcome.
   **Change**: Define checkable evidence structure and make F1 Verify reject missing/partial captures and rows not bound to the required implementation head, except explicitly justified carries where permitted. Check the presence and integrity of each row's required outputs, including the real-range measurements and verbatim structured reviewer result. Retain the exact real-session brief and relevant tool interactions/session transcript, and judge that observed behaviour directly; do not add a model-behaviour rescoring command.
   **Triage**: not triaged: the verifier has not returned

## Residuals

none
