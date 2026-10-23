# P4b: Merge gate on OpenSpec change folders (v2, on Risk tier)

Roadmap row P4b in `.omo/plans/harness-integration.md`. Builds on P4a (merged `c37104fa6a`) and on
`feat/review-risk-tier` (merged `da68f59673`).

## Decisions

Tim, 2026-10-22:
- Plan-review hash binding to the change folder moves to P3a (core).
- Evidence policy shipped separately (`919b21f9d0`).
- `opsx-apply` Verify rule (`feat/opsx-apply-verify`) not merged; outside this plan.
- Accepted residual risks: directory swap-and-restore during the snapshot, bundle rewrite between snapshot and the
  reviewer's read (see Merge gate).

Tim, 2026-10-23, after `feat/review-risk-tier` merged (it adds `Risk tier: product | internal-tooling`, the
one-auditor rule and the two-fix-round cap to file plans):
- A folder plan uses the same `Risk tier` and the same rules as a file plan; P4b's `Review tier: standard | full`
  goes away, including "full means both reviewers also for class none".
- No smoke requirement for folder plans: their QA rows follow the file-plan rules. Rows 5 and 7-9 of v1 and their
  code go away.
- `GC snapshot` writes the folder's bundle as the wave's read-only plan copy; `--freeze-plan` goes away.

Orchestrator decisions (2026-10-23, stated to Tim):
- Implementation on a new branch `feat/openspec-folder-gate-v2` from `main`, porting the reusable parts of
  `feat/openspec-folder-gate` (v1, head `49a899de5c`); v1 is deleted after v2 merges. A rebase would carry about half
  of v1's commits only to remove them again in four conflicting files.
- `gate.md` drops the "none requires a parenthesised reason" rule: `readRiskTier` (`plan-contract.mjs:67-87`)
  rejects anything but a bare `none` for `internal-tooling`, so the reason moves to a new
  `- **Author's risk assessment**:` bullet, as in file plans.

## Goal

For an OpenSpec change folder, `validate-gate-record.mjs` and `gate-convergence.mjs` treat the folder as the plan:
one snapshot feeds the OpenSpec checks, the criteria and a bundle whose sha256 is `plan_sha256`; `gate.md` is the
merge-gate section, so `Risk tier`, `Mandatory class`, `Whole-diff review` and the abort fields drive the gate exactly
as they do for a file plan.

## Facts (verified 2026-10-23 on `main` 13b1616345)

- `plan-contract.mjs` exports `scanMarkdown`, `planContent`, `mergeGateSection`, `readRiskTier`; `TIER_LINE` and
  `CLASS_LINE` accept bold labels (`- **Risk tier**: x`) (`plan-contract.mjs:61-62`); a missing tier is `product`;
  `internal-tooling` needs exactly one `Mandatory class` whose whole value is `none` (67-87).
- The validator reads `riskTier(section)` (527, 624, 894), refuses `internal-tooling` with a class other than `none`
  (688-689) or any reviewer set other than `implementation-audit` (715-716), and requires both invocations only when
  `mandatory_class` is not `none` (710-714).
- `gate-convergence.mjs` `main()` reads `--plan` with `readFileSync`, hashes it (`planSha256`), parses the Risk tier
  from it and keys the ledger by the repo-relative path (641-655). `snapshot` writes `planBytes` as a write-once,
  read-only `<lane>-<key hash>-wave-<n>.plan.md` and records `plan_sha256` (335-372); `wave` refuses a snapshot whose
  plan copy or digest differs from the current plan (487-497). `GC exempt` records a no-review exemption for a commit
  that changes no behaviour (457-467).
- `validate-openspec-change.mjs` validates `gate.md` with fields `Mandatory class`, `Review tier`, `Whole-diff review`
  and the abort fields; `none` needs a parenthesised reason; `Review tier` must be `standard|full` and `full` for a
  mandatory class (6-20, 127-163). The template and `schema.yaml:215` say the same.
- The SHA-binding exemption is the set of paths pinned by `verifyAndPinArtifact` (`pin()`); file plans pin the plan
  file with `requireTracked: false`.
- v1 code worth porting (`feat/openspec-folder-gate`): `folder-plan.mjs` (`snapshotFolder` with
  `O_RDONLY|O_NOFOLLOW|O_NONBLOCK` + `fstat`, `buildBundle`, `bundleDigest`, 1 MiB cap), `validateOpenSpecFiles` export,
  folder branch of `verifyAndPinArtifact`, criteria from the checker's `markdownFiles` set with the `gate.md` fallback,
  classification equality, convergence folder key, and their tests.

