# Review

- **Verdict**: REJECT
- **Reviewed digest**: 79146cb81ae8291fa4fc7b223bb1e596620c6407129e763618977c44f5f56636
- **Depth**: risky
- **Reviewer**: plan-reviewer, PacRevA2, PacRevB2
- **Verifier**: blocker-verifier, none
- **Models**: PacRevA2 onara/cx/gpt-6.1-sol; PacRevB2 onara/cx/gpt-6.1-sol
- **Round**: 2
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PacRevA2)

1. **Correctness — verbatim report serialization and validation**
   - Defect: A normal consultant finding containing a fenced code example cannot reliably survive the specified record writer and parser. D6 places the first value line after the field bullet and indents subsequent lines by two spaces; D9 then passes the record through the existing global Markdown fence/comment stripper. For a correction string such as "```sh\ncommand\n```", the bullet-prefixed opening fence is not recognized, but the two-space-indented closing fence is recognized as an opening fence. The scanner consequently hides confidence, disposition and the following section. Validation rejects the otherwise valid consultation, blocking the review workflow. This is reversible by correcting the design, but paraphrasing the report to get past validation violates the verbatim-record requirement.
   - Evidence: openspec/changes/plan-architecture-consultation/design.md:116 specifies verbatim field bullets with two-space continuation indentation; design.md:155 requires reuse of planContent/scanMarkdown/topLevelField. team-config/agent/skills/review-work/scripts/plan-contract.mjs:19-25 recognizes fences only at the start of a line after zero to three spaces, and :53-54 removes their contents. The required acceptance of report text is stated in openspec/changes/plan-architecture-consultation/specs/plan-architecture-consultation/spec.md:193-195.
   - Change: Specify a lossless record encoding and parser that treats report values as opaque data rather than interpreting their fences/comments as envelope syntax. Validate the envelope separately. Include a valid finding whose correction starts with a multiline fenced example, and a recommended approach containing Markdown, without changing the source report text.
   - Verifier: not triaged: the verifier has not returned

2. **CHECK 2 / CHECK 8 — consultation attempt identity and recovery selection**
   - Defect: The proposed attempt identifier does not uniquely identify a change or its originating session, and recovery does not verify either before accepting a report. Two already-committed changes consulted from separate worktrees at the same starting commit receive the same ArchConsult<commit8>1 name. Their transcripts legitimately coexist in different parent artifact directories. On interruption and recovery in a fresh session, basename lookup can therefore find the other change’s transcript. Because both reports use Fable and have structured yields, D5’s acceptance predicate accepts the unrelated report, applies or rejects its findings, and suppresses the intended consultation. No hash collision or simultaneous editing is required. Plan edits are reversible, but the consultation guarantee is lost and any additional model spend is not recoverable.
   - Evidence: openspec/changes/plan-architecture-consultation/design.md:87 claims that commit-prefix plus attempt number is unique per change; :90 accepts the recovered result based on yield and model alone. packages/coding-agent/src/task/output-manager.ts:2-8 explicitly defines names as session-scoped, with optional prefixing and suffixing; packages/coding-agent/src/task/executor.ts:4785-4786 writes transcripts beneath the parent artifact directory. packages/coding-agent/src/internal-urls/registry-helpers.ts:68-78 documents duplicate basenames across directories and first-hit selection; history-protocol.ts:349-356 prioritizes the current caller’s root, not the original consultation’s root. This breaks the recovery requirement at openspec/changes/plan-architecture-consultation/specs/plan-architecture-consultation/spec.md:53-58.
   - Change: Bind each pending attempt to its originating parent session/artifact directory and allocated child identity, and verify that the recovered dispatch belongs to the intended repository, change directory and attempt before accepting it. Do not select an arbitrary basename match; ambiguous or mismatching transcripts must remain visibly unresolved. Add a recovery control with two changes sharing the same starting commit and attempt name but different reports.
   - Verifier: not triaged: the verifier has not returned

### Scope B (PacRevB2)

3. **Quality and verification — requested standard-depth consultation**
   - Defect: No planned test exercises a standard-depth change whose user requests a consultation. An instruction that simply never consults at standard depth could satisfy every listed F1 row while ignoring this promised input. Trigger: an ordinary user requests the optional consultation on a standard change. Impact: the requested consultation is omitted; reversible by running it later, but the acceptance criterion is unproved.
   - Evidence: specs/plan-architecture-consultation/spec.md:9 specifies the requested-standard path, and tasks.md:15 explicitly makes the user's request an admission condition. tasks.md:27 tests only 'Standard change without a request'; the six seeded rows at tasks.md:28 and negative-control reviews at tasks.md:31 do not exercise requested-standard behaviour.
   - Change: Add a fresh dispatch-enabled standard-depth session with an explicit user request. Retain the request, actual architecture-oracle task item and pinned-model evidence, committed consultation record, and ordering before the standard plan-reviewer dispatch. Include its evidence artifact in the task's Verify command.
   - Verifier: not triaged: the verifier has not returned

4. **Quality and verification — source-report fidelity evidence**
   - Defect: F1 does not require retaining the complete counted consultation report or comparing its finding fields with consultation.md. The mixed-disposition row checks counts and edits, not verbatim fidelity. During normal recording or interrupted recovery, a model could summarise a correction or alter a consequence while all specified form tests and F1 observations still pass. This leaves the core record-fidelity criterion unproved and also weakens the evidence for reviewer blindness. The record can be corrected before acceptance, so the damage is reversible.
   - Evidence: specs/plan-architecture-consultation/spec.md:105-110 requires every finding verbatim; :124 prohibits quoting, summarising or referencing those findings in formal dispatches. tasks.md:26 explicitly retains task items, child model identities, tool-call order and final records, but not the complete source report. The 'Mixed dispositions' row at tasks.md:28 requires two adopted findings with edits and one rejection without requiring source-payload retention or equality with the original fields. The validator tests at tasks.md:11 validate record form, not correspondence to the counted report.
   - Change: Retain the complete counted structured yield, including the report used during interrupted recovery, and the original seeded payload files. Require direct comparison of every finding ID and report field against consultation.md, alongside the existing disposition/edit checks. Use the retained report when assessing whether formal dispatches expose findings. This needs retained inputs and direct assessment, not a new model-behaviour scorer.
   - Verifier: not triaged: the verifier has not returned

## Residuals

none
