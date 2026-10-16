/** Maps (variant, suite) to a fully specified harbor LaunchRequest: every matched field comes from the suite. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";
import type { LaunchRequest } from "../launch-args";
import { EvoHttpError } from "./boundary";
import { executorConfigHash, mergeOverlayConfig } from "./overlay";
import { formatSourceIdentity } from "./source-identity";
import type { StoredSuite } from "./suites";
import { isSourceVariant, variantConfigDir } from "./variants";
import type { VariantRow } from "./variant-types";

export interface EvoLaunchDefaults {
	/** Fixed container-safe models.yml. */
	modelsYaml: string;
	/** Host env var names forwarded into containers; null derives them from the models file. */
	forwardEnv: string[] | null;
}

export function defaultEvoLaunch(): EvoLaunchDefaults {
	const csv = process.env.OMP_EVO_FORWARD_ENV;
	return {
		modelsYaml: process.env.OMP_EVO_MODELS_YAML ?? path.join(os.homedir(), ".omp", "evo", "models.yml"),
		forwardEnv:
			csv === undefined
				? null
				: csv
						.split(",")
						.map(name => name.trim())
						.filter(Boolean),
	};
}

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Env var names a models.yml references as `apiKey` (values are never read or stored). */
export async function referencedEnvNames(modelsYaml: string): Promise<string[]> {
	const file = Bun.file(modelsYaml);
	if (!(await file.exists())) throw new EvoHttpError(422, `models file not found: ${modelsYaml}`);
	const parsed: unknown = Bun.YAML.parse(await file.text());
	const names = new Set<string>();
	const providers = isRecord(parsed) && isRecord(parsed.providers) ? parsed.providers : {};
	for (const provider of Object.values(providers)) {
		if (isRecord(provider) && typeof provider.apiKey === "string" && ENV_NAME.test(provider.apiKey)) {
			names.add(provider.apiKey);
		}
	}
	return [...names].sort();
}

/** Launch fields derived from a variant alone (no suite): config overlay, source identity, hashes. */
export type VariantLaunchFields = Pick<
	LaunchRequest,
	"variantId" | "agentDir" | "sourceRoot" | "sourceIdentity" | "stagedConfigHash" | "executorConfigHash"
>;

export function variantLaunchFields(
	jobsDir: string,
	variant: VariantRow,
	executor: { model: string; thinking: string },
): VariantLaunchFields {
	const configDir = variantConfigDir(jobsDir, variant.id);
	const spec = { ...executor, webSearch: false, findTool: false, settings: {} };
	let yaml: string | null = null;
	try {
		yaml = fs.readFileSync(path.join(configDir, "config.yml"), "utf8");
	} catch (err) {
		if (!isEnoent(err)) throw err;
	}
	return {
		variantId: variant.id,
		agentDir: configDir,
		sourceRoot: isSourceVariant(jobsDir, variant) ? variant.snapshotPath : undefined,
		sourceIdentity: formatSourceIdentity({ ref: variant.sourceRef, dirtyHash: variant.sourceDirtyHash }),
		stagedConfigHash: new Bun.CryptoHasher("sha256").update(mergeOverlayConfig(yaml, spec)).digest("hex"),
		executorConfigHash: executorConfigHash(spec),
	};
}

export interface EvalLaunchInput {
	jobsDir: string;
	variant: VariantRow;
	suite: StoredSuite;
	jobName: string;
	concurrency: number | null;
	defaults: EvoLaunchDefaults;
}

export async function buildEvalLaunch(input: EvalLaunchInput): Promise<LaunchRequest> {
	const { variant, suite, defaults } = input;
	const manifest = suite.manifest;
	const names = defaults.forwardEnv ?? (await referencedEnvNames(defaults.modelsYaml));
	const missing = names.filter(name => process.env[name] === undefined);
	if (missing.length > 0)
		throw new EvoHttpError(422, `host env not set for forwarded variables: ${missing.join(", ")}`);
	return {
		benchmark: "harbor",
		model: manifest.model,
		dataset: manifest.dataset,
		include: manifest.include,
		tasks: manifest.include.length,
		attempts: manifest.attempts,
		timeoutMultiplier: manifest.timeoutMultiplier,
		thinking: manifest.thinking,
		environment: manifest.environment,
		concurrency: input.concurrency ?? undefined,
		jobName: input.jobName,
		suiteId: manifest.id,
		suiteHash: suite.hash,
		...variantLaunchFields(input.jobsDir, variant, manifest),
		modelsYaml: defaults.modelsYaml,
		noGateway: true,
		envNames: names,
		role: "variant",
	};
}
