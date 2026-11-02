import json, os
D = os.getcwd()
F = os.path.expandvars("$TMPDIR/pirp-fix/f1b-b")

def trailer(inv, sections, verdict, blockers, crit):
    b = ",".join(blockers) if blockers else "none"
    return f"""REVIEW-TRAILER-v1
invocation: {inv}
sections_covered: {sections}
model_id: onara/cx/gpt-6.1-sol
security_delta: no
verdict: {verdict}
blockers: {b}
adversarial_criteria:
- invariant: {crit[0]}
  positive_witness: {crit[1]}
  negative_control: {crit[2]}
  observable: {crit[3]}
  boundary: {crit[4]}
END-REVIEW-TRAILER
"""

CLAIM = """Blocker B{n}: high - src/queue.ts:21 - violated contract: the change exists so jobs survive a restart (`JobQueue.restore` rebuilds the queue from the snapshot). `restore` copies every job back exactly as stored, including jobs stored as `running` with their dead worker as owner. Nothing re-queues them and `claim` only accepts `queued` jobs, so every job that was claimed when the process died stays `running` forever and never completes. Fix direction: in `restore`, put jobs that were `running` back to `queued` (clearing the owner) so another worker can claim them, and cover it with a test that claims, restores and claims again.
class: orphaned-running-after-restore (restored state keeps jobs owned by a dead worker)
sites: src/queue.ts:21. Search run: grep -rn "loadSnapshot\\|restore" src/ test/; single instance: `restore` is the only path that rebuilds jobs from a snapshot."""
TRANS1 = """Blocker B{n}: high - src/queue.ts:60, src/queue.ts:66 - violated contract: a job moves queued -> running -> done|failed. `complete` and `fail` assign `job.state` without looking at the current state, so `complete` on a queued job marks it done without a worker, and `fail` on a done job turns finished work into a failure. Fix direction: allow `complete` and `fail` only from `running`, and throw otherwise.
class: illegal-state-transition (state assigned without checking the current state)
sites: src/queue.ts:60, src/queue.ts:66. Search run: grep -n "job.state =" src/queue.ts. Confirm the class is closed at every site."""
TRANS2 = """Blocker B{n}: high - src/worker.ts:6 - violated contract: a job moves queued -> running -> done|failed. `requeue` writes `state: "queued"` with `Object.assign` and never looks at the current state, so a `done` job is put back on the queue and its work runs again. A search for `job.state =` does not find this site because it assigns through `Object.assign`. Fix direction: route requeue through the same transition check as the other state changes and allow it only from `failed`.
class: illegal-state-transition (state assigned without checking the current state)
sites: src/worker.ts:6. Search run: grep -rn "state:" src/ and grep -rn "Object.assign" src/; single remaining instance on this tree."""
SNAP = """Blocker B{n}: high - src/store.ts:6 - violated contract: "Each claim persists a snapshot" is the only record of job state after a restart. `saveSnapshot` calls `writeFile(path, JSON.stringify(data))`, which truncates the file and then writes it; a process that dies, or a reader that opens the file, in between sees an empty or partial file and `loadSnapshot` throws on it, losing every job. Fix direction: write the snapshot to a temporary file in the same directory and rename it over the target. The file is generated from the storage contract, so the durable fix belongs in the contract repository.
class: non-atomic-snapshot-write (state persisted by truncate-then-write)
sites: src/store.ts:6. Search run: grep -rn "writeFile" src/; single instance: `saveSnapshot` is the only writer."""

def reply(inv, verdict, intro, blocks, crit, sections):
    nums = list(range(1, len(blocks)+1))
    body = "\n\n".join(blk.format(n=n) for blk, n in zip(blocks, nums))
    ids = [f"B{n}" for n in nums]
    head = f"{verdict}\n\n{intro}\n\n" + (body + "\n\n" if blocks else "")
    return head + trailer(inv, sections, verdict, ids, crit)

