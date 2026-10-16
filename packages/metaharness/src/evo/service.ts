/** `/api/evo/*` request handling: variants, suites, evaluation, fitness, compare, reflection bundle. */
import * as path from "node:path";
import type { LaunchRequest } from "../launch-args";
import type { RunRow, RunStore } from "../store";
import {
	badRequest,
	EvoHttpError,
	expectObject,
	optionalPositiveInt,
	optionalString,
	readJsonBody,
	rejectUnknownKeys,
	requiredString,
} from "./boundary";
import { assertMatched, type ComparisonReport, compareFitness, type ConditionIdentity } from "./compare";
import { computeFitness, type FitnessReport } from "./fitness";
import { buildEvalLaunch, type EvoLaunchDefaults } from "./launch";
import { buildReflectionBundle } from "./reflection";
import { type StoredSuite, SuiteRegistry } from "./suites";
import { parseVariantRequest, VariantRegistry } from "./variants";
import type { VariantRow } from "./variant-types";

export interface EvoServiceOptions {
	store: RunStore;
	jobsDir: string;
	/** Root of the default source checkout (config-first variants share it). */
	sourceRoot: string;
	defaults: EvoLaunchDefaults;
	/** Spawn a harbor launch; provided by the manager server. */
	launch(request: LaunchRequest): { jobName: string; pid: number };
}

interface Evaluated {
	run: RunRow;
	report: FitnessReport;
	identity: ConditionIdentity;
}

function str(value: unknown): string | null {
	return typeof value === "string" && value !== "" ? value : null;
}

export class EvoService {
	readonly #store: RunStore;
	readonly #jobsDir: string;
	readonly #launch: EvoServiceOptions["launch"];
	readonly #defaults: EvoLaunchDefaults;
	readonly #variants: VariantRegistry;
	readonly #suites: SuiteRegistry;

	constructor(opts: EvoServiceOptions) {
		this.#store = opts.store;
		this.#jobsDir = opts.jobsDir;
		this.#launch = opts.launch;
		this.#defaults = opts.defaults;
		this.#variants = new VariantRegistry(opts.store.evo, opts.jobsDir, opts.sourceRoot);
		this.#suites = new SuiteRegistry(opts.jobsDir);
	}

	/** Answer an `/api/evo/*` request, or null when the path is not an evo route. */
	async handle(request: Request, url: URL): Promise<Response | null> {
		const p = url.pathname;
		if (!p.startsWith("/api/evo/")) return null;
		try {
			return await this.#route(request, url, p);
		} catch (err) {
			if (err instanceof EvoHttpError)
				return Response.json({ error: err.message, ...err.body }, { status: err.status });
			if (err instanceof SyntaxError)
				return Response.json({ error: "request body must be valid JSON" }, { status: 400 });
			throw err;
		}
	}

