/** `/api/evo/*` request handling: variants, suites, evaluation, fitness, compare, reflection bundle. */
import * as path from "node:path";
import type { LaunchRequest } from "../launch-args";
import type { RunStore } from "../store";
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
import { assertRequestClean, forwardedSecretValues } from "./credential-scan";
import { buildEvalLaunch, type EvoLaunchDefaults } from "./launch";
import { EvoReports } from "./service-reports";
import { SuiteRegistry } from "./suites";
import type { VariantRow } from "./variant-types";
import { parseVariantRequest, VariantRegistry } from "./variants";

export interface EvoServiceOptions {
	store: RunStore;
	jobsDir: string;
	/** Root of the default source checkout (config-first variants share it). */
	sourceRoot: string;
	defaults: EvoLaunchDefaults;
	/** Spawn a harbor launch; provided by the manager server. */
	launch(request: LaunchRequest): { jobName: string; pid: number };
}

export class EvoService {
	readonly #store: RunStore;
	readonly #jobsDir: string;
	readonly #launch: EvoServiceOptions["launch"];
	readonly #defaults: EvoLaunchDefaults;
	readonly #variants: VariantRegistry;
	readonly #suites: SuiteRegistry;
	readonly #reports: EvoReports;
	readonly #secretValues: () => readonly string[];

	constructor(opts: EvoServiceOptions) {
		this.#store = opts.store;
		this.#jobsDir = opts.jobsDir;
		this.#launch = opts.launch;
		this.#defaults = opts.defaults;
		this.#secretValues = () => forwardedSecretValues(opts.defaults);
		this.#variants = new VariantRegistry(
			opts.store.evo,
			opts.jobsDir,
			opts.sourceRoot,
			undefined,
			this.#secretValues,
		);
		this.#suites = new SuiteRegistry(opts.jobsDir, this.#secretValues);
		this.#reports = new EvoReports(opts.store, opts.jobsDir, this.#suites);
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

	/** The single decode point for every `/api/evo` body: scanned against forwarded credential values before use. */
	async #body(request: Request): Promise<unknown> {
		const body = await readJsonBody(request);
		assertRequestClean(body, this.#secretValues());
		return body;
	}

	async #route(request: Request, url: URL, p: string): Promise<Response> {
		const method = request.method;
		if (p === "/api/evo/variants") {
			if (method === "GET") return Response.json(this.#store.evo.listVariants());
			if (method === "POST") {
				const result = await this.#variants.register(parseVariantRequest(await this.#body(request)));
				return Response.json(
					{ ...result, outcome: result.proposal.outcome },
					{ status: result.created ? 201 : 200 },
				);
			}
		}
		if (p === "/api/evo/suites") {
			if (method === "GET") return Response.json(await this.#suites.list());
			if (method === "POST") {
				const { suite, created } = await this.#suites.register(await this.#body(request));
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
				return Response.json(await this.#evaluate(variant, await this.#body(request)), { status: 201 });
			case "fitness":
				if (method !== "GET") break;
				return Response.json(await this.#reports.fitness(variant, url));
			case "compare":
				if (method !== "GET") break;
				return Response.json(await this.#reports.compare(variant, url));
			case "reflection-bundle":
				if (method !== "GET") break;
				return Response.json(await this.#reports.bundle(variant, url));
		}
		return Response.json({ error: "method not allowed" }, { status: 405 });
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
		const duplicate = () =>
			new EvoHttpError(409, `job '${jobName}' already exists; evaluate always starts a new run`);
		// Fast rejection only; the re-check below is the correctness boundary.
		if (this.#store.getRun(jobName)) throw duplicate();
		const request = await buildEvalLaunch({
			jobsDir: this.#jobsDir,
			variant,
			suite,
			jobName,
			concurrency: optionalPositiveInt(body, "concurrency", "evaluate"),
			defaults: this.#defaults,
		});
		// buildEvalLaunch yields, so re-check. From here through launch's registerLaunch nothing yields,
		// so no same-process request can interleave between this check and the run row.
		if (this.#store.getRun(jobName)) throw duplicate();
		return this.#launch(request);
	}
}

/** Default source checkout shared by config-first variants. */
export function defaultSourceRoot(): string {
	return path.resolve(import.meta.dir, "..", "..", "..", "..");
}
