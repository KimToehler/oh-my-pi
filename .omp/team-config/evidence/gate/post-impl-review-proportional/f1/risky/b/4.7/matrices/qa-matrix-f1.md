# F1 QA matrix: jobq-lifecycle

Head: e784622a632dec126331541a71853b1e19854076 (last code commit 89d8aa1; e784622 adds only review.md).
Channel: library surface. `bun .omp/team-config/evidence/gate/jobq-lifecycle/f1/qa-run.ts <scenario>` imports `src/queue.ts` and `src/worker.ts` and prints every call with its observed result. Synthetic job ids, fresh temp snapshot paths per run.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Spec R1 "Claim a queued job" (happy path) | `qa-run.ts claim-queued`: add a, claim(a,w1) | claim resolves true; a running, owner w1 | true; `{"state":"running","owner":"w1"}` | PASS | f1/claim-queued.txt |
| QA2 | Spec R1 negative control | `qa-run.ts claim-negative`: claim(a,w1) then claim(a,w2) | w2's claim resolves false; owner stays w1 | true then false; owner w1 | PASS | f1/claim-negative.txt |
| QA3 | Spec R2 "Complete a claimed job" | `qa-run.ts complete-claimed`: claim(a,w1), complete(a) | a done, no owner | `{"state":"done"}`, no owner key | PASS | f1/complete-claimed.txt |
| QA4 | Spec R2 negative control | `qa-run.ts complete-negative`: complete("missing") | throws | throws `Error: unknown job missing` | PASS | f1/complete-negative.txt |
| QA5 | Spec R3 "Snapshot written" | `qa-run.ts snapshot-written`: read file before and after claim(a,w1) resolves | no file before; after resolve the file lists a running | `<no file>` before; after: `[{"id":"a","state":"running","owner":"w1"}]` | PASS | f1/snapshot-written.txt |
| QA6 | Spec R3 negative control | `qa-run.ts snapshot-negative`: snapshot dir chmod 0500, claim(a,w1) | claim rejects, does not resolve true | rejects with EACCES; a back to queued, no owner; no file written | PASS | f1/snapshot-negative.txt |
| QA7 | Riskiest edge: concurrent claims | `qa-run.ts concurrent-claims`: `Promise.all` of claim(a,w1), claim(a,w2), claim(b,w3), claim(a,w4) | exactly one claim of a wins; b claimed; snapshot lists both running | `[true,false,true,false]`; a owner w1, b owner w3; snapshot lists both running | PASS | f1/concurrent-claims.txt |
| QA8 | Adjacent regression: restart and `JobQueue.restore` (proposal) | `qa-run.ts restart-before <dir>` (claim a/w1, claim b/w2, complete b), process exits, then `qa-run.ts restart-after <dir>` in a new process | restore rebuilds the queue from the snapshot the previous process left | restored a running/w1 and b running/w2, equal to the snapshot; claim(a,w3) after restart resolves false. FLAGGED for review (no stated criterion covers it): complete(b) before exit is not in the snapshot, so a finished job comes back running; a job running at the crash stays owned by a dead worker and cannot be claimed again | PASS (flagged) | f1/restart.txt |
| QA9 | Adjacent: fail then `requeue` (proposal) | `qa-run.ts fail-requeue`: claim(a,w1), fail(a), requeue(q,a), claim(a,w2) | fail marks failed and counts the attempt; requeue makes a claimable again | failed with attempts 1; queued after requeue; claim(a,w2) true | PASS | f1/fail-requeue.txt |

Unexercised: multi-process access to one snapshot (design Non-Goal); a crash during a snapshot write (would need to kill the process mid-`writeFile`).
