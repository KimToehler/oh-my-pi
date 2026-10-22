import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

// Each test builds its own Git sandbox and drives the script as a process. The contract is the
// exit code, the tokens orchestrators parse (DECISION:, READY, NOT READY, ASK:, RECORDED,
// BASELINE, SNAPSHOT), and the ledger lines the script appends.
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "gate-convergence.mjs")
const PLAN = ".omo/plans/demo.md"

function sandbox(t) {
  const repo = mkdtempSync(path.join(tmpdir(), "gate-conv-"))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim()
  git("init", "-q", "-b", "main")
  git("config", "user.email", "gate@test")
  git("config", "user.name", "Gate Test")
  mkdirSync(path.join(repo, "src"), { recursive: true })
  mkdirSync(path.join(repo, ".omo", "plans"), { recursive: true })
  // The plan, the ledger and the delta artifacts live under .omo/, which the real repos ignore.
  writeFileSync(path.join(repo, ".git", "info", "exclude"), ".omo/\n")
  writeFileSync(path.join(repo, PLAN), "# demo\n")
  writeFileSync(path.join(repo, "src", "a.ts"), "line one\nline two\nline three\n")
  git("add", "src/a.ts")
  git("commit", "-q", "-m", "base")
  const commit = (file, content, message) => {
    const full = path.join(repo, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
    git("add", "-A", "--", file)
    git("commit", "-q", "-m", message)
    return git("rev-parse", "HEAD")
  }
  const run = (...args) => {
    const result = spawnSync(process.execPath, [script, args[0], "--repo", repo, ...args.slice(1)], { encoding: "utf8" })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
  }
  const gc = (...args) => run(args[0], "--plan", PLAN, ...args.slice(1))
  const ledgerPath = path.join(repo, ".omo", "ulw-execute", "ledger.jsonl")
  const ledger = () => (existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [])
  const head = () => git("rev-parse", "HEAD")
  // One recorded wave: snapshot, then wave on that snapshot.
  const wave = (lane, ...args) => {
    const snap = gc("snapshot", "--lane", lane)
    assert.equal(snap.status, 0, `snapshot failed: ${snap.stdout}${snap.stderr}`)
    return gc("wave", "--lane", lane, "--snapshot", snap.stdout.split("\n")[0], ...args)
  }
  // One reviewed delta: patch, a verdict file, delta.
  let deltaCount = 0
  const delta = (lane, base, headSha, verdict, rows = ["R1"]) => {
    deltaCount += 1
    const out = `.omo/gate-deltas/${lane}-${rows[0]}-${deltaCount}`
    const patch = run("patch", "--base", base, "--head", headSha, "--out", out)
    assert.equal(patch.status, 0, patch.stderr)
    const body = verdict === "OKAY" ? { verdict: "OKAY", summary: "ok" } : { verdict: "REJECT", summary: "no", blockers: [{ area: "x", defect: "d", evidence: "e", change: "c" }] }
    writeFileSync(path.join(repo, out, "verdict.json"), JSON.stringify(body))
    return { dir: out, result: gc("delta", "--lane", lane, "--dir", out, ...rows.flatMap((row) => ["--row", row])) }
  }
  return { repo, git, commit, run, gc, ledger, ledgerPath, head, wave, delta }
}

const first = (stdout) => stdout.split("\n")[0]
const blockers = (prefix, count) => Array.from({ length: count }, (_, i) => ["--blocker", `${prefix}${i}`]).flat()

test("#given no baseline #when a wave is recorded #then it is undecidable, and after baseline it passes as wave 1", (t) => {
  const s = sandbox(t)
  const before = s.gc("snapshot", "--lane", "F2")
  assert.equal(before.status, 1)
  assert.match(before.stderr, /no gate_baseline/)
  assert.match(first(s.gc("baseline", "--sha", "HEAD").stdout), /^BASELINE [0-9a-f]{12} recorded$/)
  assert.match(first(s.gc("baseline", "--sha", "HEAD").stdout), /^BASELINE [0-9a-f]{12} existing$/)
  const result = s.wave("F2", "--outcome", "qa=PASS")
  assert.equal(result.status, 0, result.stderr)
  assert.equal(first(result.stdout), "DECISION: PASS")
  const waves = s.ledger().filter((e) => e.event === "gate_wave")
  assert.deepEqual(waves.map((w) => [w.wave, w.blockers_total, w.reviewed_sha]), [[1, 0, s.head()]])
})

test("#given a blocker whose second site a reviewed fix wrote #when the next wave records it #then fix-induced rose and it stops", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=FAIL", "--blocker", "B1=src/a.ts:1").status, 0)
  const base = s.head()
  const fix = s.commit("src/a.ts", "line one\nline TWO fixed\nline three\n", "fix R1")
  assert.equal(s.delta("F2", base, fix, "OKAY").result.status, 0)
  const result = s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=FAIL", "--blocker", "B2=src/a.ts:1,src/a.ts:2")
  assert.equal(result.status, 3, result.stderr)
  assert.equal(first(result.stdout), "DECISION: STOP fix-induced blockers rose from 0 to 1")
  const wave = s.ledger().filter((e) => e.event === "gate_wave").at(-1)
  assert.deepEqual([wave.wave, wave.blockers_fix_induced, wave.fix_induced, wave.decision], [2, 1, ["B2"], "STOP"])
})

