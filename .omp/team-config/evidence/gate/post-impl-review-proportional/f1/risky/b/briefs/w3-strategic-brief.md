Read-only strategic risk review. Do not run commands, fetch network context, modify files, or spawn sub-reviewers.
Your reply ends with the REVIEW-TRAILER-v1 block given at the end of this brief, with its field names exactly as written there.

Changed files:
Diff range: 233350e821c684503c0c735e848a6f46b96da5dd..f0200d7e9ddff55a1ba8b678ef3ba1a50660d699
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
```diff
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
index 0000000..092eb4f
--- /dev/null
+++ b/openspec/changes/jobq-lifecycle/tasks.md
@@ -0,0 +1,22 @@
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
+## TODOs
+
+1. F2 wave 1 fix (orphaned-running-after-restore, src/queue.ts:21): `JobQueue.restore` puts every job stored as `running` back to `queued` with no owner, because its worker died with the previous process; `complete`, `fail` and `requeue` persist the snapshot like `claim`, so a restore never re-queues a job that already finished. Verify: `bun test`
+2. F2 wave 1 fix (illegal-state-transition, src/queue.ts:60, src/queue.ts:66, src/worker.ts:6): `complete` and `fail` accept only a `running` job and `requeue` only a `failed` one, all through `JobQueue`, and each throws otherwise. Verify: `bun test`
+3. F2 wave 1 fix (non-atomic-snapshot-write, src/store.ts:6): `JobQueue` writes each snapshot through the generated `saveSnapshot` to a sibling temporary file and renames it over the snapshot path, so a crash mid-write never leaves a truncated snapshot; `src/store.ts` stays generated and unedited. Verify: `bun test`
+4. F2 wave 2 fix (illegal-state-transition, src/worker.ts:6): `JobQueue.get` and `JobQueue.add` return copies of the job instead of the queue's own object, so no caller, `requeue` included, can change a job's state by assigning to it (`Object.assign`); every state change goes through the queue's checked transitions. Verify: `bun test`
+
+## Workflow follow-up
+
+- F2 merge gate (`review-work`), after 2.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
+- Merge only after the F2 record validates.
diff --git a/src/queue.ts b/src/queue.ts
new file mode 100644
index 0000000..344d6dd
--- /dev/null
+++ b/src/queue.ts
@@ -0,0 +1,106 @@
+import { rename } from "node:fs/promises"
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
+		for (const job of await loadSnapshot<Job[]>(snapshotPath)) {
+			// A job running when the previous process stopped lost its worker with it: queue it for another attempt.
+			if (job.state === "running") {
+				job.state = "queued"
+				job.owner = undefined
+			}
+			queue.jobs.set(job.id, job)
+		}
+		return queue
+	}
+
+	/** Queue a new job; returns a copy, since a job's state changes only through the queue's transitions. */
+	add(id: string): Job {
+		const job: Job = { id, state: "queued", attempts: 0 }
+		this.jobs.set(id, job)
+		return { ...job }
+	}
+
+	/** A copy of the job, or undefined for an unknown id; assigning to it never changes the queue. */
+	get(id: string): Job | undefined {
+		const job = this.jobs.get(id)
+		return job && { ...job }
+	}
+
+	/** Hand a queued job to a worker and persist the queue; false when the job is not queued. */
+	async claim(id: string, worker: string): Promise<boolean> {
+		const job = this.jobs.get(id)
+		if (!job || job.state !== "queued") return false
+		await this.commit(job, { state: "running", owner: worker })
+		return true
+	}
+
+	/** Mark a running job done and persist; throws at once for an unknown or not running job. */
+	complete(id: string): Promise<void> {
+		return this.commit(this.need(id, "running"), { state: "done", owner: undefined })
+	}
+
+	/** Mark a running job failed and persist; throws at once for an unknown or not running job. */
+	fail(id: string): Promise<void> {
+		const job = this.need(id, "running")
+		return this.commit(job, { state: "failed", attempts: job.attempts + 1, owner: undefined })
+	}
+
+	/** Put a failed job back on the queue and persist; throws at once for an unknown or not failed job. */
+	requeue(id: string): Promise<void> {
+		return this.commit(this.need(id, "failed"), { state: "queued", owner: undefined })
+	}
+
+	/**
+	 * Apply one transition synchronously, so a concurrent caller already sees the new state, then persist it.
+	 * A failed write undoes the transition unless a later one has replaced it.
+	 */
+	private async commit(job: Job, change: Partial<Job>): Promise<void> {
+		const undo: Partial<Job> = { state: job.state, attempts: job.attempts, owner: job.owner }
+		Object.assign(job, change)
+		try {
+			await this.persist()
+		} catch (error) {
+			if (job.state === change.state) Object.assign(job, undo)
+			throw error
+		}
+	}
+
+	/**
+	 * Snapshot writes of this instance run one after the other. The generated store writes in place, so each
+	 * snapshot goes to a sibling file first and is renamed over the snapshot path: a crash mid-write leaves
+	 * the previous snapshot intact instead of a truncated one.
+	 */
+	private persist(): Promise<void> {
+		const staging = `${this.snapshotPath}.tmp`
+		const next = this.writing.then(async () => {
+			await saveSnapshot(staging, [...this.jobs.values()])
+			await rename(staging, this.snapshotPath)
+		})
+		this.writing = next.catch(() => {})
+		return next
+	}
+
+	private need(id: string, state: JobState): Job {
+		const job = this.jobs.get(id)
+		if (!job) throw new Error(`unknown job ${id}`)
+		if (job.state !== state) throw new Error(`job ${id} is ${job.state}, not ${state}`)
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
index 0000000..5a9b90e
--- /dev/null
+++ b/src/worker.ts
@@ -0,0 +1,6 @@
+import type { JobQueue } from "./queue"
+
+/** Put a failed job back on the queue for another attempt; throws for an unknown or not failed job. */
+export function requeue(queue: JobQueue, id: string): Promise<void> {
+	return queue.requeue(id)
+}
diff --git a/test/queue.test.ts b/test/queue.test.ts
new file mode 100644
index 0000000..81b1086
--- /dev/null
+++ b/test/queue.test.ts
@@ -0,0 +1,119 @@
+import { expect, test } from "bun:test"
+import { mkdtempSync, readFileSync, statSync } from "node:fs"
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
+	await q.complete("a")
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
+	expect(bad.get("b")).toMatchObject({ state: "queued", owner: undefined })
+})
+test("restore rebuilds a queue from its snapshot", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	await q.claim("a", "w1")
+	const again = await JobQueue.restore(p)
+	expect(again.get("a")?.id).toBe("a")
+})
+test("restore queues a job whose worker died with the previous process", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	await q.claim("a", "w1")
+	const again = await JobQueue.restore(p)
+	expect(again.get("a")).toMatchObject({ state: "queued", owner: undefined })
+	expect(await again.claim("a", "w2")).toBe(true)
+})
+test("restore keeps finished jobs finished", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	q.add("b")
+	await q.claim("a", "w1")
+	await q.claim("b", "w2")
+	await q.complete("a")
+	await q.fail("b")
+	const again = await JobQueue.restore(p)
+	expect(again.get("a")).toEqual({ id: "a", state: "done", attempts: 0 })
+	expect(again.get("b")).toEqual({ id: "b", state: "failed", attempts: 1 })
+	expect(await again.claim("a", "w3")).toBe(false)
+})
+test("complete and fail accept only a running job", async () => {
+	const q = new JobQueue(snap())
+	q.add("a")
+	expect(() => q.complete("a")).toThrow()
+	expect(() => q.fail("a")).toThrow()
+	await q.claim("a", "w1")
+	await q.complete("a")
+	expect(() => q.fail("a")).toThrow()
+	expect(() => q.complete("a")).toThrow()
+	expect(q.get("a")).toMatchObject({ state: "done", attempts: 0 })
+})
+test("requeue puts a failed job back", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	await q.claim("a", "w1")
+	await q.fail("a")
+	await requeue(q, "a")
+	expect(q.get("a")).toMatchObject({ state: "queued", attempts: 1, owner: undefined })
+	expect(JSON.parse(readFileSync(p, "utf8"))[0]).toMatchObject({ id: "a", state: "queued" })
+})
+test("requeue refuses a job that is not failed", async () => {
+	const q = new JobQueue(snap())
+	q.add("a")
+	await q.claim("a", "w1")
+	expect(() => requeue(q, "a")).toThrow()
+	expect(q.get("a")).toMatchObject({ state: "running", owner: "w1" })
+	await q.complete("a")
+	expect(() => requeue(q, "a")).toThrow()
+	expect(q.get("a")?.state).toBe("done")
+})
+test("a snapshot is replaced by rename, never rewritten in place", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	q.add("a")
+	q.add("b")
+	await q.claim("a", "w1")
+	const first = statSync(p).ino
+	await q.claim("b", "w1")
+	expect(statSync(p).ino).not.toBe(first)
+	expect(JSON.parse(readFileSync(p, "utf8"))).toHaveLength(2)
+})
+test("a job's state changes only through the queue", async () => {
+	const p = snap()
+	const q = new JobQueue(p)
+	Object.assign(q.add("a"), { state: "done" })
+	await q.claim("a", "w1")
+	await q.complete("a")
+	Object.assign(q.get("a")!, { state: "queued", owner: undefined })
+	expect(q.get("a")?.state).toBe("done")
+	expect(await q.claim("a", "w2")).toBe(false)
+	expect(JSON.parse(readFileSync(p, "utf8"))[0]).toMatchObject({ id: "a", state: "done" })
+})
```

