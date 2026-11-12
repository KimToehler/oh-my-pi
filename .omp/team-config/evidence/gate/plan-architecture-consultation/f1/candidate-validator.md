# Candidate validator

Fresh ordinary `omp -p` session (`tools/run-rows.sh cv`), HOME=`/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pac-home` (deployed from worktree HEAD `6750c02729415b35470660b900e49d546d871bcf` by `scripts/install-team-config.ts`), no PI_CODING_AGENT_DIR. Fixture `/tmp/pac-f1/cv`: class `concurrency-state`, Depth `risky`, a committed round-1 OKAY `review.md` over the current digest, no `consultation.md`.

## Prompt

```
Print the absolute path that ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs resolves to (realpath), then run `node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed openspec/changes/seat-reservation` once and report its exit code and output verbatim. Change nothing.
```

## Fixture

```
18767a7 review: round 1 OKAY (written before this deploy)
afc7710 openspec: seat-reservation
9c0a09e install omp-gated workflow
d9b962c tickets service
design.md
gate.md
proposal.md
review.md
specs
tasks.md
```

## Tool calls and results (from the session file)

    CALL bash: {"command":"realpath ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs; node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed openspec/changes/seat-reservation; echo \"EXIT=$?\"","i":"Resolving path and running validator"}
    RESULT bash isError=false: /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pac-home/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs
    consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
    EXIT=1
    

Models in the session file: onara/cc/claude-opus-5-5 

## Final reply

The script's real path is:

```
/private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pac-home/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs
```

I ran `node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs --reviewed openspec/changes/seat-reservation` once. It exited with code 1 and printed:

```
consultation.md: required for a risky change; run the consultation step of the review, or record the user's skip
```

The check failed because `openspec/changes/seat-reservation` has no `consultation.md`, which this change needs because it counts as risky. I didn't change anything.

## Observation

`V` resolves under the disposable home (`.../T/pac-home/.omp/agent/skills/review-work/scripts/`), and `--reviewed` on the risky fixture without `consultation.md` exits 1 naming `consultation.md`. PASS.
