# Bind merge-gate claims to records across worktrees

## Context

`merge-gate.ts` resolves `ctx.cwd` with `git rev-parse --show-toplevel`, then selects the newest open `omo.merge-gate/v2` record under that checkout. The enforced worktree workflow puts implementation, plan, trailers, and record in a linked worktree while the omp session keeps the main checkout as `ctx.cwd`. A valid record is therefore invisible at the point where the assistant asks for merge approval.

After a local merge, records also remain “open” until `origin/HEAD` advances. In this repository local `main` is routinely ahead of `origin/main`; the extension then revalidates a record against the merged mainline HEAD and rejects unrelated mainline commits as post-review code. The record has already served its pre-merge gate at that point.

The Gate proof already supplies the binding data the extension needs:
- a literal full `reviewed_sha`;
- a `record <path>` line;
- the validator result and HEAD at which it ran.

The extension will use that explicit binding instead of guessing from record mtime. The record’s `plan` value remains an opaque repo-relative path and is passed unchanged to `validate-gate-record.mjs --plan`; no `.omo/plans` location or file-only semantics are added. A parallel OpenSpec integration may later make `--plan` accept a change folder and owns directory content/digest semantics.

## Approach

### 1. RED tests

In `team-config/tests/merge-gate.test.ts`, add hook-level cases that fail against current behavior:

1. A Gate proof naming a `reviewed_sha` whose matching record exists only in a linked worktree invokes the validator with that worktree as `--repo`.
2. Two linked worktrees hold valid records, but the claim names only one `reviewed_sha`; the other record MUST NOT satisfy the claim.
3. A claim with no full `reviewed_sha` is refused with a Gate-proof instruction instead of selecting a record by mtime.
4. A matching tracked record whose `reviewed_sha` is already an ancestor of the local default branch is accepted as locally merged without revalidating against the merged mainline HEAD.
5. A claimed `reviewed_sha` with no matching record in the repository or its worktrees is refused.

Use real temporary Git repositories/worktrees for worktree discovery and ancestry. Fake only the validator process result at the `pi.exec` boundary. Permanent tests assert the stop decision and validator invocation, not prose wording beyond stable field/path identifiers.

### 2. Exact claim binding

In `team-config/agent/extensions/merge-gate.ts`:

- Parse the full 40-hex value from the Gate proof’s `reviewed_sha` line.
- Require exactly one distinct `reviewed_sha` for a merge/completion claim. Missing or conflicting values block and request a fresh Gate proof.
- Enumerate the session repository and linked worktrees with `git worktree list --porcelain`.
- Search the existing record directories in each checkout for records whose `reviewed_sha` equals the claim.
- Require at least one matching `omo.merge-gate/v2` record. Never substitute a newer record with another SHA.
- For an unmerged match, run the validator with that checkout as `--repo`, its relative record path, and the record’s opaque `plan` value. At least one matching checkout must validate.
- Preserve plan proposal validation unchanged.

### 3. Local-merge settlement

Resolve the pushed default branch with `refs/remotes/origin/HEAD`; derive its local branch counterpart when present. A matching record is settled when its `reviewed_sha` is an ancestor of either the pushed default branch or the local default branch.

A settled record backs only an explicitly SHA-bound Gate proof. It is never eligible through an implicit “newest record” fallback. This mirrors the existing pushed-default behavior and prevents an already-merged record from being revalidated against unrelated mainline commits.

The extension remains a cooperative workflow guard, not a Git hook: arbitrary shell merges can bypass it today and remain outside this fix.

### 4. Contract prose

Update:
- `team-config/agent/extensions/merge-gate.ts` header: exact SHA binding, worktree lookup, local/pushed settlement.
- `team-config/agent/skills/review-work/SKILL.md` Enforcement: Gate proof SHA selects the record; no mtime guessing; `record.plan` stays opaque.
- `team-config/agent/rules/merge-gate-proof.md`: the full literal `reviewed_sha` is the binding key and MUST match the record.

Do not add `.omo/plans` assumptions. Do not define OpenSpec folder hashing or which file inside a change folder owns `## Merge gate`; the OpenSpec integration owns that contract.

## Verification

1. RED evidence: focused new tests fail against current `merge-gate.ts` for worktree lookup, exact SHA binding, missing-SHA refusal, and local-merge settlement.
2. Green: `bun test team-config/tests/merge-gate.test.ts` and `bun run test:team-config`.
3. Type/lint: `bun check`; TypeScript no-excuse checker over changed `.ts` files.
4. Real surface: invoke the actual extension handler with real Git against a scratch main checkout plus linked worktree. Positive: matching worktree record reaches the validator with the worktree repo. Negative: another worktree’s valid record cannot satisfy the claimed SHA. Post-merge: the matching tracked record is settled by local default ancestry and does not revalidate at merged HEAD.
5. Install only into an isolated `PI_CODING_AGENT_DIR` for smoke QA. Live `~/.omp/agent` and the deployed binary remain unchanged until merge plus explicit deploy approval.

## Final verification wave
- [ ] F3. Whole-diff review: not needed (one gate-selection mechanism; tests and prose express the same contract)
- [ ] F1. Manual QA on the real hook surface using a scratch repository with a linked worktree
- [ ] F2. Merge gate: `review-work`, one implementation-audit reviewer, SHA-bound omo.merge-gate/v2 record validated

## Merge gate
- Author's risk assessment: wrong worktree or SHA selection could falsely validate unrelated work; an overly strict settlement rule could block every local merge. The extension is team-wide internal tooling, reversible by reverting and reinstalling.
- Mandatory class: none
- Whole-diff review: not needed (the change is confined to merge-gate record selection plus its contract tests and prose)
- Accepted residual risks: a deliberately fabricated Gate proof can name another valid record; arbitrary shell merges already bypass the extension, so this cooperative guard does not become a security boundary
- Out of scope for blocking: OpenSpec change-folder content and digest semantics; Risk tier and fix-round caps from Plan B; fast-forward/direct-default-branch workflow redesign
- Feature-specific criteria:
  - Invariant: a Gate proof is validated only against an omo.merge-gate/v2 record with the same full reviewed_sha
    Positive witness: a matching record in a linked worktree invokes the validator with that worktree as --repo and exits zero
    Negative control: a different worktree has a valid newer record but no record matches the claimed reviewed_sha; the stop is refused and the validator is not allowed to substitute the newer record
    Observable: session_stop decision and validator argv
    Boundary: merge-gate extension record selection across git worktrees
  - Invariant: a record merged into the local default branch is settled without revalidation against unrelated merged-main HEAD changes
    Positive witness: reviewed_sha is an ancestor of local main but not origin/main; a matching tracked record allows the SHA-bound proof without invoking the validator at main HEAD
    Negative control: reviewed_sha is not an ancestor of either default ref and the matching worktree validator fails; the stop is refused
    Observable: ancestry commands, validator invocation count, and stop decision
    Boundary: merge-gate extension shipped-record classification
  - Invariant: plan location and shape are owned by the validator, not the extension
    Positive witness: the matching record’s plan string is passed unchanged to --plan
    Negative control: no matching record exists; the extension refuses before inventing or rewriting a .omo/plans path
    Observable: validator argv or refusal
    Boundary: merge-gate extension to validate-gate-record.mjs CLI
