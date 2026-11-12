# Review

- **Verdict**: REJECT
- **Reviewed digest**: e9d8b2c2c6c8cab2151c2907e088ea713a5dfa3247e74a7473cefd42ab4d282b
- **Depth**: risky
- **Reviewer**: plan-reviewer, PacRevA1, PacRevB1
- **Verifier**: blocker-verifier, none
- **Models**: PacRevA1 onara/cx/gpt-6.1-sol; PacRevB1 onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### Scope A (PacRevA1)

1. **CHECK 6 — Consultation entry-path parity**
   - Defect: An existing incomplete-round resume dispatches reviewers without visiting the new consultation step. After deployment, resuming a risky change with Awaiting `incomplete` and no consultation.md therefore runs a full round unconsulted. This violates the consultation-before-any-full-round requirement; the eventual presence check only blocks apply after the improperly ordered round has already run. The workflow damage is reversible, but those dispatches have already been spent.
   - Evidence: openspec/changes/plan-architecture-consultation/design.md:24 and tasks.md:15 place the trigger at step 2/2a. The existing team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:665-669 instead resumes an unchanged incomplete record directly at step 3, with fresh reviewers. specs/plan-architecture-consultation/spec.md:9 requires consultation before any full risky round without the record, and :41-44 explicitly forbids that bypass.
   - Change: Make consultation admission common to every full-round dispatch, including incomplete-round resumption. Specify how adopted consultation edits refresh the digest while preserving the incomplete round's carried findings and budget semantics; do not simply discard its resume state.
   - Verifier: not triaged: the verifier has not returned

2. **CHECK 4 / CHECK 6 — Consultation recovery and at-most-once execution**
   - Defect: The record-existence predicate cannot distinguish a never-started consultation from one that already returned successfully but was interrupted before its record was written. In an ordinary session interruption at that point, resuming the prescribed flow launches another consultation and loses the previous attempt's accounting. This breaks the explicit at-most-one requirement and can repeat paid calls; the record can be repaired later, but the repeated spend cannot be undone.
   - Evidence: specs/plan-architecture-consultation/spec.md:9 says a change gets at most one consultation. design.md:24 dispatches whenever consultation.md is absent and writes it only after dispatch; :102-111 put the attempt identity and models solely in the eventual record. design.md:120-124 describes writing the record and applying edits after the consultation. tasks.md:15 likewise provides only the completed-record existence check, with no recovery of an already-running or completed attempt.
   - Change: Define durable in-progress/recovery state within the existing consultation mechanism. Preserve attempt identity and the retry budget, recover the original task/result on resume, and keep incomplete state inadmissible to --reviewed. Cover interruption after dispatch and after report delivery, not only resumption with a finished record.
   - Verifier: not triaged: the verifier has not returned

3. **CHECK 3 — Placeholder detection conflicts with verbatim content**
   - Defect: Reusing PLACEHOLDER as a blanket ban on every field rejects ordinary report text and legitimate user skip reasons. For example, a user's reason 'This only changes the TODO scanner; skip the consultation' is not an unfilled template, but the proposed check rejects it. The author then cannot both preserve the user's exact words and produce a valid skipped record. The same conflict occurs when findings quote angle-bracket syntax. This blocks otherwise valid workflow input and is reversible only by changing the validator or violating the verbatim requirement.
   - Evidence: design.md:150 explicitly reuses PLACEHOLDER, and :157-158 forbid placeholders in Skip reason and any field. team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs:31 defines PLACEHOLDER as /<[^>]+>|\b(?:TBD|TODO)\b/i. specs/plan-architecture-consultation/spec.md:34, :72 and :81 require verbatim reasons/findings. This is not merely hypothetical report syntax: the cited pilot's results/P3-findings.md:73-76 contains legitimate `Blocker B<n>` and `--original-reply <file>` text.
   - Change: Distinguish untouched template slots from quoted source text and ordinary words. Restrict placeholder checks to actual template sentinels/structural fields, or use an encoding that preserves arbitrary report strings and user reasons without interpreting their content as unfinished form syntax.
   - Verifier: not triaged: the verifier has not returned

