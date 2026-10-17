/**
 * Registry task resolution stub. Importing this module installs a fetcher that serves plain (non-generated) tasks
 * for the names the suite tests include, so no test needs a real Harbor registry. `serveRegistryTasks` swaps in
 * explicit task files for one test and returns the restore function.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type RegistryTaskFetcher, setRegistryTaskFetcher } from "../src/evo/registry-tasks";

const PLAIN_TASKS = ["t1", "t2", "t3", "foo", "bar"];

function serve(tasks: Record<string, Record<string, string>>): RegistryTaskFetcher {
	return async (dataset, dest) => {
		const name = dataset.split("@")[0];
		for (const [task, files] of Object.entries(tasks)) {
			for (const [rel, text] of Object.entries(files)) {
				const file = path.join(dest, name, task, rel);
				fs.mkdirSync(path.dirname(file), { recursive: true });
				fs.writeFileSync(file, text);
			}
		}
	};
}

const plain = Object.fromEntries(
	PLAIN_TASKS.map(task => [task, { "task.toml": `name = "${task}"\n`, "environment/Dockerfile": "FROM scratch\n" }]),
);
setRegistryTaskFetcher(serve(plain));

export function serveRegistryTasks(tasks: Record<string, Record<string, string>>): () => void {
	return setRegistryTaskFetcher(serve(tasks));
}
