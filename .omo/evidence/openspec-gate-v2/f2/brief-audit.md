Local implementation audit. No PR lookup, remote fetch, file write, or sub-reviewer dispatch.

Inputs:
- Goal, constraints, and behavioural contract: P4b v2: OpenSpec change folders as merge-gate plans under the merged Risk tier (see plan). Branch feat/openspec-folder-gate-v2, worktree /Users/tim/git/oh-my-pi/.worktrees/openspec-gate-v2, range main(13b1616345d3c3c03cc6ba44a1cc9149282411be)..37dd1f1a84a70b464bb80dc76b9a7adce73ccb63. Implementation models: Claude (onara/cc/claude-opus-5-5 orchestrator, onara/cc/claude-sonnet-5-5 task subagent).
- Changed files and reviewed diff: A	.omo/plans/openspec-gate.md
M	openspec/schemas/omp-gated/schema.yaml
M	openspec/schemas/omp-gated/templates/gate.md
M	team-config/README.md
M	team-config/agent/rules/merge-gate-proof.md
M	team-config/agent/rules/plan-merge-gate.md
M	team-config/agent/skills/review-work/SKILL.md
A	team-config/agent/skills/review-work/scripts/folder-plan.mjs
M	team-config/agent/skills/review-work/scripts/gate-convergence.mjs
M	team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
M	team-config/agent/skills/review-work/scripts/plan-contract.mjs
M	team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
M	team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
M	team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs
M	team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts


```diff
diff --git a/openspec/schemas/omp-gated/schema.yaml b/openspec/schemas/omp-gated/schema.yaml
index 1e94ef331d..3abae33bf4 100644
--- a/openspec/schemas/omp-gated/schema.yaml
+++ b/openspec/schemas/omp-gated/schema.yaml
@@ -205,17 +205,25 @@ artifacts:
 
   - id: gate
     generates: gate.md
-    description: Risk classification and review tier for merge enforcement
+    description: Risk classification for merge enforcement
     template: gate.md
     instruction: |
       Classify the change; do not duplicate requirements or implementation tasks.
+      gate.md is the change's merge-gate section: the gate reads these bullets exactly as it reads a plan's.
 
       Keep every bullet exactly once and replace every placeholder:
-      - **Mandatory class**: one of `none`, `auth-secrets-pii`, `schema-migration`, `wire-contract-api`, `concurrency-state`; classify from consequence and a real trust, process or release boundary. `wire-contract-api` means a supported contract consumed outside the changed package/process or independently released surface; an internal exported symbol alone is `none`. `none` MUST carry a concrete reason.
-      - **Review tier**: `full` for every mandatory class other than `none`; otherwise `standard` unless realistic damage reaches production data, real credentials, tenant isolation, money, audit history or irreversible state.
-      - **Whole-diff review**: `needed` when the change spans at least three independently testable modules/layers; otherwise `not needed` with a reason.
-      - **Accepted residual risks**: concrete risks, or `none` with a reason.
-      - **Out of scope for blocking**: concrete areas whose findings become follow-ups, or `none` with a reason.
+      - **Mandatory class**: exactly one of `none`, `auth-secrets-pii`, `schema-migration`, `wire-contract-api`, `concurrency-state`, with no reason; classify from consequence and a real trust, process or release boundary. `wire-contract-api` means a supported contract consumed outside the changed package/process or independently released surface; an internal exported symbol alone is `none`. A class other than `none` runs both reviewers.
+      - **Risk tier**: `product` (the default) or `internal-tooling`. `internal-tooling` is for dev, CI and proof tooling that reaches no protected asset (production data, real credentials, tenant isolation, money, audit history, irreversible state) and needs class `none`; it runs one reviewer and caps fix rounds. Never write `Review tier`.
+      - **Author's risk assessment**: what could break and how badly, and why the tier and class fit.
+      - **Whole-diff review**: `needed` when the change spans at least three independently testable modules/layers; otherwise `not needed (<reason>)`.
+      - **Accepted residual risks**: concrete risks, or `none (<reason>)`.
+      - **Out of scope for blocking**: concrete areas whose findings become follow-ups, or `none (<reason>)`.
+
+      Review criteria come from the `### Requirement:` blocks of the specs. When `.openspec.yaml` sets
+      `skip_specs: true` or the specs hold no `### Requirement:` (rename-only), uncomment the criteria
+      example at the end of the template and fill it: one `- Feature-specific criteria:` bullet with each
+      criterion nested below it (`  - Invariant:` with `Positive witness`, `Negative control`, `Observable`
+      and `Boundary` indented under it), all with concrete values.
 
       Never accept a risk that contradicts a requirement or its scenarios.
     requires:
diff --git a/openspec/schemas/omp-gated/templates/gate.md b/openspec/schemas/omp-gated/templates/gate.md
index 03d06f4c04..26df872089 100644
--- a/openspec/schemas/omp-gated/templates/gate.md
+++ b/openspec/schemas/omp-gated/templates/gate.md
@@ -1,7 +1,20 @@
 # Gate
 
-- **Mandatory class**: none (<concrete reason>)
-- **Review tier**: standard
+- **Mandatory class**: none
+- **Risk tier**: product
+- **Author's risk assessment**: <what could break, and how badly>
 - **Whole-diff review**: not needed (<concrete reason>)
 - **Accepted residual risks**: none (<concrete reason>)
 - **Out of scope for blocking**: none (<concrete reason>)
+
+<!--
+Only when the change has no requirements (skip_specs true or rename-only deltas): uncomment this block and replace
+every angle-bracket placeholder with concrete text. Requirements in specs/ are the review criteria otherwise.
+
+- Feature-specific criteria:
+  - Invariant: <property that must hold>
+    Positive witness: <observation proving expected behaviour>
+    Negative control: <plausible broken outcome that MUST fail>
+    Observable: <measured output>
+    Boundary: <real contract surface where it is checked>
+-->
diff --git a/team-config/README.md b/team-config/README.md
index dc75741907..90594dcab2 100644
--- a/team-config/README.md
+++ b/team-config/README.md
@@ -166,10 +166,14 @@ node ~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs opensp
 
 The team validator enforces the proposal sections (`## Why`, `## What Changes` and `## Impact` with content outside HTML
 comments, and `## Capabilities` without template placeholders; its subsections may stay empty), the `Negative control`