4. **CHECK 4 — Well-formed record acceptance**
   - Defect: The specified validator accepts a lossy or partially populated consultation record. Six valid header fields plus a Findings subsection containing only a Disposition satisfy D9 even when every original finding field is missing; omitting Recommended approach also satisfies its complete checklist. Such an incomplete model-written record can authorize --reviewed despite not following the shipped template. This breaks the form-validation criterion independently of the expressly accepted limitation that the validator cannot prove a consultation actually ran. The missing content is recoverable only while the original report remains available.
   - Evidence: design.md:111 requires each finding's report fields, and :113-115 require Recommended approach. However, the exhaustive validation rules at design.md:154-158 check only the six header fields, Findings structure and a Disposition per subsection; they require neither the report fields nor Recommended approach. specs/plan-architecture-consultation/spec.md:152 requires plain validation and --reviewed to refuse a consultation.md that does not follow the template.
   - Change: Specify complete structural validation of the form: all required sections, every finding field with appropriate multiplicity and nonempty content, and the required recommended approach. Reject partial records while continuing to treat verification that the report actually ran as the documented prompt-level boundary.
   - Verifier: not triaged: the verifier has not returned

### Scope B (PacRevB1)

5. **F1 executability — candidate validator not exercised**
   - Defect: Tasks 5.1–5.3 install into a disposable agent directory, but the delivered instruction's V command still invokes the validator under ~/.omp/agent. On the ordinary pre-deploy installation, these sessions therefore exercise the old validator rather than the candidate. They can produce misleading passing evidence or fail under the old digest rules. The fixture effects are reversible, but the resulting evidence does not prove the new workflow.
   - Evidence: openspec/changes/plan-architecture-consultation/tasks.md:26 installs with PI_CODING_AGENT_DIR=$TMPDIR/pac-agent; :27 says V runs for real, and :28 reuses that setup. team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml:358 defines V as `node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs`. team-config/agent/skills/review-work/scripts/install-openspec-workflow.mjs:138-141 copies the schema verbatim, without rebinding that path.
   - Change: Make the F1 session resolve V to the candidate installation—for example, use a disposable HOME and install under its .omp/agent—or explicitly bind the QA workflow to the candidate validator. Retain its resolved path and demonstrate a new consultation-rule rejection through that same session workflow.
   - Verifier: not triaged: the verifier has not returned

6. **F1 verification — dispatch suppression is vacuous**
   - Defect: F1-B replaces consultation and reviewer dispatches with fixed payload reads, then uses that session to prove that standard/no-request and resumed/record-present states do not dispatch a consultation. Suppressing dispatch throughout the harness makes those observations true independently of the delivered guard. An instruction that would dispatch another paid consultation on ordinary resume can escape the planned behavioural verification; F1-E only reviews its text. This leaves the material once-only and conditional-selection behaviour unproven.
   - Evidence: openspec/changes/plan-architecture-consultation/tasks.md:27 specifies taking both consultation reports and reviewer results from files 'instead of dispatching', including `standard-no-request.md` and `record-present.md`. The corresponding ordinary-session requirements are specs/plan-architecture-consultation/spec.md:16-19 and :36-39 within the change directory. Tasks :26 and :28 exercise initial risky review and missing-model failure, not these states; :30 supplies static instruction review.
   - Change: Exercise standard/no-request and resumed/record-present states in fresh ordinary sessions with task dispatch enabled. Retain the actual calls and records, showing ordinary reviewer progress without an architecture-oracle call. Fixed report inputs can remain for disposition-specific rows, where copying findings and applying edits—not suppressing dispatch—is the behaviour being tested.
   - Verifier: not triaged: the verifier has not returned

## Residuals

none
