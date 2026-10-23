# Fix delta R-x

Fix entry: R-x: repair the job-name claim (packages/metaharness/src/store.ts, server.ts)

Diff of the fix:

```diff
commit 0720de8d94168bfa7be079b95c671e74db53652e
Author: Tim <tim.koehler90@googlemail.com>
Date:   Fri Oct 16 19:20:12 2026 +0200

    fix(metaharness): repair the job-name claim and normalize raw scan tokens
    
    RED: every evaluate returned 400 'already running' on the real server; a quoted short credential in a comment passed; a pid-less claim stayed listed.

diff --git a/packages/metaharness/src/server.ts b/packages/metaharness/src/server.ts
index f0cd3cb5f2..338aa57d7c 100755
--- a/packages/metaharness/src/server.ts
+++ b/packages/metaharness/src/server.ts
@@ -276,7 +276,7 @@ export class ManagerServer {
 			jobsDir,
 			sourceRoot: evo.sourceRoot ?? defaultSourceRoot(),
 			defaults: evo.defaults ?? defaultEvoLaunch(),
-			launch: request => this.launch(request),
+			launch: (request, opts) => this.launch(request, opts),
 		});
 	}
 
@@ -465,7 +465,7 @@ export class ManagerServer {
 	}
 
 	/** Launch any supported benchmark and register it in the uniform run store. */
-	launch(request: LaunchRequest): { jobName: string; pid: number } {
+	launch(request: LaunchRequest, opts: { claimed?: boolean } = {}): { jobName: string; pid: number } {
 		if (!request.model) throw new Error("model is required");
 		const benchmark = request.benchmark ?? "harbor";
 		if (benchmark !== "harbor" && benchmark !== "edit" && benchmark !== "snapcompact") {
@@ -477,7 +477,10 @@ export class ManagerServer {
 			request.dataset ??
 			(benchmark === "harbor" ? "terminal-bench@2.0" : benchmark === "edit" ? "typescript-edit" : "squad-dev");
 		const jobName = request.jobName ?? defaultJobName(request.model);
-		if (this.#children.has(jobName) || this.#store.getRun(jobName)?.status === "running") {
+		const existing = this.#store.getRun(jobName);
+		// `claimed` is an evaluate's name reservation: only that evaluate (opts.claimed) may launch over it.
+		const blocked = existing?.status === "running" || (existing?.status === "claimed" && !opts.claimed);
+		if (this.#children.has(jobName) || blocked) {
 			throw new Error(`run ${jobName} is already running`);
 		}
 		// Validate before any job dir exists so a bad path leaves no debris for discover().
diff --git a/packages/metaharness/src/store.ts b/packages/metaharness/src/store.ts
index f9ad416482..1b1047abed 100644
--- a/packages/metaharness/src/store.ts
+++ b/packages/metaharness/src/store.ts
@@ -21,7 +21,7 @@ import {
 } from "./evo/transcript-columns";
 import { readJobResult } from "./runner";
 
-export type RunStatus = "running" | "complete" | "failed" | "cancelled";
+export type RunStatus = "claimed" | "running" | "complete" | "failed" | "cancelled";
 
 /** Benchmark implementation that produced a run. */
 export type BenchmarkKind = "harbor" | "edit" | "snapcompact";
@@ -206,6 +206,8 @@ const LIVE_DURATION_QUANTUM_MS = 30_000;
 const LIVE_HEARTBEAT_MS = 10_000;
 
 export class RunStore {
+	/** Job names this instance claimed and has not yet launched or released; used to tell live claims from abandoned ones. */
+	#liveClaims = new Set<string>();
 	#db: Database;
 	readonly jobsDir: string;
 	/** Evo variant registry tables living in the same database. */
@@ -257,29 +259,50 @@ export class RunStore {
 	}
 
 	/**
-	 * Atomically reserve a job name with a pid-less placeholder row. The conditional insert is the
-	 * uniqueness decision and the write in one statement, so concurrent callers cannot both win.
-	 * `registerLaunch` later upserts the same row; `releaseClaim` drops it if launch setup fails.
+	 * Atomically reserve a job name with a pid-less `claimed` placeholder row. The conditional insert is the
+	 * uniqueness decision and the write in one statement, so concurrent callers cannot both win. `claimed` is
+	 * deliberately not `running`: it never looks like a live run, and only `ManagerServer.launch` called with
+	 * `{ claimed: true }` (the claimer) may take it over. `registerLaunch` upserts the same row to `running`;
+	 * `releaseClaim` drops it if launch setup fails.
 	 */
 	claimJobName(claim: { jobName: string; dataset: string; variantId: string; suiteId: string }): boolean {
+		this.#reapAbandonedClaims();
 		const result = this.#db
 			.query(
 				`INSERT INTO runs (job_name, dataset, variant_id, suite_id, status, pid, created_at)
