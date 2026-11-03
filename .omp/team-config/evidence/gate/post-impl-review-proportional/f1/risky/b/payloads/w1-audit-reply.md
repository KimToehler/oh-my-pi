FAIL

Two blocking defects, in the restore path and in the completion paths; the manual QA matrix covers legal transitions and a restore of a queued job only.

Blocker B1: high - src/queue.ts:21 - violated contract: the change exists so jobs survive a restart (`JobQueue.restore` rebuilds the queue from the snapshot). `restore` copies every job back exactly as stored, including jobs stored as `running` with their dead worker as owner. Nothing re-queues them and `claim` only accepts `queued` jobs, so every job that was claimed when the process died stays `running` forever and never completes. Fix direction: in `restore`, put jobs that were `running` back to `queued` (clearing the owner) so another worker can claim them, and cover it with a test that claims, restores and claims again.
class: orphaned-running-after-restore (restored state keeps jobs owned by a dead worker)
sites: src/queue.ts:21. Search run: grep -rn "loadSnapshot\|restore" src/ test/; single instance: `restore` is the only path that rebuilds jobs from a snapshot.

Blocker B2: high - src/queue.ts:60, src/queue.ts:66 - violated contract: a job moves queued -> running -> done|failed. `complete` and `fail` assign `job.state` without looking at the current state, so `complete` on a queued job marks it done without a worker, and `fail` on a done job turns finished work into a failure. Fix direction: allow `complete` and `fail` only from `running`, and throw otherwise.
class: illegal-state-transition (state assigned without checking the current state)
sites: src/queue.ts:60, src/queue.ts:66. Search run: grep -n "job.state =" src/queue.ts. Confirm the class is closed at every site.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: FAIL
blockers: B1,B2
adversarial_criteria:
- invariant: A job claimed before a restart can be claimed again after restore
  positive_witness: restore of a snapshot holding a running job yields a claimable job
  negative_control: restore of a snapshot holding a running job yields a job still running under a dead owner
  observable: state and owner of the job returned by JobQueue.restore
  boundary: JobQueue.restore public API
END-REVIEW-TRAILER