## Scope

In: `team-config/agent/skills/review-work/scripts/{folder-plan.mjs (new),plan-contract.mjs,validate-gate-record.mjs,validate-gate-record.test.mjs,validate-openspec-change.mjs,validate-openspec-change.test.ts,gate-convergence.mjs,gate-convergence.test.mjs}`,
`team-config/agent/skills/review-work/SKILL.md`, `team-config/agent/rules/{plan-merge-gate.md,merge-gate-proof.md}`,
`openspec/schemas/omp-gated/{schema.yaml,templates/gate.md}`, `team-config/README.md` (only if it describes `gate.md`
fields).

Out: core plan mode and plan-review hash (P3a), OpenSpec CLI pin and project installer (P3b), OmO state (P5),
records that already block on `main`, any change to file-plan behaviour.

## Folder-plan contract

- A folder plan is a `--plan` path that is a directory containing `gate.md`; anything else is a file plan with
  today's behaviour, byte for byte, in both the validator and convergence.
- Snapshot (`folder-plan.mjs` `snapshotFolder`): `readdir` with file types; each file opened with
  `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, `fstat` must say regular file, bytes read from that handle, 1 MiB cap per file.
  A symlink, FIFO, other type or `ELOOP` throws naming the entry. Result: map of change-relative path (`/`) to bytes.
- Bundle: manifest lines `<sha256 hex>  <path>` sorted by path as UTF-8 bytes, then each file under a
  `===== <path> =====` line followed by its bytes and one `\n`. `plan_sha256` = sha256 of the bundle bytes.
- Plan bytes: for a folder plan, the "plan bytes" everywhere are the bundle bytes. Convergence `main()` builds them
  from one snapshot, so `planSha256`, `snapshot`'s plan copy and `wave`'s comparison work unchanged; the Risk tier is
  `readRiskTier(gate.md text)` instead of `readRiskTier(mergeGateSection(...))`. The validator rebuilds the bundle from
  one snapshot of the live folder and compares its digest to `record.plan_sha256`.
- Merge-gate section: for a folder plan the section is the `gate.md` text from the snapshot. `riskTier`, the abort
  fields, `mandatory_class` and `whole_diff` read it; `mandatory_class` (first token) and `whole_diff` (`needed` →
  `run: true`; `not needed (<reason>)` → `run: false` with that reason) must equal `gate.md`. No `review_tier` record
  field.
- OpenSpec checks: `validateOpenSpecFiles(snapshot)` (pure, exported; the CLI keeps reading from disk and calls it).
  Any diagnostic blocks with its text, in `--plan-only` and full mode.
- Criteria: every `### Requirement:` in the checker's spec file set (every `.md` under `specs/`) is a criterion, its
  Negative control scenario the negative control. When none exist (`skip_specs: true`, rename-only deltas), `gate.md`
  must carry `- Feature-specific criteria:` that passes `validateCriteria`, with `Invariant`, `Negative control`
  (behavioural) and `Observable` passing the `abortFieldDefect` content grammar without the `none` branch.
  `planText` for the copied-criterion check is the bundle text.
- Pinning: every snapshot file path is pinned (exempt from the SHA binding; any byte change fails `plan_sha256`).
- `gate.md` format (checker, template, schema instruction): fields `Mandatory class` (exactly one class token),
  `Risk tier` (`product` | `internal-tooling`; `internal-tooling` only with class `none`, same rule and messages as
  `readRiskTier`, which the checker imports from `plan-contract.mjs`), `Author's risk assessment` (substantive),
  `Whole-diff review`, `Accepted residual risks`, `Out of scope for blocking`. `Review tier` is an error naming
  `Risk tier`.
- Fallback criteria authoring: `templates/gate.md` ends with an HTML comment holding a filled-shape example of
  `- Feature-specific criteria:` with one nested criterion (`  - Invariant:` and its four fields indented below),
  to be uncommented when the change has no requirements; the `schema.yaml` gate instruction says: when
  `.openspec.yaml` sets `skip_specs: true` or the specs hold no `### Requirement:` (rename-only), add that block with
  concrete values. The OpenSpec checker enforces the same rule as the gate (criteria parsed by the gate validator's
  criteria parser moved into `plan-contract.mjs` and imported by both), so the author sees the failure at
  `validate-openspec-change.mjs`, before the gate.

## TODOs

