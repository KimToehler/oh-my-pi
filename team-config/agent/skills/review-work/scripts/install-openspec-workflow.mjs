#!/usr/bin/env node
/**
 * Install or update the team's `omp-gated` OpenSpec workflow in a project repository.
 *
 * Writes only `openspec/schemas/omp-gated/` (replaced wholesale from the copy deployed next to this
 * script) and, when absent, `openspec/config.yaml` (the team config). Git is the backup: every
 * check runs before the first write, and the run refuses unless `git status` over both paths is
 * empty, so every byte it replaces is in HEAD. An existing config is never rewritten; a foreign
 * `schema:` is refused. A failed copy is rolled back in the same process and the rollback is
 * verified, never assumed.
 *
 * After a successful install it reports what a project set up under an older team version still
 * has to change (per-project validator copy, `Review tier` in open changes, project opsx commands),
 * without touching those files.
 *
 * Usage: node ~/.omp/agent/skills/review-work/scripts/install-openspec-workflow.mjs [project-root]
 *        (default: the git work-tree root of the current directory)
 */
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { planContent, scanMarkdown, topLevelField } from "./plan-contract.mjs"

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_SOURCE = path.join(SCRIPTS_DIR, "..", "openspec")
const SCHEMA = "openspec/schemas/omp-gated"
const CONFIG = "openspec/config.yaml"
const WORKFLOW_PATHS = [CONFIG, SCHEMA]
const DEPLOYED_VALIDATOR = "~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs"
const OLD_VALIDATOR = "scripts/validate-openspec-change.mjs"

class Refusal extends Error {}

function git(root, ...args) {
  return spawnSync("git", ["-C", root, ...args], { encoding: "utf8" })
}

function workflowStatus(root) {
  const result = git(root, "status", "--porcelain", "--ignored", "--untracked-files=all", "--", ...WORKFLOW_PATHS)
  if (result.status !== 0) throw new Error(`git status failed: ${result.stderr.trim()}`)
  return result.stdout.split("\n").filter(Boolean)
}

function lstat(file) {
  try {
    return fs.lstatSync(file)
  } catch (error) {
    if (error.code === "ENOENT") return undefined
    throw error
  }
}

function listFiles(dir, prefix = "") {
  const out = []
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(dir, rel))
    else if (entry.isFile()) out.push(rel)
    else throw new Refusal(`deployed schema holds ${rel}, which is not a regular file; redeploy the team config`)
  }
  return out.sort()
}