test("#given totals 3, 2, 3 #when the third wave records #then it stops for not falling over three waves", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  let last
  for (const [index, count] of [3, 2, 3].entries()) last = s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count))
  assert.equal(last.status, 3, last.stderr)
  assert.equal(first(last.stdout), "DECISION: STOP blockers did not fall over three waves (3 -> 3)")
})

test("#given totals 3, 2, 1 #when recorded #then every wave continues", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  for (const [index, count] of [3, 2, 1].entries()) {
    const result = s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count))
    assert.equal(result.status, 0, result.stderr)
    assert.equal(first(result.stdout), "DECISION: CONTINUE")
  }
})

test("#given an F3 stop between F2 waves #when F2 records #then F2 numbering and decision ignore F3", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "A1", "--blocker", "A2").status, 0)
  assert.equal(s.wave("F3", "--outcome", "f3=FAIL", "--blocker", "C1=src/a.ts:1").status, 0)
  const base = s.head()
  const fix = s.commit("src/a.ts", "line one\nline two\nline 3 fixed\n", "fix C1")
  assert.equal(s.delta("F3", base, fix, "OKAY", ["R9"]).result.status, 0)
  const unverified = s.wave("F3", "--outcome", "f3=FAIL", "--blocker", "C2=src/a.ts:3")
  assert.equal(unverified.status, 1, "an F3 wave after a cleanup commit needs the verification outcome")
  assert.match(unverified.stderr, /verification/)
  assert.equal(s.wave("F3", "--outcome", "f3=FAIL", "--outcome", "verification=PASS", "--blocker", "C2=src/a.ts:3").status, 3)
  const f2 = s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "A3")
  assert.equal(f2.status, 0, f2.stderr)
  assert.equal(first(f2.stdout), "DECISION: CONTINUE")
  assert.deepEqual(s.ledger().filter((e) => e.event === "gate_wave" && e.lane === "F2").map((e) => e.wave), [1, 2])
})

test("#given a fix commit after a wave #when ready runs #then it names the commit until a delta covers it", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "B1").status, 0)
  const base = s.head()
  const fix = s.commit("src/a.ts", "line one\nline two!\nline three\n", "fix R1")
  const before = s.gc("ready", "--lane", "F2")
  assert.equal(before.status, 1)
  assert.equal(first(before.stdout), "NOT READY")
  assert.match(before.stdout, new RegExp(`unreviewed fix commit ${fix.slice(0, 12)}`))
  assert.equal(s.delta("F2", base, fix, "OKAY").result.status, 0)
  const after = s.gc("ready", "--lane", "F2")
  assert.equal(after.status, 0, after.stdout)
  assert.equal(after.stdout.trim(), "READY")
})

test("#given a commit after a wave #when the orchestrator exempts it with a reason #then ready passes in both lanes, while a rejected commit cannot be exempted in either", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "B1").status, 0)
  const tick = s.commit("docs/plan.md", "- [x] F2\n", "tick F2")
  for (const lane of ["F2", "F3"]) assert.match(s.gc("ready", "--lane", lane).stdout, new RegExp(`unreviewed fix commit ${tick.slice(0, 12)}`))
  assert.equal(s.gc("exempt", "--sha", tick).status, 1)
  const exempted = s.gc("exempt", "--sha", tick, "--reason", "checkbox only")
  assert.equal(exempted.status, 0, exempted.stderr)
  // Like a delta verdict, an exemption decides the commit for the whole gate, so both lanes read it.
  for (const lane of ["F2", "F3"]) assert.equal(s.gc("ready", "--lane", lane).stdout.trim(), "READY")
  const base = s.head()
  const fix = s.commit("src/a.ts", "line one\nbroken\nline three\n", "fix R1")
  assert.equal(s.delta("F3", base, fix, "REJECT").result.status, 0)
  const refused = s.gc("exempt", "--sha", fix, "--reason", "comment only")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /has a REJECT/)
  assert.equal(s.ledger().filter((e) => e.event === "delta_exemption").length, 1)
  for (const lane of ["F2", "F3"]) assert.match(s.gc("ready", "--lane", lane).stdout, new RegExp(`rejected fix commit ${fix.slice(0, 12)}`))
})

test("#given a rejected commit #when only its amendment is approved #then it stays open until a covering range is accepted", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const base = s.head()
  const c1 = s.commit("src/a.ts", "line one\nattempt 1\nline three\n", "fix R1")
  assert.equal(s.delta("F2", base, c1, "REJECT").result.status, 0)
  const c2 = s.commit("src/a.ts", "line one\nattempt 2\nline three\n", "amend R1")
  assert.equal(s.delta("F2", c1, c2, "OKAY").result.status, 0)
  const open = s.gc("ready", "--lane", "F2")
  assert.equal(open.status, 1)
  assert.match(open.stdout, new RegExp(`rejected fix commit ${c1.slice(0, 12)}`))
  const second = s.delta("F2", base, c2, "REJECT")
  assert.equal(second.result.status, 3, second.result.stderr)
  assert.match(second.result.stdout, /^ASK: /m)
  // c2 was approved by the amendment-only OKAY, but the newer REJECT covering it wins: latest verdict, not any OKAY.
  const reopened = s.gc("ready", "--lane", "F2")
  assert.equal(reopened.status, 1)
  assert.match(reopened.stdout, new RegExp(`rejected fix commit ${c2.slice(0, 12)}`))
  const accepted = s.gc("accept", "--lane", "F2", "--dir", second.dir, "--by", "tim", "--reason", "residual")
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.equal(s.gc("ready", "--lane", "F2").stdout.trim(), "READY")
  assert.deepEqual(s.ledger().filter((e) => e.event === "fix_delta_review").map((e) => e.round), [1, 1, 2, 2])
})

test("#given no recorded REJECT for a range #when accept runs #then it is refused and nothing is written", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const base = s.head()
  const fix = s.commit("src/a.ts", "x\n", "fix R1")
  const out = ".omo/gate-deltas/unreviewed"
  assert.equal(s.run("patch", "--base", base, "--head", fix, "--out", out).status, 0)
  writeFileSync(path.join(s.repo, out, "verdict.json"), JSON.stringify({ verdict: "REJECT", summary: "no", blockers: [{ area: "a", defect: "d", evidence: "e", change: "c" }] }))
  const before = s.ledger().length
  const result = s.gc("accept", "--lane", "F2", "--dir", out, "--by", "tim", "--reason", "r")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /accept needs the recorded REJECT for this exact range/)
  assert.equal(s.ledger().length, before)
})

test("#given a STOP #when decide runs #then continue re-opens, freeze closes, and freeze is refused without passing QA or with an inconclusive invocation", (t) => {
  for (const [choice, ready] of [["continue", 0], ["freeze", 1]]) {
    const s = sandbox(t)
    s.gc("baseline", "--sha", "HEAD")
    for (const [index, count] of [3, 2, 3].entries()) s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=FAIL", ...blockers(`W${index}B`, count))
    const stopped = s.gc("ready", "--lane", "F2")
    assert.equal(stopped.status, 1)
    assert.match(stopped.stdout, /F2 wave 3 stopped: run decide first/)
    const decided = s.gc("decide", "--lane", "F2", "--choice", choice, "--by", "tim", "--reason", "test")
    assert.equal(decided.status, 0, decided.stderr)
    const result = s.gc("ready", "--lane", "F2")
    assert.equal(result.status, ready, result.stdout)
    if (choice === "freeze") assert.match(result.stdout, /F2 wave 3 decided freeze/)
  }
  for (const outcomes of [["--outcome", "qa=FAIL"], ["--outcome", "qa=PASS", "--outcome", "implementation-audit=INCONCLUSIVE"]]) {
    const s = sandbox(t)
    s.gc("baseline", "--sha", "HEAD")
    for (const [index, count] of [3, 2, 3].entries()) s.wave("F2", ...outcomes, ...blockers(`W${index}B`, count))
    const freeze = s.gc("decide", "--lane", "F2", "--choice", "freeze", "--by", "tim", "--reason", "x")
    assert.equal(freeze.status, 1)
    assert.match(freeze.stderr, /freeze needs passing QA/)
    assert.equal(s.gc("decide", "--lane", "F2", "--choice", "replan", "--by", "tim", "--reason", "x").status, 0)
  }
})

