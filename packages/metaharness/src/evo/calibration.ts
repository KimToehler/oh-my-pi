/** RED/GREEN calibration evidence for generated tasks, bound to the task's bytes. */
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const META_FILE = "evo-task.json";
export const CALIBRATION_FILE = "calibration.json";

/** Where the RED/GREEN outcomes were measured: the task's generated image under the verifier's network policy. */
export interface CalibrationEnvironment {
	mode: "container";
	runtime: string;
	image: string;
	verifierNetwork: string;
}

export interface CalibrationRecord {
	before: number;
	after: number;
	environment: CalibrationEnvironment;
	taskHash: string;
	verifiedAt: string;
}

/** sha256 over every file of a task directory (relative path, exec bit, bytes), excluding calibration.json. */
export async function hashTaskDir(taskDir: string): Promise<string> {
	const names = (await fs.readdir(taskDir, { recursive: true })).map(p => p.toString()).sort();
	const hasher = new Bun.CryptoHasher("sha256");
	for (const rel of names) {
		if (rel === CALIBRATION_FILE) continue;
		const abs = path.join(taskDir, rel);
		const st = await fs.lstat(abs);
		if (st.isDirectory()) continue;
		const body = st.isSymbolicLink()
			? `link:${await fs.readlink(abs)}`
			: `file:${st.mode & 0o111 ? "x" : "-"}:${new Bun.CryptoHasher("sha256").update(await Bun.file(abs).bytes()).digest("hex")}`;
		hasher.update(`${JSON.stringify(rel)}\0${body}\0`);
	}
	return hasher.digest("hex");
}
