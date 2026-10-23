# F-D1 (R81 replay, DOMAIN 6) analysis

Fixture: `/tmp/evo2-qa/fixtures/F-D1.md` (173 lines) = fix entry + full `git show 0720de8d94 -- store.ts server.ts`; contains the removed line `DELETE FROM trials WHERE job_name = ?`.
Reviewer cwd: detached worktree at `0720de8d94`. One isolated session dir per attempt.

| run | rule state | DOMAIN 6 label | R81 substance (old trials kept on name reuse) | claims "diff omitted" |
|---|---|---|---|---|
| a0 | no domain rule | 0 | 1 | 0 |
| a1-a3 | domain rule v1 | 1,1,1 | 0,0,0 | 3,2,2 |
| a4-a6 | domain rule v2 (delta-first paragraph + DOMAIN 6 question) | 1,1,1 | 0*,1,0 | 1,0,1 |

*a4's regex hit is "Claim placeholder is replaced by launched row" (DOMAIN 5), not R81 substance; a5 states it: "Removed trial purge leaves prior trial/reward rows attached when normal launch reuses completed job name."

Tool check: the reviewer's read of the fixture returned all 173 lines (`details.totalLines=173`, `truncation=null`, no elision markers). The "diff body omitted" claim is a reviewer misreading, not tool truncation.

Result: DOMAIN 6 fires 6/6 with the rule; the concrete R81 defect is named in 1/3 runs with rule v2 (a5) and 1/1 without the rule (a0). Not 2-of-3.
