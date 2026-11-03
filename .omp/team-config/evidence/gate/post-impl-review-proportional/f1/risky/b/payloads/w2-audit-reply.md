FAIL

One path to the state-machine class is still open on the reviewed tree.

Blocker B1: high - src/worker.ts:6 - violated contract: a job moves queued -> running -> done|failed. `requeue` writes `state: "queued"` with `Object.assign` and never looks at the current state, so a `done` job is put back on the queue and its work runs again. A search for `job.state =` does not find this site because it assigns through `Object.assign`. Fix direction: route requeue through the same transition check as the other state changes and allow it only from `failed`.
class: illegal-state-transition (state assigned without checking the current state)
sites: src/worker.ts:6. Search run: grep -rn "state:" src/ and grep -rn "Object.assign" src/; single remaining instance on this tree.

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: FAIL
blockers: B1
adversarial_criteria:
- invariant: A done job never returns to the queue
  positive_witness: requeue of a done job leaves it done
  negative_control: requeue of a done job reports queued
  observable: state of the job after requeue(queue, id) on a completed job
  boundary: worker.requeue public API
END-REVIEW-TRAILER
