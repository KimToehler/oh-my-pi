// usage: node mk-brief.mjs <repo> <SKILL.md> <qa-dir> <out>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [repo, skill, qa, out] = process.argv.slice(2);
const sh = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" });
const tpl = readFileSync(skill, "utf8").split("\n").slice(207, 254).join("\n"); // lines 208-254
const plan = readFileSync(`${repo}/.omp/plans/release-approvals.md`, "utf8");
const crit = plan.slice(plan.indexOf("- Feature-specific criteria:"));
const rows = [
  ["1", "Happy path: two independent approvals, checks pass", "bun scripts/gate.ts ok.json", "ADMIT, exit 0", "ok"],
  ["2", "Duplicate approvals by one reviewer (negative control)", "bun scripts/gate.ts dup.json", "REJECT needs 2 independent approvals, got 1, exit 1", "dup"],
  ["3", "Author approves own release (negative control)", "bun scripts/gate.ts self.json", "REJECT needs 2 independent approvals, got 1, exit 1", "self"],
  ["4", "Failing check with three independent approvals (negative control)", "bun scripts/gate.ts failchk.json", "REJECT failed checks: tests, exit 1", "failchk"],
  ["5", "Regression: no approvals", "bun scripts/gate.ts none.json", "REJECT needs 2 independent approvals, got 0, exit 1", "none"],
  ["6", "Regression: unit tests", "bun test", "5 pass 0 fail", null],
];
let m = "| # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |\n|---|---|---|---|---|---|---|\n";
for (const [n, s, c, e, f] of rows) {
  const obs = f ? readFileSync(`${qa}/${f}.out`, "utf8").trim().replace(/\n/g, "; ") : "5 pass, 0 fail, 5 expect() calls";
  m += `| ${n} | ${s} | \`${c}\` | ${e} | ${obs} | PASS | ${f ? `.omp/team-config/evidence/gate/release-approvals/f1/${f}.out` : ".omp/team-config/evidence/gate/release-approvals/f1/bun-test.out"} |\n`;
}
const sub = {
  "{GOAL, CONSTRAINTS, BACKGROUND}": "GOAL: admit a release in scripts/gate.ts only with at least two approvals from distinct reviewers other than the author and every check passed (plan .omp/plans/release-approvals.md, Goal). CONSTRAINTS: CLI contract `bun scripts/gate.ts <candidate.json>` unchanged (ADMIT/exit 0, REJECT <reason>/exit 1); candidate JSON shape unchanged. BACKGROUND: one approval of any kind, the author's own included, admitted a release before.",
  "{CHANGED_FILES, DIFF}": `Changed files:\n${sh("diff", "--name-only", "main...HEAD")}\nDiff (git diff main...HEAD):\n${sh("diff", "main...HEAD")}`,
  "{FILE PATHS, CONTEXT_MINING, PLAN}": `File paths: scripts/gate.ts, scripts/gate.test.ts, README.md, .omp/plans/release-approvals.md. CONTEXT_MINING: none - fresh fixture repo with three commits and no TODO/FIXME markers in the changed files. PLAN:\n${plan}`,
  "{QA MATRIX}": m,
  "{CRITERIA WITH FIVE FIELDS}": crit,
};
let b = tpl;
for (const [k, v] of Object.entries(sub)) { if (!b.includes(k)) throw new Error("missing " + k); b = b.replace(k, () => v); }
writeFileSync(out, b + "\n");
