# Design

## Context

See proposal.md - Why. The relevant mechanics of `validate-gate-record.mjs`:

- Phase 1 checks only the structure of `qa[]` rows (`passed === true`, non-empty `artifact`, lines 587-597).
- Phase 2 authenticates artifacts through `verifyAndPinArtifact`: `assertTracked`, then a byte digest, then an optional `admit` callback that decides whether the path enters the post-review exemption. `assertTracked` already covers four refusals: containment including symlinks, ignored paths, missing index entries, and the working-tree/index/`HEAD` agreement of "Validated bytes are the committed bytes".
- Phase 3 (`commitsTouchOnlyEvidence`) accepts commits after `reviewed_sha` only when every touched path is pinned.
- The whole-diff report already uses exactly this path: it is tracked, digested, and pinned only under `reportMayBePinned`.

The comment at line 393 and SKILL.md "`qa[].artifact` is **not** exempt" both rest on one premise: QA artifacts exist before validation and need no exemption. The data contradicts that premise for durability. The artifacts exist on the validating machine, but they are ignored, so they never reach a commit.

## Goals / Non-Goals

**Goals:**
- Every QA artifact a record cites is readable from any checkout of the merged default branch, with bytes provably equal to what the orchestrator saw.
- Storing those artifacts after the review cannot widen what counts as reviewed code.

**Non-Goals:**
- Proving that the QA really ran. The validator reads files and cannot witness a run, the same boundary as for trailers.
- Keeping artifacts of failed or superseded waves. Only rows the record cites must be durable.
- Migrating merged records. They are settled, and their missing artifacts cannot be restored.
- Changing `gate-convergence.mjs`, the ledger, or the `.gitignore` block.

## Decisions

1. **Route QA artifacts through `verifyAndPinArtifact`** (Phase 2, one call per row). Path field `qa.<n>.artifact`, digest field `qa.<n>.artifact_sha256`. This reuses every existing refusal, including the "Validated bytes" check, through the one sanctioned admission path. Alternative: a separate QA checker. Rejected, because a second reader would re-implement containment, ignore and index checks, and the file's own structural guard says no read may bypass that pair.

2. **`admit` for QA: absent at `reviewed_sha` and below the record's evidence directory.** The evidence directory is the record path without `.json`, e.g. `.omp/team-config/evidence/gate/<plan basename>/`. Alternatives considered:
   - Reuse the report rule "inside the record's directory". Rejected: the record path is free. A record at the repository root, or a shared `evidence/gate/` directory, would then exempt any new file anywhere, or any other plan's directory. The report needs its first-line marker for exactly this reason, and QA artifacts (PNG, JSONL, logs) have no marker to carry.
   - No exemption, so QA must be committed before the snapshot. Rejected: QA runs inside the wave, after `GC snapshot`. Moving it out changes the meaning of the ledger's `qa` outcome per wave.

   Artifacts already in the reviewed tree, onara's `docs/evidence/<slug>/f1/`, need no exemption. They are only verified. A changed file that existed at `reviewed_sha` is never admitted, so a QA row that names a source file still blocks. That closes the threat the line-393 comment names.

3. **Digest is mandatory, not optional.** An optional digest would leave records without one durable but unbound. A later edit to a tracked QA file would then go unnoticed, which is exactly the class `trailer_sha256` closes.

4. **Guidance: wave QA goes to `.omp/team-config/evidence/gate/<plan basename>/wave-<n>/`.** That path is addable but unstaged, so `GC snapshot` (`status --untracked-files=no`) is unaffected. Phase 5 stages the rows' files together with the record. Other evidence paths stay ignored scratch space, including reviewer reply copies and failed-wave output. Alternative: copy final artifacts at Phase 5 from the ignored path. Rejected: the copy is an extra step, and the row would name a different file than the one QA wrote.

5. **One shipping unit.** The validator change and the guidance change share one contract, the record field set, and one cutover. Guidance without the validator leaves the rule unenforced, and the validator without guidance blocks every gate that follows the old text. They cannot ship separately.

## Risks / Trade-offs

- [Records in progress at deploy time block until migrated] → None exist on 2026-10-27 in oh-my-pi. onara's `strength-progression-targets` has no record yet, and its tracked `docs/evidence` artifacts need only digests. The migration is mechanical: copy the files, add digests, stage, commit. The exemption makes a re-review unnecessary.
- [Post-review commit adds an executable file below the evidence directory, e.g. `x.test.ts` picked up by `bun test`] → It is still exempt if a QA row names it. Accepted residual: nothing in the shipped code imports from the evidence directory. The file enters the default branch visibly in the gate's evidence commit, and the reviewer of the merge sees it.
- [Artifact above the 1 MiB limit (screenshots, frame logs)] → The existing `MAX_ARTIFACT_BYTES` refusal applies with the `qa.<n>.artifact` field. All 40 surviving cited QA artifacts are below 84 KB. The guidance says to split or compress, never to drop a row.
- [Repository size growth from tracked QA output] → Bounded by 1 MiB per file and by citing only the final wave's rows.

## Migration Plan

1. Land the validator, tests, fixtures and guidance on the branch. Merge after the gate.
2. Deploy: `scripts/deploy-local.sh` for `~/.omp/agent`. Then, per profile or `PI_CODING_AGENT_DIR` root, `env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=<dir> bun scripts/install-team-config.ts`. Restart running sessions that loaded the old skill text.
3. Rollback: revert the merge commit and redeploy. Records written under the new rule carry an extra `artifact_sha256` field, which the old validator ignores.
