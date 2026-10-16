/** Evaluated-run reads for `/api/evo/*`: identity validation, fitness, comparison, reflection bundle. */
import * as fs from "node:fs";
import * as path from "node:path";
import type { RunRow, RunStore } from "../store";
import { badRequest, EvoHttpError } from "./boundary";
import { assertMatched, type ComparisonReport, compareFitness, type ConditionIdentity } from "./compare";
import { computeFitness, type FitnessReport } from "./fitness";
import { buildReflectionBundle } from "./reflection";
import type { StoredSuite, SuiteRegistry } from "./suites";
import type { VariantRow } from "./variant-types";

interface Evaluated {
	run: RunRow;
	report: FitnessReport;
	identity: ConditionIdentity;
}

function str(value: unknown): string | null {
	return typeof value === "string" && value !== "" ? value : null;
}

export class EvoReports {
	readonly #store: RunStore;
	readonly #jobsDir: string;
	readonly #suites: SuiteRegistry;

	constructor(store: RunStore, jobsDir: string, suites: SuiteRegistry) {
		this.#store = store;
		this.#jobsDir = jobsDir;
		this.#suites = suites;
	}

	async suite(url: URL): Promise<StoredSuite> {
		const id = url.searchParams.get("suite");
		if (!id) throw badRequest("query parameter 'suite' is required");
		const suite = await this.#suites.get(id);
		if (!suite) throw new EvoHttpError(404, `suite '${id}' not found`);
		return suite;
	}

	/** Condition identity recorded when the run was launched; unrecorded fields make a delta meaningless. */
	#identity(run: RunRow, variant: VariantRow): ConditionIdentity {
		const cfg = run.config;
		const suiteHash = str(cfg.suiteHash);
		const taskHash = str(cfg.taskHash);
		const executorConfigHash = str(cfg.executorConfigHash);
		const modelsYamlHash = str(cfg.modelsYamlHash);
		const model = str(cfg.model);
		if (!run.suiteId || !suiteHash || !taskHash || !executorConfigHash || !modelsYamlHash || !model) {
			throw new EvoHttpError(409, `run '${run.jobName}' did not record its evaluation conditions`);
		}
		const postRun = str(cfg.postRunSourceIdentity) ?? this.#recordedPostRunIdentity(run.jobName);
		const launched = str(cfg.sourceIdentity);
		if (postRun && launched && postRun !== launched) {
			throw new EvoHttpError(409, `run '${run.jobName}' source changed during the run; it is not comparable`);
		}
		return {
			suiteId: run.suiteId,
			suiteHash,
			taskHash,
			model,
			executorConfigHash,
			modelsYamlHash,
			sourceRef: variant.sourceRef,
			sourceDirtyHash: variant.sourceDirtyHash,
		};
	}

	/** The runner writes the post-run identity to its own `runner-config.json`, not into the launch request. */
	#recordedPostRunIdentity(jobName: string): string | null {
		try {
			const saved: unknown = JSON.parse(
				fs.readFileSync(path.join(this.#jobsDir, "_bench", jobName, "runner-config.json"), "utf8"),
			);
			return saved && typeof saved === "object"
				? str((saved as Record<string, unknown>).postRunSourceIdentity)
				: null;
		} catch {
			return null;
		}
	}

	async evaluated(variant: VariantRow, suite: StoredSuite): Promise<Evaluated> {
		const runs = this.#store.listRunsForVariant(variant.id, suite.manifest.id);
		const run = runs[0];
		if (!run) throw new EvoHttpError(404, `variant '${variant.id}' has no run on suite '${suite.manifest.id}'`);
		const synced = this.#store.syncRun(run.jobName) ?? run;
		const identity = this.#identity(synced, variant);
		if (identity.suiteHash !== suite.hash) {
			throw new EvoHttpError(
				409,
				`run '${run.jobName}' evaluated a different version of suite '${suite.manifest.id}'`,
				{
					mismatches: [{ field: "suiteHash", child: identity.suiteHash, baseline: suite.hash }],
				},
			);
		}
		const report = computeFitness({
			variantId: variant.id,
			suiteId: suite.manifest.id,
			jobName: synced.jobName,
			suiteTasks: suite.manifest.include,
			attempts: suite.manifest.attempts,
			policy: {
				minPairedTasks: suite.manifest.minPairedTasks,
				minAttemptsPerTask: suite.manifest.minAttemptsPerTask,
			},
			trials: this.#store.listTraces(synced.jobName),
		});
		return { run: synced, report, identity };
	}

	async #baseline(variant: VariantRow, url: URL): Promise<VariantRow> {
		const requested = url.searchParams.get("baseline") ?? variant.parentId;
		if (!requested) throw badRequest("variant has no parent; pass query parameter 'baseline'");
		const baseline = this.#store.evo.getVariant(requested);
		if (!baseline) throw new EvoHttpError(404, `baseline variant '${requested}' not found`);
		return baseline;
	}

	async #compareEvaluated(
		variant: VariantRow,
		url: URL,
	): Promise<{ child: Evaluated; baseline: Evaluated; baselineVariant: VariantRow; report: ComparisonReport }> {
		const suite = await this.suite(url);
		const baselineVariant = await this.#baseline(variant, url);
		const child = await this.evaluated(variant, suite);
		const baseline = await this.evaluated(baselineVariant, suite);
		assertMatched(child.identity, baseline.identity);
		return { child, baseline, baselineVariant, report: compareFitness(child.report, baseline.report, variant) };
	}

	async compare(variant: VariantRow, url: URL): Promise<ComparisonReport> {
		return (await this.#compareEvaluated(variant, url)).report;
	}

	async bundle(variant: VariantRow, url: URL): Promise<unknown> {
		const suite = await this.suite(url);
		const parentId = url.searchParams.get("baseline") ?? variant.parentId;
		if (!parentId) {
			const child = await this.evaluated(variant, suite);
			return buildReflectionBundle({
				variant,
				parent: null,
				fitness: child.report,
				baselineFitness: null,
				comparison: null,
				childTraces: this.#store.listTraces(child.run.jobName),
				baselineTraces: [],
			});
		}
		const { child, baseline, baselineVariant, report } = await this.#compareEvaluated(variant, url);
		return buildReflectionBundle({
			variant,
			parent: baselineVariant,
			fitness: child.report,
			baselineFitness: baseline.report,
			comparison: report,
			childTraces: this.#store.listTraces(child.run.jobName),
			baselineTraces: this.#store.listTraces(baseline.run.jobName),
		});
	}

	async fitness(variant: VariantRow, url: URL): Promise<FitnessReport> {
		return (await this.evaluated(variant, await this.suite(url))).report;
	}
}
