INTEGRATION-REVIEW-REPORT-v1

# F3 integration review: team-config-omp-native-locations

Range `main...HEAD` (merge base 35e10fce04acea8b23852ce4b26ae0fe5e7a517d). Plan: `openspec/changes/team-config-omp-native-locations`. Reviewer: `auditor`, verbatim integration-review brief.

- Wave 1 at 1fd7b318d151 (snapshot F3-b4aaf73bbd8d-wave-1): FAIL, blockers B1 `incompatible-report-staging-instructions`, B2 `normalized-diff-instead-of-byte-equality`. GC wave: CONTINUE.
- Cleanup commit 698b25c8f449 `refactor(team-config): integration cleanup` (rows 7.2-7.4) plus plan rows 735269b523b6; fix-delta review by `plan-reviewer`: OKAY (first attempt returned REJECT because the router compressed the patch read; retried fresh, per review-work Fix waves step e). Verification gate: `bun run test:team-config` 627 pass, 0 fail.
- Wave 2 (delta round) at 735269b523b6 (snapshot F3-b4aaf73bbd8d-wave-2): PASS. GC wave: DECISION PASS. Should-fix taken as follow-up, not fixed: README upgrade note on `.omo` plans/evidence wording.

Both reports follow verbatim.

## Wave 1 report

## Must-fix

**Blocker B1: Generated OpenSpec gates cannot follow both the F3 verification and the prescribed F2 snapshot workflow.** `team-config/agent/skills/review-work/openspec/schemas/omp-gated/templates/tasks.md:16` requires the F3 report to be in Git’s index before the task can be verified, while `team-config/agent/skills/review-work/SKILL.md:402` says to commit it with the record after F2; `gate-convergence.mjs:213-214,326-328` rejects a snapshot with staged changes. **Trigger:** a normal generated change completes F3 and stages its new report to satisfy the template. **Impact:** F2’s snapshot refuses, contrary to the shipped workflow and the plan’s report-after-review contract. The state is reversible by unstaging or committing the report, but neither action follows all the supplied instructions.  
**Fix:** Make F3 verify the report’s existence and marker without requiring it to be staged, then explicitly stage it with the record and trailers in Phase 5; retain the validator’s tracked-and-digest checks.  
**class:** incompatible report-staging instructions. **sites:** template `tasks.md:16`, schema `schema.yaml:267-271`, and review-work `SKILL.md:402,444`. Search: `functions.grep` with pattern `git ls-files --error-unmatch .*f3|Only the record and the|commits on top of \`reviewed_sha\` are tolerated`, path `.`; report-path search pattern `f3-integration-review-report\.md|Only the record and the|committing that evidence afterwards`, path `.`.

**Blocker B2: Git’s normalized diff is not a byte-equality check for artifacts.** `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs:328-370` uses `git diff --quiet` to establish equality, but `verifyAndPinArtifact` hashes working-tree bytes at `:258-262`. **Trigger:** a normal checkout using Git line-ending conversion, such as `core.autocrlf=true`, has a text artifact whose CRLF working-tree bytes normalize to an LF index blob. **Impact:** Git can report no diff while the record binds the CRLF digest and the commit stores different bytes, violating D12’s committed-bytes criterion; the later settled shortcut does not revalidate artifacts. The resulting local gate record can be corrected, but it can otherwise back a claim with nonmatching committed evidence.  
**Fix:** Compare the actual working-tree bytes and index/HEAD blob bytes, without Git clean-filter normalization, for the record, trailers and report; cover a repository configured for line-ending conversion.  
**class:** normalized comparison substituted for artifact-byte equality. **sites:** `recordIsCommitted`, `gitDiffQuiet`, and `assertTracked` in `validate-gate-record.mjs:328-370`; their callers are `pinRecordPath` and `verifyAndPinArtifact` at `:257-258,282-285`. Search: `functions.grep` pattern `\b(STATE_DIR|EVIDENCE_DIR|GATE_RECORD_DIR|LEDGER_PATH|GATE_DELTAS_DIR|RECORD_SCHEMA)\b`, path `.`, followed by reading `validate-gate-record.mjs:230-420`; the byte-comparison implementation is centralized in these helpers.

