#!/usr/bin/env node
// Gate-wave convergence and fix-delta coverage for review-work (F2) and integration-review (F3).
// The skills call this script; it is the only writer and judge of the gate_baseline,
// fix_delta_review, gate_wave and convergence_decision ledger events. Every decision is
// deterministic and every undecidable state refuses rather than guesses.
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

class GateError extends Error {}
const fail = (message) => {
  throw new GateError(message)
}

const OWN_EVENTS = new Set(["gate_baseline", "fix_delta_review", "gate_wave", "convergence_decision"])
const LANES = new Set(["F2", "F3"])
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA = /^[0-9a-f]{40}$/
const OUTCOME_NAMES = { F2: ["qa", "implementation-audit", "strategic-risk-review"], F3: ["f3", "verification"] }
const OUTCOME_VALUES = new Set(["PASS", "FAIL", "INCONCLUSIVE"])
const CHOICES = new Set(["freeze", "replan", "continue"])

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

function git(repo, args, { allowFail = false, raw = false } = {}) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: raw ? "buffer" : "utf8", maxBuffer: 256 * 1024 * 1024 })
  if (result.status !== 0) {
    if (allowFail) return null
    fail(`git ${args.join(" ")} failed: ${String(result.stderr).trim()}`)
  }
  return raw ? result.stdout : result.stdout.trim()
}

function resolveCommit(repo, ref) {
  if (typeof ref !== "string" || ref === "") fail("a commit reference is required")
  const sha = git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true })
  if (!sha) fail(`unknown commit ${ref}`)
  return sha
}

const isAncestor = (repo, a, b) => spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", a, b]).status === 0
const revList = (repo, base, head) => {
  const out = git(repo, ["rev-list", "--reverse", `${base}..${head}`])
  return out === "" ? [] : out.split("\n")
}
const subject = (repo, sha) => git(repo, ["log", "-1", "--format=%s", sha])
const short = (sha) => sha.slice(0, 12)

function ledgerPath(repo) {
  return path.join(repo, ".omo", "ulw-execute", "ledger.jsonl")
}

