Read-only strategic risk review. Do not run commands, fetch network context, modify files, or spawn sub-reviewers.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Changed files:
DIFF_RANGE: 233350e821c684503c0c735e848a6f46b96da5dd..c26f934a2fd22580a5c528cbb3182d0e929a0a47 (git diff main...HEAD; merge-base 233350e821c6 = main)
Changed files:
openspec/changes/jobq-lifecycle/.openspec.yaml
openspec/changes/jobq-lifecycle/design.md
openspec/changes/jobq-lifecycle/gate.md
openspec/changes/jobq-lifecycle/proposal.md
openspec/changes/jobq-lifecycle/review.md
openspec/changes/jobq-lifecycle/specs/job-lifecycle/spec.md
openspec/changes/jobq-lifecycle/tasks.md
src/queue.ts
src/store.ts
src/worker.ts
test/queue.test.ts


Diff:
diff --git a/openspec/changes/jobq-lifecycle/.openspec.yaml b/openspec/changes/jobq-lifecycle/.openspec.yaml
new file mode 100644
index 0000000..f05d850
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/.openspec.yaml
@@ -0,0 +1,2 @@
+schema: omp-gated
+created: 2026-11-02
diff --git a/openspec/changes/jobq-lifecycle/design.md b/openspec/changes/jobq-lifecycle/design.md
new file mode 100644
index 0000000..0527b20
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/design.md
@@ -0,0 +1,21 @@
+# Design
+
+## Context
+
+`jobq` is new. The storage layer is shared with other services through a generated client.
+
+## Goals / Non-Goals
+
+**Goals:**
+- A small queue with explicit job states and an on-disk snapshot.
+
+**Non-Goals:**
+- Multi-process coordination and distribution.
+
+## Decisions
+
+State lives in one `Map` inside `JobQueue`; snapshots go through the generated `store.ts`.
+
+## Risks / Trade-offs
+
+The queue is the only owner of job state, so every state change must go through it.
diff --git a/openspec/changes/jobq-lifecycle/gate.md b/openspec/changes/jobq-lifecycle/gate.md
new file mode 100644
index 0000000..1593af1
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/gate.md
@@ -0,0 +1,9 @@
+# Gate
+
+- **Mandatory class**: concurrency-state
+- **Depth**: risky (a job state machine with workers claiming jobs concurrently; the class makes the review risky)
+- **Risk tier**: product
+- **Author's risk assessment**: a job handed to two workers runs twice, and a job moved through a wrong state can be lost or re-run; the snapshot is the only record after a restart.
+- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
+- **Accepted residual risks**: none (no concurrency or state defect is accepted for this change)
+- **Out of scope for blocking**: none (no area is excluded from blocking)
diff --git a/openspec/changes/jobq-lifecycle/proposal.md b/openspec/changes/jobq-lifecycle/proposal.md
new file mode 100644
index 0000000..544c452
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/proposal.md
@@ -0,0 +1,22 @@
+# Proposal
+
+## Why
+
+Services embedding `jobq` hand-roll job bookkeeping. They need one queue that tracks which worker owns a job and survives a restart.
+
+## What Changes
+
+- Add `JobQueue` (`src/queue.ts`): add, claim, complete and fail jobs, persisting a snapshot on every claim, and `JobQueue.restore(path)` to rebuild a queue from its snapshot after a restart.
+- Add `requeue` (`src/worker.ts`): put a job back on the queue for another attempt.
+- Add `src/store.ts`: the snapshot reader/writer, generated from the shared storage contract.
+
+## Capabilities
+
+### New Capabilities
+- `job-lifecycle`: queue jobs, hand each to a worker, record its outcome and persist state.
+
+### Modified Capabilities
+
+## Impact
+
+New modules under `src/`. No existing code changes.
diff --git a/openspec/changes/jobq-lifecycle/review.md b/openspec/changes/jobq-lifecycle/review.md
new file mode 100644
index 0000000..934c8d1
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/review.md
@@ -0,0 +1,19 @@
+# Review
+
+- **Verdict**: OKAY
+- **Reviewed digest**: bb79972ac8de1430244ef312c289de6ca703174361c3e62c26ffcc12b660f179
+- **Depth**: risky
+- **Reviewer**: plan-reviewer, 01fixtureC1, 01fixtureD2
+- **Verifier**: blocker-verifier, none
+- **Models**: 01fixtureC1 onara/cx/gpt-6.1-sol, 01fixtureD2 onara/cx/gpt-6.1-sol
+- **Round**: 1
+- **Awaiting**: none
+- **Override**: none
+
+## Blockers
+
+none
+
+## Residuals
+
+none
diff --git a/openspec/changes/jobq-lifecycle/specs/job-lifecycle/spec.md b/openspec/changes/jobq-lifecycle/specs/job-lifecycle/spec.md
new file mode 100644
index 0000000..72a8a95
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/specs/job-lifecycle/spec.md
@@ -0,0 +1,39 @@
+# Spec Delta
+
+## Purpose
+Track jobs from queued to done or failed and keep a snapshot of their state on disk.
+
+## ADDED Requirements
+
+### Requirement: A queued job is claimed by one worker
+`claim(id, worker)` SHALL move a queued job to `running`, record the worker as owner and resolve `true`; it SHALL resolve `false` for a job that is not queued.
+
+#### Scenario: Claim a queued job
+- **WHEN** worker `w1` claims queued job `a`
+- **THEN** `claim` resolves `true`, the job is `running` and its owner is `w1`
+
+#### Scenario: Negative control
+- **WHEN** worker `w2` claims job `a` after `w1` has claimed it
+- **THEN** `claim` resolving `true` for `w2` MUST fail the check; it resolves `false`
+
+### Requirement: Completing a running job marks it done
+`complete(id)` SHALL mark a running job `done` and clear its owner; `complete` SHALL throw for an unknown id.
+
+#### Scenario: Complete a claimed job
+- **WHEN** job `a` is running and `complete("a")` is called
+- **THEN** the job is `done` with no owner
+
+#### Scenario: Negative control
+- **WHEN** `complete("missing")` is called for an id that was never added
+- **THEN** returning normally MUST fail the check; it throws
+
+### Requirement: Each claim persists a snapshot
+`claim` SHALL write the state of every job to the queue's snapshot path before it resolves.
+
+#### Scenario: Snapshot written
+- **WHEN** a claim resolves for job `a`
+- **THEN** the snapshot file lists job `a` as `running`
+
+#### Scenario: Negative control
+- **WHEN** the snapshot path is not writable
+- **THEN** `claim` resolving `true` MUST fail the check; it rejects
diff --git a/openspec/changes/jobq-lifecycle/tasks.md b/openspec/changes/jobq-lifecycle/tasks.md
new file mode 100644
index 0000000..32ae942
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/tasks.md
@@ -0,0 +1,15 @@
+# Tasks
+
+## 1. Implementation
+
+- [x] 1.1 Add `JobQueue` with add, claim, complete and fail Verify: `bun test`
+- [x] 1.2 Add `requeue` and the generated snapshot store Verify: `bun test`
+
+## 2. Final verification
+
+- [x] 2.1 F1. Manual QA on the real surface: run each scenario of `specs/job-lifecycle/spec.md` with bun against `src/`; one evidence path per scenario in the `f1/` directory below the record's evidence directory (`.omp/team-config/evidence/gate/jobq-lifecycle/f1/`), on the head after the last code commit; the QA lane judges the observations. Verify: `test -s .omp/team-config/evidence/gate/jobq-lifecycle/f1/qa-matrix.md`
+
+## Workflow follow-up
+
+- F2 merge gate (`review-work`), after 2.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
+- Merge only after the F2 record validates.
diff --git a/src/queue.ts b/src/queue.ts
new file mode 100644
index 0000000..4b50a44
--- /dev/null
+++ b/src/queue.ts
@@ -0,0 +1,76 @@
+import { loadSnapshot, saveSnapshot } from "./store"
+
+export type JobState = "queued" | "running" | "done" | "failed"
+
+export interface Job {
+	id: string
+	state: JobState
+	attempts: number
+	owner?: string
+}
+
+export class JobQueue {
+	private jobs = new Map<string, Job>()
+	private writing: Promise<void> = Promise.resolve()
+
+	constructor(private readonly snapshotPath: string) {}
+
+	/** Rebuild a queue from the snapshot a previous process left behind. */
+	static async restore(snapshotPath: string): Promise<JobQueue> {
+		const queue = new JobQueue(snapshotPath)
+		for (const job of await loadSnapshot<Job[]>(snapshotPath)) queue.jobs.set(job.id, job)
+		return queue
+	}
+
+	add(id: string): Job {
+		const job: Job = { id, state: "queued", attempts: 0 }
+		this.jobs.set(id, job)
+		return job
+	}
+
+	get(id: string): Job | undefined {
+		return this.jobs.get(id)
+	}
+
+	/** Hand a queued job to a worker and persist the queue; false when the job is not queued. */
+	async claim(id: string, worker: string): Promise<boolean> {
+		const job = this.jobs.get(id)
+		if (!job || job.state !== "queued") return false
+		job.state = "running"
+		job.owner = worker
+		try {
+			await this.persist()
+		} catch (error) {
+			job.state = "queued"
+			job.owner = undefined
+			throw error
+		}
+		return true
+	}
+
+	/** Snapshot writes of this instance run one after the other. */
+	private persist(): Promise<void> {
+		const next = this.writing.then(() => saveSnapshot(this.snapshotPath, [...this.jobs.values()]))
+		this.writing = next.catch(() => {})
+		return next
+	}
+
+	complete(id: string): void {
+		const job = this.need(id)
+		job.state = "done"
+		job.owner = undefined
+	}
+
+	fail(id: string): void {
+		const job = this.need(id)
+		job.state = "failed"
+		job.attempts += 1
+		job.owner = undefined
+	}
+
+	private need(id: string): Job {
+		const job = this.jobs.get(id)
+		if (!job) throw new Error(`unknown job ${id}`)
+		return job
+	}
+}
diff --git a/src/store.ts b/src/store.ts
new file mode 100644
index 0000000..80df299
--- /dev/null
+++ b/src/store.ts
@@ -0,0 +1,11 @@
+// GENERATED from storage-contract v3 (https://example.invalid/storage-contract).
+// DO NOT EDIT: regenerate with `contract-gen`, which lives in the contract repository.
+import { readFile, writeFile } from "node:fs/promises"
+
+export async function saveSnapshot(path: string, data: unknown): Promise<void> {
+	await writeFile(path, JSON.stringify(data))
+}
+
+export async function loadSnapshot<T>(path: string): Promise<T> {
+	return JSON.parse(await readFile(path, "utf8")) as T
+}
diff --git a/src/worker.ts b/src/worker.ts
new file mode 100644
index 0000000..ac92cec
--- /dev/null
+++ b/src/worker.ts
@@ -0,0 +1,7 @@
+import type { JobQueue } from "./queue"
+
+/** Put a job back on the queue for another attempt. */
+export function requeue(queue: JobQueue, id: string): void {
+	const job = queue.get(id)
+	if (job) Object.assign(job, { state: "queued", owner: undefined })
+}
diff --git a/test/queue.test.ts b/test/queue.test.ts
new file mode 100644
index 0000000..43db073
--- /dev/null
+++ b/test/queue.test.ts
@@ -0,0 +1,49 @@
+import { expect, test } from "bun:test"
+import { mkdtempSync, readFileSync } from "node:fs"
+import { tmpdir } from "node:os"
+import { join } from "node:path"
+import { JobQueue } from "../src/queue"
+import { requeue } from "../src/worker"
+
+const snap = () => join(mkdtempSync(join(tmpdir(), "jobq-")), "snap.json")
+
+test("claim hands a queued job to one worker", async () => {
+	const q = new JobQueue(snap())
+	q.add("a")
+	expect(await q.claim("a", "w1")).toBe(true)
+	expect(q.get("a")).toMatchObject({ state: "running", owner: "w1" })
+	expect(await q.claim("a", "w2")).toBe(false)
+})
+test("complete marks done and unknown ids throw", async () => {
+	const q = new JobQueue(snap())
+	q.add("a")
+	await q.claim("a", "w1")
+	q.complete("a")
+	expect(q.get("a")).toMatchObject({ state: "done", owner: undefined })
+	expect(() => q.complete("missing")).toThrow()
+})
+test("claim persists a snapshot and rejects on an unwritable path", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	await q.claim("a", "w1")
+	expect(JSON.parse(readFileSync(p, "utf8"))[0]).toMatchObject({ id: "a", state: "running" })
+	const bad = new JobQueue("/nonexistent-dir/snap.json")
+	bad.add("b")
+	await expect(bad.claim("b", "w1")).rejects.toThrow()
+})
+test("restore rebuilds a queue from its snapshot", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	await q.claim("a", "w1")
+	const again = await JobQueue.restore(p)
+	expect(again.get("a")?.id).toBe("a")
+})
+test("requeue puts a failed job back", () => {
+	const q = new JobQueue(snap())
+	q.add("a")
+	q.fail("a")
+	requeue(q, "a")
+	expect(q.get("a")?.state).toBe("queued")
+})


Manual QA matrix:
QA rows below were captured by the orchestrator (F1) on e784622a632d. Carried to the reviewed head c26f934a2fd2 without re-run: the only commit since (c26f934 "Tick F1 manual QA task") changes one checkbox in openspec/changes/jobq-lifecycle/tasks.md and cannot change any behaviour a row observed. Artifacts live under /private/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/pirp-fix/f1b-r47-b/.worktrees/review-jobq-lifecycle/.omp/team-config/evidence/gate/jobq-lifecycle/f1/ (one transcript per row, driver qa-run.ts).

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


Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Answer four questions about the whole diff:
1. Does the change hold up architecturally against the rest of the system, and where are the cross-module seams between its files?
2. What is inconsistent, duplicated or needlessly complex across files, and where does simplification apply?
3. Which failure mode would hurt most in production, and is it handled?
4. What would a line-level reading of the diff miss?

Brief guard: if this message did not carry all four questions, the diff, the changed-file list, and the QA matrix, return INCONCLUSIVE and name what was missing.

Start each blocker with its own `Blocker B<n>:` line. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: <numbers of the questions you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER
