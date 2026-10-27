# Proposal

## Why

A merge-gate record proves its F1 manual QA only through `qa[].artifact` paths. The validator checks only that each path is a non-empty string (`validate-gate-record.mjs:594`). The review-work guidance sends QA artifacts to git-ignored `.omp/team-config/evidence/<plan>/wave-<n>/` (SKILL.md, Fix waves step 2). The evidence therefore disappears with the worktree that produced it.

The 24 gate records in `.omp/team-config/evidence/gate/` cite 155 distinct QA paths. In the main checkout, 28 of them are tracked, 12 exist untracked, and 115 no longer exist. One example is `acp-load-relocated-session`: its 5 F1 artifacts survive only in the session transcript, including a first F1 run that failed. Without the artifacts, nobody can check a recorded F1 PASS afterwards, and a retrospective baseline cannot tell what F1 actually observed.

## What Changes

- **BREAKING** (gate records): every `qa[]` row SHALL name a tracked file inside the repository and SHALL carry `artifact_sha256`, the SHA-256 of that file's bytes. A row whose path is ignored, untracked, missing, a directory, or outside the repository blocks the record. So does a row without a digest or with a mismatched one.
- The validator binds QA artifacts the way it already binds the whole-diff report. A QA artifact may sit in the reviewed tree; onara commits `docs/evidence/<slug>/f1/` before its snapshot. Or a commit after `reviewed_sha` may add it without voiding the record, but only when the file is absent from the `reviewed_sha` tree, lies below the record's evidence directory (the record path without `.json`), and matches its digest. A QA row that names a file that existed at `reviewed_sha` and changed afterwards is still a source change and blocks.
- QA artifacts join the "validated bytes are the committed bytes" check: working tree, index and `HEAD` must agree, as for trailers and the report.
- The review-work guidance moves wave QA output to `wave-<n>/` below the record's evidence directory, by default `.omp/team-config/evidence/gate/<plan basename>/`. That path is addable but stays unstaged until Phase 5, so `GC snapshot` keeps working, and it is staged by explicit path only. Phase 5 stages the cited artifacts together with the record, and the record template carries `artifact_sha256`. Because cited artifacts become repository history, the existing "safe to share" rule extends to them: synthetic data, inspect and redact before the digest, and a redacted excerpt in place of an unshareable capture.
- Records already merged into the default branch are settled and are not revalidated. A record still being written adds digests. Artifacts that are not yet tracked are copied into the record's evidence directory; no re-review is needed, because the added files fall under the exemption.

## Capabilities

### New Capabilities

### Modified Capabilities
- `merge-gate-record`: adds the QA artifact binding requirement, and extends "Validated bytes are the committed bytes" to QA artifacts.

## Impact

- `team-config/agent/skills/review-work/scripts/validate-gate-record.mjs` and its tests and fixtures (`fixtures/*.json` that carry `qa` rows).
- Guidance that says where F1 evidence goes: review-work `SKILL.md` (Reuse first, Fix waves step 2, the Phase 5 template, the field rules, the tracked-artifact, exemption and validator-summary paragraphs), the `plan-merge-gate` rule's F1 line, the omp-gated `templates/tasks.md` F1 row with this repository's installed `openspec/schemas/omp-gated/` copy, `team-config/README.md`, the `gate-layout.mjs` comment, and `visual-qa/SKILL.md`.
- Deployed copies: `~/.omp/agent/skills/review-work` after `deploy-local.sh`, plus every profile and `PI_CODING_AGENT_DIR` install, and the running sessions that load them.
- No change to `gate-convergence.mjs`, the ledger, the `.gitignore` block, or the `gate-workspace-layout` ignore policy: `evidence/gate/**` is already addable.
- In-flight gates, checked on 2026-10-27: no unmerged oh-my-pi worktree has a gate ledger or a record. onara's `.worktrees/strength-progression-targets` is mid-gate: F3 recorded, no F1/F2 and no record yet. Its F1 artifacts follow onara's tracked `docs/evidence/<slug>/` convention, so its record only needs `artifact_sha256` per row once this ships.