- [x] 1. Worktree `.worktrees/openspec-gate-v2`, branch `feat/openspec-folder-gate-v2` from `main`. RED tests first,
  committed alone and run (failure summary in the commit body), fixtures built from the shipped templates:
  validator (a) untouched folder record → `passed`; (b) after the snapshot: edit a spec line / add / delete a file →
  blocked on `plan_sha256`; (c) symlink file, symlinked subdirectory, FIFO → blocked naming it; (d) spec without its
  Negative control → blocked with the OpenSpec diagnostic although `plan_sha256` matches; (e) seam on
  `snapshotFolder`'s per-entry hook: file swapped for a symlink after `readdir` → blocked; bytes changed after a read
  → checks, criteria and digest reflect the first read; (f) post-review commit touching only the record → `passed`;
  touching a folder file and a source file → blocked; (g) `mandatory_class` or `whole_diff` (run or reason) differing
  from `gate.md` → blocked; (h) `gate.md` `Risk tier: internal-tooling` with two invocations → blocked, with one →
  `passed`; `product` + `wire-contract-api` with one invocation → blocked; `product` + `none` with one → `passed`;
  (i) criteria shapes: requirement in `specs/cap/other.md` counts; `skip_specs` / rename-only without `gate.md`
  criteria → blocked, with substantive ones → `passed`, with empty / `<placeholder>` / `TBD` values → blocked;
  (j) `--plan-only` on a valid folder → `passed`, unfilled `gate.md` → blocked; (k) trailer criterion copied from a
  spec requirement → blocked; (l) every v1 file-plan test still passes unchanged.
  Convergence: (m) folder `--plan`: `baseline`, `ready`, `snapshot` work; the plan copy's bytes equal the bundle and
  its sha256 equals the validator's `plan_sha256`; ledger keyed by the folder path; the tier comes from `gate.md`
  (`internal-tooling` folder → cap applies); (n) folder edited after `snapshot` → `wave` refuses; (o) directory
  without `gate.md` → fails as unreadable plan.
  OpenSpec checker: (p) `Review tier` → error naming `Risk tier`; `Risk tier: internal-tooling` with
  `wire-contract-api` → error; missing `Author's risk assessment` → error; bare `none` accepted; (q) a
  `skip_specs: true` folder and a rename-only folder authored from the shipped template with the commented example
  uncommented and filled → checker `passed` and validator `--plan-only` `passed`; the same with the example left
  commented → both blocked naming the criteria; with `<placeholder>` values → both blocked.
  Verify: `bun test` on the three test files fails before TODO 2 on the new cases only
- [x] 2. Implement the contract: `folder-plan.mjs`; `validateOpenSpecFiles` export and the new `gate.md` fields in
  `validate-openspec-change.mjs`; folder branch in the validator (no `review_tier`, no smoke code, no
  `--freeze-plan`); convergence folder plan bytes and tier. Verify: `bun run test:team-config`
- [x] 3. Mechanical: every tracked `.omo/evidence/gate/*.json` record validated at the commit that added it, with
  `main`'s validator and with the new one; identical outcome per record. Verify: both outputs in F1 evidence
- [x] 4. Docs: `SKILL.md` (folder plans: Phase 0.6 `--plan <change-dir>`, the `PLAN` copy from `GC snapshot` is the
  bundle reviewers read, `plan_sha256` is the snapshot's; criteria section from spec requirements or the `gate.md`
  fallback); one line each in `plan-merge-gate.md` and `merge-gate-proof.md`; `schema.yaml` gate instruction and
  `templates/gate.md` for the new fields and the fallback criteria block; `team-config/README.md` only where it lists
  `gate.md` fields. Delete every
  `Review tier`, `standard`/`full` tier, `--freeze-plan` and folder-smoke sentence. Verify: `bun run test:team-config`

## Final verification wave
- [ ] F3. Whole-diff review: `integration-review` over <base>...<head> when Merge gate says needed; otherwise tick with its reason
- [ ] F1. Manual QA on the real surface, one evidence path per scenario, on the head after F3's last code commit
- [ ] F2. Merge gate: `review-work`, SHA-bound omo.merge-gate/v2 record validated

F1 scenarios (scripts installed into a scratch agent dir with `PI_CODING_AGENT_DIR=<tmp> bun scripts/install-team-config.ts`,
run from a scratch git project with a real OpenSpec 1.14.3 change):
1. `internal-tooling` folder: `GC baseline`, `GC ready --lane F2`, `GC snapshot --lane F2` print a `PLAN` copy equal
   to the bundle; record with one real `implementation-audit` trailer and that digest → `passed`; edit one spec line →
   `blocked` on `plan_sha256`; commit only the record after `reviewed_sha` → `passed`.