function append(repo, event) {
  const file = ledgerPath(repo)
  mkdirSync(path.dirname(file), { recursive: true })
  let prefix = ""
  if (existsSync(file) && statSync(file).size > 0) {
    const bytes = readFileSync(file)
    if (bytes[bytes.length - 1] !== 0x0a) prefix = "\n"
  }
  appendFileSync(file, `${prefix}${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

const isString = (v) => typeof v === "string" && v.length > 0
const isSha = (v) => typeof v === "string" && SHA.test(v)
const isShaList = (v) => Array.isArray(v) && v.every(isSha)
const isStringList = (v) => Array.isArray(v) && v.every(isString)

// Field checks per own event; a wrong shape is undecidable, never silently skipped.
const SHAPES = {
  gate_baseline: { base_sha: isSha },
  fix_delta_review: {
    lane: (v) => LANES.has(v),
    rows: (v) => isStringList(v) && v.length > 0,
    base_sha: isSha,
    head_sha: isSha,
    fix_shas: (v) => isShaList(v) && v.length > 0,
    dir: isString,
    verdict: (v) => v === "OKAY" || v === "REJECT" || v === "accepted-risk",
    verdict_sha256: (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v),
    round: (v) => Number.isInteger(v) && v >= 1,
  },
  gate_wave: {
    lane: (v) => LANES.has(v),
    wave: (v) => Number.isInteger(v) && v >= 1,
    reviewed_sha: isSha,
    outcomes: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    blockers_total: (v) => Number.isInteger(v) && v >= 0,
    blockers_fix_induced: (v) => Number.isInteger(v) && v >= 0,
    fix_induced: isStringList,
    unlocated: isStringList,
    decision: (v) => v === "PASS" || v === "CONTINUE" || v === "STOP",
  },
  convergence_decision: {
    lane: (v) => LANES.has(v),
    wave: (v) => Number.isInteger(v) && v >= 1,
    choice: (v) => CHOICES.has(v),
    by: isString,
    reason: isString,
  },
}

function readLedger(repo, key, { requireBaseline = true } = {}) {
  const file = ledgerPath(repo)
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : []
  const parsed = lines.map((raw, index) => {
    if (raw.trim() === "") return { index, blank: true }
    try {
      const value = JSON.parse(raw)
      return value !== null && typeof value === "object" && !Array.isArray(value) ? { index, value } : { index, malformed: true }
    } catch {
      return { index, malformed: true }
    }
  })
  const baselines = parsed.filter((line) => line.value?.event === "gate_baseline" && line.value.plan === key)
  if (baselines.length > 1) fail(`undecidable: ${baselines.length} gate_baseline events for ${key}`)
  if (baselines.length === 0) {
    if (requireBaseline) fail(`undecidable: no gate_baseline for ${key}; run baseline before the first gate wave`)
    return { baseline: undefined, events: [] }
  }
  const start = baselines[0].index
  const events = []
  for (const line of parsed.slice(start)) {
    if (line.blank) continue
    // After the baseline every line belongs to a gated period: a line that does not parse may be a
    // truncated own event, and skipping it could hide a REJECT or a STOP.
    if (line.malformed) fail(`undecidable: ledger line ${line.index + 1} does not parse`)
    const event = line.value
    if (!OWN_EVENTS.has(event.event) || event.plan !== key) continue
    for (const [field, valid] of Object.entries(SHAPES[event.event])) {
      if (!valid(event[field])) fail(`undecidable: ledger line ${line.index + 1} ${field}`)
    }
    if (event.event === "gate_wave" && event.decision === "STOP" && !isString(event.reason)) {
      fail(`undecidable: ledger line ${line.index + 1} reason`)
    }
    events.push(event)
  }
  return { baseline: baselines[0].value.base_sha, events }
}

function laneWaves(events, lane) {
  const waves = events.filter((e) => e.event === "gate_wave" && e.lane === lane)
  waves.forEach((wave, index) => {
    if (wave.wave !== index + 1) fail(`undecidable: ${lane} wave numbers are not 1..${waves.length} in order`)
  })
  return waves
}

function commitStates(repo, state, head) {
  const deltas = state.events.filter((e) => e.event === "fix_delta_review")
  return revList(repo, state.baseline, head).map((sha) => {
    let latest
    for (const delta of deltas) if (delta.fix_shas.includes(sha)) latest = delta
    const status = latest === undefined ? "unreviewed" : latest.verdict === "REJECT" ? "rejected" : "accepted"
    return { sha, status }
  })
}

// Every reason a lane may not dispatch or record its next wave, in report order.
function readyReasons(repo, state, lane, head) {
  if (!isAncestor(repo, state.baseline, head)) fail(`undecidable: ${short(state.baseline)} is not an ancestor of HEAD`)
  const allWaves = state.events.filter((e) => e.event === "gate_wave")
  const lastWave = allWaves.at(-1)
  if (lastWave && !isAncestor(repo, lastWave.reviewed_sha, head)) fail(`undecidable: ${short(lastWave.reviewed_sha)} is not an ancestor of HEAD`)
  const reasons = []
  const states = commitStates(repo, state, head)
  for (const { sha, status } of states) {
    if (status === "unreviewed") reasons.push(`unreviewed fix commit ${short(sha)} ${subject(repo, sha)}`)
  }
  for (const { sha, status } of states) {
    if (status === "rejected") reasons.push(`rejected fix commit ${short(sha)} ${subject(repo, sha)}: review a range that includes it again`)
  }
  const waves = laneWaves(state.events, lane)
  const last = waves.at(-1)
  if (last?.decision === "STOP") {
    const decision = state.events.find((e) => e.event === "convergence_decision" && e.lane === lane && e.wave === last.wave)
    if (!decision) reasons.push(`${lane} wave ${last.wave} stopped: run decide first`)
    else if (decision.choice !== "continue") reasons.push(`${lane} wave ${last.wave} decided ${decision.choice}: no further wave in this lane`)
  }
  return reasons
}

function trackedChanges(repo) {
  return git(repo, ["status", "--porcelain", "--untracked-files=no"])
}

function showPatch(repo, sha) {
  return git(repo, ["show", "--format=fuller", "--no-renames", "--patch", sha], { raw: true })
}

function verifyDeltaDir(repo, dirArg) {
  const dir = path.resolve(repo, dirArg)
  let manifest
  try {
    manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"))
  } catch {
    fail(`patch artifacts changed since dispatch: manifest.json is missing or unreadable in ${dirArg}`)
  }
  if (!isSha(manifest?.base_sha) || !isSha(manifest?.head_sha) || !Array.isArray(manifest?.commits)) {
    fail("patch artifacts changed since dispatch: manifest.json")
  }
  const commits = revList(repo, manifest.base_sha, manifest.head_sha)
  if (commits.length === 0 || commits.join() !== manifest.commits.map((c) => c?.sha).join()) {
    fail("patch artifacts changed since dispatch: commit list")
  }
  for (const entry of manifest.commits) {
    const expected = sha256(showPatch(repo, entry.sha))
    let onDisk
    try {
      onDisk = sha256(readFileSync(path.join(dir, entry.patch)))
    } catch {
      fail(`patch artifacts changed since dispatch: ${entry.patch}`)
    }
    if (entry.sha256 !== expected || onDisk !== expected) fail(`patch artifacts changed since dispatch: ${entry.patch}`)
  }
  let verdictBytes
  let verdict
  try {
    verdictBytes = readFileSync(path.join(dir, "verdict.json"))
    verdict = JSON.parse(verdictBytes.toString("utf8"))
  } catch {
    fail("verdict.json is not a structured plan-reviewer verdict")
  }
  const valid =
    verdict !== null &&
    typeof verdict === "object" &&
    (verdict.verdict === "OKAY" || (verdict.verdict === "REJECT" && Array.isArray(verdict.blockers) && verdict.blockers.length > 0))
  if (!valid) fail("verdict.json is not a structured plan-reviewer verdict")
  return { manifest, commits, verdict: verdict.verdict, verdictSha256: sha256(verdictBytes), dir: path.relative(repo, dir) }
}

function parseBlocker(spec) {
  const match = /^([^=@]+)(@fix)?(?:=(.+))?$/.exec(spec)
  if (!match || !ID.test(match[1])) fail(`malformed blocker ${spec}`)
  const sites = (match[3] ?? "").split(",").filter((s) => s !== "").map((site) => {
    const colon = site.lastIndexOf(":")
    const file = site.slice(0, colon)
    const line = Number(site.slice(colon + 1))
    if (colon <= 0 || !Number.isInteger(line) || line < 1) fail(`malformed blocker site ${site}`)
    return { file, line }
  })
  if (match[3] !== undefined && sites.length === 0) fail(`malformed blocker ${spec}`)
  return { id: match[1], fix: match[2] !== undefined, sites }
}

function blameCommit(repo, sha, { file, line }) {
  const out = git(repo, ["blame", "--porcelain", "-L", `${line},${line}`, sha, "--", file], { allowFail: true })
  return out ? out.split(/\s/)[0] : null
}

function decide(waves, total, fixInduced) {
  const n = waves.length + 1
  if (total === 0) return { decision: "PASS" }
  if (n >= 2 && fixInduced > waves[n - 2].blockers_fix_induced) {
    return { decision: "STOP", reason: `fix-induced blockers rose from ${waves[n - 2].blockers_fix_induced} to ${fixInduced}` }
  }
  if (n >= 3 && total >= waves[n - 3].blockers_total) {
    return { decision: "STOP", reason: `blockers did not fall over three waves (${waves[n - 3].blockers_total} -> ${total})` }
  }
  return { decision: "CONTINUE" }
}

function requireLane(values) {
  if (!LANES.has(values.lane)) fail("--lane must be F2 or F3")
  return values.lane
}

function requireRows(values) {
  const rows = values.row ?? []
  if (rows.length === 0) fail("at least one --row is required")
  if (new Set(rows).size !== rows.length) fail("--row values must be unique")
  for (const row of rows) if (!ID.test(row)) fail(`malformed row id ${row}`)
  return rows
}

const commands = {
  baseline(ctx) {
    const { baseline } = readLedger(ctx.repo, ctx.key, { requireBaseline: false })
    if (baseline) return console.log(`BASELINE ${short(baseline)} existing`)
    const sha = resolveCommit(ctx.repo, ctx.values.sha)
    append(ctx.repo, { event: "gate_baseline", plan: ctx.key, base_sha: sha })
    console.log(`BASELINE ${short(sha)} recorded`)
  },

  ready(ctx) {
    const lane = requireLane(ctx.values)
    const state = readLedger(ctx.repo, ctx.key)
    const reasons = readyReasons(ctx.repo, state, lane, resolveCommit(ctx.repo, "HEAD"))
    if (reasons.length === 0) return console.log("READY")
    console.log(["NOT READY", ...reasons].join("\n"))
    process.exitCode = 1
  },

  snapshot(ctx) {
    const lane = requireLane(ctx.values)
    const state = readLedger(ctx.repo, ctx.key)
    if (trackedChanges(ctx.repo) !== "") {
      fail("working tree has uncommitted tracked changes; commit them (and review them as a delta) before the wave")
    }
    const head = resolveCommit(ctx.repo, "HEAD")
    const reasons = readyReasons(ctx.repo, state, lane, head)
    if (reasons.length > 0) fail(`not ready: ${reasons.join("; ")}`)
    const wave = laneWaves(state.events, lane).length + 1
    const file = path.join(ctx.repo, ".omo", "gate-deltas", `${lane}-wave-${wave}.snapshot.json`)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify({ lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]) })}\n`)
    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}`)
  },

  patch(ctx) {
    const base = resolveCommit(ctx.repo, ctx.values.base)
    const head = resolveCommit(ctx.repo, ctx.values.head)
    if (base === head || !isAncestor(ctx.repo, base, head)) fail("--base must be a proper ancestor of --head")
    if (!isString(ctx.values.out)) fail("--out is required")
    const out = path.resolve(ctx.repo, ctx.values.out)
    if (existsSync(out)) fail("delta directory exists; use a new directory per dispatch")
    mkdirSync(out, { recursive: true })
    const commits = revList(ctx.repo, base, head).map((sha, index) => {
      const name = `${String(index + 1).padStart(3, "0")}.patch`
      const bytes = showPatch(ctx.repo, sha)
      writeFileSync(path.join(out, name), bytes)
      return { sha, subject: subject(ctx.repo, sha), patch: name, sha256: sha256(bytes) }
    })
    const manifestPath = path.join(out, "manifest.json")
    writeFileSync(manifestPath, `${JSON.stringify({ base_sha: base, head_sha: head, commits }, null, 2)}\n`)
    for (const entry of commits) chmodSync(path.join(out, entry.patch), 0o444)
    chmodSync(manifestPath, 0o444)
    console.log(manifestPath)
  },

  delta(ctx) {
    const lane = requireLane(ctx.values)
    const rows = requireRows(ctx.values)
    const state = readLedger(ctx.repo, ctx.key)
    const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
    const head = resolveCommit(ctx.repo, "HEAD")
    if (!isAncestor(ctx.repo, state.baseline, checked.manifest.base_sha) || !isAncestor(ctx.repo, checked.manifest.head_sha, head)) {
      fail("range outside baseline..HEAD")
    }
    const range = new Set(checked.commits)
    const priorRejects = state.events.filter((e) => e.event === "fix_delta_review" && e.verdict === "REJECT" && e.fix_shas.some((sha) => range.has(sha)))
    const round = priorRejects.length + 1
    append(ctx.repo, {
      event: "fix_delta_review",
      plan: ctx.key,
      lane,
      rows,
      base_sha: checked.manifest.base_sha,
      head_sha: checked.manifest.head_sha,
      fix_shas: checked.commits,
      dir: checked.dir,
      verdict: checked.verdict,
      verdict_sha256: checked.verdictSha256,
      round,
    })
    console.log(`RECORDED fix_delta_review rows=${rows.join(",")} round=${round} verdict=${checked.verdict}`)
    if (checked.verdict === "REJECT" && round >= 2) {
      console.log("ASK: second REJECT on these commits: amend and review again, accept (accept --dir), or re-plan")
      process.exitCode = 3
    }
  },

  accept(ctx) {
    const lane = requireLane(ctx.values)
    if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("accept needs --by and --reason")
    const state = readLedger(ctx.repo, ctx.key)
    const checked = verifyDeltaDir(ctx.repo, ctx.values.dir ?? "")
    const latest = state.events
      .filter((e) => e.event === "fix_delta_review" && e.base_sha === checked.manifest.base_sha && e.head_sha === checked.manifest.head_sha)
      .at(-1)
    if (!latest || latest.verdict !== "REJECT" || latest.verdict_sha256 !== checked.verdictSha256) {
      fail("accept needs the recorded REJECT for this exact range")
    }
    append(ctx.repo, {
      event: "fix_delta_review",
      plan: ctx.key,
      lane,
      rows: latest.rows,
      base_sha: latest.base_sha,
      head_sha: latest.head_sha,
      fix_shas: latest.fix_shas,
      dir: latest.dir,
      verdict: "accepted-risk",
      verdict_sha256: latest.verdict_sha256,
      round: latest.round,
      by: ctx.values.by,
      reason: ctx.values.reason,
    })
    console.log("RECORDED fix_delta_review verdict=accepted-risk")
  },

  wave(ctx) {
    const lane = requireLane(ctx.values)
    const state = readLedger(ctx.repo, ctx.key)
    const waves = laneWaves(state.events, lane)
    const n = waves.length + 1

    let snapshot
    try {
      snapshot = JSON.parse(readFileSync(path.resolve(ctx.repo, ctx.values.snapshot ?? ""), "utf8"))
    } catch {
      fail("state changed since the wave was dispatched: snapshot file is missing or unreadable")
    }
    const head = resolveCommit(ctx.repo, "HEAD")
    if (snapshot?.lane !== lane || snapshot?.wave !== n) fail(`state changed since the wave was dispatched: snapshot is not ${lane} wave ${n}`)
    if (snapshot.sha !== head) fail(`state changed since the wave was dispatched: HEAD ${short(head)} is not the snapshot ${short(String(snapshot.sha))}`)
    if (snapshot.tree !== git(ctx.repo, ["rev-parse", "HEAD^{tree}"]) || trackedChanges(ctx.repo) !== "") {
      fail("state changed since the wave was dispatched: tracked files differ from the snapshot")
    }

    const outcomes = {}
    for (const spec of ctx.values.outcome ?? []) {
      const [name, value, extra] = spec.split("=")
      if (extra !== undefined || !OUTCOME_NAMES[lane].includes(name) || !OUTCOME_VALUES.has(value)) fail(`malformed outcome ${spec} for ${lane}`)
      if (Object.hasOwn(outcomes, name)) fail(`duplicate outcome ${name}`)
      outcomes[name] = value
    }
    const required = [OUTCOME_NAMES[lane][0]]
    const previous = waves.at(-1)
    if (lane === "F3") {
      // A cleanup commit reviewed since the last F3 wave means Step 5's verification gate ran.
      const lastWaveIndex = previous ? state.events.indexOf(previous) : -1
      const cleanupSince = state.events.some((e, index) => index > lastWaveIndex && e.event === "fix_delta_review" && e.lane === "F3")
      if (cleanupSince) required.push("verification")
    }
    for (const name of required) if (!Object.hasOwn(outcomes, name)) fail(`missing required outcome ${name}`)

    const blockers = (ctx.values.blocker ?? []).map(parseBlocker)
    for (const [name, value] of Object.entries(outcomes)) {
      if (value === "INCONCLUSIVE") blockers.push({ id: `${name}-inconclusive`, fix: false, sites: [] })
    }
    const ids = blockers.map((b) => b.id)
    if (new Set(ids).size !== ids.length) fail("blocker ids must be unique")
    const values = Object.values(outcomes)
    for (const [name, value] of Object.entries(outcomes)) {
      if (value === "FAIL" && blockers.length === 0) fail(`${name} is FAIL but no blocker was given`)
    }
    if (values.every((v) => v === "PASS") && blockers.length > 0) fail("blockers given but every outcome is PASS")

    const reasons = readyReasons(ctx.repo, state, lane, head)
    if (reasons.length > 0) fail(`wave dispatched on unreviewed state: ${reasons.join("; ")}`)

    const fixCommits = new Set(state.events.filter((e) => e.event === "fix_delta_review").flatMap((e) => e.fix_shas))
    const fixInduced = []
    const unlocated = []
    for (const blocker of blockers) {
      if (blocker.fix) {
        fixInduced.push(blocker.id)
        continue
      }
      const blamed = blocker.sites.map((site) => blameCommit(ctx.repo, head, site)).filter((sha) => sha !== null)
      if (blamed.some((sha) => fixCommits.has(sha))) fixInduced.push(blocker.id)
      else if (blamed.length === 0) unlocated.push(blocker.id)
    }
    const outcome = decide(waves, blockers.length, fixInduced.length)
    append(ctx.repo, {
      event: "gate_wave",
      plan: ctx.key,
      lane,
      wave: n,
      reviewed_sha: head,
      outcomes,
      blockers_total: blockers.length,
      blockers_fix_induced: fixInduced.length,
      fix_induced: fixInduced,
      unlocated,
      decision: outcome.decision,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    })
    console.log(`DECISION: ${outcome.decision}${outcome.reason ? ` ${outcome.reason}` : ""}`)
    console.log(`WAVE ${lane} ${n} total=${blockers.length} fix_induced=${fixInduced.length} unlocated=${unlocated.length}`)
    if (outcome.decision === "STOP") process.exitCode = 3
  },

  decide(ctx) {
    const lane = requireLane(ctx.values)
    if (!CHOICES.has(ctx.values.choice)) fail("--choice must be freeze, replan or continue")
    if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("decide needs --by and --reason")
    const state = readLedger(ctx.repo, ctx.key)
    const last = laneWaves(state.events, lane).at(-1)
    if (last?.decision !== "STOP") fail(`${lane} has no stopped wave to decide`)
    if (state.events.some((e) => e.event === "convergence_decision" && e.lane === lane && e.wave === last.wave)) {
      fail(`${lane} wave ${last.wave} is already decided`)
    }
    if (lane === "F2" && ctx.values.choice === "freeze") {
      const outcomes = Object.values(last.outcomes)
      if (last.outcomes.qa !== "PASS" || outcomes.includes("INCONCLUSIVE")) {
        fail("freeze needs passing QA and a verdict from every invocation (the gate record requires passing QA rows and a stored trailer per invocation); choose replan or continue")
      }
    }
    append(ctx.repo, { event: "convergence_decision", plan: ctx.key, lane, wave: last.wave, choice: ctx.values.choice, by: ctx.values.by, reason: ctx.values.reason })
    console.log(`RECORDED convergence_decision lane=${lane} wave=${last.wave} choice=${ctx.values.choice}`)
  },
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      repo: { type: "string" },
      plan: { type: "string" },
      lane: { type: "string" },
      sha: { type: "string" },
      base: { type: "string" },
      head: { type: "string" },
      out: { type: "string" },
      dir: { type: "string" },
      snapshot: { type: "string" },
      row: { type: "string", multiple: true },
      by: { type: "string" },
      reason: { type: "string" },
      outcome: { type: "string", multiple: true },
      blocker: { type: "string", multiple: true },
      choice: { type: "string" },
    },
  })
  const [command, ...rest] = positionals
  if (!Object.hasOwn(commands, command ?? "") || rest.length > 0) fail(`unknown command ${command ?? "(none)"}`)
  if (!isString(values.repo)) fail("--repo is required")
  const repo = path.resolve(values.repo)
  let key
  if (command !== "patch") {
    if (!isString(values.plan)) fail("--plan is required")
    const resolved = path.resolve(repo, values.plan)
    try {
      readFileSync(resolved)
    } catch {
      fail(`plan ${values.plan} is not readable`)
    }
    const relative = path.relative(repo, resolved)
    key = relative.startsWith("..") || path.isAbsolute(relative) ? resolved : relative
  }
  commands[command]({ repo, key, values })
}

try {
  main()
} catch (error) {
  console.error(`gate-convergence: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