/** Every check that can refuse, before any write. Returns what the write phase needs. */
function preflight(target, source) {
  const top = git(target, "rev-parse", "--show-toplevel")
  if (top.status !== 0) throw new Refusal(`${target} is not inside a git work tree; run this in a git repository`)
  const root = fs.realpathSync(top.stdout.trim())
  if (fs.realpathSync(target) !== root) {
    throw new Refusal(`${target} is not the work-tree root; run it on ${root}`)
  }

  const canonical = path.join(source, "schemas", "omp-gated")
  if (!lstat(path.join(canonical, "schema.yaml"))?.isFile() || !lstat(path.join(source, "config.yaml"))?.isFile()) {
    throw new Refusal(`no deployed omp-gated schema at ${canonical}; deploy the team config first (scripts/deploy-local.sh)`)
  }
  const files = listFiles(canonical)

  for (const rel of ["openspec", "openspec/schemas", SCHEMA, CONFIG]) {
    if (lstat(path.join(root, rel))?.isSymbolicLink()) {
      throw new Refusal(`${rel} is a symlink; the installer never writes through a link (the oh-my-pi repository itself links its schema to the canonical copy)`)
    }
  }
  for (const rel of ["openspec", "openspec/schemas"]) {
    const stat = lstat(path.join(root, rel))
    if (stat && !stat.isDirectory()) throw new Refusal(`${rel} exists and is not a directory`)
  }

  const dirty = workflowStatus(root)
  if (dirty.length > 0) {
    throw new Refusal(
      `these workflow paths hold changes git cannot restore; commit or move them yourself, then rerun:\n${dirty.map((line) => `  ${line}`).join("\n")}`,
    )
  }
  const created = [
    ...(lstat(path.join(root, CONFIG)) ? [] : [CONFIG]),
    ...files.map((rel) => `${SCHEMA}/${rel}`).filter((rel) => !lstat(path.join(root, rel))),
  ]
  if (created.length > 0) {
    const ignored = git(root, "check-ignore", "-v", "--no-index", "--", ...created)
    if (ignored.status === 0) {
      // `-v` also prints a path whose last matching pattern is a negation (`!pat`): that path is NOT ignored.
      const lines = ignored.stdout.split("\n").filter(Boolean).flatMap((line) => {
        const [rule, file] = line.split("\t")
        const pattern = /^.*?:\d+:(.*)$/.exec(rule)?.[1] ?? rule
        return pattern.startsWith("!") ? [] : [`  ${file}  (${rule})`]
      })
      if (lines.length > 0) {
        throw new Refusal(
          `git ignores files this install would create, so they could not be committed with plain git add; adjust the ignore rule yourself, then rerun:\n${lines.join("\n")}`,
        )
      }
    }
    if (ignored.status !== 0 && ignored.status !== 1) throw new Error(`git check-ignore failed: ${ignored.stderr.trim()}`)
  }

  const configStat = lstat(path.join(root, CONFIG))
  if (configStat) {
    if (!configStat.isFile()) throw new Refusal(`${CONFIG} is not a regular file`)
    const schema = /^schema:[ \t]*(.*?)[ \t]*(?:#.*)?$/m.exec(fs.readFileSync(path.join(root, CONFIG), "utf8"))
    if (schema?.[1].replace(/^(["'])(.*)\1$/, "$2") !== "omp-gated") {
      const found = schema ? `schema: ${schema[1]}` : "no top-level schema: line"
      throw new Refusal(`${CONFIG} has ${found}; change it to "schema: omp-gated" (keep your rules), commit, then rerun`)
    }
  }

  const schemaTracked = git(root, "ls-files", "--error-unmatch", "--", SCHEMA).status === 0
  return { root, canonical, files, createConfig: !configStat, schemaTracked }
}

/** Replace the schema and create the config; on failure undo and verify the undo. */
function write(plan, source, hooks, out, err) {
  const { root, canonical, files, createConfig, schemaTracked } = plan
  const schemaDir = path.join(root, SCHEMA)
  let configCreated = false
  try {
    fs.rmSync(schemaDir, { recursive: true, force: true })
    for (const rel of files) {
      fs.mkdirSync(path.dirname(path.join(schemaDir, rel)), { recursive: true })
      fs.copyFileSync(path.join(canonical, rel), path.join(schemaDir, rel), fs.constants.COPYFILE_EXCL)
      hooks.afterCopy?.(rel)
    }
    if (createConfig) {
      fs.copyFileSync(path.join(source, "config.yaml"), path.join(root, CONFIG), fs.constants.COPYFILE_EXCL)
      configCreated = true
    }
    return true
  } catch (error) {
    err.push(`install failed: ${error.message}`)
    rollback(root, schemaDir, schemaTracked, configCreated, hooks, err)
    return false
  }
}

function rollback(root, schemaDir, schemaTracked, configCreated, hooks, err) {
  // The preflight saw both paths clean, so everything here is this run's copy or in HEAD.
  const steps = []
  try {
    fs.rmSync(schemaDir, { recursive: true, force: true })
    if (configCreated) fs.rmSync(path.join(root, CONFIG), { force: true })
    if (schemaTracked) {
      hooks.beforeRollbackCheckout?.()
      const checkout = git(root, "checkout", "HEAD", "--", SCHEMA)
      if (checkout.status !== 0) throw new Error(`git checkout HEAD -- ${SCHEMA}: ${checkout.stderr.trim()}`)
    }
  } catch (error) {
    steps.push(error.message)
  }
  let remaining
  try {
    remaining = workflowStatus(root)
  } catch (error) {
    steps.push(error.message)
  }
  if (steps.length === 0 && remaining.length === 0) {
    err.push("rolled back: the workflow paths match HEAD again")
    return
  }
  err.push(`rollback did not complete: ${steps.join("; ") || "workflow paths still differ from HEAD"}`)
  if (remaining?.length) err.push(...remaining.map((line) => `  ${line}`))
  if (schemaTracked) err.push(`once the cause is fixed, restore the committed schema with: git checkout HEAD -- ${SCHEMA}`)
}

function migrationNotices(root) {
  const notices = []
  const config = path.join(root, CONFIG)
  // The project-relative path, not the tail of the deployed `.../review-work/scripts/...` path.
  if (/(?:^|[^/\w.~-])(?:\.\/)?scripts\/validate-openspec-change\.mjs/m.test(fs.readFileSync(config, "utf8"))) {
    notices.push(`${CONFIG} names ${OLD_VALIDATOR}; point it at ${DEPLOYED_VALIDATOR}`)
  }
  if (lstat(path.join(root, OLD_VALIDATOR))) {
    notices.push(`${OLD_VALIDATOR} is a per-project copy; the validator ships with the team config, remove it (git rm ${OLD_VALIDATOR})`)
  }
  const changes = path.join(root, "openspec", "changes")
  for (const entry of lstat(changes)?.isDirectory() ? fs.readdirSync(changes, { withFileTypes: true }) : []) {
    if (!entry.isDirectory() || entry.name === "archive") continue
    const gate = path.join(changes, entry.name, "gate.md")
    if (!lstat(gate)?.isFile()) continue
    if (topLevelField(planContent(scanMarkdown(fs.readFileSync(gate, "utf8"))), "Review tier").count > 0) {
      const rel = `openspec/changes/${entry.name}/gate.md`
      notices.push(`${rel} has Review tier, which the gate now refuses; replace it with "- **Risk tier**: product" or internal-tooling and add "- **Author's risk assessment**"`)
    }
  }
  const commands = path.join(root, ".omp", "commands")
  for (const name of lstat(commands)?.isDirectory() ? fs.readdirSync(commands).sort() : []) {
    if (/^opsx-.*\.md$/.test(name)) {
      notices.push(`.omp/commands/${name} duplicates the deployed /opsx command; remove it (git rm .omp/commands/${name})`)
    }
  }
  return notices.map((line) => `notice: ${line}`)
}

/**
 * @param {string} target project root
 * @param {{ source?: string, hooks?: { afterCopy?: (rel: string) => void, beforeRollbackCheckout?: () => void } }} [options]
 *   `source` is the deployed `openspec/` directory; `hooks` inject failures for tests.
 * @returns {{ code: 0 | 1, out: string[], err: string[] }}
 */
export function installWorkflow(target, { source = DEFAULT_SOURCE, hooks = {} } = {}) {
  const out = []
  const err = []
  let plan
  try {
    plan = preflight(path.resolve(target), source)
  } catch (error) {
    if (!(error instanceof Refusal)) throw error
    err.push(`refused, nothing changed: ${error.message}`)
    return { code: 1, out, err }
  }
  if (!write(plan, source, hooks, out, err)) return { code: 1, out, err }

  const changed = workflowStatus(plan.root)
  out.push(
    changed.length === 0
      ? `omp-gated workflow in ${plan.root} is already current`
      : `installed omp-gated workflow in ${plan.root}; review and commit:\n${changed.map((line) => `  ${line}`).join("\n")}`,
  )
  if (changed.some((line) => !line.startsWith("??"))) {
    out.push(`replaced files keep their previous content in HEAD: git show HEAD:<path>`)
  }
  out.push(...migrationNotices(plan.root))
  return { code: 0, out, err }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length > 1 || args[0]?.startsWith("-")) {
    process.stderr.write("usage: install-openspec-workflow.mjs [project-root]\n")
    process.exit(2)
  }
  let target = args[0]
  if (target === undefined) {
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" })
    target = top.status === 0 ? top.stdout.trim() : process.cwd()
  }
  const result = installWorkflow(target)
  if (result.out.length) process.stdout.write(`${result.out.join("\n")}\n`)
  if (result.err.length) process.stderr.write(`${result.err.join("\n")}\n`)
  process.exit(result.code)
}

const entry = process.argv[1] ? fs.realpathSync.native(process.argv[1]) : undefined
if (entry && import.meta.url === pathToFileURL(entry).href) main()
