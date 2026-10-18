/** Maps (variant, suite) to a fully specified harbor LaunchRequest: every matched field comes from the suite. */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { credentialValuesFromEnv, type LaunchRequest } from "../launch-args";
import { EvoHttpError } from "./boundary";
import { assertNoHostCredentialValues, referencedEnvNamesFromText } from "./models-yaml";
import { assertJobsDirOutsideSource } from "./jobs-dir-guard";
import { canonicalStagedModelsHash } from "./proxy-models";
import { executorConfigHash, mergeOverlayConfig } from "./overlay";
import { formatSourceIdentity } from "./source-identity";
import { assertSourceClean } from "./source-stage";
import { stageRunData } from "./run-data";
import { suiteTaskHash } from "./suite-tasks";
import type { StoredSuite } from "./suites";
import { assertVariantSnapshotIntact, assertWorktreeOwned, isSourceVariant, variantConfigDir } from "./variants";
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
	| "variantId"
	| "agentDir"
	| "agentDirHash"
	| "sourceRoot"
	| "sourceIdentity"
	| "stagedConfigHash"
	| "executorConfigHash"
>;

export function variantLaunchFields(
	jobsDir: string,
	variant: VariantRow,
	executor: { model: string; thinking: string },
	defaultSourceRoot: string,
): VariantLaunchFields {
	const configDir = variantConfigDir(jobsDir, variant.id);
	const sourceVariant = isSourceVariant(jobsDir, variant);
	if (sourceVariant) {
		try {
			assertWorktreeOwned(jobsDir, variant.snapshotPath, `variant '${variant.id}' source worktree`);
		} catch (err) {
			throw new EvoHttpError(422, err instanceof Error ? err.message : String(err));
		}
	}
	// Every variant launch (evaluate, arm swap) funnels through here: verify before any config byte is read for staging.
	assertVariantSnapshotIntact(jobsDir, variant);
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
		agentDirHash: variant.configHash,
		// Config-first variants were registered against the service default root; launch must name that same root.
		sourceRoot: sourceVariant ? variant.snapshotPath : defaultSourceRoot,
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
	/** Suite policy owns evaluation concurrency; callers cannot select it. */
	defaults: EvoLaunchDefaults;
	/** Source root config-first variants were registered against. */
	sourceRoot: string;
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
	// `names` is the full referenced ∪ explicit union: an explicitly forwarded extra is as secret as a referenced one.
	// No copy of the text may be written while an unvalidated scalar still carries a host credential.
	const hostValues = credentialValuesFromEnv(names, process.env);
	assertNoHostCredentialValues(modelsText, hostValues);
	// Launch-time integrity: stage a RUN-OWNED copy and verify the copy's bytes, so the path Harbor opens is
	// private to this run and no later replacement of the shared snapshot can change what it evaluates. The verify
	// walk also scans for the CURRENT credential values; a key set or rotated after registration was never scanned for.
	const dataset = stageRunData(input.jobsDir, suite, input.jobName, hostValues);
	// The runner never sees these values (the manager strips them from its environment), so the staged source
	// tree must be scanned here, over the root this launch will stage, before anything is spawned.
	const fields = variantLaunchFields(input.jobsDir, variant, manifest, input.sourceRoot);
	try {
		assertJobsDirOutsideSource(input.jobsDir, fields.sourceRoot as string);
	} catch (err) {
		throw new EvoHttpError(422, err instanceof Error ? err.message : String(err));
	}
	// The scan holds the real values and returns the hash of exactly the bytes it scanned. That hash must be the
	// registered one; the runner then requires the staged bytes to equal the registered bytes, so staged bytes were scanned.
	const scannedHash = await assertSourceClean(fields.sourceRoot as string, hostValues);
	if (scannedHash !== variant.sourceDirtyHash) {
		throw new EvoHttpError(409, "source changed since registration; re-register the variant");
	}
	// Provider-proxy launch: the agent receives no host variable at all. Referenced credentials stay in the manager
	// (the proxy injects them); an explicitly forwarded extra has no proxy route and would reach the agent plaintext.
	const unroutable = explicit.filter(name => !referenced.includes(name));
	if (unroutable.length > 0) {
		throw new EvoHttpError(
			422,
			`provider proxy cannot route forwarded variables not referenced by models.yml: ${unroutable.join(", ")}`,
		);
	}
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
		dataset,
		include: manifest.include,
		tasks: manifest.include.length,
		attempts: manifest.attempts,
		timeoutMultiplier: manifest.timeoutMultiplier,
		thinking: manifest.thinking,
		environment: manifest.environment,
		concurrency: manifest.concurrency,
		jobName: input.jobName,
		suiteId: manifest.id,
		suiteHash: suite.hash,
		taskHash: suiteTaskHash(suite),
		...fields,
		modelsYaml: snapshot,
		modelsYamlHash,
		// Staged (proxy-rewritten) bytes modulo the runtime endpoint; see PROXY_ENDPOINT_PLACEHOLDER.
		stagedModelsHash: canonicalStagedModelsHash(modelsText),
		noGateway: true,
		providerProxy: true,
		envNames: [],
		role: "variant",
	};
}
