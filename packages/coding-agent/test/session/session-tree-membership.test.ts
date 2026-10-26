import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { type AgentKind, AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { findRunningSessionWork, sessionTreeMembership } from "@oh-my-pi/pi-coding-agent/session/session-move";

const ROOT = "Owner";
const base = path.resolve("/tmp/session-tree-membership");
const sessionFile = path.join(base, "current.jsonl");
const currentDir = path.join(base, "current");
const secondDir = path.join(base, "second");

interface Row {
	name: string;
	id: string;
	kind: AgentKind;
	file: string | null;
	extraDirs: string[];
	membership: "root" | "descendant" | undefined;
	listed: boolean;
}

const rows: Row[] = [
	{
		name: "the root id",
		id: ROOT,
		kind: "sub",
		file: path.join(currentDir, "Owner.jsonl"),
		extraDirs: [],
		membership: "root",
		listed: false,
	},
	{
		name: "a sub ref under the current directory",
		id: "Child",
		kind: "sub",
		file: path.join(currentDir, "Child.jsonl"),
		extraDirs: [],
		membership: "descendant",
		listed: true,
	},
	{
		name: "a sub ref under a second directory that is in the tree",
		id: "Moved",
		kind: "sub",
		file: path.join(secondDir, "Moved.jsonl"),
		extraDirs: [secondDir],
		membership: "descendant",
		listed: true,
	},
	{
		name: "a sub ref under a second directory that is not in the tree",
		id: "Moved",
		kind: "sub",
		file: path.join(secondDir, "Moved.jsonl"),
		extraDirs: [],
		membership: undefined,
		listed: false,
	},
	{
		name: "an advisor ref under the directory",
		id: "Advisor",
		kind: "advisor",
		file: path.join(currentDir, "Advisor.jsonl"),
		extraDirs: [],
		membership: undefined,
		listed: false,
	},
	{
		name: "a sub ref without a session file",
		id: "Fileless",
		kind: "sub",
		file: null,
		extraDirs: [],
		membership: undefined,
		listed: false,
	},
	{
		name: "a sub ref under a sibling directory with a shared name prefix",
		id: "Sibling",
		kind: "sub",
		file: path.join(`${currentDir}-other`, "Sibling.jsonl"),
		extraDirs: [],
		membership: undefined,
		listed: false,
	},
];

describe("session tree membership", () => {
	for (const row of rows) {
		it(`session tree membership: ${row.name}`, () => {
			const registry = new AgentRegistry();
			registry.register({
				id: row.id,
				displayName: row.id,
				kind: row.kind,
				session: null,
				sessionFile: row.file,
				status: "running",
			});
			const ref = registry.get(row.id)!;
			expect(sessionTreeMembership({ rootId: ROOT, artifactsDirs: [currentDir, ...row.extraDirs] }, ref)).toBe(
				row.membership,
			);
			const work = findRunningSessionWork({
				asyncJobManager: undefined,
				agentId: ROOT,
				sessionFile,
				extraArtifactsDirs: row.extraDirs,
				registry,
			});
			expect(work.agentIds.includes(row.id)).toBe(row.listed);
		});
	}
});