2. `product` + `wire-contract-api` folder: one invocation → blocked; both → `passed`.
3. `--plan-only`: valid folder `passed`; without the Negative control → `blocked`; with `Review tier` → `blocked`.
4. The Mechanical loop.
5. Stop hook: an `omp -p` merge claim naming the folder record is accepted by `merge-gate.ts`.

## Merge gate
- Author's risk assessment: the validator and convergence are the merge gate for every gated change; a parser or
  hashing mistake either blocks honest work (visible) or lets an edited spec, a reclassified change or a missing
  reviewer pass (silent). The `gate.md` format change breaks change folders written with `Review tier` (none are
  tracked in this repo).
- Mandatory class: wire-contract-api
- Risk tier: product
- Why one plan: the folder branch in convergence, the `validateOpenSpecFiles` export and the `gate.md` field change have
  no consumer without folder plans in the validator, and folder plans in the validator cannot run a review-work wave
  without convergence. The independently useful part shipped as P4a.
- Whole-diff review: needed (gate validator, convergence, OpenSpec checker and the new snapshot module are independently testable scripts, plus the review-work workflow that drives them)
- Accepted residual risks: a process with write access to the repo that swaps a directory for a symlink and back while the snapshot is read, or rewrites the read-only plan copy between snapshot and the reviewer's read, can feed reviewers other bytes; both need a deliberate actor already able to edit the code, and the plan-copy case equals today's file-plan exposure; committed symlinks and FIFOs still block (Tim, 2026-10-22). A change misclassified as `none` with `Risk tier: internal-tooling` gets one reviewer; the auditor's `security_delta: yes` is the catch, as for file plans.
- Out of scope for blocking: plan-review hash binding (P3a), OpenSpec CLI pin and project installer (P3b), OmO state removal (P5), records that already block on `main`, the Risk tier rules themselves (merged in `da68f59673`).
- Feature-specific criteria:
  - Invariant: a folder-plan record stays valid only while every file in the change folder is byte-identical to what the reviewers read.
    Positive witness: an unchanged folder validates `passed`, also after a post-review commit that adds only the record.
    Negative control: editing a spec line, adding a file, deleting a file, or replacing a file with a symlink after the snapshot MUST block.
    Observable: validator stdout and the stderr field (`plan_sha256` or the entry path).
    Boundary: installed `validate-gate-record.mjs --plan <change-dir> --record <record>`.
  - Invariant: the OpenSpec checks, the criteria, the reviewers' plan copy and `plan_sha256` come from the same bytes.
    Positive witness: the `GC snapshot` plan copy hashes to the digest the validator computes from the unchanged folder.
    Negative control: a spec without its Negative control MUST block even when `plan_sha256` matches; a folder edited after `GC snapshot` MUST make `GC wave` refuse; an entry swapped for a symlink between listing and open MUST block.
    Observable: stderr naming the OpenSpec diagnostic, `plan_sha256` or the entry; `GC wave` refusal text.
    Boundary: installed validator and `gate-convergence.mjs` with `--plan <change-dir>`.
  - Invariant: a folder plan's review depth and fix-round cap follow `Risk tier` and `Mandatory class` in `gate.md` with the same rules as a file plan.
    Positive witness: `internal-tooling` + `none` with one `implementation-audit` passes; `product` + `wire-contract-api` with both passes; an `internal-tooling` folder's lane stops at the file-plan cap.
    Negative control: `internal-tooling` with two invocations MUST block; `product` + `wire-contract-api` with one MUST block; a record whose `mandatory_class` or `whole_diff` differs from `gate.md` MUST block; `Review tier` in `gate.md` MUST block.
    Observable: stderr naming `reviewers_run`, `mandatory_class`, `whole_diff` or `Risk tier`; convergence cap message.
    Boundary: same CLIs, folder plan.
  - Invariant: every valid change folder yields at least one review criterion from the files the OpenSpec checker reads.
    Positive witness: a requirement in `specs/cap/other.md` is a criterion; a `skip_specs: true` folder with substantive `gate.md` criteria passes.
    Negative control: a `skip_specs: true` or rename-only folder without `gate.md` criteria, or with empty or placeholder values, MUST block.
    Observable: stderr naming the criteria field.
    Boundary: validator, folder plan, `--plan-only` and full mode.
  - Mechanical: file-plan records keep their outcome.
    Invariant: every tracked `.omo/evidence/gate/*.json` record gives the same `passed` or blocked outcome at the commit that added it with the new validator as with `main`'s.
    Observable: validator stdout per record, both validators.
    Boundary: validator CLI against the committed records.