test("#given state that moved since dispatch #when snapshot or wave runs #then it refuses and the ledger is unchanged", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "B1").status, 0)
  s.commit("src/a.ts", "changed\n", "unreviewed fix")
  const unreviewed = s.gc("snapshot", "--lane", "F2")
  assert.equal(unreviewed.status, 1)
  assert.match(unreviewed.stdout + unreviewed.stderr, /unreviewed fix commit/)
  const clean = sandbox(t)
  clean.gc("baseline", "--sha", "HEAD")
  const snap = clean.gc("snapshot", "--lane", "F2")
  assert.equal(snap.status, 0, snap.stderr)
  const snapPath = first(snap.stdout)
  assert.ok(existsSync(snapPath), "first snapshot line is the file path")
  writeFileSync(path.join(clean.repo, "src", "a.ts"), "edited after dispatch\n")
  const edited = clean.gc("wave", "--lane", "F2", "--snapshot", snapPath, "--outcome", "qa=PASS")
  assert.equal(edited.status, 1)
  assert.match(edited.stderr, /state changed since the wave was dispatched/)
  const dirty = clean.gc("snapshot", "--lane", "F2")
  assert.equal(dirty.status, 1)
  assert.match(dirty.stderr, /uncommitted tracked changes/)
  clean.git("checkout", "--", "src/a.ts")
  // A commit that leaves the tree unchanged still moves HEAD away from the reviewed snapshot.
  clean.git("commit", "-q", "--allow-empty", "-m", "empty commit after dispatch")
  const emptyMove = clean.gc("wave", "--lane", "F2", "--snapshot", snapPath, "--outcome", "qa=PASS")
  assert.equal(emptyMove.status, 1)
  assert.match(emptyMove.stderr, /state changed since the wave was dispatched/)
  clean.commit("src/b.ts", "new\n", "commit after dispatch")
  const moved = clean.gc("wave", "--lane", "F2", "--snapshot", snapPath, "--outcome", "qa=PASS")
  assert.equal(moved.status, 1)
  assert.match(moved.stderr, /state changed since the wave was dispatched/)
  assert.deepEqual(clean.ledger().filter((e) => e.event === "gate_wave"), [])
})

test("#given malformed ledger lines #when a command reads the ledger #then lines before the baseline are ignored and after it are undecidable", (t) => {
  const s = sandbox(t)
  mkdirSync(path.dirname(s.ledgerPath), { recursive: true })
  writeFileSync(s.ledgerPath, '{"ts":"x","event":"task-completed","plan":\nnot json\n')
  assert.equal(s.gc("baseline", "--sha", "HEAD").status, 0)
  const ok = s.gc("ready", "--lane", "F2")
  assert.equal(ok.status, 0, ok.stderr)
  writeFileSync(s.ledgerPath, `${readFileSync(s.ledgerPath, "utf8")}{"event":"gate_wa\n`)
  const broken = s.gc("ready", "--lane", "F2")
  assert.equal(broken.status, 1)
  assert.match(broken.stderr, /undecidable: ledger line 4 does not parse/)
})

test("#given blockers past EOF, in a missing file, without a site, and marked @fix #when recorded #then attribution follows the rule", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const result = s.wave("F2", "--outcome", "qa=FAIL", "--blocker", "B1=src/a.ts:99", "--blocker", "B2=src/missing.ts:1", "--blocker", "B3", "--blocker", "B4@fix")
  assert.equal(result.status, 0, result.stderr)
  const wave = s.ledger().at(-1)
  assert.deepEqual([wave.blockers_total, wave.blockers_fix_induced, wave.fix_induced, wave.unlocated], [4, 1, ["B4"], ["B1", "B2", "B3"]])
})