## Should-fix

1. **`team-config/agent/skills/review-work/SKILL.md:351,402` — The exemption and staging summaries omit the newly bound report.** The first says anything other than the record, trailers and plan blocks after `reviewed_sha`; the second says only the record and trailers are staged, despite the new report contract. This does not independently block because Phase 5 describes the report, but it gives operators conflicting instructions.  
   **Fix:** Include the qualifying report in both summaries and explicitly stage it in Phase 5.  
   **class:** stale gate-workflow summaries. **sites:** `SKILL.md:351,402`; search: `functions.grep` pattern `git ls-files --error-unmatch .*f3|Only the record and the|commits on top of \`reviewed_sha\` are tolerated`, path `.`.

2. **`team-config/agent/rules/lesson-size-gate-to-audience.md:5-6` — The migrated plan glob appears twice.** It is redundant configuration, not a behavioral blocker.  
   **Fix:** Remove one duplicate entry.  
   **class:** duplicate migrated glob. **single instance:** search `functions.grep` pattern `\*\*/\.omp/plans/\*\*/\*\.md`, path `.`, found the duplicate only in this rule; other matches are separate rules or an example.

## Nit

None.

## Checked

- **Duplication:** D4 intentionally duplicates the schema ID across the extension and script module; the duplicate rule glob is reported above.
- **Naming inconsistency:** Checked record schema, report digest and ledger/delta path names across producers and consumers; no unintended instance found.
- **Uneven API surface:** Checked `InstallReport.notices`, record fields and shared layout exports; no instance found.
- **Mixed conventions:** Checked the duplicated extension/schema constant and validator checks; the former is intentional under D4. The staging and byte-comparison inconsistencies are reported above.
- **Missing abstractions:** No cross-slice abstraction candidate beyond the reported workflow simplification.
- **Dead code:** Searched the new layout constants and their consumers; the evidence and gate-directory exports are specified by D4, though currently used to compose the layout rather than imported by consumers. No unintended dead-code instance found.
- **Doc drift:** Report staging and exemption summaries are reported above.
- **Surprise scope and plan:** Compared the supplied changed-file list with the pinned proposal, design and task slices. No implementation of P5b, P5c, omp-core changes, or other listed out-of-scope work found. No i18n keys were changed.
- **Verification checklist:** The pinned tasks mark implementation checks complete, but the supplied artifacts contain no command output proving those runs or their required pre-fix RED observations. F3, F1 and F2 are pending in the pinned plan; this read-only review did not run tests.
- **Seams:** Inspected all seven listed seams: shared layout and convergence; stop-hook ID and ordering; report production and validation; committed-byte checks; installer notice and seed; ignore guidance; and rule globs. Findings affecting the report, committed bytes and globs are above.
- **Simplification pass:** Remove the duplicate glob and make the report’s staging lifecycle consistent.
- **Review limitation:** The supplied patch itself ends with an RTK truncation notice during `merge-gate.test.ts`; the remainder of that changed test file was read directly, but the supplied diff does not show any changes beyond its truncation point.

FAIL

## Wave 2 report

PASS

## Must-fix

None.

## Should-fix

