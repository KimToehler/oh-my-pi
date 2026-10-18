/** Shared path-boundary validation: filesystem paths that reach mounts, argv, or YAML must be plain text. */
import { badRequest, optionalString } from "./boundary";

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the purpose
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Throws a stable error when `value` contains NUL or any other control character (newline included). */
export function assertPlainPath(label: string, value: string): string {
	if (CONTROL.test(value)) throw new Error(`${label} must not contain NUL or control characters`);
	return value;
}

/** Optional request-body path field; control characters are a 400 before anything is persisted. */
export function optionalPlainPath(obj: Record<string, unknown>, key: string): string | null {
	const value = optionalString(obj, key, "variant");
	if (value === null) return null;
	try {
		return assertPlainPath(`variant.${key}`, value);
	} catch (err) {
		throw badRequest((err as Error).message);
	}
}
