# Review

- **Verdict**: REJECT
- **Reviewed digest**: 4187b3a2c7e2afd73f476726b26e4b350692c023f470675fec9543b9fb4c769b
- **Depth**: standard
- **Reviewer**: plan-reviewer, PlanReviewFUR1
- **Verifier**: blocker-verifier, none
- **Models**: PlanReviewFUR1 onara/cx/gpt-6.1-sol
- **Round**: 1
- **Awaiting**: triage
- **Override**: none

## Blockers

### All scopes (PlanReviewFUR1)

1. **Area**: CHECK 6 — destination provenance across propose and archive
   **Defect**: A normally generated proposal can take a follow-up without recording its source document, after which archive cannot both remove it and obey its write restriction. For example, project context names docs/roadmap/widgets.md, but the proposal records only the required verbatim bullet, containing a code location and source change—not the roadmap path. Archive then forbids writing that unnamed document. This breaks the removal requirement in an ordinary fresh archive session; the stale item is reversible but the promised loop does not close.
   **Evidence**: openspec/changes/follow-up-routing/tasks.md:40 requires verbatim taken bullets and the originating document only in the final conversational summary, not in proposal.md. tasks.md:26 says “Never write to a document the proposal does not name,” while tasks.md:28 requires deleting taken bullets from their documents. specs/review-follow-ups/spec.md:84-88 requires their removal. The separate propose-take and remove-taken fixtures at tasks.md:52 do not exercise this handoff.
   **Change**: Persist each taken item's repository-relative source document in proposal.md alongside its unchanged bullet, and explicitly authorize and resolve removal through that association. Add a fresh-session propose-to-archive round trip where the roadmap initially appears only in request/project context. Also decide how a user can select a destination when the proposal names no documents; the delivered step currently offers only named documents and skip.
   **Triage**: not triaged: the verifier has not returned

2. **Area**: CHECK 2 — unavailable source provenance
   **Defect**: The required wave number is not guaranteed to exist in the permitted durable inputs. A valid gate record can bind a trailer under f2/ without recording its wave anywhere. Archiving such a record in another checkout/session cannot produce the mandated source honestly: it must invent a wave, omit a required field, or drop the item. This breaks the source requirement under normal supported record layouts; incorrect Markdown provenance is reversible.
   **Evidence**: openspec/changes/follow-up-routing/tasks.md:24 and specs/review-follow-ups/spec.md:51-55 require the wave. team-config/agent/skills/review-work/SKILL.md:14 explicitly permits an f2/trailer-implementation-audit.txt path; its trailer format at lines 241-254 and record format at lines 525-550 require no wave field. A concrete repository example is .omp/team-config/evidence/gate/comment-commits.json:159-161, whose bound f2 trailer has a non-blocking note but no wave metadata in .omp/team-config/evidence/gate/comment-commits/f2/trailer-implementation-audit.txt:1-42.
   **Change**: Define provenance using information existing records actually guarantee, such as the bound artifact path and record/reviewed SHA, with an explicit unknown-wave representation when necessary. Alternatively identify a guaranteed durable wave source without assuming an ignored local ledger exists. Update the requirement and add a fixture using the supported f2 layout with no wave metadata.
   **Triage**: not triaged: the verifier has not returned

3. **Area**: CHECK 2 — lossy follow-up identity
   **Defect**: Location plus change/wave/reviewer does not identify an individual finding. Two distinct notes from the same reviewer can concern the same line or broad area. After adding the first, the specified deduplication skips the second, contradicting the requirement to collect and record every finding. This is ordinary reviewer output, not deliberately corrupted input; the omitted work can be recovered from the source review, but the change's value proof fails.
   **Evidence**: openspec/changes/follow-up-routing/design.md:30 defines identity as location plus source. tasks.md:24 implements that rule. specs/review-follow-ups/spec.md:10 requires every non-blocking finding, while lines 51-55 allow the source to identify only the reviewer, without a finding identifier. tasks.md:52 tests repeating one existing item, but not distinct items sharing those identity fields.
   **Change**: Include an individual finding discriminator in identity—an existing note/blocker identifier where available, otherwise a stable distinction derived from the finding itself. Define normalization and exclusions explicitly. Add controls proving that identical items deduplicate, distinct findings at the same location survive, and changing each identity component is distinguished.
   **Triage**: not triaged: the verifier has not returned

4. **Area**: Verification — whole-diff-report collection is not exercised
   **Defect**: The plan claims collection from a second material source, the bound whole-diff report, but no real-session row exercises it. Removing that clause from the delivered instruction would leave task 2.1's Verify command and every listed F1 archive scenario able to pass. Thus the retained evidence would not establish the complete collection requirement. This affects normal changes with an on-demand integration review; missing follow-ups are reversible but violate the criterion.
   **Evidence**: openspec/changes/follow-up-routing/specs/review-follow-ups/spec.md:10 and tasks.md:20 include the whole-diff report. tasks.md:35 checks selected instruction fragments but none for whole_diff or report collection. The fixture at tasks.md:50 and all rows at tasks.md:52 supply trailer notes and downgrades, with no report-only finding. team-config/agent/skills/review-work/SKILL.md:546 defines the supported whole_diff.run=true report binding.
   **Change**: Add a real-session archive row whose valid record binds a whole-diff report containing a unique follow-up absent from every trailer and downgrade. Retain the tool interactions, routed bullet, summary, and before/after report digest. Make task 2.1's deterministic delivered-text check cover that source as well; no model-behaviour re-scoring script is needed.
   **Triage**: not triaged: the verifier has not returned

## Residuals

none

