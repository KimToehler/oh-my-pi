/** Maps (variant, suite) to a fully specified harbor LaunchRequest: every matched field comes from the suite. */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import type { LaunchRequest } from "../launch-args";
import { EvoHttpError } from "./boundary";
import { referencedEnvNamesFromText } from "./models-yaml";
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
	// Validate even with an explicit forward list: the file is what the container receives.
	let modelsText: string;
	try {
		modelsText = await Bun.file(defaults.modelsYaml).text();
	} catch {
		throw new EvoHttpError(422, `models file not readable: ${defaults.modelsYaml}`);
	}
	const referenced = referencedEnvNamesFromText(modelsText);
	const explicit = defaults.forwardEnv ?? [];
	// An explicit list must cover every variable the models file references; extras are allowed.
	const unforwarded = referenced.filter(name => !explicit.includes(name));
	if (defaults.forwardEnv !== null && unforwarded.length > 0) {
		throw new EvoHttpError(
			422,
			`forwarded env is missing variables referenced by models.yml: ${unforwarded.join(", ")}`,
		);
	}
	const names = [...new Set([...referenced, ...explicit])].sort();
	const missing = names.filter(name => process.env[name] === undefined);
	if (missing.length > 0)
		throw new EvoHttpError(422, `host env not set for forwarded variables: ${missing.join(", ")}`);
	// Content-addressed snapshot: later edits to the host file cannot change what this run (or its identity) used.
	const modelsYamlHash = new Bun.CryptoHasher("sha256").update(modelsText).digest("hex");
	const snapshot = path.join(input.jobsDir, "_evo", "models", `${modelsYamlHash}.yml`);
	if (!fs.existsSync(snapshot)) {
		await fsp.mkdir(path.dirname(snapshot), { recursive: true });
		// Temp + rename: readers never see a partial file; racing writers publish byte-identical content.
		const tmp = path.join(path.dirname(snapshot), `.${modelsYamlHash}.${crypto.randomUUID()}.tmp`);
		try {
			await Bun.write(tmp, modelsText);
			await fsp.chmod(tmp, 0o444);
			await fsp.rename(tmp, snapshot);
		} catch (err) {
			await fsp.rm(tmp, { force: true }).catch(() => {});
			throw err;
		}
	}
	// A reuse hit is trusted only after its bytes hash back to the recorded identity.
	const publishedHash = new Bun.CryptoHasher("sha256").update(await fsp.readFile(snapshot)).digest("hex");
	if (publishedHash !== modelsYamlHash) {
		throw new EvoHttpError(
			422,
			`models snapshot ${snapshot} no longer matches its recorded sha256 ${modelsYamlHash}`,
		);
	}
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
		modelsYaml: snapshot,
		modelsYamlHash,
		noGateway: true,
		envNames: names,
		role: "variant",
	};
}