Manual QA matrix:
Head: f0200d7e9ddff55a1ba8b678ef3ba1a50660d699. Every row re-run on the wave-3 snapshot (fix round 2 changed what `add` and `get` return, which every row observes through). Channel: library, bun 1.4.4 scripts importing `src/` in the review worktree; synthetic data in fresh temp dirs. Each artifact holds the exact script, stdout, stderr and exit code.

| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|----------|------------------------|----------|----------|---------|----------|
| QA1 | Spec: claim a queued job | `bun run qa1-claim-queued.ts`: add `a`, `claim("a","w1")` | resolves `true`; `a` running, owner `w1` | `true`; `{state:running, owner:w1}` | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa1-claim-queued.txt` |
| QA2 | Spec negative control: second claimer | `bun run qa2-claim-negative-control.ts`: `w1` claims `a`, then `w2` claims `a` | `w2` claim resolves `false`; owner stays `w1` | `true` then `false`; owner `w1` | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa2-claim-negative-control.txt` |
| QA3 | Spec: complete a claimed job | `bun run qa3-complete-claimed.ts`: claim `a`, `await complete("a")` | `a` done with no owner | `{state:done}`, owner absent | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa3-complete-claimed.txt` |
| QA4 | Spec negative control: complete unknown id | `bun run qa4-complete-unknown-negative-control.ts`: `complete("missing")` | throws | threw `Error: unknown job missing` | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa4-complete-unknown-negative-control.txt` |
| QA5 | Spec: snapshot written on claim | `bun run qa5-snapshot-written.ts`: claim `a`, read snapshot file | snapshot lists `a` as running | `[{id:a,state:running,owner:w1}]` | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa5-snapshot-written.txt` |
| QA6 | Spec negative control: unwritable snapshot path | `bun run qa6-unwritable-snapshot-negative-control.ts`: queue on `/nonexistent-dir/snap.json`, claim `b` | claim rejects (does not resolve `true`) | rejected with ENOENT on `snap.json.tmp`; `b` back to queued, no owner | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa6-unwritable-snapshot-negative-control.txt` |
| QA7 | Happy path: add, claim by two workers, snapshot, complete, fail | `bun run qa7-happy-path-lifecycle.ts` | both claims `true`; snapshot lists both running; `a` done, `b` failed with attempts 1; snapshot then lists done/failed | as expected | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa7-happy-path-lifecycle.txt` |
| QA8 | Riskiest edge: concurrent claims (50 jobs x 2 workers via `Promise.all`) | `bun run qa8-concurrent-claims-edge.ts` | exactly one winning claim per job; last snapshot lists all 50 running | 50 jobs with one winner, 0 with two; owners `[w1]`; 50 running on disk | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa8-concurrent-claims-edge.txt` |
| QA9 | Regression on adjacent behaviour: restore and requeue | `bun run qa9-regression-restore-requeue.ts` | restore yields `a` queued (its worker died) and `c` queued; claim, fail, requeue gives queued with attempts 1 and a second worker can claim it | as expected | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa9-regression-restore-requeue.txt` |
| QA10 | Regression: test suite | `bun test` | 11 pass, 0 fail | 11 pass, 0 fail | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa10-bun-test-suite.txt` |
| QA11 | Fix row 1: restart re-queues an orphaned running job, keeps a finished one | `bun run qa11-restart-requeues-orphaned-job.ts` | restored `a` queued without owner and claimable by `w3`; restored `b` done and not claimable | `a` queued, claim `true`; `b` done, claim `false` | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa11-restart-requeues-orphaned-job.txt` |
| QA12 | Fix row 2: illegal transitions throw | `bun run qa12-illegal-transitions.ts` | complete/fail from queued, requeue from queued/running/done, fail from done all throw; `a` stays done, attempts 0 | all six threw; `a` done, attempts 0 | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa12-illegal-transitions.txt` |
| QA13 | Fix row 3: snapshot replaced by rename | `bun run qa13-atomic-snapshot-replace.ts` | inode changes between snapshots; no leftover temp file; unwritable path still rejects and rolls back | inode replaced `true`; dir holds only `snap.json`; rejection with rollback | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa13-atomic-snapshot-replace.txt` |
| QA14 | Fix row 4: job state changes only through the queue | `bun run qa14-state-only-through-queue.ts` | assigning to the objects `add`/`get` return leaves the queue unchanged; `a` stays done, a second claim resolves `false`, `requeue` of done `a` throws; snapshot lists `a` done | as expected | PASS | `.omp/team-config/evidence/gate/jobq-lifecycle/wave-3/qa14-state-only-through-queue.txt` |


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
