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

4. **Guidance: wave QA goes to `wave-<n>/` below the record's evidence directory.** The guidance derives that directory from the record path the gate actually uses: `.omp/team-config/evidence/gate/<plan basename>/` by default, and for example `docs/evidence/<slug>/merge-gate/` for a record at `docs/evidence/<slug>/merge-gate.json`. It never hard-codes the default, so a project with its own record convention keeps the post-review exemption. Tracked evidence already in the reviewed tree stays citable at any path. The path is addable but unstaged, so `GC snapshot` (`status --untracked-files=no`) is unaffected, and Phase 5 stages the rows' files together with the record. Because the path is no longer ignored, the guidance requires explicit-path staging: a `git add -A` in a fix commit would sweep wave QA into that commit and force a delta review. Every wave writes there, failed waves included; only the files the record's rows cite are ever staged, and uncited wave output stays untracked. Reviewer reply copies stay on the ignored `evidence/<plan basename>/` path. Alternative: copy final artifacts at Phase 5 from the ignored path. Rejected: the copy is an extra step, and the row would name a different file than the one QA wrote.

   The cutover covers every text that tells an author or orchestrator where F1 evidence goes, because a stale one now fails only at Phase 5, after the reviewers ran. That text is: the `plan-merge-gate` rule's F1 line, the omp-gated `templates/tasks.md` F1 row and this repository's installed copy, review-work's "Reuse first", the tracked-artifact and validator-summary paragraphs, the README layout, the `gate-layout.mjs` comment, and both `visual-qa` paths.

5. **One shipping unit.** The validator change and the guidance change share one contract, the record field set, and one cutover. Guidance without the validator leaves the rule unenforced, and the validator without guidance blocks every gate that follows the old text. They cannot ship separately.

6. **Published evidence is shareable by procedure, not by validator.** A cited QA artifact now becomes repository history, in a public repository for oh-my-pi. Before, only trailers and reports did. The existing review-work rule "Review evidence must be safe to share" therefore extends to every cited file, images and raw terminal streams included: QA runs on synthetic data; each cited file is inspected and redacted before its digest is taken; a capture that cannot be made shareable stays local, and the row cites a redacted excerpt. The visual-qa skill repeats the rule where it captures real screenshots and terminal streams. Alternative: a validator secret scan. Rejected: it cannot recognise PII in images or prove absence, and a pattern scan would give false assurance on exactly the artifacts at risk. The validator's boundary stays the one it has for trailers, which is that it reads bytes and cannot judge their content.

   Inventory. Sources of protected data in QA output: terminal streams and their plain text (`terminal-ansi.txt`, `terminal.txt`), screenshots (`terminal.png`, browser captures), command metadata (`metadata.json`: command, inputs, environment), HTTP transcripts (headers, cookies, bodies) and logs. Holders: the wave directories below the record's evidence directory, untracked until Phase 5. Sinks: the one new sink is the commit that stages the files a `qa[]` row cites, in Phase 5 or, for this change's own F1, before the F2 snapshot. Records and trailers stay as they are: they carry only paths, digests and review text, and are already published. Reviewer briefs and handoffs stay covered by the existing rule. The publication boundary is therefore one step, the inspection and redaction of every cited file before its digest is taken, and the guidance names it in review-work's "safe to share" paragraph and in visual-qa's storage bullet. Uncited wave output never reaches a sink.

## Risks / Trade-offs

- [Records in progress at deploy time block until migrated] → None exist on 2026-10-27 in oh-my-pi. onara's `strength-progression-targets` has no record yet, and its tracked `docs/evidence` artifacts need only digests. The migration is mechanical: copy the files, add digests, stage, commit. The exemption makes a re-review unnecessary.
- [Post-review commit adds an executable file below the evidence directory, e.g. `x.test.ts` picked up by `bun test`] → It is still exempt if a QA row names it. Accepted residual: nothing in the shipped code imports from the evidence directory. The file enters the default branch visibly in the gate's evidence commit, and the reviewer of the merge sees it.
- [A record at an unusual path, e.g. `src/foo.json`, makes `src/foo/` its evidence directory] → It takes a deliberately odd `--record` path, and the shipped guidance names only `evidence/gate/`. A record path without `.json` has no evidence directory, because the path is a file and nothing lies below it, so no QA artifact is exempt for it.
- [Artifact above the 1 MiB limit (screenshots, frame logs)] → The existing `MAX_ARTIFACT_BYTES` refusal applies with the `qa.<n>.artifact` field. All 40 surviving cited QA artifacts are below 84 KB. The guidance says to split or compress, never to drop a row.
- [Repository size growth from tracked QA output] → Bounded by 1 MiB per file and by citing only the final wave's rows.
- [This change's own F2 runs on the old installed validator] → Both Phase 5 (`review-work/SKILL.md`) and the `merge-gate.ts` hook run the deployed validator, which rejects QA files committed after `reviewed_sha`, and deploying before the merge would ship an unmerged validator. So this change's F1 evidence is committed before the F2 snapshot, inside the reviewed tree, the way onara commits `docs/evidence/<slug>/f1/` today and omp-native-locations ran its own F2 on the deployed validator (its D9). The old validator accepts such rows: it checks only `passed` and a non-empty `artifact` and ignores unknown fields such as `artifact_sha256` (`validate-gate-record.mjs:587-597`). The new validator accepts them as tracked, in the reviewed tree and matching their digests.

## Migration Plan

1. Land the validator, tests, fixtures and guidance on the branch. Merge after the gate.
2. Deploy: `scripts/deploy-local.sh` for `~/.omp/agent`. Then, per profile or `PI_CODING_AGENT_DIR` root, `env -u PI_PROFILE -u OMP_PROFILE PI_CODING_AGENT_DIR=<dir> bun scripts/install-team-config.ts`. Restart running sessions that loaded the old skill text. Projects with an installed `openspec/schemas/omp-gated/` copy, onara today, re-run `install-openspec-workflow.mjs` so their task template names the new F1 location.
3. Rollback: revert the merge commit and redeploy. Merged records stay settled. The old validator ignores the extra `artifact_sha256` field, so an open record whose QA lies in the reviewed tree still validates. An open record that relies on the new post-review exemption is refused by the old validator on `reviewed_sha`: commit its QA files, take a new snapshot and re-run review-work from Phase 2, because that commit changes the reviewed tree.
