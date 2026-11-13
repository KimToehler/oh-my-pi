# Review

- **Verdict**: REJECT
- **Reviewed digest**: 81302a11f70e8f076f1288dd3f7a527b14efaeb1aa0d67195a32d1c6528dcf62
- **Depth**: risky
- **Reviewer**: plan-reviewer, GdeR2A, GdeR2B
- **Verifier**: blocker-verifier, none
- **Models**: GdeR2A onara/cx/gpt-6.1-sol; GdeR2B onara/cx/gpt-6.1-sol
- **Round**: 2
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (GdeR2A)

1. **Area**: correctness / architecture
   **Defect**: The delta reviewer cannot use the plan's sole documented route to inspect omitted historical evidence. When a cumulative range overwrites or deletes a capture needed to assess a fix or carry decision, read/grep/glob against the current checkout cannot recover that commit's version, and the advertised git show commands are unavailable. The reviewer must then stop or decide without the evidence that the design says remains accessible. This is reversible before dispatch, but otherwise defeats the stated recovery mitigation.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/design.md:49 advertises `git show <sha> -- <path>`; :58 says the reviewer obtains omitted filenames with `git show --stat`; :89 puts Git-based recovery into the delivered reviewer brief; :106-107 explicitly justifies the trade-off with “the reviewer has read-only git.” In contrast, packages/coding-agent/src/prompts/agents/plan-reviewer.md:4 declares only `tools: read, grep, glob`, and team-config/agent/skills/review-work/SKILL.md:495 dispatches that agent. No reviewer-capability change or separately readable historical-evidence artifact is planned.
   **Change**: Provide commit-pinned, on-demand recovery through capabilities the actual reviewer has—for example, separately readable evidence artifacts outside the mandatory patch-reading set, with their integrity bound—or design an explicitly supported read-only historical retrieval path. Update the listing and brief accordingly, and exercise a reviewer opening omitted evidence that has subsequently been overwritten or deleted.
   **Triage**: not triaged: the verifier has not returned

### Scope B (GdeR2B)

2. **Area**: quality / executability — tasks 2.1 and 3.1
   **Defect**: The only real-session verification can pass without establishing that the reviewer can retrieve omitted evidence. When a reviewer needs to inspect a changed or deleted capture, the supplied retrieval mechanism is `git show`, but the dispatched plan-reviewer has no shell or Git tool. Task 2.1 merely verifies that this instruction was copied correctly; m3-real-reviewer requires reading every patch and returning a verdict, not successfully retrieving any omitted file. Thus both checks can pass while this advertised workflow is unusable. The consequence is an unsupported review operation and potentially another incomplete review; recovery requires changing the retrieval mechanism and redispatching.
   **Evidence**: packages/coding-agent/src/prompts/agents/plan-reviewer.md:4 restricts tools to `read, grep, glob`. openspec/changes/gate-delta-evidence-elision/design.md:58 prescribes `git show --stat` for discovering omitted filenames, :89 prescribes `git show <sha> -- <path>` in the shipped brief, and :106-107 claims the reviewer has read-only Git. tasks.md:15 checks text equality only; :19 defines m3's observation as a structured verdict after reading every patch, with no successful omitted-evidence lookup required.
   **Change**: Provide an omitted-evidence retrieval route executable with the actual reviewer's available tools, and add a fresh-session F1 case that needs a specific omitted file—including historical content unavailable from the current working tree. Retain the successful lookup interaction and returned content, and judge that observation directly. Do not replace this with a model-behaviour scoring script.
   **Triage**: not triaged: the verifier has not returned

3. **Area**: executability — tasks 1.1 and 1.2
   **Defect**: The plan requires every new script test to fail on the unchanged script, including tests whose purpose is to preserve behaviour the unchanged script already implements. The no-evidence byte-equality test and the hand-written legacy-directory acceptance test should already pass. Normal implementation therefore cannot satisfy the stated test-first acceptance condition without artificially breaking or weakening these fixtures. This blocks honest task completion, although the resulting rework is reversible.
   **Evidence**: openspec/changes/gate-delta-evidence-elision/tasks.md:4-5 requires all new tests to be seen failing on the unchanged script; :10 includes `Range without evidence`; :11 reiterates `Each test is seen failing on the unchanged script first` and includes the old-form directory without `left_out`. team-config/agent/skills/review-work/scripts/gate-convergence.mjs:219-221 already emits exactly the full `git show` bytes required by the no-evidence test; :223-262 verifies full patches without requiring `left_out`, and :404-458 already supports recording REJECT followed by acceptance.
   **Change**: Separate new-behaviour regression tests from preservation guards. Require observed RED for tests that discriminate the new filtering or manifest-validation behaviour; explicitly allow the unchanged-byte and legacy-directory compatibility tests to start GREEN. Keep their independent fixtures and assertions intact.
   **Triage**: not triaged: the verifier has not returned

## Residuals

- Round 1 (GdeR2A, GdeR2B; triage GdeV1): four findings confirmed blocking and fixed in commit after 4983a1188d (one LEFT_OUT_DIR spelling, new-form round trip, exact brief check, head-bound F1 rows).