-				 VALUES (?, ?, ?, ?, 'running', NULL, ?)
+				 VALUES (?, ?, ?, ?, 'claimed', NULL, ?)
 				 ON CONFLICT(job_name) DO NOTHING`,
 			)
 			.run(claim.jobName, claim.dataset, claim.variantId, claim.suiteId, Date.now());
-		return result.changes === 1;
+		if (result.changes !== 1) return false;
+		this.#liveClaims.add(claim.jobName);
+		return true;
 	}
 
-	/** Drop a claim whose runner never took ownership (pid still unset); a launched run is left alone. */
+	/** Drop a claim whose runner never took ownership; a launched run is left alone. */
 	releaseClaim(jobName: string): void {
-		this.#db.query("DELETE FROM runs WHERE job_name = ? AND pid IS NULL AND status = 'running'").run(jobName);
+		this.#liveClaims.delete(jobName);
+		this.#db.query("DELETE FROM runs WHERE job_name = ? AND pid IS NULL AND status = 'claimed'").run(jobName);
+	}
+
+	/**
+	 * A `claimed` row this instance does not hold and that has no job dir belongs to a process that died between
+	 * claim and launch (the manager is the single writer of its jobs dir). Delete it so the name is reusable and
+	 * it never shows up as a run.
+	 */
+	#reapAbandonedClaims(): void {
+		const claimed = this.#db.query("SELECT job_name FROM runs WHERE status = 'claimed'").all() as Array<{
+			job_name: string;
+		}>;
+		for (const { job_name } of claimed) {
+			if (this.#liveClaims.has(job_name) || fs.existsSync(path.join(this.jobsDir, job_name))) continue;
+			this.#db.query("DELETE FROM runs WHERE job_name = ? AND status = 'claimed' AND pid IS NULL").run(job_name);
+		}
 	}
 
 	/** Register a run this manager just launched (pid-owning). */
 	registerLaunch(launch: LaunchRecord): void {
-		this.#db.query("DELETE FROM trials WHERE job_name = ?").run(launch.jobName);
+		this.#liveClaims.delete(launch.jobName);
 		this.#db
 			.query(
 				`INSERT INTO runs
@@ -413,6 +436,8 @@ export class RunStore {
 		if (!fs.existsSync(jobDir)) return this.getRun(jobName);
 		const row = this.getRun(jobName);
 		if (!row) return null;
+		// A claim is a reservation, not a run: launch owns the transition to `running`; never infer status from disk.
+		if (row.status === "claimed") return row;
 		const snapshot = readBenchmarkSnapshot(row.benchmark, jobDir);
 		const now = Date.now();
 		const transcriptColumns = TRANSCRIPT_COLUMN_NAMES.join(", ");
@@ -585,12 +610,14 @@ export class RunStore {
 	}
 
 	getRun(jobName: string): RunRow | null {
+		this.#reapAbandonedClaims();
 		const r = this.#db.query("SELECT * FROM runs WHERE job_name = ?").get(jobName) as Record<string, unknown> | null;
 		return r ? rowToRun(r) : null;
 	}
 
 	/** Runs evaluating `variantId`, newest first; optionally narrowed to one suite. */
 	listRunsForVariant(variantId: string, suiteId?: string): RunRow[] {
+		this.#reapAbandonedClaims();
 		const rows = (
 			suiteId === undefined
 				? this.#db.query("SELECT * FROM runs WHERE variant_id = ? ORDER BY created_at DESC").all(variantId)
@@ -601,10 +628,12 @@ export class RunStore {
 		return rows.map(rowToRun);
 	}
 
+	/** Every launched run, newest first; in-flight evaluate claims are reservations, not runs. */
 	listRuns(): RunRow[] {
-		const rows = this.#db.query("SELECT * FROM runs ORDER BY created_at DESC").all() as Array<
-			Record<string, unknown>
-		>;
+		this.#reapAbandonedClaims();
+		const rows = this.#db
+			.query("SELECT * FROM runs WHERE status != 'claimed' ORDER BY created_at DESC")
+			.all() as Array<Record<string, unknown>>;
 		return rows.map(rowToRun);
 	}
 
```

- Merge gate: not applicable (fixture)