AUD="implementation-audit"; STR="strategic-risk-review"
C_AUD1 = ("A job claimed before a restart can be claimed again after restore", "restore of a snapshot holding a running job yields a claimable job", "restore of a snapshot holding a running job yields a job still running under a dead owner", "state and owner of the job returned by JobQueue.restore", "JobQueue.restore public API")
C_AUD2 = ("A done job never returns to the queue", "requeue of a done job leaves it done", "requeue of a done job reports queued", "state of the job after requeue(queue, id) on a completed job", "worker.requeue public API")
C_AUD3 = ("complete and fail only act on a running job", "complete on a running job yields done", "complete on a queued job yields done with no owner", "job.state after complete on a queued job", "JobQueue.complete public API")
C_STR1 = ("The snapshot file is always parseable JSON, whenever it is read", "a reader opening the file during a claim sees either the old or the new list", "a reader opening the file mid-write gets an empty or truncated body", "result of loadSnapshot while a large saveSnapshot is in flight", "src/store.ts file contents on disk")

W = {}
W[1] = {AUD: ("FAIL", "Two blocking defects, in the restore path and in the completion paths; the manual QA matrix covers legal transitions and a restore of a queued job only.", [CLAIM, TRANS1], C_AUD1, "1,2,3,4,5"),
        STR: ("FAIL", "The most damaging production failure is losing the job list after a crash: the only persisted record is written non-atomically.", [SNAP], C_STR1, "1,2,3,4")}
W[2] = {AUD: ("FAIL", "One path to the state-machine class is still open on the reviewed tree.", [TRANS2], C_AUD2, "1,2,3,4,5"),
        STR: ("FAIL", "The snapshot write is unchanged and still truncates before it writes.", [SNAP], C_STR1, "1,2,3,4")}
W[3] = {AUD: ("PASS", "Reviewed the claim, transition and requeue paths on this tree and found no blocker in them.", [], C_AUD3, "1,2,3,4,5"),
        STR: ("FAIL", "The snapshot write is still truncate-then-write; nothing in this tree changes it.", [SNAP], C_STR1, "1,2,3,4")}

def session(path, label):
    lines = [
      {"type":"session","version":3,"id":"synthetic-"+label,"timestamp":"2026-11-02T20:00:00.000Z","cwd":F,"synthetic":True},
      {"type":"model_change","id":"s1","parentId":None,"timestamp":"2026-11-02T20:00:00.001Z","model":"onara/cx/gpt-6.1-sol","resolvedModelIsFallback":False},
      {"type":"thinking_level_change","id":"s2","parentId":"s1","timestamp":"2026-11-02T20:00:00.002Z","thinkingLevel":"high","configured":None},
    ]
    for i in (3,4):
        lines.append({"type":"message","id":f"s{i}","parentId":f"s{i-1}","timestamp":f"2026-11-02T20:00:00.00{i}Z","message":{"role":"assistant","api":"openai-responses","provider":"onara","model":"cx/gpt-6.1-sol","content":[{"type":"text","text":"synthetic reviewer session for the F1 fixed payload "+label}],"stopReason":"stop"}})
    open(path,"w").write("\n".join(json.dumps(l) for l in lines)+"\n")

for w, lanes in W.items():
    for inv, (verdict, intro, blocks, crit, sections) in lanes.items():
        short = "audit" if inv==AUD else "strategic"
        open(f"{D}/w{w}-{short}-reply.md","w").write(reply(inv, verdict, intro, blocks, crit, sections))
        session(f"{D}/w{w}-{short}-session.jsonl", f"w{w}-{short}")

def dv(summary):
    return json.dumps({"verdict":"OKAY","summary":summary,"blockers":[],"notes":[]}, indent=2)+"\n"
open(f"{D}/delta1-verdict.json","w").write(dv("Each fix entry named in the brief is implemented by the patches, and nothing in the delta contradicts a plan invariant or a carried QA row."))
open(f"{D}/delta2-verdict.json","w").write(dv("Each fix entry named in the brief is implemented by the patches, and nothing in the delta contradicts a plan invariant or a carried QA row."))
