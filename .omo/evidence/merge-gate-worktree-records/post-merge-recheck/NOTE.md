# Post-merge recheck of merge-gate-worktree-records

Main at check time: `84a5a75f76d59f6172b945265bd17706f98fb3ee` (merge of `fix/merge-gate-worktree-records`).

## Why this exists

During cleanup before the merge, untracked evidence was deleted from the task worktree. That included rejected and passing fix-delta verdicts and patches (`.omo/gate-deltas/`), the convergence ledger, the first failing audit trailers (wave 1 and wave 3), and the wave-2/3/4 QA outputs. The gate record and its passing trailer (`.omo/evidence/merge-gate-worktree-records/wave-4/f2-audit-pass.md`) were committed before the cleanup, so `validate-gate-record.mjs` still validates the record. Four of its `qa[].artifact` paths, however, point to files that no longer exist. This directory re-runs that QA on `main`, with the deployed `omp` and the installed live team config, so durable evidence of the same claims exists.

## Results

- `team-config.txt`: `bun run test:team-config`: 317 pass, 0 fail.
- `bundled.txt`: bundled-agent-parsing and acp-agent tests: 192 pass, 0 fail.
- `check-ts.txt`: `bun run check:ts`: exit 0.
- `summary.json` and `hook-*.jsonl`: real `omp -p` stop hook in scratch repositories with the real installed validator:
  - `unmerged`: the record exists only in a linked worktree; the hook runs the validator with that worktree as `--repo` and the opaque `openspec/changes/recheck` plan path.
  - `merged`: record and reviewed code are merged `--no-ff` into local `main` and `origin/HEAD` is set; there is no `Merge gate:` continuation, so the record settled without validation.
  - `codeonly`: the reviewed code is merged, but the record exists only in the feature worktree; the record is not settled, and the validator runs in the worktree and rejects it.
  - `competing`: same record path, different SHA, claimed SHA absent; the claim is refused as a missing binding and no record is substituted.
- `audit-sonnet.md`: independent Claude-family implementation-audit of the merged team-config diff. The implementation and both earlier gate audits ran on GPT models.

## Known non-blocking note

Two reviewers independently noted the same thing. `git worktree list --porcelain` is parsed by newline, so a worktree path that contains a newline cannot be reconstructed. That requires an unusual local path layout, and the effect is reversible and stays in the user's own environment. This is below the blocking threshold, so it is noted here and not fixed.