	async #route(request: Request, url: URL, p: string): Promise<Response> {
		const method = request.method;
		if (p === "/api/evo/variants") {
			if (method === "GET") return Response.json(this.#store.evo.listVariants());
			if (method === "POST") {
				const result = await this.#variants.register(parseVariantRequest(await readJsonBody(request)));
				return Response.json(
					{ ...result, outcome: result.proposal.outcome },
					{ status: result.created ? 201 : 200 },
				);
			}
		}
		if (p === "/api/evo/suites") {
			if (method === "GET") return Response.json(await this.#suites.list());
			if (method === "POST") {
				const { suite, created } = await this.#suites.register(await readJsonBody(request));
				return Response.json(suite, { status: created ? 201 : 200 });
			}
		}
		const m = p.match(/^\/api\/evo\/variants\/([^/]+)(?:\/(evaluate|fitness|compare|reflection-bundle))?$/);
		if (!m) return Response.json({ error: "not found" }, { status: 404 });
		let id: string;
		try {
			id = decodeURIComponent(m[1]);
		} catch {
			throw badRequest("variant id has invalid percent-encoding");
		}
		const variant = this.#store.evo.getVariant(id);
		if (!variant) throw new EvoHttpError(404, `variant '${id}' not found`);
		switch (m[2]) {
			case undefined:
				if (method !== "GET") break;
				return Response.json({
					variant,
					proposals: this.#store.evo.listProposals(id),
					diff: { path: variant.diffPath, changedFiles: variant.changedFiles },
					runs: this.#store.listRunsForVariant(id),
				});
			case "evaluate":
				if (method !== "POST") break;
				return Response.json(await this.#evaluate(variant, await readJsonBody(request)), { status: 201 });
			case "fitness":
				if (method !== "GET") break;
				return Response.json((await this.#evaluated(variant, await this.#suite(url))).report);
			case "compare":
				if (method !== "GET") break;
				return Response.json(await this.#compare(variant, url));
			case "reflection-bundle":
				if (method !== "GET") break;
				return Response.json(await this.#bundle(variant, url));
		}
		return Response.json({ error: "method not allowed" }, { status: 405 });
	}

	async #suite(url: URL): Promise<StoredSuite> {
		const id = url.searchParams.get("suite");
		if (!id) throw badRequest("query parameter 'suite' is required");
		const suite = await this.#suites.get(id);
		if (!suite) throw new EvoHttpError(404, `suite '${id}' not found`);
		return suite;
	}

	async #evaluate(variant: VariantRow, raw: unknown): Promise<{ jobName: string; pid: number }> {
		const body = expectObject(raw, "evaluate");
		rejectUnknownKeys(body, ["suiteId", "jobName", "concurrency"], "evaluate");
		const suiteId = requiredString(body, "suiteId", "evaluate");
		const suite = await this.#suites.get(suiteId);
		if (!suite) throw new EvoHttpError(404, `suite '${suiteId}' not found`);
		const jobName =
			optionalString(body, "jobName", "evaluate") ??
			`evo-${variant.id}-${suite.manifest.id}-${Date.now().toString(36)}`;
		if (!/^[A-Za-z0-9][A-Za-z0-9_.]*(-[A-Za-z0-9_.]+)*$/.test(jobName)) {
			throw badRequest("evaluate.jobName must be a single path-safe token of [A-Za-z0-9_.-]");
		}
		const request = await buildEvalLaunch({
			jobsDir: this.#jobsDir,
			variant,
			suite,
			jobName,
			concurrency: optionalPositiveInt(body, "concurrency", "evaluate"),
			defaults: this.#defaults,
		});
		return this.#launch(request);
	}

	/** Condition identity recorded when the run was launched; unrecorded fields make a delta meaningless. */
	#identity(run: RunRow, variant: VariantRow): ConditionIdentity {
		const cfg = run.config;
		const suiteHash = str(cfg.suiteHash);
		const executorConfigHash = str(cfg.executorConfigHash);
		const modelsYamlHash = str(cfg.modelsYamlHash);
		const model = str(cfg.model);
		if (!run.suiteId || !suiteHash || !executorConfigHash || !modelsYamlHash || !model) {
			throw new EvoHttpError(409, `run '${run.jobName}' did not record its evaluation conditions`);
		}
		return {
			suiteId: run.suiteId,
			suiteHash,
			model,
			executorConfigHash,
			modelsYamlHash,
			sourceRef: variant.sourceRef,
			sourceDirtyHash: variant.sourceDirtyHash,
		};
	}

	async #evaluated(variant: VariantRow, suite: StoredSuite): Promise<Evaluated> {
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
		const suite = await this.#suite(url);
		const baselineVariant = await this.#baseline(variant, url);
		const child = await this.#evaluated(variant, suite);
		const baseline = await this.#evaluated(baselineVariant, suite);
		assertMatched(child.identity, baseline.identity);
		return { child, baseline, baselineVariant, report: compareFitness(child.report, baseline.report, variant) };
	}

	async #compare(variant: VariantRow, url: URL): Promise<ComparisonReport> {
		return (await this.#compareEvaluated(variant, url)).report;
	}

	async #bundle(variant: VariantRow, url: URL): Promise<unknown> {
		const suite = await this.#suite(url);
		const parentId = url.searchParams.get("baseline") ?? variant.parentId;
		if (!parentId) {
			const child = await this.#evaluated(variant, suite);
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
}

/** Default source checkout shared by config-first variants. */
export function defaultSourceRoot(): string {
	return path.resolve(import.meta.dir, "..", "..", "..", "..");
}
