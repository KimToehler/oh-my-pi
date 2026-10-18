/** Request-boundary parsing for the evo REST surface: strict shapes with exact error strings. */
import { isRecord } from "@oh-my-pi/pi-utils/type-guards";

/** Error carrying the HTTP status (and extra JSON fields) the evo routes should answer with. */
export class EvoHttpError extends Error {
	readonly status: number;
	readonly body: Record<string, unknown>;
	constructor(status: number, message: string, body: Record<string, unknown> = {}) {
		super(message);
		this.name = "EvoHttpError";
		this.status = status;
		this.body = body;
	}
}

export function badRequest(message: string): EvoHttpError {
	return new EvoHttpError(400, message);
}

export function expectObject(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) throw badRequest(`${label} must be a JSON object`);
	return value;
}

export function rejectUnknownKeys(obj: Record<string, unknown>, allowed: readonly string[], label: string): void {
	for (const key of Object.keys(obj)) {
		if (!allowed.includes(key)) throw badRequest(`${label}: unknown field '${key}'`);
	}
}

export function requiredString(obj: Record<string, unknown>, key: string, label: string): string {
	const value = obj[key];
	if (typeof value !== "string" || value.trim() === "") throw badRequest(`${label}.${key} must be a non-empty string`);
	return value;
}

export function optionalString(obj: Record<string, unknown>, key: string, label: string): string | null {
	const value = obj[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== "string" || value.trim() === "") throw badRequest(`${label}.${key} must be a non-empty string`);
	return value;
}

export function optionalPositiveInt(obj: Record<string, unknown>, key: string, label: string): number | null {
	const value = obj[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
		throw badRequest(`${label}.${key} must be a positive integer`);
	}
	return value;
}

export function stringArray(
	obj: Record<string, unknown>,
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): string[] | null {
	const value = obj[key];
	if (value === undefined || value === null) {
		if (opts.required) throw badRequest(`${label}.${key} must be an array of non-empty strings`);
		return null;
	}
	if (!Array.isArray(value) || value.some(item => typeof item !== "string" || item.trim() === "")) {
		throw badRequest(`${label}.${key} must be an array of non-empty strings`);
	}
	return value as string[];
}

export function enumValue<T extends string>(
	obj: Record<string, unknown>,
	key: string,
	label: string,
	allowed: readonly T[],
): T {
	const value = obj[key];
	if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
		throw badRequest(`${label}.${key} must be one of ${allowed.join("|")}`);
	}
	return value as T;
}

/** Largest accepted JSON request body. */
export const MAX_BODY_BYTES = 1024 * 1024;

/** Read a JSON body with a hard byte cap, streaming so an oversized body is never buffered whole. */
export async function readJsonBody(request: Request, limit = MAX_BODY_BYTES): Promise<unknown> {
	const tooLarge = (): EvoHttpError => new EvoHttpError(413, `request body exceeds ${limit} bytes`);
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > limit) throw tooLarge();
	const chunks: Uint8Array[] = [];
	let total = 0;
	if (request.body) {
		const reader = request.body.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				total += value.byteLength;
				if (total > limit) {
					await reader.cancel().catch(() => {});
					throw tooLarge();
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		throw badRequest("request body must be valid JSON");
	}
}