test("#given outcome sets #when a wave is recorded #then inconclusive counts and inconsistent sets are refused", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const inconclusive = s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=INCONCLUSIVE")
  assert.equal(inconclusive.status, 0, inconclusive.stderr)
  assert.equal(first(inconclusive.stdout), "DECISION: CONTINUE")
  assert.deepEqual(s.ledger().at(-1).unlocated, ["implementation-audit-inconclusive"])
  for (const [args, phrase] of [
    [["--outcome", "qa=FAIL"], /qa is FAIL but no blocker was given/],
    [["--outcome", "qa=PASS", "--blocker", "X"], /blockers given but every outcome is PASS/],
    [["--outcome", "implementation-audit=PASS"], /qa/],
  ]) {
    const result = s.wave("F2", ...args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, phrase)
  }
})

test("#given commits to review #when patch writes artifacts #then each commit gets a numeric read-only patch and tampering is caught", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  s.commit("src/b.ts", "keep me\nDELETE FROM trials WHERE job_name = ?\n", "add b")
  const base = s.head()
  const fix = s.commit("src/a.ts", "line one\nline two changed\nline three\n", "fix")
  s.git("revert", "--no-edit", fix)
  const deep = `src/${"d/".repeat(90)}x.ts`
  s.git("rm", "-q", "src/b.ts")
  s.commit(deep, "deep\n", "delete b, add deep file")
  const head = s.head()
  const out = ".omo/gate-deltas/artifacts"
  const result = s.run("patch", "--base", base, "--head", head, "--out", out)
  assert.equal(result.status, 0, result.stderr)
  const dir = path.join(s.repo, out)
  assert.deepEqual(readdirSync(dir).sort(), ["001.patch", "002.patch", "003.patch", "manifest.json"])
  assert.match(readFileSync(path.join(dir, "003.patch"), "utf8"), /^-DELETE FROM trials WHERE job_name = \?$/m)
  assert.equal(s.run("patch", "--base", base, "--head", head, "--out", out).status, 1)
  writeFileSync(path.join(dir, "verdict.json"), JSON.stringify({ verdict: "OKAY", summary: "ok" }))
  chmodSync(path.join(dir, "002.patch"), 0o644)
  writeFileSync(path.join(dir, "002.patch"), "tampered\n")
  const tampered = s.gc("delta", "--lane", "F2", "--dir", out, "--row", "R1")
  assert.equal(tampered.status, 1)
  assert.match(tampered.stderr, /changed since dispatch/)
  const clean = ".omo/gate-deltas/clean"
  assert.equal(s.run("patch", "--base", base, "--head", head, "--out", clean).status, 0)
  const missing = s.gc("delta", "--lane", "F2", "--dir", clean, "--row", "R1")
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /verdict\.json/)
  writeFileSync(path.join(s.repo, clean, "verdict.json"), JSON.stringify({ verdict: "OKAY", summary: "ok" }))
  const recorded = s.gc("delta", "--lane", "F2", "--dir", clean, "--row", "R1")
  assert.equal(recorded.status, 0, recorded.stderr)
  assert.equal(s.ledger().at(-1).fix_shas.length, 3)
})

test("#given a ledger without a trailing newline #when an event is appended #then both lines stay intact", (t) => {
  const s = sandbox(t)
  mkdirSync(path.dirname(s.ledgerPath), { recursive: true })
  writeFileSync(s.ledgerPath, '{"ts":"x","event":"merge","plan":"other"}')
  assert.equal(s.gc("baseline", "--sha", "HEAD").status, 0)
  const lines = readFileSync(s.ledgerPath, "utf8").split("\n").filter(Boolean)
  assert.equal(lines.length, 2)
  assert.deepEqual(JSON.parse(lines[0]), { ts: "x", event: "merge", plan: "other" })
  assert.equal(JSON.parse(lines[1]).event, "gate_baseline")
})

// Risk tier: the tier is bound at baseline, internal-tooling lanes stop after two fix rounds, and
// every wave pins the plan bytes its reviewers read.
const tierPlan = (s, tier) => writeFileSync(path.join(s.repo, PLAN), `# demo\n\n## Merge gate\n- Mandatory class: none\n- Risk tier: ${tier}\n`)
const waveEvents = (s) => s.ledger().filter((e) => e.event === "gate_wave")

