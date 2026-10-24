#!/usr/bin/env node
// Gate-wave convergence and fix-delta coverage for review-work (F2) and integration-review (F3).
// The skills call this script; it is the only writer and judge of the gate_baseline,
// fix_delta_review, delta_exemption, gate_wave, convergence_decision and risk_tier_change ledger events. Every decision is
// deterministic and every undecidable state refuses rather than guesses.
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { buildBundle, FolderPlanError, snapshotFolder } from "./folder-plan.mjs"
import { GATE_DELTAS_DIR, LEDGER_PATH } from "./gate-layout.mjs"
import { mergeGateSection, planContent, readRiskTier, scanMarkdown } from "./plan-contract.mjs"
import { checkTrailer, TrailerError } from "./trailer.mjs"

class GateError extends Error {}
const fail = (message) => {
  throw new GateError(message)
}

const OWN_EVENTS = new Set(["gate_baseline", "fix_delta_review", "delta_exemption", "gate_wave", "convergence_decision", "risk_tier_change"])
const TIERS = new Set(["product", "internal-tooling"])
const TOOLING_FIX_ROUNDS = 2
const LANES = new Set(["F2", "F3"])
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA = /^[0-9a-f]{40}$/
const OUTCOME_NAMES = { F2: ["qa", "implementation-audit", "strategic-risk-review"], F3: ["f3", "verification"] }
const REVIEWERS = ["implementation-audit", "strategic-risk-review"]
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
  return path.join(repo, LEDGER_PATH)
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

const isSha256 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v)
const isString = (v) => typeof v === "string" && v.length > 0
const isSha = (v) => typeof v === "string" && SHA.test(v)
const isShaList = (v) => Array.isArray(v) && v.every(isSha)
const isStringList = (v) => Array.isArray(v) && v.every(isString)

// Field checks per own event; a wrong shape is undecidable, never silently skipped.
const SHAPES = {
  gate_baseline: { base_sha: isSha, risk_tier: (v) => v === undefined || TIERS.has(v) },
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
  delta_exemption: { sha: isSha, reason: isString },
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
  risk_tier_change: { from: (v) => v === "internal-tooling", to: (v) => v === "product", by: isString, reason: isString },
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
    return { baseline: undefined, tier: undefined, events: [] }
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
  let tier = baselines[0].value.risk_tier ?? "product"
  for (const event of events) {
    if (event.event !== "risk_tier_change") continue
    if (event.from !== tier) fail(`undecidable: ledger risk_tier_change from ${event.from} while the gate runs as ${tier}`)
    tier = event.to
  }
  return { baseline: baselines[0].value.base_sha, tier, events }
}

// The ledger state of a gate whose bound tier must match the plan's current Risk tier.
function gateState(ctx) {
  const state = readLedger(ctx.repo, ctx.key)
  if (state.tier !== ctx.planTier) {
    if (state.tier === "internal-tooling") {
      fail("plan Risk tier is product but this gate runs as internal-tooling; record the change with retier --by <user> --reason <text>")
    }
    fail("plan Risk tier is internal-tooling but this gate runs as product; a gate never moves to internal-tooling: set the plan back to product or gate the work under a new plan file")
  }
  return state
}

function laneWaves(events, lane) {
  const waves = events.filter((e) => e.event === "gate_wave" && e.lane === lane)
  waves.forEach((wave, index) => {
    if (wave.wave !== index + 1) fail(`undecidable: ${lane} wave numbers are not 1..${waves.length} in order`)
  })
  return waves
}

