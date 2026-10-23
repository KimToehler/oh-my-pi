# F1 QA matrix: review-risk-tier

Head: 8e9b1a1e8afdb8ca54d34912efda50e18168a377. Artifact paths are relative to `.omo/evidence/review-risk-tier/`.

Verification 5 was run four times. Trials from the first three runs are INFRA or superseded and are not evidence:

- `runs-v1-infra/`: the post-run check found the branch and control agent dirs differing beyond the one rule file, because trials wrote runtime state into them.
- `runs-v2-superseded/`: the trial copies were not checked against the templates before launch (F3 fix-delta round 1).
- `runs-v3-confounded/`: branch-above and control-above ran in different scratch repos (F3 wave 2, B1).

The fourth run keeps `$A` and `$C` as untouched templates. Each template has a per-file SHA-256 map frozen at the pre-run inventory (`runs/branch.json`, `runs/control.json`). Every trial copies its template into a fresh trial-owned directory, checks that copy against the frozen map before omp starts, and launches with that copy as `PI_CODING_AGENT_DIR`. All trials and the wave refusal use one scratch repo (tracked: `.gitignore`, `README`; `.omo/` untracked, as in this repo) and one pinned copy. `runs/pinned-snapshot.txt` lists the repo files before the trials; the same command after the trials and the refusal printed the identical list (job output, not saved to a file). The helper hashes equal those of the third run. `runtime-inventory.txt` holds the pre and post checks; every row passes and all identities equal the pre-run values. `/tmp/rrt-*` was removed afterwards and the evidence secret scan is clean.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | RED for step 1 | new validator rows against the unchanged scripts | new blocked/tier rows fail | 12 fail | PASS | red-step1.txt |
| 2 | RED for step 2 | new convergence rows against the unchanged script | new cap/tier/pinned rows fail | fail as listed | PASS | red-step2.txt |
| 3 | Suites green | `bun run test:team-config` on 8e9b1a1e8afd | 0 fail | 444 pass, 0 fail | PASS | green.txt |
| 3a | Cap RED on the real code (Verification 2) | delete the `decide()` cap line, `bun test gate-convergence.test.mjs`, restore from backup | cap tests fail; file restored | 2 fail (fix-round cap, continue refused), 24 pass; restore: `git diff --quiet` exit 0, file hash = HEAD blob | PASS | red-cap.txt, red-cap-restore.txt |
| 3b | Plan-only smoke (Verification 3) | real validator `--plan-only` on the four plan states | blocked/blocked/passed/passed, exit 1/1/0/0 | `auth-secrets-pii` blocked exit 1; `none (auth-secrets-pii)` blocked exit 1; `none` passed exit 0; tier line deleted passed exit 0 | PASS | smoke-plan-only.txt |
| 3c | Convergence smoke (Verification 4) | scratch repo, internal-tooling plan, waves 3/2/1 blockers, decide, retier | waves 1-2 CONTINUE exit 0; wave 3 STOP exit 3; decide continue exit 1 naming the cap; ready exit 1 naming retier; retier recorded; second decide exit 0; grep `1` | exactly as expected | PASS | smoke-convergence.txt |
| 3d | Classifier self-check | synthetic MODEL fixture plus one fixture per INFRA condition | MODEL for the complete fixture; INFRA for loss, missing END, dead proxy, nonzero exit, empty, truncated, drift, copy mismatch, no router CONNECT | as expected; classifier hash equals the one used in the scored run | PASS | classifier-selfcheck.txt |
| 4 | Copy-check control | freeze a scratch template; unchanged copy, then change one rule file after freezing | unchanged `COPY-OK`; mutated `COPY-MISMATCH`, INFRA | `COPY-OK files=436`; `COPY-MISMATCH differs rules/plan-review-process.md`; `INFRA trial agent copy differs from the frozen template map` | PASS | runs/copy-check-control.txt, runs/copy-ok/, runs/copy-mutated/ |
| 5 | Pinned snapshot | `GC baseline`, `GC snapshot --lane F2`, then overwrite the source plan with the below fixture | copy mode 444, copy = snapshot digest = above fixture; source digest changes | `92671c25…` for all three; source `ed2fd9cd…` | PASS | runs/pinned-snapshot.txt |
| 6 | branch-above | deployed omp, branch rules, reviewer given the pinned copy | MODEL REJECT with a PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=yes blockers=5` | PASS | runs/branch-above/ |
| 7 | Wave refusal | `GC wave --lane F2 --snapshot $SNAP --outcome qa=PASS --outcome implementation-audit=PASS` after the source changed | exit 1, `plan bytes differ from the snapshot`, no `gate_wave` | as expected; `gate_wave-count=0` | PASS | runs/pinned-wave-refusal.txt |
| 8 | control-above | same repo and pinned copy as 6, one-file control rule | MODEL, no PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=no blockers=6` | PASS | runs/control-above/ |
| 9 | branch-below | branch rules, reviewer given the mutated source (below fixture) | MODEL, no PROCESS 5 blocker | `COPY-OK files=436`; `MODEL REJECT process5=no blockers=4` | PASS | runs/branch-below/ |
| 10 | Dependency loss mid-review | `--mode json`; the proxy is killed after router traffic follows the task start | INFRA | `COPY-OK`; LOSS 0.2 s after TASK-START; CLI exit 124; `INFRA dependency loss recorded` | PASS | runs/killed-below/ |