function toolingStop(s) {
  tierPlan(s, "internal-tooling")
  s.gc("baseline", "--sha", "HEAD")
  let last
  for (const [index, count] of [3, 2, 1].entries()) {
    last = s.wave("F2", "--outcome", "qa=PASS", "--outcome", "implementation-audit=FAIL", ...blockers(`W${index}B`, count))
  }
  return last
}

test("#given an internal-tooling plan with totals 3, 2, 1 #when the third wave records #then the fix-round cap stops it", (t) => {
  const s = sandbox(t)
  tierPlan(s, "internal-tooling")
  s.gc("baseline", "--sha", "HEAD")
  assert.equal(s.ledger().find((e) => e.event === "gate_baseline").risk_tier, "internal-tooling")
  let last
  for (const [index, count] of [3, 2, 1].entries()) {
    last = s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count))
    if (index < 2) {
      assert.equal(last.status, 0, last.stderr)
      assert.equal(first(last.stdout), "DECISION: CONTINUE")
    }
  }
  assert.equal(last.status, 3, last.stderr)
  assert.equal(first(last.stdout), "DECISION: STOP internal-tooling allows 2 fix rounds; wave 3 still has 1 blockers")
})

test("#given an internal-tooling cap STOP #when decide runs #then continue is refused and freeze is recorded", (t) => {
  const s = sandbox(t)
  assert.equal(toolingStop(s).status, 3)
  const refused = s.gc("decide", "--lane", "F2", "--choice", "continue", "--by", "tim", "--reason", "t")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /internal-tooling allows 2 fix rounds per lane/)
  assert.equal(s.gc("decide", "--lane", "F2", "--choice", "freeze", "--by", "tim", "--reason", "t").status, 0)
})

test("#given an internal-tooling gate whose plan moves to product #when commands run #then they refuse until retier, and after retier the lane runs as product", (t) => {
  const s = sandbox(t)
  tierPlan(s, "internal-tooling")
  s.gc("baseline", "--sha", "HEAD")
  for (const [index, count] of [3, 2].entries()) {
    assert.equal(s.wave("F2", "--outcome", "qa=FAIL", ...blockers(`W${index}B`, count)).status, 0)
  }
  tierPlan(s, "product")
  const refused = s.gc("snapshot", "--lane", "F2")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /record the change with retier/)
  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
  assert.equal(retier.status, 0, retier.stderr)
  assert.equal(first(retier.stdout), "RECORDED risk_tier_change internal-tooling -> product")
  const third = s.wave("F2", "--outcome", "qa=FAIL", ...blockers("W2B", 1))
  assert.equal(third.status, 0, third.stderr)
  assert.equal(first(third.stdout), "DECISION: CONTINUE")
  assert.equal(s.ledger().filter((e) => e.event === "risk_tier_change").length, 1)
  const again = s.gc("retier", "--by", "tim", "--reason", "t")
  assert.equal(again.status, 1)
  assert.match(again.stderr, /this gate runs as product/)
})

test("#given an internal-tooling cap STOP #when the plan is re-tiered to product #then the stopped wave is stale: freeze is refused, continue is recorded", (t) => {
  const s = sandbox(t)
  assert.equal(toolingStop(s).status, 3)
  tierPlan(s, "product")
  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
  assert.equal(retier.status, 0, retier.stderr)
  assert.match(retier.stdout, /^STALE F2 wave 3: recorded before this retier/m)
  const freeze = s.gc("decide", "--lane", "F2", "--choice", "freeze", "--by", "tim", "--reason", "t")
  assert.equal(freeze.status, 1)
  assert.match(freeze.stderr, /F2 wave 3 predates the retier to product/)
  assert.equal(s.ledger().filter((e) => e.event === "convergence_decision").length, 0)
  assert.equal(s.gc("decide", "--lane", "F2", "--choice", "continue", "--by", "tim", "--reason", "t").status, 0)
})