// The latest ledger event naming a commit decides it: a delta verdict, or the orchestrator's
// exemption for a commit that changes no behaviour and no review input.
function commitStates(repo, state, head) {
  const verdicts = state.events.filter((e) => e.event === "fix_delta_review" || e.event === "delta_exemption")
  return revList(repo, state.baseline, head).map((sha) => {
    let latest
    for (const event of verdicts) if (event.event === "delta_exemption" ? event.sha === sha : event.fix_shas.includes(sha)) latest = event
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

function decide(waves, total, fixInduced, tier) {
  const n = waves.length + 1
  if (total === 0) return { decision: "PASS" }
  if (tier === "internal-tooling" && n > TOOLING_FIX_ROUNDS) {
    return { decision: "STOP", reason: `internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds; wave ${n} still has ${total} blockers` }
  }
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
    append(ctx.repo, { event: "gate_baseline", plan: ctx.key, base_sha: sha, risk_tier: ctx.planTier })
    console.log(`BASELINE ${short(sha)} recorded`)
  },

  ready(ctx) {
    const lane = requireLane(ctx.values)
    const state = gateState(ctx)
    const reasons = readyReasons(ctx.repo, state, lane, resolveCommit(ctx.repo, "HEAD"))
    if (reasons.length === 0) return console.log("READY")
    console.log(["NOT READY", ...reasons].join("\n"))
    process.exitCode = 1
  },

  snapshot(ctx) {
    const lane = requireLane(ctx.values)
    const state = gateState(ctx)
    if (trackedChanges(ctx.repo) !== "") {
      fail("working tree has uncommitted tracked changes; commit them (and review them as a delta) before the wave")
    }
    const head = resolveCommit(ctx.repo, "HEAD")
    const reasons = readyReasons(ctx.repo, state, lane, head)
    if (reasons.length > 0) fail(`not ready: ${reasons.join("; ")}`)
    const wave = laneWaves(state.events, lane).length + 1
    const dir = path.join(ctx.repo, GATE_DELTAS_DIR)
    // The ledger numbers waves per plan, so the files carry the plan key too: another plan gated in
    // this checkout starts its own wave 1 instead of meeting this plan's write-once snapshot.
    const prefix = `${lane}-${sha256(ctx.key).slice(0, 12)}-wave-${wave}`
    const file = path.join(dir, `${prefix}.snapshot.json`)
    const planCopy = path.join(dir, `${prefix}.plan.md`)
    mkdirSync(dir, { recursive: true })
    // A wave's snapshot is write-once: reviewers may already be reading its plan copy, so any rerun
    // only re-prints an unchanged snapshot. Other bytes, another commit or a partial pair mean the
    // wave must be restarted deliberately, with every reviewer re-dispatched.
    if (existsSync(file) || existsSync(planCopy)) {
      let previous
      let copyBytes
      try {
        previous = JSON.parse(readFileSync(file, "utf8"))
        copyBytes = readFileSync(planCopy)
      } catch {
        previous = undefined
      }
      const same =
        previous !== undefined &&
        previous.sha === head &&
        previous.plan_sha256 === ctx.planSha256 &&
        previous.plan_copy === path.relative(ctx.repo, planCopy) &&
        sha256(copyBytes) === ctx.planSha256
      if (!same) {
        fail(
          `${lane} wave ${wave} already has a snapshot on other plan bytes or another commit, or an incomplete one; reviewers may hold the old copy. ` +
            `Delete ${path.relative(ctx.repo, file)} and ${path.relative(ctx.repo, planCopy)}, then snapshot again and re-dispatch every reviewer of this wave`,
        )
      }
      return console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}\nPLAN ${planCopy}`)
    }
    writeFileSync(planCopy, ctx.planBytes, { flag: "wx" })
    chmodSync(planCopy, 0o444)
    const record = { lane, wave, sha: head, tree: git(ctx.repo, ["rev-parse", "HEAD^{tree}"]), plan_sha256: ctx.planSha256, plan_copy: path.relative(ctx.repo, planCopy) }
    writeFileSync(file, `${JSON.stringify(record)}\n`, { flag: "wx" })
    console.log(`${file}\nSNAPSHOT ${lane} wave ${wave} ${short(head)}\nPLAN ${planCopy}`)
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
    const state = gateState(ctx)
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
    const state = gateState(ctx)
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

  exempt(ctx) {
    if (!isString(ctx.values.reason)) fail("exempt needs --reason")
    const state = gateState(ctx)
    const sha = resolveCommit(ctx.repo, ctx.values.sha)
    const found = commitStates(ctx.repo, state, resolveCommit(ctx.repo, "HEAD")).find((entry) => entry.sha === sha)
    if (!found) fail(`${short(sha)} is not a commit in baseline..HEAD`)
    // A REJECT is closed by a covering review or the user's accept, never by the orchestrator alone.
    if (found.status === "rejected") fail(`${short(sha)} has a REJECT; review a covering range again or accept it`)
    append(ctx.repo, { event: "delta_exemption", plan: ctx.key, sha, reason: ctx.values.reason })
    console.log(`RECORDED delta_exemption ${short(sha)}`)
  },

  wave(ctx) {
    const lane = requireLane(ctx.values)
    // Trailers are reviewer evidence of lane F2; F3 records the integration review, which has none.
    if (lane !== "F2" && (ctx.values.trailer ?? []).length > 0) fail(`--trailer belongs to lane F2 reviewer outcomes; lane ${lane} takes none`)
    const state = gateState(ctx)
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
    if (!isSha256(snapshot.plan_sha256) || !isString(snapshot.plan_copy)) {
      fail("state changed since the wave was dispatched: snapshot predates the pinned plan copy; retake the snapshot")
    }
    let pinned
    try {
      pinned = readFileSync(path.resolve(ctx.repo, snapshot.plan_copy))
    } catch {
      fail("state changed since the wave was dispatched: pinned plan copy differs from the snapshot")
    }
    if (sha256(pinned) !== snapshot.plan_sha256) fail("state changed since the wave was dispatched: pinned plan copy differs from the snapshot")
    if (snapshot.plan_sha256 !== ctx.planSha256) fail("state changed since the wave was dispatched: plan bytes differ from the snapshot")

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

    // A reviewer PASS or FAIL is recorded only with its stored trailer, checked here with the rules
    // the gate record applies, against the plan bytes verified above and with that outcome as the
    // verdict. A repair turn that changed its verdict is refused, and a refusal appends nothing.
    const trailers = {}
    for (const spec of ctx.values.trailer ?? []) {
      const at = spec.indexOf("=")
      const name = at === -1 ? "" : spec.slice(0, at)
      const file = spec.slice(at + 1)
      if (!REVIEWERS.includes(name) || file === "") fail(`malformed trailer ${spec}; use --trailer <invocation>=<path> with implementation-audit or strategic-risk-review`)
      if (Object.hasOwn(trailers, name)) fail(`duplicate trailer for ${name}`)
      if (!Object.hasOwn(outcomes, name)) fail(`trailer for ${name} names no outcome; pass --outcome ${name}=<value> or drop the trailer`)
      trailers[name] = file
    }
    for (const name of REVIEWERS) {
      const value = outcomes[name]
      if ((value === "PASS" || value === "FAIL") && !Object.hasOwn(trailers, name)) {
        fail(`${name} is ${value} but no --trailer ${name}=<path> was given; store and check the reviewer's trailer first`)
      }
    }
    const planText = ctx.planBytes.toString("utf8")
    for (const [name, file] of Object.entries(trailers)) {
      let text
      try {
        text = readFileSync(path.resolve(ctx.repo, file), "utf8")
      } catch {
        fail(`trailer ${name}: ${file} is not readable`)
      }
      try {
        checkTrailer(text, { field: `trailer.${name}`, invocation: name, verdict: outcomes[name], planText })
      } catch (error) {
        if (error instanceof TrailerError) fail(error.message)
        throw error
      }
    }

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
    const outcome = decide(waves, blockers.length, fixInduced.length, state.tier)
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
    const state = gateState(ctx)
    const last = laneWaves(state.events, lane).at(-1)
    if (last?.decision !== "STOP") fail(`${lane} has no stopped wave to decide`)
    if (state.events.some((e) => e.event === "convergence_decision" && e.lane === lane && e.wave === last.wave)) {
      fail(`${lane} wave ${last.wave} is already decided`)
    }
    if (state.tier === "internal-tooling" && last.wave > TOOLING_FIX_ROUNDS && ctx.values.choice === "continue") {
      fail(`internal-tooling allows ${TOOLING_FIX_ROUNDS} fix rounds per lane: choose freeze or replan, or re-tier the plan to product (retier) to continue`)
    }
    // Reviewers of a wave recorded before a retier read the internal-tooling plan, so its verdicts
    // cannot be frozen into a product record; a new wave reviews the current plan.
    const retierIndex = state.events.findLastIndex((e) => e.event === "risk_tier_change")
    if (ctx.values.choice === "freeze" && state.events.indexOf(last) < retierIndex) {
      fail(`${lane} wave ${last.wave} predates the retier to product, so its reviewers saw the internal-tooling plan: choose continue or replan`)
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

  retier(ctx) {
    if (!isString(ctx.values.by) || !isString(ctx.values.reason)) fail("retier needs --by and --reason")
    // Not gateState: the tier mismatch is the reason this command runs.
    const state = readLedger(ctx.repo, ctx.key)
    if (state.tier !== "internal-tooling") fail(`this gate runs as ${state.tier}; retier moves internal-tooling to product only`)
    if (ctx.planTier !== "product") fail("set - Risk tier: product in the plan before retier")
    // A freeze or replan closes its lane on a wave whose reviewers read the internal-tooling plan;
    // re-tiering then would leave a product gate resting on that wave with no way to review again.
    const closed = state.events.find((e) => e.event === "convergence_decision" && e.choice !== "continue")
    if (closed) fail(`${closed.lane} wave ${closed.wave} is decided ${closed.choice}; a closed gate cannot be re-tiered: gate the work as product under a new plan file`)
    append(ctx.repo, { event: "risk_tier_change", plan: ctx.key, from: "internal-tooling", to: "product", by: ctx.values.by, reason: ctx.values.reason })
    console.log("RECORDED risk_tier_change internal-tooling -> product")
    for (const lane of LANES) {
      const last = laneWaves(state.events, lane).at(-1)
      if (last) console.log(`STALE ${lane} wave ${last.wave}: recorded before this retier; run a new ${lane} wave before Phase 4 or freeze`)
    }
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
      trailer: { type: "string", multiple: true },
    },
  })
  const [command, ...rest] = positionals
  if (!Object.hasOwn(commands, command ?? "") || rest.length > 0) fail(`unknown command ${command ?? "(none)"}`)
  if (!isString(values.repo)) fail("--repo is required")
  const repo = path.resolve(values.repo)
  let key
  let planBytes
  let planTier
  let planSha256
  if (command !== "patch") {
    if (!isString(values.plan)) fail("--plan is required")
    const resolved = path.resolve(repo, values.plan)
    // A plan is a readable file, or a change folder (a directory holding gate.md). For a folder the
    // plan bytes are the bundle of one snapshot and the Risk tier is read from its gate.md, which is
    // the folder's merge-gate section. The ledger key stays the repo-relative path either way.
    let tierSection
    try {
      if (statSync(resolved).isDirectory()) {
        statSync(path.join(resolved, "gate.md"))
        const snapshot = snapshotFolder(resolved)
        planBytes = buildBundle(snapshot)
        tierSection = planContent(scanMarkdown(snapshot.get("gate.md").toString("utf8")))
      } else {
        planBytes = readFileSync(resolved)
      }
    } catch (error) {
      if (error instanceof FolderPlanError) fail(`plan ${values.plan}: ${error.message}`)
      fail(`plan ${values.plan} is not readable`)
    }
    planSha256 = sha256(planBytes)
    const parsed = readRiskTier(tierSection ?? mergeGateSection(planContent(scanMarkdown(planBytes.toString("utf8")))))
    if (parsed.error) fail(`plan Risk tier: ${parsed.error}`)
    planTier = parsed.tier
    const relative = path.relative(repo, resolved)
    key = relative.startsWith("..") || path.isAbsolute(relative) ? resolved : relative
  }
  commands[command]({ repo, key, values, planBytes, planTier, planSha256 })
}

try {
  main()
} catch (error) {
  console.error(`gate-convergence: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
