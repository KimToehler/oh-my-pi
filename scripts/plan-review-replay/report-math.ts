import type { Ratio } from "./report-types";

export function cmp(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function sortedBy<T>(rows: readonly T[], key: (row: T) => string): readonly T[] {
	return [...rows].sort((x, y) => cmp(key(x), key(y)));
}

export function unique(values: Iterable<string>): readonly string[] {
	return [...new Set(values)].sort(cmp);
}

export function sum(values: readonly number[]): number {
	let total = 0;
	for (const v of values) total += v;
	return total;
}

export function ratio(numerator: number, denominator: number, zeroReason: string): Ratio {
	if (denominator === 0) return { numerator, denominator, value: null, reason: zeroReason };
	return { numerator, denominator, value: numerator / denominator, reason: null };
}

export function unavailable(reason: string): Ratio {
	return { numerator: 0, denominator: 0, value: null, reason };
}