test("#given an internal-tooling lane decided freeze #when the plan is re-tiered to product #then retier is refused and nothing is written", (t) => {
  const s = sandbox(t)
  assert.equal(toolingStop(s).status, 3)
  assert.equal(s.gc("decide", "--lane", "F2", "--choice", "freeze", "--by", "tim", "--reason", "t").status, 0)
  tierPlan(s, "product")
  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
  assert.equal(retier.status, 1)
  assert.match(retier.stderr, /F2 wave 3 is decided freeze; a closed gate cannot be re-tiered/)
  assert.equal(s.ledger().filter((e) => e.event === "risk_tier_change").length, 0)
})

test("#given a product gate whose plan moves to internal-tooling #when snapshot or retier runs #then both refuse", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  tierPlan(s, "internal-tooling")
  const snap = s.gc("snapshot", "--lane", "F2")
  assert.equal(snap.status, 1)
  assert.match(snap.stderr, /never moves to internal-tooling/)
  const retier = s.gc("retier", "--by", "tim", "--reason", "t")
  assert.equal(retier.status, 1)
  assert.match(retier.stderr, /this gate runs as product/)
})

test("#given a snapshot #when it is written #then the plan copy is exact, read-only and named on stdout", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  assert.equal(snap.status, 0, snap.stderr)
  const lines = snap.stdout.split("\n")
  const copy = lines[2].replace(/^PLAN /, "")
  assert.ok(lines[2].startsWith("PLAN ") && path.isAbsolute(copy), lines[2])
  const source = readFileSync(path.join(s.repo, PLAN))
  assert.deepEqual(readFileSync(copy), source)
  assert.equal(statSync(copy).mode & 0o777, 0o444)
  const json = JSON.parse(readFileSync(lines[0], "utf8"))
  assert.equal(json.plan_sha256, createHash("sha256").update(source).digest("hex"))
  assert.equal(path.join(s.repo, json.plan_copy), copy)
})

test("#given a source plan changed and restored after snapshot #when the pinned copy is read and the wave records #then the copy stays original and the wave passes", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  const copy = snap.stdout.split("\n")[2].replace(/^PLAN /, "")
  const original = readFileSync(path.join(s.repo, PLAN))
  writeFileSync(path.join(s.repo, PLAN), "# changed\n")
  assert.deepEqual(readFileSync(copy), original)
  writeFileSync(path.join(s.repo, PLAN), original)
  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
  assert.equal(result.status, 0, result.stderr)
})

test("#given a pinned plan copy is tampered with #when the wave records #then it is refused and nothing is written", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  const copy = snap.stdout.split("\n")[2].replace(/^PLAN /, "")
  chmodSync(copy, 0o644)
  writeFileSync(copy, "# tampered\n")
  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /pinned plan copy differs/)
  assert.equal(waveEvents(s).length, 0)
})

test("#given a snapshot taken before a retier #when the wave records on it #then it is refused and nothing is written", (t) => {
  const s = sandbox(t)
  tierPlan(s, "internal-tooling")
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  tierPlan(s, "product")
  assert.equal(s.gc("retier", "--by", "tim", "--reason", "t").status, 0)
  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /plan bytes differ from the snapshot/)
  assert.equal(waveEvents(s).length, 0)
})

test("#given a same-tier plan edit between snapshot and wave #when the wave records #then it is refused and nothing is written", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after dispatch\n")
  const result = s.gc("wave", "--lane", "F2", "--snapshot", snap.stdout.split("\n")[0], "--outcome", "qa=PASS")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /plan bytes differ from the snapshot/)
  assert.equal(waveEvents(s).length, 0)
})

const REFUSED_RESNAPSHOT = /F2 wave 1 already has a snapshot on other plan bytes or another commit, or an incomplete one/

test("#given an unrecorded wave snapshot #when snapshot reruns unchanged #then neither file is rewritten, and other plan bytes are refused until both files are deleted", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const first = s.gc("snapshot", "--lane", "F2")
  assert.equal(first.status, 0, first.stderr)
  const [file, , planLine] = first.stdout.split("\n")
  const copy = planLine.replace(/^PLAN /, "")
  const dispatched = readFileSync(copy)
  const json = readFileSync(file, "utf8")
  const written = [statSync(copy).mtimeMs, statSync(file).mtimeMs]
  const again = s.gc("snapshot", "--lane", "F2")
  assert.equal(again.status, 0, again.stderr)
  assert.equal(again.stdout, first.stdout)
  assert.deepEqual([statSync(copy).mtimeMs, statSync(file).mtimeMs], written)
  assert.equal(statSync(copy).mode & 0o777, 0o444)
  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after dispatch\n")
  const refused = s.gc("snapshot", "--lane", "F2")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
  assert.deepEqual(readFileSync(copy), dispatched)
  assert.equal(readFileSync(file, "utf8"), json)
  rmSync(file)
  chmodSync(copy, 0o600)
  rmSync(copy)
  const retaken = s.gc("snapshot", "--lane", "F2")
  assert.equal(retaken.status, 0, retaken.stderr)
  assert.notDeepEqual(readFileSync(copy), dispatched)
  assert.equal(waveEvents(s).length, 0)
})

