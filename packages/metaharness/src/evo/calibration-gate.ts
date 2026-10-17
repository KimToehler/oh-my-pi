/**
 * Calibration gate shared by local and registry suites. RED/GREEN evidence is only valid for the environment it was
 * measured in, so the record's backend must be the environment the suite manifest declares for evaluation.
 */
import * as path from "node:path";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { EvoHttpError } from "./boundary";
import { CALIBRATION_FILE, type CalibrationRecord, hashTaskDir, META_FILE } from "./calibration";

const key = (task: string): string => task.slice(task.lastIndexOf("/") + 1);

/**
 * Generated tasks (entries holding evo-task.json) must carry a calibration.json whose hash still matches the task
 * bytes, whose GREEN reward is 1, and whose recorded runtime/platform belong to the suite's declared environment.
 * Re-running calibration is not reachable from registration (it needs the runtime and the task's build context), so a
 * mismatch is refused fail-closed.
 */
export async function requireCalibratedTasks(
	root: string,
	include: readonly string[],
	environment: string,
): Promise<void> {
	for (const task of include) {
		const dir = path.join(root, key(task));
		if (!(await Bun.file(path.join(dir, META_FILE)).exists())) continue;
		let record: Partial<CalibrationRecord> | null = null;
		try {
			record = (await Bun.file(path.join(dir, CALIBRATION_FILE)).json()) as Partial<CalibrationRecord>;
		} catch (err) {
			if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
		}
		const env = record?.environment;
		if (
			!record ||
			record.before !== 0 ||
			record.after !== 1 ||
			env?.mode !== "container" ||
			env.verifierNetwork !== "no-network"
		) {
			throw new EvoHttpError(422, `task '${task}' has no successful RED/GREEN calibration; run evo-task verify`);
		}
		if (env.backend !== environment || typeof env.platform !== "string" || env.platform.length === 0) {
			throw new EvoHttpError(
				422,
				`task '${task}' was calibrated on backend '${env.backend}' via runtime '${env.runtime}' (platform '${env.platform ?? "unrecorded"}'), not the suite environment '${environment}'; re-run evo-task verify on the ${environment} backend (registration cannot re-run calibration)`,
			);
		}
		if (record.taskHash !== (await hashTaskDir(dir))) {
			throw new EvoHttpError(422, `task '${task}' changed since its calibration; re-run evo-task verify`);
		}
	}
}