## Re-run on head 18867ae3fd0f0ba5e1e5399c22c772b97b5ffd50

Since 8e9b1a1 only `gate-convergence.mjs`, its tests and the two skills' prose changed (rows 3-7 of `## TODOs`); the validator, `plan-contract.mjs` and every rule file are byte-identical, so rows 3b and 4-10 stand. The rows that exercise `gate-convergence.mjs` ran again. Artifacts under `head-18867ae/`.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 11 | Suites green | `bun run test:team-config` on 7af7d75958 (last script change; 18867ae changes only a test and prose) and `gate-convergence.test.mjs` on 18867ae | 0 fail | 449 pass, 0 fail; 31 pass, 0 fail | PASS | wave-2/green.txt, wave-2/gate-convergence-tests.txt |
| 12 | Cap RED on the real code | delete the three-line cap block in `decide()` (`node --check` ok), run the convergence tests, restore | the 2 cap tests fail; file restored | 2 fail, 29 pass; `restore-diff-exit=0` | PASS | head-18867ae/red-cap.txt |
| 13 | Convergence smoke, plus exempt and snapshot rerun | Verification 4 script in a scratch repo, then: a commit after wave 3, `ready`, `exempt` without and with `--reason`, `ready` F2/F3; identical snapshot rerun; snapshot after a plan edit | as Verification 4; NOT READY naming the commit; exempt without reason exit 1; with reason recorded; READY in F2 and F3; identical rerun prints the same snapshot; edited plan refused exit 1 | exactly as expected; snapshot files named `F2-<plan hash>-wave-<n>` | PASS | head-18867ae/smoke-convergence.txt |
| 14 | New-test RED | row 5 and row 7 tests against the prior script | each fails | 1 fail each | PASS | red-f3-b1-wave4.txt, red-exempt.txt |
| 15 | Combined witness on the final head (F2 wave 2 B1) | head 9abb83c9c7: branch team-config installed into a fresh isolated agent dir (installed `gate-convergence.mjs` = HEAD; `plan-review-process.md` sha256 `df271a06…`, identical to rows 6-9); scratch repo, installed script `baseline` + `snapshot`, source overwritten with the below fixture; deployed omp (sha256 `62b88249…`, unchanged) runs plan-reviewer on the pinned copy; then installed `wave` on that snapshot | copy 444 = `plan_sha256` = above fixture; MODEL REJECT with a PROCESS 5 blocker; wave exit 1 `plan bytes differ from the snapshot`, no `gate_wave` | copy `92671c25…` for all three, source `ed2fd9cd…`; snapshot named `F2-<plan hash>-wave-1`; CLI exit 0, `MODEL REJECT process5=yes blockers=4`; wave exit 1 as expected, `gate_wave-count=0`; rules, agents, packages and fixtures unchanged since 8e9b1a1, so rows 8-10 (control, below, dependency loss) stand; secret scan clean, `/tmp/rrt5-*` removed | PASS | head-18867ae/v5/ |

## Re-run on head 14de786154a767d4d26d72aaf8c500f9d65031e7

Since 9abb83c9c7 only `gate-convergence.mjs` `decide`/`retier`, its tests, review-work Fix waves step 1 prose and the plan changed (row 8). Row 15's installed witness exercises snapshot, reviewer and wave, none of which changed; rows 3b-15 stand.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 16 | Suites green | `bun run test:team-config` on 280f0c8ed4 (last script change); `gate-convergence.test.mjs` on 14de786154 (tests only) | 0 fail | 451 pass, 0 fail; 33 pass, 0 fail | PASS | wave-2/green.txt, wave-2/gate-convergence-tests.txt |
| 17 | Row 8 RED | stale-freeze test against 9abb83c9c7; retier-refusal test against d6aa9ee156; stale-freeze test against HEAD with only the freeze guard removed | each fails | 1 fail each; guard-only run fails on the freeze exit status (`actual: 0`), file restored | PASS | red-f2w2-b2.txt, red-f2w2-b2-round2.txt, red-f2w2-b2-guard-only.txt |
