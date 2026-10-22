/**
 * Matcher tests for rules/destructive-git-consent.md. The SHIPPED rule file is loaded through the same path
 * as `omp ttsr test --rule` (buildRuleFromMarkdown + TtsrManager.checkSnapshot) and fed the raw tool-argument
 * JSON a live bash/eval call produces.
 *
 * Lives outside agent/ so the installer never ships it into ~/.omp/agent. Run: bun run test:team-config
 */
import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { buildRuleFromMarkdown, createSourceMeta } from "../../packages/coding-agent/src/discovery/helpers";
import { TtsrManager } from "../../packages/coding-agent/src/export/ttsr";

const RULE_PATH = path.resolve(import.meta.dir, "../agent/rules/destructive-git-consent.md");
const ruleText = await Bun.file(RULE_PATH).text();

function triggers(tool: "bash" | "eval", snippet: string): boolean {
	const rule = buildRuleFromMarkdown(
		"destructive-git-consent",
		ruleText,
		RULE_PATH,
		createSourceMeta("ttsr-cli", RULE_PATH, "project"),
		{ ruleName: "destructive-git-consent" },
	);
	const manager = new TtsrManager({
		enabled: true,
		contextMode: "discard",
		interruptMode: "always",
		repeatMode: "once",
		repeatGap: 10,
		builtinRules: true,
		disabledRules: [],
	});
	if (!manager.addRule(rule)) throw new Error("rule has no usable TTSR condition");
	return manager.checkSnapshot(snippet, { source: "tool", toolName: tool }).length > 0;
}

const bash = (command: string) => JSON.stringify({ command });
const evalArgs = (code: string) => JSON.stringify({ code });

const BASH_MUST_TRIGGER = [
	"git reset --hard",
	"git -C /repo reset --hard HEAD~1",
	"git -c core.x=y clean -fdx",
	"git --git-dir=/r/.git --work-tree=/r checkout -- src/a.ts",
	"git restore src/a.ts",
	"git stash",
	"git switch main",
	"git push --force-with-lease",
	"git push -f origin main",
	"git push origin +main",
	"git rebase -i HEAD~3",
	"git commit --amend",
	"git filter-repo --path x",
	"cd /r && git reset --hard",
];

const EVAL_MUST_TRIGGER = [
	'subprocess.run(["git", "reset", "--hard"])',
	`await $\`git -C \${dir} clean -fd\``,
	"!git checkout -- .",
];

const BASH_MUST_NOT_TRIGGER = [
	"git status",
	"git diff --stat",
	"git log --oneline -5",
	"git add src/a.ts",
	'git commit -m "reset docs"',
	"git push origin main",
	"git push origin feat/force-fields",
	"git branch -f topic main",
	"git reset --soft HEAD~1",
	"git reset src/a.ts",
	"git stash list",
	"git stash show",
	"git worktree add .worktrees/x -b x main",
	"grep -rn 'git reset' docs/",
];

describe("destructive-git-consent matcher", () => {
	describe("bash: must trigger", () => {
		it.each(BASH_MUST_TRIGGER)("%s", command => {
			expect(triggers("bash", bash(command))).toBe(true);
		});
	});
	describe("eval: must trigger", () => {
		it.each(EVAL_MUST_TRIGGER)("%s", code => {
			expect(triggers("eval", evalArgs(code))).toBe(true);
		});
	});
	describe("bash: must not trigger", () => {
		it.each(BASH_MUST_NOT_TRIGGER)("%s", command => {
			expect(triggers("bash", bash(command))).toBe(false);
		});
	});
});