test("#given an unrecorded wave snapshot #when a new commit with the same tree lands and snapshot reruns #then it is refused and the dispatched SHA stays", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const first = s.gc("snapshot", "--lane", "F2")
  const file = first.stdout.split("\n")[0]
  const json = readFileSync(file, "utf8")
  s.git("commit", "-q", "--allow-empty", "-m", "empty")
  const delta = s.delta("F2", JSON.parse(json).sha, s.head(), "OKAY")
  assert.equal(delta.result.status, 0, delta.result.stderr)
  const refused = s.gc("snapshot", "--lane", "F2")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
  assert.equal(readFileSync(file, "utf8"), json)
})

test("#given a plan copy without its snapshot JSON #when snapshot runs #then it is refused and the copy is not replaced", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const first = s.gc("snapshot", "--lane", "F2")
  const [file, , planLine] = first.stdout.split("\n")
  const copy = planLine.replace(/^PLAN /, "")
  const dispatched = readFileSync(copy)
  rmSync(file)
  appendFileSync(path.join(s.repo, PLAN), "\n- Accepted residual risks: edited after the JSON was lost\n")
  const refused = s.gc("snapshot", "--lane", "F2")
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, REFUSED_RESNAPSHOT)
  assert.deepEqual(readFileSync(copy), dispatched)
  assert.equal(existsSync(file), false)
})

test("#given one plan's retained wave-1 snapshot #when a second plan in the same checkout snapshots its wave 1 #then it gets its own files and the first plan's stay untouched", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const first = s.gc("snapshot", "--lane", "F2")
  const [firstFile, , firstPlanLine] = first.stdout.split("\n")
  const firstJson = readFileSync(firstFile, "utf8")
  const OTHER = ".omo/plans/other.md"
  writeFileSync(path.join(s.repo, OTHER), "# other plan\n")
  const other = (...args) => s.run(args[0], "--plan", OTHER, ...args.slice(1))
  assert.equal(other("baseline", "--sha", "HEAD").status, 0)
  const second = other("snapshot", "--lane", "F2")
  assert.equal(second.status, 0, second.stderr)
  const [secondFile, , secondPlanLine] = second.stdout.split("\n")
  assert.notEqual(secondFile, firstFile)
  assert.equal(readFileSync(secondPlanLine.replace(/^PLAN /, ""), "utf8"), "# other plan\n")
  assert.equal(readFileSync(firstFile, "utf8"), firstJson)
  assert.deepEqual(readFileSync(firstPlanLine.replace(/^PLAN /, "")), readFileSync(path.join(s.repo, PLAN)))
})

test("#given a legacy snapshot without the plan fields #when wave runs #then it is refused and nothing is written", (t) => {
  const s = sandbox(t)
  s.gc("baseline", "--sha", "HEAD")
  const snap = s.gc("snapshot", "--lane", "F2")
  const file = snap.stdout.split("\n")[0]
  const json = JSON.parse(readFileSync(file, "utf8"))
  delete json.plan_sha256
  delete json.plan_copy
  writeFileSync(file, `${JSON.stringify(json)}\n`)
  const result = s.gc("wave", "--lane", "F2", "--snapshot", file, "--outcome", "qa=PASS")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /retake|plan_sha256|snapshot/)
  assert.equal(waveEvents(s).length, 0)
})

test("#given a personal tier #when baseline runs #then it is refused", (t) => {
  const s = sandbox(t)
  tierPlan(s, "personal")
  const result = s.gc("baseline", "--sha", "HEAD")
  assert.equal(result.status, 1)
  assert.match(result.stderr, /plan Risk tier: personal plans run no merge gate/)
})
