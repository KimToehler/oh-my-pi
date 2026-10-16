export interface TaskMeta {
	base: string;
	fix: string;
	testFiles: string[];
	solutionFiles: string[];
	deletedFiles: string[];
}

export interface VerifyResult {
	before: number;
	after: number;
}

const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function fail(message: string): never {
	throw new Error(message);
}

export interface RunResult {
	code: number;
	err: string;
}

export async function run(cmd: string[], env: Record<string, string> = {}): Promise<RunResult> {
	const proc = Bun.spawn(cmd, { env: { ...Bun.env, ...env }, stdout: "ignore", stderr: "pipe" });
	const [err, code] = await Promise.all([proc.stderr.text(), proc.exited]);
	return { code, err };
}

/** Repo-relative path must be plain, forward-slash, non-escaping, free of control characters. */
export function assertSafeRelPath(rel: string, label: string): void {
	if (rel.length === 0) fail(`${label}: empty path`);
	if (CONTROL_RE.test(rel)) fail(`${label}: control character in path ${JSON.stringify(rel)}`);
	if (rel.startsWith("/") || /^[A-Za-z]:/.test(rel) || rel.includes("\\")) fail(`${label}: absolute path ${rel}`);
	if (rel.split("/").some(seg => seg === ".." || seg === "")) fail(`${label}: traversal path ${rel}`);
}

export function assertSafeRef(ref: string): void {
	if (ref.length === 0 || ref.startsWith("-") || CONTROL_RE.test(ref)) fail(`invalid ref ${JSON.stringify(ref)}`);
}