1. `team-config/README.md:95` — **what:** The upgrade note says old `.omo/plans` and `.omo/evidence` files “are not read any more,” but the new contract intentionally keeps plan paths opaque (including existing `.omo/plans/*.md`) and keeps record paths free; the stop hook also reads a claimed legacy-path v2 record to refuse it with the v3-specific reason. **why:** An operator can be incorrectly told that a valid existing plan or a deliberately located v3 record cannot be used, even though the validator’s plan binding accepts the supplied path and D1 rejects a fixed record-location policy. **fix:** Narrow the statement to the migrated ledger/delta state and retired v1/v2 records, e.g. say that old ledgers/deltas are not resumed and old records cannot back new claims, while plan paths and a v3 record’s tracked location remain contractually supported. This does not block because the effect is documentation-only and locally reversible.  
   **class:** misleading legacy-location migration documentation.  
   **single instance:** `functions.grep` with pattern `\.omo/(plans|evidence).*not read|not read.*\.omo/(plans|evidence)|Old \.omo`, path `team-config;openspec`, case `false`, gitignore `false`, found this user-facing claim only; the other result is the intentional legacy-ledger negative-control test. Compared against `openspec/changes/team-config-omp-native-locations/design.md:25-41`, `validate-gate-record.mjs:707-716`, and `merge-gate.test.ts:863-879`.

## Nit

None.

## Checked

- **Previous-report closure:** Confirmed `incompatible-report-staging-instructions` is closed at every reported site: the generated task now checks the marker without staging (`templates/tasks.md:16`), the schema directs F3 to leave the report unstaged (`schema.yaml:267-273`), and review-work’s exemption, staging, and Phase-5 guidance now name the report (`SKILL.md:351,402,444`). Confirmed `normalized-diff-instead-of-byte-equality` is closed: `assertTracked` now compares raw working-tree/index/HEAD blobs via `git cat-file blob` (`validate-gate-record.mjs:340-371`), and the CRLF regression case exists. Confirmed the stale summaries and duplicate plan glob are closed.
- **Duplication across slices/files:** No unintended instance found. The duplicated record schema constant is intentional D4 separation between the extension and script layout module.
- **Naming inconsistency:** No instance found. `schema`, `whole_diff.report_sha256`, and the ledger/delta names are consistent across the producer, validator, stop hook, guidance, and tests.
- **Uneven API surface:** No instance found. `InstallReport.notices` is initialized by the installer and consumed by the CLI/tests; whole-diff records consistently pair `report` with `report_sha256`.
- **Mixed conventions:** No unintended instance found. Artifact-byte verification consistently uses raw blob comparison in the validator; F3 report staging is consistently delayed until review-work Phase 5.
- **Missing abstractions:** No cross-slice candidate found. `gate-layout.mjs` centralizes the script-owned locations; the extension’s separate schema literal is required to avoid making stop-hook loading depend on a skill file.
- **Dead code:** No unintended instance found. `GATE_RECORD_DIR` and `EVIDENCE_DIR` have no external script consumer, but are specified D4 layout exports and compose the canonical layout rather than acting as a compatibility alias.
- **Doc drift:** Reported the README migration claim above. The root `.gitignore` D6 block and README block match line-for-line; native locations in shipped guidance match the layout module.
- **Surprise scope:** The changed-file inventory stays within the planned validator, convergence, extension, installer, seed, guidance, rule-glob, ignore-policy, and test surfaces. No `packages/` change, P5b migration, P5c work, onara policy change, or provenance-note removal was introduced.
- **Plan walks:** The plan’s out-of-scope list was checked against the diff; no excluded implementation landed. No i18n keys were added. The implementation task rows are marked complete, but this read-only review did not run their commands and the supplied evidence directory contains only the prior F3 report. Final-wave 8.1 is this F3 review and 8.2/F2 remain pending by plan design.
- **Seams:** Verified shared v3 ID and layout paths between `gate-layout.mjs`, validator, convergence, extension, and tests; retired-id refusal precedes settlement; report marker/digest production and consumption agree; D12 raw-byte checks cover record/trailer/report; installer notice and seed agree; ignore rules and rule globs agree.
- **Simplification pass:** No additional cross-slice simplification candidate found.
- **Verification reviewed:** Read the real-Git sandbox coverage for validator, convergence, and stop-hook cases plus installer tests; no tests, builds, linters, or runtime commands were run by this reviewer.

PASS