-scenario for every requirement block, exact gate classification, and a numbered task with exactly one `Verify:` command for
+scenario for every requirement block, the `gate.md` fields (exactly one `Mandatory class` token, `Risk tier` `product` or
+`internal-tooling` with the same rules as a plan's, `Author's risk assessment`, `Whole-diff review` and both abort
+fields), and a numbered task with exactly one `Verify:` command for
 every tracked checkbox (any marker OpenSpec counts, e.g. `[~]`). A change with no behavioural delta must declare
 `skip_specs: true` in `.openspec.yaml` and then has no
-Markdown specs. Once `skip_specs` appears there, the whole file must be flat top-level `key: value` lines with plain values and
+Markdown specs; a change without requirements (`skip_specs`, rename-only) must carry a `- Feature-specific criteria:`
+block in `gate.md` (the template ends with a commented example), because the gate takes its review criteria from the
+requirements otherwise. Once `skip_specs` appears there, the whole file must be flat top-level `key: value` lines with plain values and
 no repeated key, and `skip_specs` must be exactly `true` or `false`; anything else is rejected. A rename-only delta needs no
 scenarios. OpenSpec's own strict validator does not enforce project rules from
 `openspec/config.yaml`. `DO_NOT_TRACK=1` or `OPENSPEC_TELEMETRY=0` is the environment equivalent of the persisted
diff --git a/team-config/agent/rules/merge-gate-proof.md b/team-config/agent/rules/merge-gate-proof.md
index d954dcfd82..16c93bf17c 100644
--- a/team-config/agent/rules/merge-gate-proof.md
+++ b/team-config/agent/rules/merge-gate-proof.md
@@ -36,6 +36,7 @@ Only passed, overridden and legitimately skipped lines allow a merge request. If
 
 - integration-review: whole diff read, every failure mode named with an instance or "no instance found", simplification pass, plan scope walk, the reviewer dispatched with the skill's verbatim brief, a stored report, one cleanup commit for applied fixes, and a delta round after fixes. A reviewer asked "is this good?" is not the skill.
 - review-work: plan frozen first (F2 `[x]`, then `plan_sha256`), each reviewer dispatched with the skill's verbatim brief, its `REVIEW-TRAILER-v1` stored unedited at a tracked path, the `omo.merge-gate/v2` record written and staged, the validator exiting 0, re-run after the record commit.
+- For an OpenSpec change folder the plan is the folder: `plan_sha256` is the digest of the bundle `GC snapshot` writes as the wave's plan copy, and the record's `mandatory_class` and `whole_diff` equal `gate.md`.
 
 Order: integration-review, fixes, review-work. Code committed after review-work's `reviewed_sha` voids it; code committed after integration-review's last reviewed SHA needs a delta round over `<last reviewed>...<head>`.
 
diff --git a/team-config/agent/rules/plan-merge-gate.md b/team-config/agent/rules/plan-merge-gate.md
index 4f4f5f323a..4b18cd73b7 100644
--- a/team-config/agent/rules/plan-merge-gate.md
+++ b/team-config/agent/rules/plan-merge-gate.md
@@ -79,3 +79,7 @@ direct-commit exception) skip both sections and carry this one line instead:
 `- Merge gate: not applicable (<reason>)`. It counts only as a top-level bullet outside code fences
 and HTML comments; quoting it inside a fence or nesting it under another bullet does not opt out.
 A plan MUST NOT carry both the opt-out and feature-specific criteria.
+
+## OpenSpec change folders
+
+An OpenSpec change folder is a plan when `--plan` names the directory: its `gate.md` is the `## Merge gate` section (`Risk tier`, `Mandatory class`, `Author's risk assessment`, `Whole-diff review`, the abort fields), its specs' `### Requirement:` blocks are the criteria (a change without requirements adds a `- Feature-specific criteria:` block to `gate.md`), and `plan_sha256` is the digest of the folder's bundle.
diff --git a/team-config/agent/skills/review-work/SKILL.md b/team-config/agent/skills/review-work/SKILL.md
index 1c025cf823..2f8e6fd7f5 100644
--- a/team-config/agent/skills/review-work/SKILL.md
+++ b/team-config/agent/skills/review-work/SKILL.md
@@ -358,6 +358,8 @@ The plan is bound by **content**, not just by path: `plan_sha256` is the digest
 
 The plan must already be in its final state, including its own merge-gate checkbox (final verification wave F2) marked `[x]`, at the moment reviewers are dispatched and this digest is taken - no plan edit may follow. `plan_sha256` binds whatever bytes existed at hash time, so hashing before that mark would seal an unfrozen plan and let the gate's own required output invalidate its own binding.
 
+**OpenSpec change folders.** A `--plan` that is a directory holding `gate.md` is a folder plan: Phase 0.6 runs `--plan-only --plan <change-dir>`, and the folder obeys the file-plan rules (Risk tier, Mandatory class, the one-auditor rule, the fix-round cap) with `gate.md` as the `## Merge gate` section. `validate-gate-record.mjs` and `GC` read the folder once, through a snapshot that opens each file `O_NOFOLLOW` and refuses symlinks, FIFOs and any file above 1 MiB. That one snapshot feeds the OpenSpec checks (`validate-openspec-change.mjs`'s rules), the criteria and the bundle: a manifest of `<sha256>  <path>` lines sorted by path, then each file under a `===== <path> =====` line. `plan_sha256` is the sha256 of the bundle, so it is not `shasum` of any one file; take it from the `plan_sha256` field of the snapshot JSON (the first path `GC snapshot` prints) or hash the printed `PLAN <path>` copy, which is the bundle and the plan the reviewers read. Any added, deleted or edited file in the folder fails `plan_sha256`. The review criteria are the `### Requirement:` blocks of the specs with their Negative control scenarios; a change with none (`skip_specs: true`, rename-only deltas) carries a `- Feature-specific criteria:` block in `gate.md` instead. The record's `mandatory_class` and `whole_diff` must equal `gate.md`.
+
 A commit touching reviewed code after the review still invalidates everything. Re-review the delta.
 
 ```markdown
diff --git a/team-config/agent/skills/review-work/scripts/folder-plan.mjs b/team-config/agent/skills/review-work/scripts/folder-plan.mjs
new file mode 100644
index 0000000000..22e8c0d06c
--- /dev/null
+++ b/team-config/agent/skills/review-work/scripts/folder-plan.mjs
@@ -0,0 +1,65 @@
+// Folder plans for validate-gate-record.mjs: one snapshot of an OpenSpec change folder, and the
+// bundle whose sha256 is the folder's `plan_sha256`. Lives beside the validator rather than inside
+// it because the validator's fs surface is pinned to three primitives; this module is the only
+// place that opens folder entries.
+import { closeSync, constants, fstatSync, openSync, readdirSync, readFileSync } from "node:fs"
+import { createHash } from "node:crypto"
+import path from "node:path"
+
+export class FolderPlanError extends Error {}
+
+const MAX_FILE_BYTES = 1024 * 1024
+
+// Every file is opened with O_NOFOLLOW and judged by fstat on the HANDLE, so what is checked is
+// what is read: a symlink swapped in after `readdir` fails with ELOOP, a FIFO swapped in fails the
+// regular-file test (O_NONBLOCK keeps that open from hanging). The result maps change-relative
+// paths (with `/`) to bytes; the checks, the criteria and the bundle all read this map and never
+// the disk again. `hooks.beforeOpen` / `hooks.afterRead` are test seams for exactly those races.
+export function snapshotFolder(root, hooks = {}) {
+  const snapshot = new Map()
+  const walk = (directory, prefix) => {
+    for (const entry of readdirSync(directory, { withFileTypes: true })) {
+      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`
+      const absolute = path.join(directory, entry.name)
+      if (entry.isSymbolicLink()) throw new FolderPlanError(`${rel}: symlink is not allowed in a change folder`)
+      if (entry.isDirectory()) {
+        walk(absolute, rel)
+        continue
+      }
+      if (!entry.isFile()) throw new FolderPlanError(`${rel}: not a regular file; a change folder holds regular files and directories only`)
+      hooks.beforeOpen?.(rel)
+      let descriptor
+      try {
+        descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
+      } catch (error) {
+        throw new FolderPlanError(`${rel}: cannot open: ${error instanceof Error ? error.message : String(error)}`)
+      }
+      try {
+        const stats = fstatSync(descriptor)
+        if (!stats.isFile()) throw new FolderPlanError(`${rel}: not a regular file; a change folder holds regular files and directories only`)
+        if (stats.size > MAX_FILE_BYTES) throw new FolderPlanError(`${rel}: is ${stats.size} bytes, above the ${MAX_FILE_BYTES}-byte limit for a gate artifact`)
+        snapshot.set(rel, readFileSync(descriptor))
+      } finally {
+        closeSync(descriptor)
+      }
+      hooks.afterRead?.(rel)
+    }
+  }
+  walk(root, "")
+  return snapshot
+}
+
+const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
+
+// Manifest (`<sha256>  <path>` per file, sorted by path as UTF-8 bytes), then each file's bytes
+// under a `===== <path> =====` line in the same order. The reviewer reads this as the plan.
+export function buildBundle(snapshot) {
+  const paths = [...snapshot.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
+  const manifest = paths.map((rel) => `${sha256(snapshot.get(rel))}  ${rel}\n`).join("")
+  const sections = paths.map((rel) => Buffer.concat([Buffer.from(`===== ${rel} =====\n`), snapshot.get(rel), Buffer.from("\n")]))
+  return Buffer.concat([Buffer.from(manifest), ...sections])
+}
+
+export function bundleDigest(bundle) {
+  return sha256(bundle)
+}
diff --git a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
index 4297f5d6bc..ab981e395a 100755
--- a/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
+++ b/team-config/agent/skills/review-work/scripts/gate-convergence.mjs
@@ -8,6 +8,7 @@ import { createHash } from "node:crypto"
 import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
 import path from "node:path"
 import { parseArgs } from "node:util"
+import { buildBundle, FolderPlanError, snapshotFolder } from "./folder-plan.mjs"
 import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"
 
 class GateError extends Error {}
@@ -641,13 +642,25 @@ function main() {
   if (command !== "patch") {
     if (!isString(values.plan)) fail("--plan is required")
     const resolved = path.resolve(repo, values.plan)
+    // A plan is a readable file, or a change folder (a directory holding gate.md). For a folder the
+    // plan bytes are the bundle of one snapshot and the Risk tier is read from its gate.md, which is
+    // the folder's merge-gate section. The ledger key stays the repo-relative path either way.
+    let tierSection
     try {
-      planBytes = readFileSync(resolved)
-    } catch {
+      if (statSync(resolved).isDirectory()) {
+        statSync(path.join(resolved, "gate.md"))
+        const snapshot = snapshotFolder(resolved)
+        planBytes = buildBundle(snapshot)
+        tierSection = planContent(scanMarkdown(snapshot.get("gate.md").toString("utf8")))
+      } else {
+        planBytes = readFileSync(resolved)
+      }
+    } catch (error) {
+      if (error instanceof FolderPlanError) fail(`plan ${values.plan}: ${error.message}`)
       fail(`plan ${values.plan} is not readable`)
     }
     planSha256 = sha256(planBytes)
-    const parsed = readRiskTier(mergeGateSection(planContent(scanMarkdown(planBytes.toString("utf8")))))
+    const parsed = readRiskTier(tierSection ?? mergeGateSection(planContent(scanMarkdown(planBytes.toString("utf8")))))
     if (parsed.error) fail(`plan Risk tier: ${parsed.error}`)
     planTier = parsed.tier
     const relative = path.relative(repo, resolved)
diff --git a/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs b/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
index 07993a0834..bde70f2956 100644
--- a/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
+++ b/team-config/agent/skills/review-work/scripts/gate-convergence.test.mjs
@@ -1,6 +1,6 @@
 import assert from "node:assert/strict"
 import { execFileSync, spawnSync } from "node:child_process"
-import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
+import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
 import { createHash } from "node:crypto"
 import { tmpdir } from "node:os"
 import path from "node:path"
@@ -631,3 +631,152 @@ test("#given a personal tier #when baseline runs #then it is refused", (t) => {
   assert.equal(result.status, 1)
   assert.match(result.stderr, /plan Risk tier: personal plans run no merge gate/)
 })
+
+// A change folder is a plan: `gate.md` marks it, the plan bytes are a bundle of every file in the
+// folder, the ledger key is the repo-relative folder path and the Risk tier comes from `gate.md`.
+// The folder stays untracked, so a later edit is seen as a plan change and not as a tracked change.
+const FOLDER = "openspec/changes/demo"
+const gateMd = (tier, cls = "none") => `# Gate\n\n- **Mandatory class**: ${cls}\n- **Risk tier**: ${tier}\n- **Whole-diff review**: not needed (one module)\n`
+
+function changeFolder(s, { tier = "product", files = {} } = {}) {
+  const folder = path.join(s.repo, FOLDER)
+  mkdirSync(path.join(folder, "specs", "feature"), { recursive: true })
+  writeFileSync(path.join(folder, "gate.md"), gateMd(tier))
+  writeFileSync(path.join(folder, "proposal.md"), "# Proposal\n")
+  writeFileSync(path.join(folder, "specs", "feature", "spec.md"), "# Spec\n")
+  for (const [rel, text] of Object.entries(files)) {
+    mkdirSync(path.dirname(path.join(folder, rel)), { recursive: true })
+    writeFileSync(path.join(folder, rel), text)
+  }
+  return folder
+}
+
+// The documented bundle, computed here independently of the script: a manifest of
+// `<sha256>  <path>` lines sorted by path bytes, then each file under `===== <path> =====`.
+function expectedBundle(folder) {
+  const files = []
+  const walk = (dir, prefix) => {
+    for (const entry of readdirSync(dir, { withFileTypes: true })) {
+      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`
+      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel)
+      else files.push(rel)
+    }
+  }
+  walk(folder, "")
+  files.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
+  const contents = files.map((rel) => readFileSync(path.join(folder, rel)))
+  const manifest = files.map((rel, i) => `${createHash("sha256").update(contents[i]).digest("hex")}  ${rel}\n`).join("")
+  return Buffer.concat([Buffer.from(manifest), ...files.map((rel, i) => Buffer.concat([Buffer.from(`===== ${rel} =====\n`), contents[i], Buffer.from("\n")]))])
+}
+
+const folderGc = (s, command, ...args) => s.run(command, "--plan", FOLDER, ...args)
+
+test("#given a change folder as the plan #when baseline, ready, snapshot, wave run #then they work, the plan copy is the bundle and the ledger carries the folder key", (t) => {
+  const s = sandbox(t)
+  const folder = changeFolder(s)
+  assert.match(first(folderGc(s, "baseline", "--sha", "HEAD").stdout), /^BASELINE [0-9a-f]{12} recorded$/)
+  assert.equal(folderGc(s, "ready", "--lane", "F2").stdout.trim(), "READY")
+  const snap = folderGc(s, "snapshot", "--lane", "F2")
+  assert.equal(snap.status, 0, snap.stderr)
+  const copyPath = /^PLAN (.+)$/m.exec(snap.stdout)[1]
+  const bundle = expectedBundle(folder)
+  assert.ok(readFileSync(copyPath).equals(bundle), "the plan copy must be the bundle bytes")
+  assert.equal(statSync(copyPath).mode & 0o222, 0, "the plan copy must be read-only")
+  const record = JSON.parse(readFileSync(first(snap.stdout), "utf8"))
+  assert.equal(record.plan_sha256, createHash("sha256").update(bundle).digest("hex"))
+  const result = folderGc(s, "wave", "--lane", "F2", "--snapshot", first(snap.stdout), "--outcome", "qa=PASS")
+  assert.equal(result.status, 0, result.stderr)
+  assert.equal(first(result.stdout), "DECISION: PASS")
+  assert.deepEqual([...new Set(s.ledger().map((e) => e.plan))], [FOLDER])
+  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "product")
+})
+
+test("#given an absolute change folder path #when baseline runs #then the ledger key is still repo-relative", (t) => {
+  const s = sandbox(t)
+  changeFolder(s)
+  assert.equal(s.run("baseline", "--plan", path.join(s.repo, FOLDER), "--sha", "HEAD").status, 0)
+  assert.deepEqual(s.ledger().map((e) => e.plan), [FOLDER])
+})
+
+test("#given an internal-tooling gate.md #when three waves record #then the fix-round cap applies to the folder", (t) => {
+  const s = sandbox(t)
+  changeFolder(s, { tier: "internal-tooling" })
+  assert.equal(folderGc(s, "baseline", "--sha", "HEAD").status, 0)
+  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "internal-tooling")
+  let last
+  for (const [index, count] of [3, 2, 1].entries()) {
+    const snap = folderGc(s, "snapshot", "--lane", "F2")
+    assert.equal(snap.status, 0, snap.stderr)
+    last = folderGc(s, "wave", "--lane", "F2", "--snapshot", first(snap.stdout), "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count))
+  }
+  assert.equal(last.status, 3, last.stderr)
+  assert.equal(first(last.stdout), "DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers")
+})
+
+test("#given a product gate.md and another file quoting an internal-tooling Merge gate #when baseline runs #then the tier comes from gate.md alone", (t) => {
+  const s = sandbox(t)
+  changeFolder(s, { files: { "notes.md": "## Merge gate\n- Mandatory class: none\n- Risk tier: internal-tooling\n" } })
+  assert.equal(folderGc(s, "baseline", "--sha", "HEAD").status, 0)
+  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "product")
+})
+
+test("#given a gate.md whose Risk tier lines sit in an HTML comment #when baseline runs #then only the visible line counts", (t) => {
+  const s = sandbox(t)
+  const folder = changeFolder(s)
+  writeFileSync(path.join(folder, "gate.md"), `${gateMd("product")}<!--\n- **Risk tier**: internal-tooling\n-->\n`)
+  assert.equal(folderGc(s, "baseline", "--sha", "HEAD").status, 0)
+  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "product")
+})
+
+test("#given a gate.md with an invalid Risk tier #when a command runs #then it fails naming the Risk tier", (t) => {
+  const s = sandbox(t)
+  const folder = changeFolder(s)
+  writeFileSync(path.join(folder, "gate.md"), gateMd("sometimes"))
+  const result = folderGc(s, "baseline", "--sha", "HEAD")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /plan Risk tier: must be exactly product or internal-tooling/)
+})
+
+for (const [name, mutate] of [
+  ["a spec line edited", (folder) => writeFileSync(path.join(folder, "specs/feature/spec.md"), "# Spec\nedited\n")],
+  ["a file added", (folder) => writeFileSync(path.join(folder, "notes.md"), "late\n")],
+  ["a file deleted", (folder) => rmSync(path.join(folder, "proposal.md"))],
+]) {
+  test(`#given ${name} after the snapshot #when wave runs #then it refuses on the plan bytes`, (t) => {
+    const s = sandbox(t)
+    const folder = changeFolder(s)
+    folderGc(s, "baseline", "--sha", "HEAD")
+    const snap = folderGc(s, "snapshot", "--lane", "F2")
+    assert.equal(snap.status, 0, snap.stderr)
+    mutate(folder)
+    const result = folderGc(s, "wave", "--lane", "F2", "--snapshot", first(snap.stdout), "--outcome", "qa=PASS")
+    assert.equal(result.status, 1)
+    assert.match(result.stderr, /plan bytes differ from the snapshot/)
+    assert.deepEqual(s.ledger().filter((e) => e.event === "gate_wave"), [])
+  })
+}
+
+test("#given a folder with a symlink #when baseline runs #then it fails naming the entry", (t) => {
+  const s = sandbox(t)
+  const folder = changeFolder(s)
+  symlinkSync("proposal.md", path.join(folder, "alias.md"))
+  const result = folderGc(s, "baseline", "--sha", "HEAD")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /alias\.md/)
+  assert.deepEqual(s.ledger(), [])
+})
+
+test("#given a directory without gate.md #when it is the plan #then the command fails as an unreadable plan", (t) => {
+  const s = sandbox(t)
+  mkdirSync(path.join(s.repo, "openspec", "changes", "bare"), { recursive: true })
+  const result = s.run("baseline", "--plan", "openspec/changes/bare", "--sha", "HEAD")
+  assert.equal(result.status, 1)
+  assert.match(result.stderr, /plan openspec\/changes\/bare is not readable/)
+  assert.deepEqual(s.ledger(), [])
+})
+
+test("#given a file plan #when baseline runs #then its ledger key is unchanged", (t) => {
+  const s = sandbox(t)
+  assert.equal(s.gc("baseline", "--sha", "HEAD").status, 0)
+  assert.deepEqual(s.ledger().map((e) => e.plan), [PLAN])
+})
diff --git a/team-config/agent/skills/review-work/scripts/plan-contract.mjs b/team-config/agent/skills/review-work/scripts/plan-contract.mjs
index 50db501939..7d4f431141 100644
--- a/team-config/agent/skills/review-work/scripts/plan-contract.mjs
+++ b/team-config/agent/skills/review-work/scripts/plan-contract.mjs
@@ -85,3 +85,139 @@ export function readRiskTier(section) {
   }
   return { tier }
 }
+
+// ---- Criteria and value grammar -------------------------------------------------------------
+// Shared by the gate validator (file plans, folder plans) and the OpenSpec checker, so a change
+// folder fails at `validate-openspec-change.mjs` for exactly the reasons the gate would give.
+// Every function takes content-only text (the output of `planContent(scanMarkdown(...))`) and
+// returns defects instead of throwing; the callers decide how a defect is reported.
+export const CRITERIA_HEADER_PATTERN = /^(\s*)-\s+(?:\*\*)?Feature-specific criteria\b[^\n]*(?:\*\*)?\s*:?\s*$/mi
+const DEFERRAL_MARKERS = new Set(["tbd", "tba", "tbc", "todo", "fixme", "xxx", "n/a", "na", "?", "-", "...", "\u2026"])
+const DEFERRAL_PREFIX = /^(?:tbd|tba|tbc|todo|fixme|xxx|n\/a)(?!\p{L})/u
+
+export function criterionBullets(section) {
+  const headerMatch = section.match(CRITERIA_HEADER_PATTERN)
+  const headerIndent = headerMatch[1].length
+  const criteriaSource = section.slice(headerMatch.index + headerMatch[0].length)
+  return [...criteriaSource.matchAll(/^(\s*)-\s+([\s\S]*?)(?=^\s*-\s+|$(?![\s\S]))/gm)]
+    .filter((match) => match[1].length > headerIndent && /^\s*(?:\*\*)?Invariant\s*:/mi.test(match[2]))
+}
+
+// The shape check of `- Feature-specific criteria:`: the first defect as { field, detail }, or undefined.
+export function criteriaShapeDefect(section, label = "plan Merge gate criteria") {
+  if (!CRITERIA_HEADER_PATTERN.test(section)) {
+    return { field: label, detail: "Feature-specific criteria header is required: one `- Feature-specific criteria:` bullet with each criterion nested below it as `  - Invariant: ...` and its fields indented under that; flat `- Invariant I1:` bullets are not read as criteria" }
+  }
+  const bullets = criterionBullets(section)
+  if (bullets.length === 0) return { field: label, detail: "header requires at least one criterion with Invariant" }
+  for (const [index, match] of bullets.entries()) {
+    const criterion = match[2]
+    if (/^\s*(?:\*\*)?Mechanical\b/i.test(criterion)) continue
+    if (!/^\s*(?:\*\*)?Negative control\s*:/mi.test(criterion)) {
+      return { field: `${label}.${index}.Negative control`, detail: "behavioural criterion requires this field" }
+    }
+  }
+  return undefined
+}
+
+export function isDeferral(text) {
+  const lowered = text.toLowerCase().replace(/[`*]/g, "").trim()
+  const bare = lowered.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")
+  return DEFERRAL_MARKERS.has(lowered) || DEFERRAL_MARKERS.has(bare) || DEFERRAL_PREFIX.test(bare)
+}
+
+export function withoutTemplates(text) {
+  let current = text
+  for (;;) {
+    const next = current.replace(/<\p{L}[^<>]*>/gu, "")
+    if (next === current) return current
+    current = next
+  }
+}
+
+// One verdict per value: undefined accepts, a string names the defect. The grammar rejects
+// non-answers only; whether a named risk is real is the reviewer's PROCESS 1 check.
+// `allowNone` turns on the abort fields' `none (<reason>)` branch; without it a bare `none` is a
+// non-answer and any other value starting with the word none is judged like ordinary text.
+export function valueDefect(value, { allowNone = false } = {}) {
+  if (value === "") return "empty"
+  const residue = withoutTemplates(value).trim()
+  if (/^[\s\p{P}\p{S}]*$/u.test(residue) && residue !== value.trim()) return "template placeholder"
+  if (isDeferral(residue)) return "deferral marker"
+  if (!allowNone && /^[`*\s]*none[\s\p{P}]*$/iu.test(residue)) return "none is not an answer here"
+  if (allowNone && /^none(?!\p{L})/iu.test(residue.replace(/^[`*]+/, ""))) {
+    const open = residue.indexOf("(")
+    const close = residue.lastIndexOf(")")
+    const reason = open !== -1 && close > open ? withoutTemplates(residue.slice(open + 1, close)).trim() : ""
+    return /\p{L}{3,}/u.test(reason) && !isDeferral(reason) ? undefined : "none needs a reason"
+  }
+  return /\p{L}{3,}/u.test(residue) ? undefined : "no substance"
+}
+
+export const abortFieldDefect = (value) => valueDefect(value, { allowNone: true })
+
+export const ABORT_FIELDS = ["Accepted residual risks", "Out of scope for blocking"]
+
+// The value of one top-level bullet `- Label: value` plus its indented continuation lines, or
+// undefined when the label is absent; `count` tells a duplicate from a single occurrence.
+export function topLevelField(section, field) {
+  const lines = section.split("\n")
+  const label = new RegExp(`^-\\s+(?:\\*\\*)?${field}(?:\\*\\*)?\\s*:(?:\\*\\*)?(.*)$`, "i")
+  const starts = lines.flatMap((line, index) => (label.test(line) ? [index] : []))
+  if (starts.length === 0) return { count: 0 }
+  const parts = [label.exec(lines[starts[0]])[1]]
+  for (const line of lines.slice(starts[0] + 1)) {
+    if (/^\S/.test(line)) break
+    parts.push(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""))
+  }
+  return { count: starts.length, value: parts.join(" ").replace(/\s+/g, " ").trim() }
+}
+
+// The abort fields' defects as `<field>: <defect>` strings; empty when both are acceptable.
+export function abortRuleDefects(section) {
+  const defects = []
+  for (const field of ABORT_FIELDS) {
+    const found = topLevelField(section, field)
+    if (found.count === 0) defects.push(`${field}: missing`)
+    else if (found.count > 1) defects.push(`${field}: duplicate`)
+    else {
+      const defect = abortFieldDefect(found.value)
+      if (defect) defects.push(`${field}: ${defect}`)
+    }
+  }
+  return defects
+}
+
+const CRITERION_LABEL = /^\s*(?:-\s+)?(?:\*\*)?(Invariant|Positive witness|Negative control|Observable|Boundary|Mechanical)\b/i
+
+function criterionField(criterion, field) {
+  const lines = criterion.split("\n")
+  const label = new RegExp(`^\\s*(?:-\\s+)?(?:\\*\\*)?${field}(?:\\*\\*)?\\s*:(?:\\*\\*)?(.*)$`, "i")
+  const start = lines.findIndex((line) => label.test(line))
+  if (start === -1) return undefined
+  const parts = [label.exec(lines[start])[1]]
+  for (const line of lines.slice(start + 1)) {
+    if (CRITERION_LABEL.test(line)) break
+    parts.push(line)
+  }
+  return parts.join(" ").replace(/\s+/g, " ").trim()
+}
+
+// Criteria carried by a plan that has no requirements to derive them from: the shape check, then
+// every field the authoring template asks for held to the content grammar (behavioural: all five;
+// Mechanical: the check itself, Invariant, Observable and Boundary). Returns every defect as { field, detail }.
+export function substantiveCriteriaDefects(section, label = "plan Merge gate criteria") {
+  const shape = criteriaShapeDefect(section, label)
+  if (shape) return [shape]
+  const defects = []
+  for (const [index, criterion] of criterionBullets(section).entries()) {
+    const fields = /^\s*(?:\*\*)?Mechanical\b/i.test(criterion[2])
+      ? ["Mechanical", "Invariant", "Observable", "Boundary"]
+      : ["Invariant", "Positive witness", "Negative control", "Observable", "Boundary"]
+    for (const field of fields) {
+      const defect = valueDefect(criterionField(criterion[2], field) ?? "")
+      if (defect) defects.push({ field: `${label}.${index}.${field}`, detail: `${defect}; the criteria need concrete text when the change carries no requirements` })
+    }
+  }
+  return defects
+}
diff --git a/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs b/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
index 983c8a6401..17f759f91c 100644
--- a/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
+++ b/team-config/agent/skills/review-work/scripts/validate-gate-record.mjs
@@ -4,7 +4,9 @@ import { createHash } from "node:crypto"
 import { readFileSync, realpathSync, statSync } from "node:fs"
 import path from "node:path"
 import { parseArgs } from "node:util"
-import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"
+import { buildBundle, bundleDigest, FolderPlanError, snapshotFolder } from "./folder-plan.mjs"
+import { abortRuleDefects, CRITERIA_HEADER_PATTERN, criteriaShapeDefect, mergeGateSection, planContent, readRiskTier, scanMarkdown, topLevelField } from "./plan-contract.mjs"
+import { validateOpenSpecFiles } from "./validate-openspec-change.mjs"
 
 class GateError extends Error {}
 
@@ -240,20 +242,34 @@ function tryRealpath(target) {
 // trailers are review OUTPUT that a later reviewer must be able to open, so they must be tracked.
 // `pathField` names the field that supplied the path and `digestField` the one that pinned it, so a
 // path problem and a digest mismatch stay distinguishable to the operator reading stderr.
-function verifyAndPinArtifact(context, absolutePath, pathField, digestField, expectedDigest, { requireTracked = true } = {}) {
+//
+// A folder plan is bound by the digest of the bundle rebuilt from the one snapshot `main` took, and
+// every snapshot file is admitted to the exemption. The single `pin` call below serves both shapes,
+// so this function stays the only admission path.
+function verifyAndPinArtifact(context, absolutePath, pathField, digestField, expectedDigest, { requireTracked = true, folder = null } = {}) {
   const field = digestField
-  if (requireTracked) assertTracked(context.repo, absolutePath, pathField)
-  else assertInsideRepo(context.repo, absolutePath, pathField)
-  const bytes = readBytes(absolutePath, pathField)
-  const digest = createHash("sha256").update(bytes).digest("hex")
+  let bytes = null
+  let digest
+  let targets = [absolutePath]
+  if (folder) {
+    digest = folder.digest
+    targets = [...folder.snapshot.keys()].map((file) => path.join(absolutePath, file))
+  } else {
+    if (requireTracked) assertTracked(context.repo, absolutePath, pathField)
+    else assertInsideRepo(context.repo, absolutePath, pathField)
+    bytes = readBytes(absolutePath, pathField)
+    digest = createHash("sha256").update(bytes).digest("hex")
+  }
   if (typeof expectedDigest !== "string" || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
     block(field, "must be the sha256 of the stored artifact bytes, so a later edit to that file cannot ride the path exemption")
   }
   if (expectedDigest !== digest) {
     block(field, `records ${expectedDigest} but the artifact now hashes to ${digest}; it changed after the review, so re-review against it as it now stands`)
   }
-  pin(context, absolutePath)
-  return { digest, text: bytes.toString("utf8") }
+  for (const target of targets) {
+    pin(context, target)
+  }
+  return { digest, text: bytes === null ? "" : bytes.toString("utf8") }
 }
 
 // The record is the one artifact that cannot self-bind: a digest of the record stored inside the
@@ -517,12 +533,8 @@ function reconcileBlockers(scalars, narrative, field) {
   return ids
 }
 
-const CRITERIA_HEADER_PATTERN = /^(\s*)-\s+(?:\*\*)?Feature-specific criteria\b[^\n]*(?:\*\*)?\s*:?\s*$/mi
 // The opt-out is one top-level bullet. A glued suffix (`not applicableXYZ`) is not a declaration.
 const OPT_OUT_PATTERN = /^-\s+(?:\*\*)?Merge gate(?:\*\*)?\s*:\s*(?:\*\*)?\s*not applicable(?=$|[\s(.,;:\u2013\u2014])/i
-const ABORT_FIELDS = ["Accepted residual risks", "Out of scope for blocking"]
-const DEFERRAL_MARKERS = new Set(["tbd", "tba", "tbc", "todo", "fixme", "xxx", "n/a", "na", "?", "-", "...", "\u2026"])
-const DEFERRAL_PREFIX = /^(?:tbd|tba|tbc|todo|fixme|xxx|n\/a)(?!\p{L})/u
 
 function riskTier(section) {
   const parsed = readRiskTier(section)
@@ -532,77 +544,12 @@ function riskTier(section) {
 
 function validateCriteria(section) {
   if (section === undefined) block("plan Merge gate", "section is required")
-  const headerMatch = section.match(CRITERIA_HEADER_PATTERN)
-  if (!headerMatch) {
-    block("plan Merge gate criteria", "Feature-specific criteria header is required: one `- Feature-specific criteria:` bullet with each criterion nested below it as `  - Invariant: ...` and its fields indented under that; flat `- Invariant I1:` bullets are not read as criteria")
-  }
-  const headerIndent = headerMatch[1].length
-  const criteriaSource = section.slice(headerMatch.index + headerMatch[0].length)
-  const bullets = [...criteriaSource.matchAll(/^(\s*)-\s+([\s\S]*?)(?=^\s*-\s+|$(?![\s\S]))/gm)]
-    .filter((match) => match[1].length > headerIndent && /^\s*(?:\*\*)?Invariant\s*:/mi.test(match[2]))
-  if (bullets.length === 0) block("plan Merge gate criteria", "header requires at least one criterion with Invariant")
-  for (const [index, match] of bullets.entries()) {
-    const criterion = match[2]
-    if (/^\s*(?:\*\*)?Mechanical\b/i.test(criterion)) continue
-    if (!/^\s*(?:\*\*)?Negative control\s*:/mi.test(criterion)) {
-      block(`plan Merge gate criteria.${index}.Negative control`, "behavioural criterion requires this field")
-    }
-  }
-}
-
-function isDeferral(text) {
-  const lowered = text.toLowerCase().replace(/[`*]/g, "").trim()
-  const bare = lowered.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")
-  return DEFERRAL_MARKERS.has(lowered) || DEFERRAL_MARKERS.has(bare) || DEFERRAL_PREFIX.test(bare)
-}
-
-function withoutTemplates(text) {
-  let current = text
-  for (;;) {
-    const next = current.replace(/<\p{L}[^<>]*>/gu, "")
-    if (next === current) return current
-    current = next
-  }
-}
-
-// One verdict per value: undefined accepts, a string names the block reason. The grammar rejects
-// non-answers only; whether a named risk is real is the reviewer's PROCESS 1 check.
-function abortFieldDefect(value) {
-  if (value === "") return "empty"
-  const residue = withoutTemplates(value).trim()
-  if (/^[\s\p{P}\p{S}]*$/u.test(residue) && residue !== value.trim()) return "template placeholder"
-  if (isDeferral(residue)) return "deferral marker"
-  if (/^none(?!\p{L})/iu.test(residue.replace(/^[`*]+/, ""))) {
-    const open = residue.indexOf("(")
-    const close = residue.lastIndexOf(")")
-    const reason = open !== -1 && close > open ? withoutTemplates(residue.slice(open + 1, close)).trim() : ""
-    return /\p{L}{3,}/u.test(reason) && !isDeferral(reason) ? undefined : "none needs a reason"
-  }
-  return /\p{L}{3,}/u.test(residue) ? undefined : "no substance"
+  const defect = criteriaShapeDefect(section)
+  if (defect) block(defect.field, defect.detail)
 }
 
 function validateAbortRuleFields(section) {
-  const lines = section.split("\n")
-  const defects = []
-  for (const field of ABORT_FIELDS) {
-    const label = new RegExp(`^-\\s+(?:\\*\\*)?${field}(?:\\*\\*)?\\s*:(?:\\*\\*)?(.*)$`, "i")
-    const starts = lines.flatMap((line, index) => (label.test(line) ? [index] : []))
-    if (starts.length === 0) {
-      defects.push(`${field}: missing`)
-      continue
-    }
-    if (starts.length > 1) {
-      defects.push(`${field}: duplicate`)
-      continue
-    }
-    const parts = [label.exec(lines[starts[0]])[1]]
-    for (const line of lines.slice(starts[0] + 1)) {
-      if (/^\S/.test(line)) break
-      parts.push(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""))
-    }
-    const defect = abortFieldDefect(parts.join(" ").replace(/\s+/g, " ").trim())
-    if (defect) defects.push(`${field}: ${defect}`)
-  }
+  const defects = abortRuleDefects(section)
   if (defects.length > 0) {
     block("plan Merge gate abort fields", `${defects.join("; ")}. Each is a top-level bullet in ## Merge gate with concrete text or none (<reason>)`)
   }
@@ -624,6 +571,65 @@ function validatePlanContract(planText) {
   riskTier(section)
 }
 
+// ---- Folder plans -------------------------------------------------------------------------------
+// An OpenSpec change folder is the plan. One snapshot feeds the OpenSpec checks (which include the
+// criteria), the classification and the bundle, so every check runs on exactly the bytes
+// `plan_sha256` pins. `gate.md` is the folder's merge-gate section.
+
+function isFolderPlan(planPath) {
+  try {
+    return statSync(planPath).isDirectory() && statSync(path.join(planPath, "gate.md"), { throwIfNoEntry: false }) !== undefined
+  } catch {
+    return false
+  }
+}
+
+function takeSnapshot(folderPath) {
+  try {
+    return snapshotFolder(folderPath)
+  } catch (error) {
+    if (error instanceof FolderPlanError) block("plan", error.message)
+    throw error
+  }
+}
+
+const gateField = (gateContent, field) => topLevelField(gateContent, field).value ?? ""
+
+function parseGateClassification(gateContent) {
+  const wholeDiff = gateField(gateContent, "Whole-diff review").replace(/[`*]/g, "").trim()
+  return {
+    mandatoryClass: gateField(gateContent, "Mandatory class").replace(/[`*]/g, "").trim().split(/\s+/, 1)[0],
+    wholeDiff: wholeDiff === "needed",
+    wholeDiffReason: /^not needed\s*\((.*)\)$/.exec(wholeDiff)?.[1].trim(),
+  }
+}
+
+// One snapshot of the live folder: the OpenSpec checks (fields, specs, criteria) block with their own
+// text, then the bundle and its digest are built from the same map. A file plan never reaches this.
+function loadFolderPlan(repo, planPath) {
+  assertInsideRepo(repo, planPath, "plan")
+  const snapshot = takeSnapshot(planPath)
+  const errors = validateOpenSpecFiles(snapshot)
+  if (errors.length > 0) block("plan OpenSpec change", errors.join("; "))
+  const gateContent = planContent(scanMarkdown(snapshot.get("gate.md").toString("utf8")))
+  const bundle = buildBundle(snapshot)
+  return { snapshot, gateContent, gate: parseGateClassification(gateContent), bundle, digest: bundleDigest(bundle) }
+}
+
+// The folder's classification is whatever gate.md says; a record can neither reclassify the change
+// nor swap the Whole-diff decision.
+function checkFolderClassification(record, gate) {
+  if (record.mandatory_class !== gate.mandatoryClass) {
+    block("mandatory_class", `record says ${record.mandatory_class} but gate.md says ${gate.mandatoryClass}; the class comes from gate.md`)
+  }
+  if (record.whole_diff.run !== gate.wholeDiff) {
+    block("whole_diff", `record says run ${record.whole_diff.run} but gate.md says Whole-diff review ${gate.wholeDiff ? "needed" : "not needed"}`)
+  }
+  if (!gate.wholeDiff && record.whole_diff.reason?.trim() !== gate.wholeDiffReason) {
+    block("whole_diff.reason", `record says "${record.whole_diff.reason}" but gate.md says "${gate.wholeDiffReason}"; the reason comes from gate.md`)
+  }
+}
+
 function validateRecord(record, context) {
   if (record.schema === "omo.merge-gate/v1") {
     block("schema", "omo.merge-gate/v1 is superseded: v2 requires implementation_models and a reviewer trailer artifact per verdict; re-run the review rather than editing the old record")
@@ -643,7 +649,7 @@ function validateRecord(record, context) {
   // independent one without touching the reviewer's trailer. Path exemption cannot catch that, and
   // where the plan is git-ignored - as `.omo/plans/` commonly is - no commit is needed at all.
   // So the plan is bound by CONTENT: the digest of the exact bytes the reviewer was given.
-  verifyAndPinArtifact(context, context.planPath, "plan", "plan_sha256", record.plan_sha256, { requireTracked: false })
+  verifyAndPinArtifact(context, context.planPath, "plan", "plan_sha256", record.plan_sha256, { requireTracked: false, folder: context.folder })
   if (typeof record.decision_reason !== "string" || record.decision_reason.trim() === "") {
     block("decision_reason", "must be a non-empty line")
   }
@@ -685,6 +691,7 @@ function validateRecord(record, context) {
   if (!mandatoryClasses.has(record.mandatory_class)) {
     block("mandatory_class", "must be none, auth-secrets-pii, schema-migration, wire-contract-api, or concurrency-state")
   }
+  if (context.folder) checkFolderClassification(record, context.folder.gate)
   if (context.riskTier === "internal-tooling" && record.mandatory_class !== "none") {
     block("mandatory_class", "the plan declares Risk tier internal-tooling, which requires none; a mandatory class makes the work product: set - Risk tier: product, run gate-convergence retier, and review again")
   }
@@ -876,19 +883,22 @@ function main() {
   // tracked check anchored to the repo let the guarantee and the parsed bytes be different files,
   // and it broke the documented invocation from any subdirectory.
   const planPath = path.resolve(repo, values.plan)
-  const planText = readText(planPath, "plan")
+  const folder = isFolderPlan(planPath) ? loadFolderPlan(repo, planPath) : null
+  const planText = folder ? folder.bundle.toString("utf8") : readText(planPath, "plan")
   if (values["plan-only"]) {
-    validatePlanContract(planText)
+    if (!folder) validatePlanContract(planText)
     return "passed"
   }
-  const section = mergeGateSection(planContent(scanMarkdown(planText)))
-  validateCriteria(section)
+  // A folder's merge-gate section is its gate.md; its criteria were checked with the folder.
+  const section = folder ? folder.gateContent : mergeGateSection(planContent(scanMarkdown(planText)))
+  if (!folder) validateCriteria(section)
   const recordPath = path.resolve(repo, values.record)
   const context = {
     head: execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
     planRelative: path.relative(repo, planPath),
     planPath,
     planText,
+    folder,
     pinned: new Set(),
     repo,
     riskTier: riskTier(section),
diff --git a/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs b/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
index 575e497972..3fdfa5dbea 100644
--- a/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
+++ b/team-config/agent/skills/review-work/scripts/validate-gate-record.test.mjs
@@ -1,7 +1,7 @@
 import assert from "node:assert/strict"
 import { execFileSync, spawnSync } from "node:child_process"
 import { createHash } from "node:crypto"
-import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
+import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
 import { tmpdir } from "node:os"
 import path from "node:path"
 import test from "node:test"
@@ -1715,3 +1715,571 @@ test("#given an exempt artifact whose invalid-UTF-8 bytes change after the revie
     rmSync(directory, { recursive: true, force: true })
   }
 })
+
+// ---------------------------------------------------------------------------------------------
+// Folder plans: an OpenSpec change folder is the plan. Fixtures are real change folders built from
+// the shipped schema templates with every placeholder filled, committed into a scratch repository.
+// The expected digest is computed here, independently of the validator, from the bundle format the
+// skill documents: a manifest of `<sha256>  <path>` lines sorted by path bytes, then each file's
+// bytes under a `===== <path> =====` line, one `\n` after every file.
+// ---------------------------------------------------------------------------------------------
+const templateRoot = path.join(scriptsDir, "..", "..", "..", "..", "..", "openspec", "schemas", "omp-gated", "templates")
+const checker = path.join(scriptsDir, "validate-openspec-change.mjs")
+const FOLDER = "openspec/changes/demo"
+const template = (name) => readFileSync(path.join(templateRoot, name), "utf8")
+
+function fillTemplate(text, replacements) {
+  let out = text
+  for (const [pattern, value] of replacements) {
+    assert.match(out, pattern, `template placeholder not found: ${pattern}`)
+    out = out.replace(pattern, () => value)
+  }
+  return out
+}
+
+function specText(name = "Safe update", requirement = "The system SHALL update one record.", { negativeControl = true } = {}) {
+  const filled = fillTemplate(template("spec.md"), [
+    [/<!-- New capabilities only[^]*?-->/, "Safe single-record updates for the fixture capability, so concurrent edits stop overwriting each other."],
+    [/### Requirement: <!-- requirement name -->\n<!-- requirement text -->/, `### Requirement: ${name}\n${requirement}`],
+    [/#### Scenario: <!-- scenario name -->\n- \*\*WHEN\*\* <!-- condition -->\n- \*\*THEN\*\* <!-- expected outcome -->/, "#### Scenario: Successful update\n- **WHEN** a valid record is submitted\n- **THEN** the record is updated"],
+    [/- \*\*WHEN\*\* <!-- plausible broken input or state -->\n- \*\*THEN\*\* <!-- outcome that MUST fail -->/, "- **WHEN** an invalid record is submitted\n- **THEN** the update MUST fail"],
+  ])
+  return negativeControl ? filled : filled.slice(0, filled.indexOf("#### Scenario: Negative control"))
+}
+
+const renameOnlySpec = "# Spec Delta\n\n## RENAMED Requirements\n\n- FROM: `### Requirement: Old update`\n- TO: `### Requirement: Safe update`\n"
+
+const gateCriteria = `- Feature-specific criteria:
+  - Invariant: a pure tooling change keeps the pinned command output byte-identical
+    Positive witness: the command prints the same bytes before and after the change
+    Negative control: a changed byte in the command output MUST fail the comparison
+    Observable: the diff of the two outputs
+    Boundary: the command invoked as a process
+`
+
+// The gate.md fixture starts from the shipped template and sets each field by label, so a field the
+// template does not carry (yet) is added rather than failing the fixture for a reason the case under
+// test did not name.
+function setGateField(text, label, value) {
+  const line = new RegExp(`^- \\*\\*${label}\\*\\*:.*$`, "m")
+  if (line.test(text)) return text.replace(line, () => `- **${label}**: ${value}`)
+  return text.replace(/^# Gate\n\n?/, (head) => `${head}- **${label}**: ${value}\n`)
+}
+
+const CONCRETE = {
+  Invariant: "the generated artifact keeps its documented shape",
+  "Positive witness": "the artifact is byte-identical to the documented sample",
+  "Negative control": "a changed byte in the artifact MUST fail the comparison",
+  Observable: "the diff of the artifact and the sample",
+  Boundary: "the generator invoked as a process",
+}
+
+// The shipped template ends with an HTML comment holding a criteria example for changes without
+// requirements. `uncomment` removes the comment markers; `fill` also replaces every `<...>` value.
+function exampleComment(text) {
+  const match = /<!--([\s\S]*?)-->\s*$/.exec(text)
+  assert.ok(match && /Feature-specific criteria/.test(match[1]), "templates/gate.md must end with a commented `- Feature-specific criteria:` example")
+  return match
+}
+
+function useExample(text, mode) {
+  if (mode === "commented") {
+    exampleComment(text)
+    return text
+  }
+  const match = exampleComment(text)
+  let body = match[1].trim()
+  if (mode === "filled") {
+    body = body.split("\n").map((line) => line.replace(/^(\s*(?:- )?)(Invariant|Positive witness|Negative control|Observable|Boundary):\s*<[^>]*>.*$/, (_, lead, label) => `${lead}${label}: ${CONCRETE[label]}`)).join("\n")
+    assert.ok(!/<[^>]+>/.test(body), `the example must be fillable by label alone: ${body}`)
+  } else {
+    assert.match(body, /<[^>]+>/, "the example must carry placeholders for the author to fill")
+  }
+  return text.replace(match[0], () => `${body}\n`)
+}
+
+function gateText({ cls, tier, whole, assessment, extra, example }) {
+  let text = template("gate.md")
+  for (const [label, value] of [
+    ["Mandatory class", cls],
+    ["Risk tier", tier],
+    ["Author's risk assessment", assessment],
+    ["Whole-diff review", whole],
+    ["Accepted residual risks", "none (reviewer verdicts vary between runs)"],
+    ["Out of scope for blocking", "none (the change is self-contained)"],
+  ]) text = setGateField(text, label, value)
+  if (example !== undefined) text = useExample(text, example)
+  return `${text.trimEnd()}\n${extra}`
+}
+
+function writeFolder(folder, { cls, tier, whole, assessment, specs, skipSpecs, gateExtra, example }) {
+  mkdirSync(folder, { recursive: true })
+  const write = (rel, text) => {
+    mkdirSync(path.dirname(path.join(folder, rel)), { recursive: true })
+    writeFileSync(path.join(folder, rel), text)
+  }
+  let tasks = 0
+  write("proposal.md", fillTemplate(template("proposal.md"), [
+    [/<!-- Explain the motivation[^]*?-->/, "Records can only be replaced whole, so concurrent edits overwrite each other."],
+    [/<!-- Describe what will change[^]*?-->/, "- Add a safe single-record update."],
+    [/- `<capability-path>`: <brief[^\n]*\n/, "- `feature`: safe record updates\n"],
+    [/- `<existing-capability-path>`:[^\n]*\n/, ""],
+    [/<!-- Affected code[^]*?-->/, "The update endpoint and its tests."],
+  ]))
+  write("design.md", template("design.md").replace(/<!--[^]*?-->/g, "Fixture text for the design section."))
+  write("tasks.md", template("tasks.md").replace(/<!-- Task Group Name -->/g, "Update").replace(/<!-- Task description --> Verify: `<deterministic command>`/g, () => {
+    tasks += 1
+    return `Implement step ${tasks}. Verify: \`bun test step-${tasks}.test.ts\``
+  }))
+  write("gate.md", gateText({ cls, tier, whole, assessment, extra: gateExtra, example }))
+  write(".openspec.yaml", skipSpecs ? "schema: omp-gated\nskip_specs: true\n" : "schema: omp-gated\n")
+  for (const [rel, text] of Object.entries(specs)) write(`specs/${rel}`, text)
+}
+
+function folderFiles(root, prefix = "") {
+  const out = []
+  for (const entry of readdirSync(path.join(root, prefix), { withFileTypes: true })) {
+    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`
+    if (entry.isDirectory()) out.push(...folderFiles(root, rel))
+    else if (entry.isFile()) out.push(rel)
+  }
+  return out
+}
+
+function bundleBytes(root) {
+  const files = folderFiles(root).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
+  const contents = files.map((rel) => readFileSync(path.join(root, rel)))
+  const manifest = files.map((rel, index) => `${createHash("sha256").update(contents[index]).digest("hex")}  ${rel}\n`).join("")
+  const sections = files.map((rel, index) => Buffer.concat([Buffer.from(`===== ${rel} =====\n`), contents[index], Buffer.from("\n")]))
+  return Buffer.concat([Buffer.from(manifest), ...sections])
+}
+
+const bundleDigest = (root) => createHash("sha256").update(bundleBytes(root)).digest("hex")
+
+const folderDefaults = {
+  cls: "none",
+  tier: "product",
+  whole: "not needed (one module)",
+  assessment: "a stale digest lets an edited spec pass review unnoticed, so the folder bytes are pinned",
+  specs: { "feature/spec.md": specText() },
+  skipSpecs: false,
+  gateExtra: "",
+}
+
+function folderScenario(options = {}) {
+  const settings = { ...folderDefaults, ...options }
+  const { cls, tier, whole, commitFolder = true, auditTrailer = buildTrailer(), riskTrailer = buildTrailer({ invocation: "strategic-risk-review", sections_covered: "1,2,3,4" }) } = settings
+  const repository = scratchRepo()
+  const { directory, git } = repository
+  const folder = path.join(directory, FOLDER)
+  writeFolder(folder, settings)
+  const evidence = path.join(directory, "evidence")
+  mkdirSync(evidence)
+  writeFileSync(path.join(evidence, "qa.txt"), "qa ok\n")
+  git("add", "--", "evidence/qa.txt", ...(commitFolder ? [FOLDER] : []))
+  git("commit", "-q", "--allow-empty", "-m", "qa log and change folder")
+  const invocations = settings.invocations ?? (tier === "internal-tooling" || cls === "none" ? ["implementation-audit"] : ["implementation-audit", "strategic-risk-review"])
+  const bodies = { "implementation-audit": auditTrailer, "strategic-risk-review": riskTrailer }
+  const record = structuredClone(pass)
+  Object.assign(record, {
+    plan: FOLDER,
+    plan_sha256: bundleDigest(folder),
+    reviewed_sha: git("rev-parse", "HEAD"),
+    diff_base: git("rev-parse", "HEAD~1"),
+    mandatory_class: cls,
+    whole_diff: whole === "needed" ? { run: true, reason: null } : { run: false, reason: "one module" },
+    qa: [{ name: "validator tests", passed: true, artifact: "evidence/qa.txt" }],
+    reviewers_run: invocations,
+    resolution: invocations.map((invocation) => ({ invocation, agent: invocation === "implementation-audit" ? "auditor" : "oracle", model: "onara/cc/claude-opus-5", independence: "same-model" })),
+    verdicts: invocations.map((invocation) => {
+      const file = path.join(evidence, `${invocation}.txt`)
+      writeFileSync(file, bodies[invocation])
+      return { invocation, verdict: "PASS", trailer_artifact: path.relative(directory, file), trailer_sha256: planDigest(file) }
+    }),
+  })
+  const recordPath = path.join(evidence, "merge-gate.json")
+  const scenario = {
+    repository,
+    folder,
+    record,
+    recordPath,
+    evidence,
+    save() {
+      writeFileSync(recordPath, JSON.stringify(record, null, 2))
+      git("add", "--intent-to-add", "--", ...folderFiles(evidence).filter((rel) => rel !== "qa.txt").map((rel) => path.join("evidence", rel)))
+    },
+    validate(extra = []) {
+      return spawnSync(process.execPath, [validator, "--record", recordPath, "--plan", folder, "--repo", directory, ...extra], { encoding: "utf8" })
+    },
+  }
+  scenario.save()
+  return scenario
+}
+
+function withScenario(options, body) {
+  const scenario = folderScenario(options)
+  try {
+    return body(scenario)
+  } finally {
+    rmSync(scenario.repository.directory, { recursive: true, force: true })
+  }
+}
+
+// An uncommitted folder in a scratch repository, for the checks that need no record.
+function withFolder(options, body) {
+  const repository = scratchRepo()
+  const folder = path.join(repository.directory, FOLDER)
+  writeFolder(folder, { ...folderDefaults, ...options })
+  try {
+    return body({ repository, folder })
+  } finally {
+    rmSync(repository.directory, { recursive: true, force: true })
+  }
+}
+
+const planOnlyFolder = ({ repository, folder }) => spawnSync(process.execPath, [validator, "--plan-only", "--plan", folder, "--repo", repository.directory], { encoding: "utf8" })
+const checkFolder = ({ folder }) => spawnSync(process.execPath, [checker, folder], { encoding: "utf8" })
+
+function expectFolderBlocked(result, pattern) {
+  assert.equal(result.status, 1, `expected a block, got exit ${result.status}: ${result.stdout}${result.stderr}`)
+  assert.equal(result.stdout, "blocked\n")
+  assert.match(result.stderr, pattern)
+  assert.doesNotMatch(result.stderr, /\n\s+at /)
+}
+
+function expectFolderPassed(result) {
+  assert.equal(result.status, 0, result.stderr)
+  assert.equal(result.stdout, "passed\n")
+}
+
+// A mutation case first proves the untouched folder passes, so a block afterwards is the
+// mutation's doing and not a fixture defect, and the pattern names the field the block must carry.
+function expectMutationBlocked(options, mutate, pattern) {
+  withScenario(options, (s) => {
+    expectFolderPassed(s.validate())
+    mutate(s)
+    expectFolderBlocked(s.validate(), pattern)
+  })
+}
+
+test("#given an untouched OpenSpec change folder #when its record is validated #then it passes", () => {
+  withScenario({}, (s) => expectFolderPassed(s.validate()))
+})
+
+for (const [name, mutate] of [
+  ["a spec line edited", (s) => writeFileSync(path.join(s.folder, "specs/feature/spec.md"), readFileSync(path.join(s.folder, "specs/feature/spec.md"), "utf8").replace("update one record", "update one record atomically"))],
+  ["a file added", (s) => writeFileSync(path.join(s.folder, "notes.md"), "late note\n")],
+  ["a file deleted", (s) => rmSync(path.join(s.folder, "design.md"))],
+]) {
+  test(`#given ${name} after the review #when validated #then plan_sha256 blocks`, () => {
+    expectMutationBlocked({}, mutate, /plan_sha256/)
+  })
+}
+
+for (const [name, entry, mutate] of [
+  ["a symlinked file", "alias.md", (s) => symlinkSync("proposal.md", path.join(s.folder, "alias.md"))],
+  ["a symlinked subdirectory", "linked-specs", (s) => symlinkSync("specs", path.join(s.folder, "linked-specs"))],
+  ["a FIFO", "pipe.md", (s) => execFileSync("mkfifo", [path.join(s.folder, "pipe.md")])],
+]) {
+  test(`#given ${name} in the folder #when validated #then the plan blocks naming the entry`, () => {
+    expectMutationBlocked({}, mutate, new RegExp(`plan: .*${entry}`))
+  })
+}
+
+test("#given a file above the 1 MiB artifact limit in the folder #when validated #then the plan blocks naming it", () => {
+  expectMutationBlocked({}, (s) => writeFileSync(path.join(s.folder, "big.md"), "x".repeat(1024 * 1024 + 1)), /plan: .*big\.md.*1048576/)
+})
+
+test("#given a spec without its Negative control #when its digest matches #then the OpenSpec diagnostic blocks, not plan_sha256", () => {
+  withScenario({ specs: { "feature/spec.md": specText("Safe update", "The system SHALL update one record.", { negativeControl: false }) } }, (s) => {
+    const result = s.validate()
+    expectFolderBlocked(result, /exactly one Scenario: Negative control is required/)
+    assert.doesNotMatch(result.stderr, /plan_sha256/, "the digest matches, so the block must come from the OpenSpec check")
+  })
+})
+
+// The per-entry hooks of `snapshotFolder` are the seam for the races the validator must survive.
+test("#given a file replaced by a symlink after the listing #when the snapshot opens it #then it throws naming the entry with ELOOP", async () => {
+  const { snapshotFolder } = await import("./folder-plan.mjs")
+  withScenario({}, (s) => {
+    const spec = path.join(s.folder, "specs/feature/spec.md")
+    assert.throws(
+      () => snapshotFolder(s.folder, {
+        beforeOpen(rel) {
+          if (rel !== "specs/feature/spec.md") return
+          rmSync(spec)
+          symlinkSync(path.join(s.folder, "proposal.md"), spec)
+        },
+      }),
+      /specs\/feature\/spec\.md[^]*ELOOP/,
+    )
+  })
+})
+
+test("#given a file replaced by a FIFO after the listing #when the snapshot opens it #then it throws without hanging", async () => {
+  const { snapshotFolder } = await import("./folder-plan.mjs")
+  withScenario({}, (s) => {
+    const spec = path.join(s.folder, "specs/feature/spec.md")
+    assert.throws(
+      () => snapshotFolder(s.folder, {
+        beforeOpen(rel) {
+          if (rel !== "specs/feature/spec.md") return
+          rmSync(spec)
+          execFileSync("mkfifo", [spec])
+        },
+      }),
+      /specs\/feature\/spec\.md[^]*not a regular file/,
+    )
+  })
+})
+
+test("#given bytes changed after a file was read #when checks, criteria, bundle and digest are built #then all reflect the first read", async () => {
+  const { snapshotFolder, buildBundle } = await import("./folder-plan.mjs")
+  const { validateOpenSpecFiles } = await import("./validate-openspec-change.mjs")
+  withScenario({ skipSpecs: true, specs: {}, gateExtra: gateCriteria }, (s) => {
+    const copy = `${s.folder}-first-read`
+    execFileSync("cp", ["-R", s.folder, copy])
+    const gate = path.join(s.folder, "gate.md")
+    const snapshot = snapshotFolder(s.folder, {
+      afterRead(rel) {
+        if (rel === "gate.md") writeFileSync(gate, readFileSync(gate, "utf8").replace(gateCriteria, ""))
+      },
+    })
+    assert.notEqual(validateOpenSpecFiles(new Map([...snapshot, ["gate.md", readFileSync(gate)]])).length, 0, "the rewritten gate.md lacks the criteria the first read carried, so this case would not discriminate")
+    assert.deepEqual(validateOpenSpecFiles(snapshot), [], "the checks and the criteria must read the first read's bytes")
+    assert.equal(createHash("sha256").update(buildBundle(snapshot)).digest("hex"), bundleDigest(copy), "the digest must pin the first read")
+    assert.equal(snapshot.get("gate.md").toString("utf8"), readFileSync(path.join(copy, "gate.md"), "utf8"))
+  })
+})
+
+test("#given only the record committed after the review #when validated #then it still passes", () => {
+  withScenario({}, (s) => {
+    const { git } = s.repository
+    expectFolderPassed(s.validate())
+    git("add", "-A")
+    git("commit", "-q", "-m", "gate evidence")
+    expectFolderPassed(s.validate())
+  })
+})
+
+test("#given the folder first committed with the record after the review, bytes unchanged #when validated #then it passes", () => {
+  withScenario({ commitFolder: false }, (s) => {
+    const { git } = s.repository
+    expectFolderPassed(s.validate())
+    git("add", "-A")
+    git("commit", "-q", "-m", "change folder and gate evidence")
+    expectFolderPassed(s.validate())
+  })
+})
+
+test("#given a source commit alongside the folder files after the review #when validated #then reviewed_sha blocks", () => {
+  withScenario({ commitFolder: false }, (s) => {
+    const { git, directory } = s.repository
+    writeFileSync(path.join(directory, "source.txt"), "unreviewed change\n")
+    git("add", "-A")
+    git("commit", "-q", "-m", "folder, evidence and unreviewed source")
+    expectFolderBlocked(s.validate(), /reviewed_sha/)
+  })
+})
+
+test("#given a folder file edited together with source after the review #when validated #then it blocks", () => {
+  withScenario({}, (s) => {
+    const { git, directory } = s.repository
+    expectFolderPassed(s.validate())
+    writeFileSync(path.join(s.folder, "design.md"), "edited after the review\n")
+    writeFileSync(path.join(directory, "source.txt"), "unreviewed change\n")
+    git("add", "-A")
+    git("commit", "-q", "-m", "folder file and source")
+    expectFolderBlocked(s.validate(), /plan_sha256|reviewed_sha/)
+  })
+})
+
+for (const [name, options, mutate, field] of [
+  ["mandatory_class none against a wire-contract-api gate.md", { cls: "wire-contract-api" }, (r) => { r.mandatory_class = "none" }, /mandatory_class/],
+  ["mandatory_class auth-secrets-pii against a none gate.md", {}, (r) => { r.mandatory_class = "auth-secrets-pii" }, /mandatory_class/],
+  ["whole_diff not run against a needed gate.md", { whole: "needed" }, (r) => { r.whole_diff = { run: false, reason: "skipped" } }, /whole_diff/],
+  ["whole_diff run against a not-needed gate.md", {}, (r) => { r.whole_diff = { run: true, reason: null } }, /whole_diff/],
+  ["a whole_diff reason other than gate.md's", {}, (r) => { r.whole_diff = { run: false, reason: "no reviewer needed" } }, /whole_diff/],
+]) {
+  test(`#given a record with ${name} #when validated #then the classification blocks`, () => {
+    withScenario(options, (s) => {
+      expectFolderPassed(s.validate())
+      mutate(s.record)
+      s.save()
+      expectFolderBlocked(s.validate(), field)
+    })
+  })
+}
+
+test("#given a gate.md with Whole-diff review needed and a matching record #when validated #then it passes", () => {
+  withScenario({ whole: "needed" }, (s) => expectFolderPassed(s.validate()))
+})
+
+function addRiskInvocation(s) {
+  const both = twoInvocationRecord()
+  s.record.reviewers_run = both.reviewers_run
+  s.record.resolution = both.resolution
+  const risk = path.join(s.evidence, "strategic-risk-review.txt")
+  writeFileSync(risk, buildTrailer({ invocation: "strategic-risk-review", sections_covered: "1,2,3,4" }))
+  s.record.verdicts = [s.record.verdicts[0], { invocation: "strategic-risk-review", verdict: "PASS", trailer_artifact: path.relative(s.repository.directory, risk), trailer_sha256: planDigest(risk) }]
+  s.save()
+}
+
+test("#given an internal-tooling gate.md with one implementation-audit #when validated #then it passes", () => {
+  withScenario({ tier: "internal-tooling" }, (s) => expectFolderPassed(s.validate()))
+})
+
+test("#given an internal-tooling gate.md with two invocations #when validated #then reviewers_run blocks", () => {
+  withScenario({ tier: "internal-tooling" }, (s) => {
+    expectFolderPassed(s.validate())
+    addRiskInvocation(s)
+    expectFolderBlocked(s.validate(), /reviewers_run/)
+  })
+})
+
+test("#given an internal-tooling gate.md with a mandatory class #when validated #then Risk tier blocks", () => {
+  withScenario({ tier: "internal-tooling", cls: "wire-contract-api" }, (s) => {
+    expectFolderBlocked(s.validate(), /Risk tier/)
+  })
+})
+
+test("#given a product gate.md with wire-contract-api and both invocations #when validated #then it passes", () => {
+  withScenario({ cls: "wire-contract-api" }, (s) => expectFolderPassed(s.validate()))
+})
+
+test("#given a product gate.md with wire-contract-api and one invocation #when validated #then reviewers_run blocks", () => {
+  withScenario({ cls: "wire-contract-api" }, (s) => {
+    expectFolderPassed(s.validate())
+    s.record.reviewers_run = ["implementation-audit"]
+    s.record.resolution = s.record.resolution.slice(0, 1)
+    s.record.verdicts = s.record.verdicts.slice(0, 1)
+    s.save()
+    expectFolderBlocked(s.validate(), /reviewers_run/)
+  })
+})
+
+test("#given a product gate.md with class none and one invocation #when validated #then it passes", () => {
+  withScenario({ tier: "product", cls: "none" }, (s) => expectFolderPassed(s.validate()))
+})
+
+test("#given a gate.md still carrying a Review tier bullet #when validated #then Risk tier blocks", () => {
+  withScenario({}, (s) => {
+    expectFolderPassed(s.validate())
+    const gate = path.join(s.folder, "gate.md")
+    writeFileSync(gate, `${readFileSync(gate, "utf8").trimEnd()}\n- **Review tier**: standard\n`)
+    expectFolderBlocked(s.validate(), /Review tier[^]*Risk tier/)
+  })
+})
+
+test("#given a requirement in specs/cap/other.md beside a rename-only spec #when validated #then it counts as a criterion", () => {
+  withScenario({ specs: { "feature/spec.md": renameOnlySpec, "cap/other.md": specText("Other update", "The system SHALL update another record.") } }, (s) => expectFolderPassed(s.validate()))
+})
+
+const skipFolder = { skipSpecs: true, specs: {} }
+const renameFolder = { specs: { "feature/spec.md": renameOnlySpec } }
+
+for (const [name, base] of [["skip_specs", skipFolder], ["rename-only", renameFolder]]) {
+  test(`#given a ${name} folder with a valid gate.md criteria block #when validated #then it passes`, () => {
+    withScenario({ ...base, gateExtra: gateCriteria }, (s) => expectFolderPassed(s.validate()))
+  })
+
+  test(`#given a ${name} folder without gate.md criteria #when validated #then the criteria block`, () => {
+    withScenario({ ...base, gateExtra: gateCriteria }, (s) => {
+      expectFolderPassed(s.validate())
+      writeFileSync(path.join(s.folder, "gate.md"), readFileSync(path.join(s.folder, "gate.md"), "utf8").replace(gateCriteria, ""))
+      expectFolderBlocked(s.validate(), /Feature-specific criteria/)
+    })
+  })
+}
+
+for (const [name, field, value] of [
+  ["an empty Invariant", "Invariant", ""],
+  ["a placeholder Negative control", "Negative control", "<what must fail>"],
+  ["a TBD Observable", "Observable", "TBD"],
+  ["a deferral Observable", "Observable", "todo later"],
+]) {
+  test(`#given a skip_specs folder whose gate.md has ${name} #when validated #then the criteria block naming the field`, () => {
+    const broken = gateCriteria.replace(new RegExp(`(${field}:).*`), `$1 ${value}`.trimEnd())
+    assert.notEqual(broken, gateCriteria)
+    withScenario({ ...skipFolder, gateExtra: gateCriteria }, (s) => {
+      expectFolderPassed(s.validate())
+      writeFileSync(path.join(s.folder, "gate.md"), readFileSync(path.join(s.folder, "gate.md"), "utf8").replace(gateCriteria, broken))
+      expectFolderBlocked(s.validate(), new RegExp(`criteria[^\\n]*${field}`))
+    })
+  })
+}
+
+test("#given --plan-only on a valid folder #when validated #then it passes", () => {
+  withFolder({}, (f) => expectFolderPassed(planOnlyFolder(f)))
+})
+
+test("#given --plan-only on a folder with an unfilled gate.md #when validated #then it blocks on the placeholder", () => {
+  withFolder({}, (f) => {
+    expectFolderPassed(planOnlyFolder(f))
+    writeFileSync(path.join(f.folder, "gate.md"), template("gate.md"))
+    expectFolderBlocked(planOnlyFolder(f), /placeholder/)
+  })
+})
+
+test("#given a directory without gate.md as the plan #when validated #then it is an unreadable file plan", () => {
+  withFolder({}, (f) => {
+    rmSync(path.join(f.folder, "gate.md"))
+    expectFolderBlocked(planOnlyFolder(f), /^plan: cannot read /)
+  })
+})
+
+test("#given a reviewer criterion copied from a spec requirement #when validated #then adversarial_criteria blocks", () => {
+  const copied = "The system SHALL update one record."
+  withScenario({ auditTrailer: buildTrailer({ criteria: [{ invariant: copied, positive_witness: "a record is updated", negative_control: "an invalid record is rejected", observable: "the response status", boundary: "the update endpoint" }] }) }, (s) => {
+    expectFolderBlocked(s.validate(), /adversarial_criteria/)
+  })
+})
+
+test("#given a reviewer criterion that is original #when validated against a folder plan #then it passes", () => {
+  withScenario({}, (s) => expectFolderPassed(s.validate()))
+})
+
+test("#given a fresh clone of a repo holding the folder, the record and the trailer #when validated #then it passes", () => {
+  withScenario({}, (s) => {
+    const { git, directory } = s.repository
+    git("add", "-A")
+    git("commit", "-q", "-m", "gate evidence")
+    const clone = mkdtempSync(path.join(tmpdir(), "omo-gate-clone-"))
+    try {
+      execFileSync("git", ["clone", "-q", directory, clone], { encoding: "utf8" })
+      const result = spawnSync(process.execPath, [validator, "--record", path.join(clone, "evidence/merge-gate.json"), "--plan", path.join(clone, FOLDER), "--repo", clone], { encoding: "utf8" })
+      expectFolderPassed(result)
+    } finally {
+      rmSync(clone, { recursive: true, force: true })
+    }
+  })
+})
+
+// A change without requirements is authored from the shipped template: its commented criteria
+// example is uncommented and filled. The OpenSpec checker and the gate's --plan-only must agree.
+for (const [kind, base] of [["skip_specs", skipFolder], ["rename-only", renameFolder]]) {
+  test(`#given a ${kind} folder with the template's criteria example uncommented and filled #when checked #then the checker and --plan-only pass`, () => {
+    withFolder({ ...base, example: "filled" }, (f) => {
+      expectFolderPassed(checkFolder(f))
+      expectFolderPassed(planOnlyFolder(f))
+    })
+  })
+
+  test(`#given a ${kind} folder with the template's criteria example left commented #when checked #then the checker and --plan-only block naming the criteria`, () => {
+    withFolder({ ...base, example: "commented" }, (f) => {
+      const checked = checkFolder(f)
+      assert.equal(checked.status, 1, checked.stdout)
+      assert.match(checked.stderr, /criteria/i)
+      expectFolderBlocked(planOnlyFolder(f), /criteria/i)
+    })
+  })
+
+  test(`#given a ${kind} folder with the template's criteria example uncommented but unfilled #when checked #then the checker and --plan-only block naming the criteria`, () => {
+    withFolder({ ...base, example: "placeholders" }, (f) => {
+      const checked = checkFolder(f)
+      assert.equal(checked.status, 1, checked.stdout)
+      assert.match(checked.stderr, /criteria/i)
+      expectFolderBlocked(planOnlyFolder(f), /criteria/i)
+    })
+  })
+}
diff --git a/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs b/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs
index b092ee68d5..ca71ab40ff 100755
--- a/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs
+++ b/team-config/agent/skills/review-work/scripts/validate-openspec-change.mjs
@@ -2,10 +2,20 @@
 import * as fs from "node:fs/promises";
 import * as path from "node:path";
 import { pathToFileURL } from "node:url";
+import {
+	abortRuleDefects,
+	planContent,
+	readRiskTier,
+	scanMarkdown,
+	substantiveCriteriaDefects,
+	topLevelField,
+	valueDefect,
+} from "./plan-contract.mjs";
 
 const GATE_FIELDS = [
 	"Mandatory class",
-	"Review tier",
+	"Risk tier",
+	"Author's risk assessment",
 	"Whole-diff review",
 	"Accepted residual risks",
 	"Out of scope for blocking",
@@ -17,7 +27,6 @@ const MANDATORY_CLASSES = new Set([
 	"wire-contract-api",
 	"concurrency-state",
 ]);
-const REVIEW_TIERS = new Set(["standard", "full"]);
 const PLACEHOLDER = /<[^>]+>|\b(?:TBD|TODO)\b/i;
 
 async function regularFile(file) {
@@ -48,10 +57,12 @@ async function markdownFiles(root) {
 	return out.sort();
 }
 
+// Returns whether the specs hold a requirement, counted by the same per-line parse that validates it, so the gate.md
+// criteria fallback applies exactly when no requirement supplies the review criteria.
 function validateSpecs(files, texts, skipSpecs, errors) {
 	if (files.length === 0) {
 		if (!skipSpecs) errors.push("specs: at least one Markdown spec is required");
-		return;
+		return false;
 	}
 	if (skipSpecs) errors.push("specs: skip_specs requires no Markdown specs");
 	let renameCount = 0;
@@ -97,6 +108,7 @@ function validateSpecs(files, texts, skipSpecs, errors) {
 	}
 	if (requirementCount === 0 && renameCount === 0)
 		errors.push("specs: at least one Requirement or rename is required");
+	return requirementCount > 0;
 }
 
 // Mirrors OpenSpec 1.14.3 utils/task-progress.js TASK_LINE_PATTERN: any checkbox it counts as a tracked task must satisfy the team contract.
@@ -124,41 +136,48 @@ function validateTasks(text, errors) {
 	}
 }
 
-function validateGate(text, errors) {
+/**
+ * Checks gate.md as the merge-gate section of the change, on content-only text (code fences and HTML comments are not
+ * gate content). The class, tier and abort-field rules are the gate validator's own, imported from plan-contract.mjs.
+ * `hasRequirements` says whether the specs carry review criteria; when they do not (skip_specs, rename-only deltas),
+ * gate.md must.
+ */
+function validateGate(text, hasRequirements, errors) {
+	const content = planContent(scanMarkdown(text));
 	const values = new Map();
-	const lines = text.split(/\r?\n/);
 	for (const field of GATE_FIELDS) {
-		const prefix = `- **${field.toLowerCase()}**:`;
-		const matches = lines
-			.filter(line => line.toLowerCase().startsWith(prefix))
-			.map(line => line.slice(prefix.length).trim());
-		if (matches.length !== 1 || !matches[0]) {
+		const found = topLevelField(content, field);
+		if (found.count !== 1 || !found.value) {
 			errors.push(`${field}: expected exactly one nonempty top-level bullet`);
 			continue;
 		}
-		const value = matches[0];
-		values.set(field, value);
-		if (PLACEHOLDER.test(value)) errors.push(`${field}: placeholder text is forbidden`);
+		values.set(field, found.value);
+		if (field !== "Author's risk assessment" && PLACEHOLDER.test(found.value))
+			errors.push(`${field}: placeholder text is forbidden`);
 	}
+	if (topLevelField(content, "Review tier").count > 0)
+		errors.push("Review tier: removed; the gate reads - **Risk tier**: product or internal-tooling");
 
 	const mandatory = values.get("Mandatory class");
-	const mandatoryName = mandatory?.split(/\s+/, 1)[0];
-	if (mandatory && !MANDATORY_CLASSES.has(mandatoryName))
-		errors.push(`Mandatory class: unsupported value ${mandatoryName}`);
-	if (mandatoryName === "none" && !/^none\s*\(.+\)$/.test(mandatory))
-		errors.push("Mandatory class: none requires a concrete parenthesized reason");
-
-	const tier = values.get("Review tier");
-	if (tier && !REVIEW_TIERS.has(tier)) errors.push(`Review tier: unsupported value ${tier}`);
-	if (mandatoryName && mandatoryName !== "none" && tier && tier !== "full")
-		errors.push(`Review tier: ${mandatoryName} requires full`);
+	if (mandatory && !MANDATORY_CLASSES.has(mandatory.replace(/`/g, ""))) {
+		errors.push(`Mandatory class: unsupported value ${mandatory}; use exactly one class, with no reason (it goes in Author's risk assessment)`);
+	}
+	if (values.has("Risk tier")) {
+		const parsed = readRiskTier(content);
+		if (parsed.error) errors.push(`Risk tier: ${parsed.error}`);
+	}
+	const assessment = values.get("Author's risk assessment");
+	const defect = assessment === undefined ? undefined : valueDefect(assessment);
+	if (defect) errors.push(`Author's risk assessment: ${defect}; say what could break and how badly`);
 
 	const wholeDiff = values.get("Whole-diff review");
 	if (wholeDiff && wholeDiff !== "needed" && !/^not needed\s*\(.+\)$/.test(wholeDiff))
 		errors.push("Whole-diff review: use needed or not needed (<concrete reason>)");
-	for (const field of ["Accepted residual risks", "Out of scope for blocking"]) {
-		const value = values.get(field);
-		if (value?.toLowerCase() === "none") errors.push(`${field}: none requires a concrete parenthesized reason`);
+	for (const message of abortRuleDefects(content)) {
+		if (!message.endsWith(": missing") && !message.endsWith(": duplicate")) errors.push(message);
+	}
+	if (!hasRequirements) {
+		for (const { field, detail } of substantiveCriteriaDefects(content, "gate.md criteria")) errors.push(`${field}: ${detail}`);
 	}
 }
 
@@ -282,26 +301,38 @@ function parseSkipSpecs(text, errors) {
 	return skipSpecs;
 }
 
-export async function validateOpenSpecChange(changeDir) {
+/**
+ * Pure checker over a snapshot: a Map of change-relative path (`/`-separated) to file bytes. It reads nothing from disk,
+ * so a caller that digests the same snapshot validates exactly the bytes it pins.
+ */
+export function validateOpenSpecFiles(snapshot) {
 	const errors = [];
-	const root = path.resolve(changeDir);
+	const text = name => snapshot.get(name)?.toString("utf8");
 	for (const file of ["proposal.md", "gate.md", "tasks.md"]) {
-		if (!(await regularFile(path.join(root, file)))) errors.push(`${file}: required regular file is missing`);
+		if (!snapshot.has(file)) errors.push(`${file}: required regular file is missing`);
 	}
-	if (await regularFile(path.join(root, "proposal.md")))
-		validateProposal(await fs.readFile(path.join(root, "proposal.md"), "utf8"), errors);
-	const specs = await markdownFiles(path.join(root, "specs"));
-	const texts = new Map(await Promise.all(specs.map(async file => [file, await fs.readFile(file, "utf8")])));
-	const metadata = path.join(root, ".openspec.yaml");
-	const skipSpecs = (await regularFile(metadata)) && parseSkipSpecs(await fs.readFile(metadata, "utf8"), errors);
-	validateSpecs(specs, texts, skipSpecs, errors);
-	if (await regularFile(path.join(root, "tasks.md")))
-		validateTasks(await fs.readFile(path.join(root, "tasks.md"), "utf8"), errors);
-	if (await regularFile(path.join(root, "gate.md")))
-		validateGate(await fs.readFile(path.join(root, "gate.md"), "utf8"), errors);
+	if (snapshot.has("proposal.md")) validateProposal(text("proposal.md"), errors);
+	const specs = [...snapshot.keys()].filter(name => name.startsWith("specs/") && name.endsWith(".md")).sort();
+	const texts = new Map(specs.map(file => [file, text(file)]));
+	const skipSpecs = snapshot.has(".openspec.yaml") && parseSkipSpecs(text(".openspec.yaml"), errors);
+	const hasRequirements = validateSpecs(specs, texts, skipSpecs, errors);
+	if (snapshot.has("tasks.md")) validateTasks(text("tasks.md"), errors);
+	if (snapshot.has("gate.md")) validateGate(text("gate.md"), hasRequirements, errors);
 	return errors;
 }
 
+export async function validateOpenSpecChange(changeDir) {
+	const root = path.resolve(changeDir);
+	const snapshot = new Map();
+	for (const file of ["proposal.md", "gate.md", "tasks.md", ".openspec.yaml"]) {
+		if (await regularFile(path.join(root, file))) snapshot.set(file, await fs.readFile(path.join(root, file)));
+	}
+	for (const file of await markdownFiles(path.join(root, "specs"))) {
+		snapshot.set(path.relative(root, file).split(path.sep).join("/"), await fs.readFile(file));
+	}
+	return validateOpenSpecFiles(snapshot);
+}
+
 async function main() {
 	const changeDir = process.argv[2];
 	if (!changeDir || process.argv.length !== 3) {
diff --git a/team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts b/team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts
index 4d17513b84..52f22f8bc2 100644
--- a/team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts
+++ b/team-config/agent/skills/review-work/scripts/validate-openspec-change.test.ts
@@ -69,8 +69,9 @@ The system SHALL update one record.
 		path.join(root, "gate.md"),
 		`# Gate
 
-- **Mandatory class**: none (local reversible behaviour)
-- **Review tier**: standard
+- **Mandatory class**: none
+- **Risk tier**: product
+- **Author's risk assessment**: a wrong update overwrites a record, so the update path is covered by requirements
 - **Whole-diff review**: not needed (one module)
 - **Accepted residual risks**: none (all specified paths are covered)
 - **Out of scope for blocking**: none (the change is self-contained)
@@ -83,6 +84,20 @@ The system SHALL update one record.
 	return root;
 }
 
+// A change without requirements carries its review criteria in gate.md.
+const GATE_CRITERIA = `
+- Feature-specific criteria:
+  - Invariant: a pure tooling change keeps the pinned command output byte-identical
+    Positive witness: the command prints the same bytes before and after the change
+    Negative control: a changed byte in the command output MUST fail the comparison
+    Observable: the diff of the two outputs
+    Boundary: the command invoked as a process
+`;
+
+async function withGateCriteria(root: string): Promise<void> {
+	await fs.appendFile(path.join(root, "gate.md"), GATE_CRITERIA);
+}
+
 function run(root: string): { exitCode: number; stdout: string; stderr: string } {
 	const result = Bun.spawnSync(["node", SCRIPT, root]);
 	return {
@@ -157,7 +172,8 @@ describe("validate-openspec-change", () => {
 
 	for (const field of [
 		"Mandatory class",
-		"Review tier",
+		"Risk tier",
+		"Author's risk assessment",
 		"Whole-diff review",
 		"Accepted residual risks",
 		"Out of scope for blocking",
@@ -182,6 +198,7 @@ describe("validate-openspec-change", () => {
 		const root = await fixture();
 		await fs.rm(path.join(root, "specs"), { recursive: true });
 		await Bun.write(path.join(root, ".openspec.yaml"), metadata);
+		await withGateCriteria(root);
 		return root;
 	}
 
@@ -257,9 +274,33 @@ describe("validate-openspec-change", () => {
 			path.join(root, "specs/feature/spec.md"),
 			"## RENAMED Requirements\n\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: New`\n",
 		);
+		await withGateCriteria(root);
 		expect(run(root).exitCode).toBe(0);
 	});
 
+	it("requires gate.md criteria for a rename-only delta that also holds an empty requirement heading", async () => {
+		const root = await fixture();
+		await Bun.write(
+			path.join(root, "specs/feature/spec.md"),
+			"## RENAMED Requirements\n\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: New`\n\n### Requirement:\nstray text\n",
+		);
+		const result = run(root);
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toContain("gate.md criteria");
+	});
+
+	for (const field of ["Positive witness", "Boundary"]) {
+		it(`rejects gate.md criteria whose ${field} is a placeholder`, async () => {
+			const root = await skippedSpecsFixture(GENERATED_METADATA);
+			const gate = path.join(root, "gate.md");
+			const text = await Bun.file(gate).text();
+			await Bun.write(gate, text.replace(new RegExp(`(${field}:)[^\\n]*`), "$1 <to be written>"));
+			const result = run(root);
+			expect(result.exitCode).toBe(1);
+			expect(result.stderr).toContain(`gate.md criteria.0.${field}`);
+		});
+	}
+
 	for (const operation of ["MODIFIED", "REMOVED"]) {
 		it(`accepts ${operation} requirements with negative controls`, async () => {
 			const root = await fixture();
@@ -392,7 +433,7 @@ describe("validate-openspec-change", () => {
 	it("rejects an unknown mandatory class", async () => {
 		const root = await fixture();
 		const gate = path.join(root, "gate.md");
-		await Bun.write(gate, (await Bun.file(gate).text()).replace("none (local reversible behaviour)", "filesystem"));
+		await Bun.write(gate, (await Bun.file(gate).text()).replace("**: none\n", "**: filesystem\n"));
 		const result = run(root);
 		expect(result.exitCode).toBe(1);
 		expect(result.stderr).toContain("Mandatory class: unsupported value filesystem");
@@ -407,3 +448,75 @@ describe("validate-openspec-change", () => {
 		expect(result.stderr).toContain("Whole-diff review: placeholder text is forbidden");
 	});
 });
+
+describe("validate-openspec-change gate.md under the Risk tier", () => {
+	const GATE = (fields: Record<string, string | null>) =>
+		`# Gate\n\n${Object.entries(fields)
+			.filter(([, value]) => value !== null)
+			.map(([label, value]) => `- **${label}**: ${value}`)
+			.join("\n")}\n`;
+	const VALID = {
+		"Mandatory class": "none",
+		"Risk tier": "product",
+		"Author's risk assessment": "a wrong update overwrites a record, so the update path is covered by requirements",
+		"Whole-diff review": "not needed (one module)",
+		"Accepted residual risks": "none (all specified paths are covered)",
+		"Out of scope for blocking": "none (the change is self-contained)",
+	};
+	async function withGate(fields: Record<string, string | null>): Promise<string> {
+		const root = await fixture();
+		await Bun.write(path.join(root, "gate.md"), GATE(fields));
+		return root;
+	}
+
+	it("accepts a Risk tier gate.md with a bare none class", async () => {
+		expect(run(await withGate(VALID))).toEqual({ exitCode: 0, stdout: "passed\n", stderr: "" });
+	});
+	it("accepts internal-tooling with class none", async () => {
+		expect(run(await withGate({ ...VALID, "Risk tier": "internal-tooling" })).exitCode).toBe(0);
+	});
+	it("accepts a mandatory class under the product tier", async () => {
+		expect(run(await withGate({ ...VALID, "Mandatory class": "wire-contract-api" })).exitCode).toBe(0);
+	});
+	it("rejects a Review tier bullet with an error naming Risk tier", async () => {
+		const result = run(await withGate({ ...VALID, "Review tier": "standard" }));
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toMatch(/Review tier[^\n]*Risk tier/);
+	});
+	it("rejects internal-tooling with a mandatory class", async () => {
+		const result = run(await withGate({ ...VALID, "Risk tier": "internal-tooling", "Mandatory class": "wire-contract-api" }));
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toContain("Risk tier");
+	});
+	it("rejects a Risk tier other than product or internal-tooling", async () => {
+		const result = run(await withGate({ ...VALID, "Risk tier": "personal" }));
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toContain("Risk tier");
+	});
+	it("rejects a missing Risk tier", async () => {
+		const result = run(await withGate({ ...VALID, "Risk tier": null }));
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toContain("Risk tier:");
+	});
+	it("rejects a missing Author's risk assessment", async () => {
+		const result = run(await withGate({ ...VALID, "Author's risk assessment": null }));
+		expect(result.exitCode).toBe(1);
+		expect(result.stderr).toContain("Author's risk assessment:");
+	});
+	for (const [name, value] of [
+		["a placeholder", "<what could break>"],
+		["TBD", "TBD"],
+		["no substance", "-"],
+	]) {
+		it(`rejects ${name} as the Author's risk assessment`, async () => {
+			const result = run(await withGate({ ...VALID, "Author's risk assessment": value }));
+			expect(result.exitCode).toBe(1);
+			expect(result.stderr).toContain("Author's risk assessment:");
+		});
+	}
+	it("accepts a bare none for the abort fields only with a reason", async () => {
+		const bare = run(await withGate({ ...VALID, "Accepted residual risks": "none" }));
+		expect(bare.exitCode).toBe(1);
+		expect(bare.stderr).toContain("Accepted residual risks:");
+	});
+});

```
- Repository context and plan: Worktree /Users/tim/git/oh-my-pi/.worktrees/openspec-gate-v2. Plan (exact bytes behind plan_sha256): /Users/tim/git/oh-my-pi/.worktrees/openspec-gate-v2/.omo/gate-deltas/F2-0b139221f7cc-wave-1.plan.md. Read it; the diff above excludes .omo/.
- Manual QA matrix and artifacts: | # | Scenario | Exact command / action | Expected | Observed | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | internal-tooling folder: GC baseline/ready/snapshot, real auditor record, spec edit, record-only commit | installed scripts in scratch project (f1.md scenario 1) | PLAN copy sha == snapshot plan_sha256; passed; blocked on plan_sha256; passed after restore and after record-only commit | equal=True; passed; blocked `plan_sha256: records c07bf0…`; passed; passed | PASS | .omo/evidence/openspec-gate-v2/f1.md |
| 2 | product + wire-contract-api folder | record with implementation-audit only / both / class none | blocked / passed / blocked | `mandatory_class requires missing invocation strategic-risk-review` / passed / `record says none but gate.md says wire-contract-api` | PASS | .omo/evidence/openspec-gate-v2/f1.md |
| 3 | --plan-only on folders | valid; no Negative control; Review tier; skip_specs commented / filled / placeholder Boundary criteria | passed; blocked; blocked; blocked; passed; blocked | as expected, stderr in artifact | PASS | .omo/evidence/openspec-gate-v2/f1.md |
| 4 | Mechanical: 9 tracked records at their adding commit, main vs new validator | loop in f1-4-mechanical.txt | identical per record | same=9 diff=0 | PASS | .omo/evidence/openspec-gate-v2/f1-4-mechanical.txt |
| 5 | Stop hook with real omp -p | merge claim naming folder record; same with one spec line edited | no Merge gate message; Merge gate rejection then NOT RUN reply | [] ; rejection naming plan_sha256, second reply NOT RUN | PASS | .omo/evidence/openspec-gate-v2/f1-5-hook-accepted.jsonl, f1-5-hook-edited-spec-negative-control.jsonl |
| 6 | Team-config suite on reviewed head 37dd1f1a84 | bun run test:team-config | 0 fail | 529 pass, 0 fail | PASS | .omo/evidence/openspec-gate-v2/team-config-tests.txt |
- Author-supplied behavioural criteria: From the plan's ## Merge gate:

- Author's risk assessment: the validator and convergence are the merge gate for every gated change; a parser or
  hashing mistake either blocks honest work (visible) or lets an edited spec, a reclassified change or a missing
  reviewer pass (silent). The `gate.md` format change breaks change folders written with `Review tier` (none are
  tracked in this repo).
- Mandatory class: wire-contract-api
- Risk tier: product
- Why one plan: the folder branch in convergence, the `validateOpenSpecFiles` export and the `gate.md` field change have
  no consumer without folder plans in the validator, and folder plans in the validator cannot run a review-work wave
  without convergence. The independently useful part shipped as P4a.
- Whole-diff review: needed (gate validator, convergence, OpenSpec checker and the new snapshot module are independently testable scripts, plus the review-work workflow that drives them)
- Accepted residual risks: a process with write access to the repo that swaps a directory for a symlink and back while the snapshot is read, or rewrites the read-only plan copy between snapshot and the reviewer's read, can feed reviewers other bytes; both need a deliberate actor already able to edit the code, and the plan-copy case equals today's file-plan exposure; committed symlinks and FIFOs still block (Tim, 2026-10-22). A change misclassified as `none` with `Risk tier: internal-tooling` gets one reviewer; the auditor's `security_delta: yes` is the catch, as for file plans.
- Out of scope for blocking: plan-review hash binding (P3a), OpenSpec CLI pin and project installer (P3b), OmO state removal (P5), records that already block on `main`, the Risk tier rules themselves (merged in `da68f59673`).
- Feature-specific criteria:
  - Invariant: a folder-plan record stays valid only while every file in the change folder is byte-identical to what the reviewers read.
    Positive witness: an unchanged folder validates `passed`, also after a post-review commit that adds only the record.
    Negative control: editing a spec line, adding a file, deleting a file, or replacing a file with a symlink after the snapshot MUST block.
    Observable: validator stdout and the stderr field (`plan_sha256` or the entry path).
    Boundary: installed `validate-gate-record.mjs --plan <change-dir> --record <record>`.
  - Invariant: the OpenSpec checks, the criteria, the reviewers' plan copy and `plan_sha256` come from the same bytes.
    Positive witness: the `GC snapshot` plan copy hashes to the digest the validator computes from the unchanged folder.
    Negative control: a spec without its Negative control MUST block even when `plan_sha256` matches; a folder edited after `GC snapshot` MUST make `GC wave` refuse; an entry swapped for a symlink between listing and open MUST block.
    Observable: stderr naming the OpenSpec diagnostic, `plan_sha256` or the entry; `GC wave` refusal text.
    Boundary: installed validator and `gate-convergence.mjs` with `--plan <change-dir>`.
  - Invariant: a folder plan's review depth and fix-round cap follow `Risk tier` and `Mandatory class` in `gate.md` with the same rules as a file plan.
    Positive witness: `internal-tooling` + `none` with one `implementation-audit` passes; `product` + `wire-contract-api` with both passes; an `internal-tooling` folder's lane stops at the file-plan cap.
    Negative control: `internal-tooling` with two invocations MUST block; `product` + `wire-contract-api` with one MUST block; a record whose `mandatory_class` or `whole_diff` differs from `gate.md` MUST block; `Review tier` in `gate.md` MUST block.
    Observable: stderr naming `reviewers_run`, `mandatory_class`, `whole_diff` or `Risk tier`; convergence cap message.
    Boundary: same CLIs, folder plan.
  - Invariant: every valid change folder yields at least one review criterion from the files the OpenSpec checker reads.
    Positive witness: a requirement in `specs/cap/other.md` is a criterion; a `skip_specs: true` folder with substantive `gate.md` criteria passes.
    Negative control: a `skip_specs: true` or rename-only folder without `gate.md` criteria, or with empty or placeholder values, MUST block.
    Observable: stderr naming the criteria field.
    Boundary: validator, folder plan, `--plan-only` and full mode.
  - Mechanical: file-plan records keep their outcome.
    Invariant: every tracked `.omo/evidence/gate/*.json` record gives the same `passed` or blocked outcome at the commit that added it with the new validator as with `main`'s.
    Observable: validator stdout per record, both validators.
    Boundary: validator CLI against the committed records.

- Whole-diff review report and its class list, when F3 ran: /Users/tim/git/oh-my-pi/.worktrees/openspec-gate-v2/.omo/evidence/openspec-gate-v2/f3-wave-1.md (wave 1 PASS, four should-fixes fixed in 8d38826f94; fix delta OKAY)

Asymmetry constraint: you have only the diff and the plan. You do not have my reasoning for any specific decision. If something looks wrong, flag it - I will dismiss what is intentional. Report what you find; the blocking threshold below decides which findings block.

Blocking threshold: report every finding you can substantiate, but mark it a blocker only when a realistic trigger leads to it and the result (a) breaks the goal, the value proof, a `## Merge gate` criterion, or an existing consumer - of the change, or of the plan when you review one - or (b) reaches a protected asset. A realistic trigger is normal use, input or state that occurs in ordinary operation, or an actor outside the trust boundary sending plausible input; a state the user would have to construct deliberately on their own machine (corrupted or permission-stripped local files, hand-inserted NUL bytes, racing manual runs) is not one. A gap that appears only for an input variant the change does not claim to handle (an alternative syntax or layout) and whose damage stays in the user's own environment and is reversible is a note, not a blocker. Work the plan excludes that the change implements anyway is a blocker without a trigger. A protected asset is production data, a real credential, third-party personal data, tenant isolation, money, an audit trail, or irreversible state; a local development default in the developer's own environment is not one. Weakening access to a protected asset counts even when no data moves. Judge by causation, not location: a defect the change causes or exposes in unchanged code counts; a pre-existing defect the change neither causes nor exposes is a note. Each blocker starts a line with `Blocker B<n>:` (numbered from B1 in order) and names its trigger, preconditions, impact, and whether the damage is reversible. A finding whose precondition already grants what exploiting it would gain is not a blocker. Every other finding is a note with one line on why it does not block. A false note costs nothing; a false blocker costs a fix wave.

Review exactly these five sections:
1. Goal and behavioural contract
2. Correctness, regressions, architecture, wire contracts
3. Security and privacy delta
4. Verification adequacy
5. Final `PASS | FAIL | INCONCLUSIVE`

Generate at least one adversarial behavioural criterion of your own using Phase 2.5 fields, and make every criterion you emit your own - the validator rejects a trailer carrying any criterion whose invariant is restated from the plan, so quoting one back beside an original does not satisfy the rule. Author-supplied criteria are inputs, never complete review scope.

Security scope: a finding blocks only when it cites changed lines in DIFF_RANGE, or shows change altered exploitability or exposure of pre-existing code. Otherwise label it `PRE-EXISTING / OUT-OF-SCOPE` as a note.

Brief guard: if this message did not carry all five numbered sections, or withheld the QA matrix, return INCONCLUSIVE and name what was missing. Do not answer a narrower brief as if it were the whole assignment.

Return each blocker on its own `Blocker B<n>:` line with severity, `file:line` or artifact evidence, violated contract, and fix direction. For every blocker name `class:` and list `sites:` across the whole tree with the search you ran, or `single instance: <reason>`. Confirm each listed class is closed at every site; do not re-derive classes F3 already closed. Close with exactly one verdict token: PASS, FAIL, or INCONCLUSIVE.

End your reply with this block verbatim, filled in. It is the only record of what you were actually asked:

REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: <numbers you received, comma-separated>
model_id: <your exact resolved model ID, or unresolved>
security_delta: <yes|no - yes only when the change touches a real credential, an authentication or authorisation path, or third-party personal data, or weakens access to a protected asset; a synthetic credential limited to disposable local/test services is no>
verdict: <PASS|FAIL|INCONCLUSIVE>
blockers: <the B<n> ids of your Blocker lines, comma-separated, when verdict is FAIL; none otherwise>
adversarial_criteria:
- invariant: <your own, not restated from the plan>
  positive_witness: <representative valid outcome>
  negative_control: <plausible broken outcome that MUST fail>
  observable: <runtime evidence distinguishing them>
  boundary: <layer where the result is checked>
END-REVIEW-TRAILER