import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
// Minimal plan skeleton: the final verification wave and `## Merge gate` section the validator reads.
function buildPlanSkeleton(slug, intent) {
  return `# ${slug} - Work Plan

Intent: ${intent}

## Final verification wave
- [ ] F3. Whole-diff review: when Merge gate says Whole-diff review: needed, run integration-review (one reviewer, verbatim brief); otherwise tick with the field's reason
- [ ] F1. Real manual QA (one evidence path per scenario; on the head after F3's last code commit)
- [ ] F2. Merge gate: run \`review-work\`; record the decision and every verdict before merge

## Merge gate
> INPUT for the executor, consumed before merge.

- Author's risk assessment: <what could break, and how badly>
- Mandatory class: <none | auth-secrets-pii | schema-migration | wire-contract-api | concurrency-state>
  - If not none, both reviewers run and the orchestrator has no discretion.
- Whole-diff review: <needed | not needed + reason>   (needed when the change spans 3+ slices/modules/layers)
- Accepted residual risks: reviewer verdicts vary between runs
- Out of scope for blocking: the canonical oh-my-openagent validator
- Diff range: <base>...<head>
- Feature-specific criteria - each behavioural one carries all five fields:
  - Invariant: <property that must hold>
    Positive witness: <observation proving expected behaviour>
    Negative control: <mutation or omission that must fail>
    Observable: <measured output>
    Boundary: <real contract surface>
  - Mechanical: <deterministic equality check; no negative control needed>
    Invariant: <property that must hold>
    Positive witness: <observation proving expected equality>
    Observable: <measured output>
    Boundary: <real contract surface>
- Evidence: <evidence path>/merge-gate-${slug}.md
- Escaped-defect rule: every blocker this gate finds lands durable regression coverage at the
  nearest contract boundary before merge, or an explicit not-testable:<reason>.
`
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const validator = path.join(scriptsDir, "validate-gate-record.mjs")
const staleSha = "0000000000000000000000000000000000000000"
const pass = JSON.parse(readFileSync(path.join(scriptsDir, "fixtures/pass.json"), "utf8"))

// The validator requires gate artifacts to be in the index, so these tests must stage files. They
// do it in a throwaway repository rather than in the working checkout: staging into the real index
// would leave debris behind, and the parallel test cases would race each other on one shared index.
// The sandbox reproduces what the validator actually reads - HEAD, the index, and a .gitignore that
// un-ignores `.omo/evidence/` while leaving `.omo/` itself ignored, which gives both path cases.
const trailerRoot = "skills/review-work/scripts/fixtures/trailers"
const sandboxRepo = mkdtempSync(path.join(tmpdir(), "omo-gate-sandbox-"))
execFileSync("git", ["init", "-q", "-b", "sandbox", sandboxRepo], { encoding: "utf8" })
execFileSync("git", ["-C", sandboxRepo, "config", "user.email", "gate@test"], { encoding: "utf8" })
execFileSync("git", ["-C", sandboxRepo, "config", "user.name", "Gate Test"], { encoding: "utf8" })
writeFileSync(path.join(sandboxRepo, ".gitignore"), ".omo/*\n!.omo/evidence/\n!.omo/evidence/**\n")
execFileSync("git", ["-C", sandboxRepo, "add", ".gitignore"], { encoding: "utf8" })
// Two commits so `diff_base` can differ from `reviewed_sha`, and the fixtures' SHA can be rebound.
execFileSync("git", ["-C", sandboxRepo, "commit", "-q", "-m", "base"], { encoding: "utf8" })
writeFileSync(path.join(sandboxRepo, "source.txt"), "reviewed\n")
execFileSync("git", ["-C", sandboxRepo, "add", "source.txt"], { encoding: "utf8" })
execFileSync("git", ["-C", sandboxRepo, "commit", "-q", "-m", "reviewed change"], { encoding: "utf8" })
execFileSync("mkdir", ["-p", path.join(sandboxRepo, ".omo", "evidence"), path.join(sandboxRepo, ".omo", "plans")], { encoding: "utf8" })
process.on("exit", () => rmSync(sandboxRepo, { recursive: true, force: true }))

const trackedRecordRoot = path.join(sandboxRepo, ".omo", "evidence")
const ignoredRecordRoot = path.join(sandboxRepo, ".omo")

// Committed fixture trailers are referenced by the record fixtures, so mirror them into the sandbox
// at the same relative path and commit them: the validator requires artifacts to be in the index.
const fixtureTrailerRoot = path.join(sandboxRepo, trailerRoot)
execFileSync("mkdir", ["-p", fixtureTrailerRoot], { encoding: "utf8" })
execFileSync("cp", ["-R", `${path.join(scriptsDir, "fixtures", "trailers")}/.`, fixtureTrailerRoot], { encoding: "utf8" })
execFileSync("git", ["-C", sandboxRepo, "add", "--", trailerRoot], { encoding: "utf8" })
execFileSync("git", ["-C", sandboxRepo, "commit", "-q", "-m", "fixture trailers"], { encoding: "utf8" })
const sandboxHead = execFileSync("git", ["-C", sandboxRepo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const sandboxBase = execFileSync("git", ["-C", sandboxRepo, "rev-parse", "HEAD~1"], { encoding: "utf8" }).trim()

const head = sandboxHead
const plan = path.join(sandboxRepo, ".omo", "plans", "gate-plan.md")
writeFileSync(plan, buildPlanSkeleton("gate-plan", "exercise the gate record contract"))

function stage(file) {
  spawnSync("git", ["-C", sandboxRepo, "add", "--intent-to-add", "--", path.relative(sandboxRepo, file)], { encoding: "utf8" })
}

function unstage(file) {
  spawnSync("git", ["-C", sandboxRepo, "reset", "-q", "--", path.relative(sandboxRepo, file)], { encoding: "utf8" })
}

function run(record, options = {}) {
  const root = options.recordRoot ?? trackedRecordRoot
  const directory = mkdtempSync(path.join(root, "omo-gate-test-"))
  const recordPath = path.join(directory, "record.json")
  writeFileSync(recordPath, typeof record === "string" ? record : JSON.stringify(record))
  if (options.stageRecord !== false) stage(recordPath)
  const args = [validator, "--record", recordPath]
  if (options.includePlan !== false) args.push("--plan", options.plan ?? plan)
  args.push("--repo", options.repo ?? sandboxRepo)
  const result = spawnSync(process.execPath, args, { encoding: "utf8" })
  unstage(recordPath)
  rmSync(directory, { recursive: true, force: true })
  return result
}

// Fixtures are authored against this repository's plan path and HEAD; rebind both onto the sandbox
// so the fixture stays a statement about record SHAPE rather than about one checkout.
// Deliberately raw bytes, matching `shasum -a 256` - the command the skill documents. This helper
// is what an operator does, not a copy of what the validator does: a byte-vs-text regression inside
// the validator shipped green precisely because every fixture was ASCII, so the two agreed. Keeping
// this as the operator's semantics means the suite disagrees with the validator when the validator
// is wrong, rather than moving with it.
function planDigest(planPath) {
  return createHash("sha256").update(readFileSync(planPath)).digest("hex")
}

function rebind(record) {
  const bound = { ...record, plan: path.relative(sandboxRepo, plan), reviewed_sha: head, diff_base: sandboxBase, plan_sha256: planDigest(plan) }
  // Fixture trailers are real committed files, so their digests are derived rather than hardcoded -
  // otherwise every fixture edit would need a hand-updated hash.
  bound.verdicts = (bound.verdicts ?? []).map((verdict) => {
    if (typeof verdict?.trailer_artifact !== "string" || verdict.trailer_artifact.trim() === "") return verdict
    const artifact = path.resolve(sandboxRepo, verdict.trailer_artifact)
    return existsSync(artifact) ? { ...verdict, trailer_sha256: planDigest(artifact) } : verdict
  })
  return bound
}

function fixtureByName(name) {
  return rebind(JSON.parse(readFileSync(path.join(scriptsDir, "fixtures", name), "utf8")))
}

function buildTrailer(overrides = {}) {
  const fields = {
    invocation: "implementation-audit",
    sections_covered: "1,2,3,4,5",
    model_id: "onara/cc/claude-opus-5",
    security_delta: "no",
    verdict: "PASS",
    blockers: null,
    narrative: "Narrative findings precede the trailer.",
    criteria: [
      {
        invariant: "an incomplete brief cannot produce a passing record",
        positive_witness: "the validator names the missing section",
        negative_control: "a complete brief validates, so the rule is not blanket refusal",
        observable: "process exit code and the field name on stderr",
        boundary: "validator invoked as a process",
      },
    ],
    ...overrides,
  }
  const head = ["REVIEW-TRAILER-v1"]
  for (const key of ["invocation", "sections_covered", "model_id", "security_delta", "verdict", "blockers"]) {
    if (fields[key] !== null) head.push(`${key}: ${fields[key]}`)
  }
  head.push("adversarial_criteria:")
  for (const criterion of fields.criteria) {
    const entries = Object.entries(criterion)
    head.push(`- ${entries[0][0]}: ${entries[0][1]}`)
    for (const [key, value] of entries.slice(1)) head.push(`  ${key}: ${value}`)
  }
  head.push("END-REVIEW-TRAILER")
  return `${fields.narrative}\n\n${head.join("\n")}\n`
}

// Writes a trailer under a tracked repo path and points the record's verdict at it.
// The path is relative to the SANDBOX, which is the repository the validator is given as `--repo`.
// Taking it against the real checkout instead made the suite's outcome depend on how deep that
// checkout happens to sit: the sandbox lives under the OS temp dir, so the relative path is a run
// of `..` segments, and resolving it against the sandbox lands back on the sandbox ONLY when the
// two directories are the same depth. This repository is four levels deep and its worktrees are
// six, which is why the same commit gave 136/136 in one and 103/136 in the other - and a `TMPDIR`
// one level either way flipped each of them. Nothing about that was a real assertion.
function withTrailer(record, body, options = {}) {
  const directory = mkdtempSync(path.join(options.root ?? trackedRecordRoot, "omo-trailer-test-"))
  const file = path.join(directory, "trailer.txt")
  writeFileSync(file, body)
  if (options.stageTrailer !== false) stage(file)
  const target = record.verdicts[options.index ?? 0]
  target.trailer_artifact = path.relative(sandboxRepo, file)
  target.trailer_sha256 = planDigest(file)
  return { record, directory, file }
}

function runWithTrailer(record, body, options = {}) {
  const { directory, file } = withTrailer(record, body, options)
  try {
    return run(record, options)
  } finally {
    unstage(file)
    rmSync(directory, { recursive: true, force: true })
  }
}

function validRecord() {
  return structuredClone(rebind(pass))
}

function expectBlocked(record, field, options) {
  const result = run(record, options)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, "blocked\n")
  assert.match(result.stderr, new RegExp(field))
  assert.doesNotMatch(result.stderr, /\n\s+at /)
}

test("#given valid gate record #when validated #then exits zero and reports passed", () => {
  const result = run(validRecord())
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "passed\n")
})

test("#given stale well-formed SHA fixture #when validated #then reviewed_sha blocks", () => {
  const record = fixtureByName("stale-sha.json")
  expectBlocked({ ...record, reviewed_sha: staleSha }, "reviewed_sha")
})

test("#given wrong-plan fixture #when validated against claimed plan #then plan blocks", () => {
  const record = { ...JSON.parse(readFileSync(path.join(scriptsDir, "fixtures/wrong-plan.json"), "utf8")), reviewed_sha: head, diff_base: sandboxBase }
  expectBlocked({ ...record, reviewed_sha: head }, "plan")
})

test("#given missing-reason fixture with no reviewers #when validated #then decision_reason blocks", () => {
  const record = fixtureByName("missing-reason.json")
  expectBlocked({ ...record, reviewed_sha: head }, "decision_reason")
})

const adversarialFixtures = [
  ["QA absent", "qa-absent.json", "qa"],
  ["QA empty", "qa-empty.json", "qa"],
  ["QA row failing", "qa-failing.json", "qa.0.passed"],
  ["QA row artifact empty", "qa-empty-artifact.json", "qa.0.artifact"],
  ["mandatory class absent", "mandatory-class-absent.json", "mandatory_class"],
  ["mandatory class unrecognized", "mandatory-class-unrecognized.json", "mandatory_class"],
  ["override non-object", "override-non-object.json", "override"],
  ["override missing by", "override-missing-by.json", "override.by"],
  ["override empty reason", "override-empty-reason.json", "override.reason"],
  ["override with full PASS verdict set", "override-with-full-pass.json", "override"],
]

for (const [name, fixture, field] of adversarialFixtures) {
  test(`#given ${name} fixture #when validated #then ${field} blocks`, () => {
    const record = fixtureByName(fixture)
    expectBlocked({ ...record, reviewed_sha: head }, field.replace(".", "\\."))
  })
}

test("#given legitimate override with FAIL verdict #when validated #then exits zero and reports overridden", () => {
  const record = fixtureByName("override-with-fail.json")
  const result = run({ ...record, reviewed_sha: head })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "overridden\n", "an override must not be indistinguishable from a full PASS")
})

// Blocker reconciliation. An override over a FAIL may leave blockers unfixed only by naming each one
// in `downgrades`; the trailer's `blockers:` list must equal the reply's own `Blocker B<n>:` lines,
// so neither an omitted trailer id nor an omitted narrative blocker can drop a finding silently.
function overrideRecord(mutate = () => {}) {
  const record = { ...fixtureByName("override-with-fail.json"), reviewed_sha: head }
  mutate(record)
  return record
}

const downgradeOf = (blocker, rule = "below-threshold") => ({
  invocation: "implementation-audit",
  blocker,
  rule,
  reason: "local dev default only; no protected asset reachable",
  disposition: "residual",
})

const failTrailer = (blockers, narrative) => buildTrailer({ verdict: "FAIL", blockers, narrative })

const blockedReconciliations = [
  ["two trailer blockers with one downgrade", overrideRecord(), failTrailer("B1, B2", "Blocker B1: a\nBlocker B2: b"), /blocker B2 of implementation-audit has no downgrade entry/],
  ["a narrative blocker the trailer omits", overrideRecord(), failTrailer("B1", "Blocker B1: a\nBlocker B2: b"), /narrative reports B2/],
  ["a trailer id without a narrative blocker", overrideRecord((r) => { r.downgrades.push(downgradeOf("B2")) }), failTrailer("B1, B2", "Blocker B1: a"), /no narrative Blocker B2/],
  ["a FAIL trailer without blockers", overrideRecord(), failTrailer(null, "Blocker B1: a"), /blockers/],
  ["a repeated trailer blocker id", overrideRecord(), failTrailer("B1, B1", "Blocker B1: a"), /repeats a blocker id/],
  ["a PASS trailer listing blockers", validRecord(), buildTrailer({ blockers: "B1" }), /only a FAIL trailer lists blockers/],
]

for (const [name, record, trailer, expected] of blockedReconciliations) {
  test(`#given ${name} #when validated #then it blocks naming the gap`, () => {
    const result = runWithTrailer(record, trailer)
    assert.equal(result.status, 1, `expected a block, got exit ${result.status}`)
    assert.match(result.stderr, expected)
  })
}

const blockedDowngrades = [
  ["an override over FAIL without downgrades", overrideRecord((r) => { delete r.downgrades }), "downgrades"],
  ["an unknown downgrade rule", overrideRecord((r) => { r.downgrades[0].rule = "nitpick" }), "downgrades\\.0\\.rule"],
  ["an unknown downgrade disposition", overrideRecord((r) => { r.downgrades[0].disposition = "later" }), "downgrades\\.0\\.disposition"],
  ["a downgrade for a blocker the trailer does not list", overrideRecord((r) => { r.downgrades[0].blocker = "B7" }), "downgrades\\.0\\.blocker"],
  ["a downgrade naming a non-FAIL invocation", overrideRecord((r) => { r.downgrades[0].invocation = "strategic-risk-review" }), "downgrades\\.0\\.invocation"],
  ["a multi-line downgrade reason", overrideRecord((r) => { r.downgrades[0].reason = "one\ntwo" }), "downgrades\\.0\\.reason"],
  ["the same blocker downgraded twice", overrideRecord((r) => { r.downgrades.push(downgradeOf("B1", "frozen")) }), "downgrades the same blocker twice"],
  ["downgrades on a full PASS record", (() => { const r = validRecord(); r.downgrades = [downgradeOf("B1")]; return r })(), "downgrades"],
]

for (const [name, record, field] of blockedDowngrades) {
  test(`#given ${name} #when validated #then ${field.replaceAll("\\", "")} blocks`, () => {
    expectBlocked(record, field)
  })
}

test("#given two narrative blockers, a matching trailer and one downgrade each #when validated #then exits zero", () => {
  const record = overrideRecord((r) => { r.downgrades.push(downgradeOf("B2", "frozen")) })
  const result = runWithTrailer(record, failTrailer("B1, B2", "Blocker B1: a\n**Blocker B2**: b"))
  assert.equal(result.status, 0, result.stderr)
})

const mutations = [
  ["FAIL verdict", "verdicts", (r) => { r.verdicts[0].verdict = "FAIL" }],
  ["INCONCLUSIVE verdict", "verdicts", (r) => { r.verdicts[0].verdict = "INCONCLUSIVE"; r.verdicts[0].note = "timeout" }],
  ["missing verdict", "verdicts", (r) => { r.verdicts = [] }],
  ["extra verdict invocation", "verdicts", (r) => { r.verdicts.push({ invocation: "other", verdict: "PASS" }) }],
  ["extra resolution invocation", "resolution", (r) => { r.resolution.push({ invocation: "other" }) }],
  ["missing resolution", "resolution", (r) => { r.resolution = [] }],
  ["unknown reviewer", "reviewers_run", (r) => { r.reviewers_run = ["i-reviewed-it-myself"]; r.resolution[0].invocation = "i-reviewed-it-myself"; r.verdicts[0].invocation = "i-reviewed-it-myself" }],
  ["duplicate reviewer", "reviewers_run", (r) => { r.reviewers_run.push("implementation-audit") }],
  ["missing whole diff", "whole_diff", (r) => { delete r.whole_diff }],
  ["non-boolean whole diff run", "whole_diff.run", (r) => { r.whole_diff.run = "false" }],
  ["missing resolution agent", "resolution.0.agent", (r) => { delete r.resolution[0].agent }],
  ["missing resolution model", "resolution.0.model", (r) => { delete r.resolution[0].model }],
  ["invalid resolution independence", "resolution.0.independence", (r) => { r.resolution[0].independence = "claimed-independent" }],
  ["empty diff range", "diff_base", (r) => { r.diff_base = head }],
  ["wrong schema", "schema", (r) => { r.schema = "omo.merge-gate/v3" }],
  ["superseded v1 schema", "schema", (r) => { r.schema = "omo.merge-gate/v1" }],
  ["malformed reviewed SHA", "reviewed_sha", (r) => { r.reviewed_sha = "abc" }],
  ["malformed diff base", "diff_base", (r) => { r.diff_base = "abc" }],
  ["whole diff reason absent", "whole_diff.reason", (r) => { r.whole_diff = { run: false, reason: "" } }],
  ["mandatory reviewer absent", "strategic-risk-review", (r) => { r.mandatory_class = "auth-secrets-pii" }],
  ["blocker coverage absent", "blockers.0.coverage", (r) => { r.blockers = [{ id: "B1", fix_sha: head }] }],
  ["blocker coverage malformed", "blockers.0.coverage", (r) => { r.blockers = [{ id: "B1", coverage: "test name", fix_sha: head }] }],
  ["passing blocker fix absent", "blockers.0.fix_sha", (r) => { r.blockers = [{ id: "B1", coverage: "test.mjs::case" }] }],
]

for (const [name, field, mutate] of mutations) {
  test(`#given ${name} #when validated #then ${field} blocks`, () => {
    const record = validRecord()
    mutate(record)
    expectBlocked(record, field.replace(".", "\\."))
  })
}

test("#given both valid blocker coverage forms #when validated #then exits zero", () => {
  for (const coverage of ["path/file.test.mjs::case name", "not-testable: external policy"]) {
    const record = validRecord()
    record.blockers = [{ id: "B1", coverage, fix_sha: head }]
    assert.equal(run(record).status, 0)
  }
})

test("#given missing plan argument #when validated #then plan blocks", () => {
  expectBlocked(validRecord(), "plan", { includePlan: false })
})

test("#given unreadable plan #when validated #then plan blocks", () => {
  expectBlocked(validRecord(), "plan", { plan: path.join(sandboxRepo, "missing-plan.md") })
})

test("#given plan without merge gate #when validated #then Merge gate blocks", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "omo-plan-test-"))
  try {
    const emptyPlan = path.join(directory, "plan.md")
    writeFileSync(emptyPlan, "# Plan\n")
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, emptyPlan)
    record.plan_sha256 = planDigest(emptyPlan)
    expectBlocked(record, "Merge gate", { plan: emptyPlan })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

for (const [name, mergeGate, field] of [
  ["missing criteria header", "## Merge gate\n", "Feature-specific criteria"],
  ["renamed criteria header", "## Merge gate\n\n- **Criteria:**\n  - Invariant: stable\n", "Feature-specific criteria"],
  ["renamed Invariant label", "## Merge gate\n\n- Feature-specific criteria:\n  - Property: stable\n    Negative control: mutation fails\n", "at least one criterion with Invariant"],
]) {
  test(`#given ${name} #when validated #then Merge gate criteria blocks`, () => {
    const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
    try {
      const badPlan = path.join(directory, "plan.md")
      writeFileSync(badPlan, mergeGate)
      const record = validRecord()
      record.plan = path.relative(sandboxRepo, badPlan)
    record.plan_sha256 = planDigest(badPlan)
      expectBlocked(record, field, { plan: badPlan })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
}

function runPlanOnly(planPath) {
  return spawnSync(process.execPath, [validator, "--plan-only", "--plan", planPath, "--repo", sandboxRepo], { encoding: "utf8" })
}

const flatCriteria = "## Merge gate\n\n- Invariant I1: stable\n  Positive witness: witnessed\n  Negative control: mutation fails\n  Observable: exit code\n  Boundary: process\n"

test("#given a scaffolded plan and no record #when --plan-only runs #then it exits zero", () => {
  // given
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-only-"))
  try {
    const planPath = path.join(directory, "plan.md")
    writeFileSync(planPath, buildPlanSkeleton("plan-only", "check criteria before review"))

    // when
    const result = runPlanOnly(planPath)

    // then
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given flat criteria bullets without the header #when --plan-only runs #then it blocks and names the expected nesting", () => {
  // given
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-only-"))
  try {
    const planPath = path.join(directory, "plan.md")
    writeFileSync(planPath, flatCriteria)

    // when
    const result = runPlanOnly(planPath)

    // then
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Feature-specific criteria/)
    assert.match(result.stderr, /nested/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given --plan-only together with --record #when run #then it refuses the ambiguous invocation", () => {
  // given
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-only-"))
  try {
    const planPath = path.join(directory, "plan.md")
    writeFileSync(planPath, buildPlanSkeleton("plan-only", "check criteria before review"))

    // when
    const result = spawnSync(process.execPath, [validator, "--plan-only", "--record", planPath, "--plan", planPath, "--repo", sandboxRepo], { encoding: "utf8" })

    // then
    assert.equal(result.status, 1)
    assert.match(result.stderr, /--plan-only/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

// B1 abort-rule contract (omp-local): `--plan-only` decides the opt-out and requires both abort
// fields; full mode keeps its prior shape but reads the same fence- and comment-aware section.
const criteriaBlock = "- Feature-specific criteria:\n  - Invariant: the gate refuses an incomplete plan\n    Positive witness: a complete plan exits zero\n    Negative control: a plan missing a field exits one\n    Observable: exit code\n    Boundary: validator process\n"

function gatedPlan({ risks = "- Accepted residual risks: reviewer verdicts vary between runs", scope = "- Out of scope for blocking: the canonical oh-my-openagent validator", criteria = criteriaBlock, before = "", after = "" } = {}) {
  return `# Plan\n${before}\n## Merge gate\n- Mandatory class: none\n${[risks, scope].filter(Boolean).join("\n")}\n${criteria}${after}`
}

function planOnly(text) {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-abort-"))
  try {
    const planPath = path.join(directory, "plan.md")
    writeFileSync(planPath, text)
    return runPlanOnly(planPath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function fullMode(text) {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-abort-"))
  try {
    const planPath = path.join(directory, "plan.md")
    writeFileSync(planPath, text)
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, planPath)
    record.plan_sha256 = planDigest(planPath)
    return run(record, { plan: planPath })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const fence = "```"
const acceptedPlans = [
  ["concrete inline values", gatedPlan()],
  ["nested list values", gatedPlan({ risks: "- Accepted residual risks:\n  - reviewer verdicts vary\n  - blame misses deleted lines", scope: "- Out of scope for blocking:\n  - OpenCode\n  - provider proxies" })],
  ["none with a reason", gatedPlan({ risks: "- Accepted residual risks: none (local tool, single user)", scope: "- Out of scope for blocking: none (one surface only)" })],
  ["comparison text and an inline todo word", gatedPlan({ risks: "- Accepted residual risks: p95 < 300 ms and retries > 2 may flake; the todo list order is unstable" })],
  ["bold labels", gatedPlan({ risks: "- **Accepted residual risks:** flaky network in CI", scope: "- **Out of scope for blocking**: Windows" })],
  ["a real opt-out without a section", "# Plan\n\n- Merge gate: not applicable (throwaway spike)\n"],
  ["a real opt-out under the Merge gate heading", "# Plan\n\n## Merge gate\n- Merge gate: not applicable (local config only)\n"],
  ["a text-reason opt-out", "# Plan\n\n- Merge gate: not applicable. Throwaway spike\n"],
  ["a criteria header carrying an inline comment", gatedPlan({ criteria: criteriaBlock.replace("- Feature-specific criteria:", "- Feature-specific criteria: <!-- note -->") })],
  // A list-indented fence inside an outer fence must not close the outer one: the onara
  // AGENTS_MD_SLIM_PLAN quotes "  ```python ... ```" inside "```markdown", then opts out.
  ["an opt-out after an outer fence quoting an indented fence", `# Plan\n\n${fence}markdown\n- example:\n\n  ${fence}python\n  x = 1\n  ${fence}\n${fence}\n\n- Merge gate: not applicable (docs-only)\n`],
]

for (const [name, text] of acceptedPlans) {
  test(`#given ${name} #when --plan-only runs #then it exits zero and reports passed`, () => {
    const result = planOnly(text)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, "passed\n")
  })
}

const blockedPlans = [
  ["the accepted-risks field missing", gatedPlan({ risks: "" }), /Accepted residual risks.*missing/i],
  ["the out-of-scope field missing", gatedPlan({ scope: "" }), /Out of scope for blocking.*missing/i],
  ["both fields missing", gatedPlan({ risks: "", scope: "" }), /Accepted residual risks[\s\S]*Out of scope for blocking|Out of scope for blocking[\s\S]*Accepted residual risks/i],
  ["both fields only before the section", gatedPlan({ risks: "", scope: "", before: "- Accepted residual risks: flaky CI\n- Out of scope for blocking: Windows\n" }), /Accepted residual risks.*missing/i],
  ["a label without a colon", gatedPlan({ risks: "- Accepted residual risks flaky CI" }), /Accepted residual risks.*missing/i],
  ["a duplicate label", gatedPlan({ risks: "- Accepted residual risks: flaky CI\n- Accepted residual risks: slow disks" }), /Accepted residual risks.*duplicate/i],
  ["an empty value before a sibling bullet", gatedPlan({ risks: "- Accepted residual risks:" }), /Accepted residual risks.*empty/i],
  ["the template line from the rule", gatedPlan({ risks: "- Accepted residual risks: <named risks that may not block, or none (<reason>)>" }), /Accepted residual risks.*template placeholder/i],
  ["TBD", gatedPlan({ risks: "- Accepted residual risks: TBD" }), /Accepted residual risks.*deferral marker/i],
  ["n/a", gatedPlan({ scope: "- Out of scope for blocking: n/a" }), /Out of scope for blocking.*deferral marker/i],
  ["TODO with a note", gatedPlan({ risks: "- Accepted residual risks: TODO: decide later" }), /Accepted residual risks.*deferral marker/i],
  ["bare none", gatedPlan({ risks: "- Accepted residual risks: none" }), /Accepted residual risks.*none needs a reason/i],
  ["none with empty parentheses", gatedPlan({ risks: "- Accepted residual risks: none ()" }), /Accepted residual risks.*none needs a reason/i],
  ["none with a deferral reason", gatedPlan({ risks: "- Accepted residual risks: none (tbd)" }), /Accepted residual risks.*none needs a reason/i],
  ["punctuation only", gatedPlan({ risks: "- Accepted residual risks: -- ?" }), /Accepted residual risks.*(deferral marker|no substance)/i],
  ["both fields only inside a fence in the section", gatedPlan({ risks: `${fence}\n- Accepted residual risks: flaky CI`, scope: `- Out of scope for blocking: Windows\n${fence}` }), /Accepted residual risks.*missing/i],
  ["both fields only inside an HTML comment in the section", gatedPlan({ risks: "<!--\n- Accepted residual risks: flaky CI", scope: "- Out of scope for blocking: Windows\n-->" }), /Accepted residual risks.*missing/i],
  ["criteria only inside a fence in the section", gatedPlan({ criteria: `${fence}\n${criteriaBlock}${fence}\n` }), /Feature-specific criteria/],
  ["an opt-out only inside a fence on a gated plan without fields", gatedPlan({ risks: "", scope: "", before: `${fence}\n- Merge gate: not applicable (example)\n${fence}\n` }), /Accepted residual risks.*missing/i],
  ["an opt-out only inside an HTML comment", "# Plan\n<!-- - Merge gate: not applicable (draft) -->\n", /Merge gate: section is required/],
  ["an indented opt-out bullet", "# Plan\n- Notes:\n  - Merge gate: not applicable (nested)\n", /Merge gate: section is required/],
  ["an opt-out with a glued suffix", "# Plan\n- Merge gate: not applicableXYZ\n", /Merge gate: section is required/],
  ["an opt-out with a slash suffix", "# Plan\n- Merge gate: not applicable/xyz\n", /Merge gate: section is required/],
  ["an opt-out together with feature criteria", gatedPlan({ after: "- Merge gate: not applicable (contradiction)\n" }), /opt-out.*criteria|criteria.*opt-out/i],
  ["a Merge gate heading only inside a fence", `# Plan\n${fence}\n## Merge gate\n${criteriaBlock}${fence}\n`, /Merge gate: section is required/],
]

for (const [name, text, expected] of blockedPlans) {
  test(`#given ${name} #when --plan-only runs #then it blocks naming the defect`, () => {
    const result = planOnly(text)
    assert.equal(result.status, 1, `expected a block, got exit ${result.status}`)
    assert.equal(result.stdout, "blocked\n")
    assert.match(result.stderr, expected)
    assert.doesNotMatch(result.stderr, /\n\s+at /)
  })
}

test("#given a prior-shape plan without abort fields #when validated #then full mode passes and --plan-only blocks", () => {
  const prior = gatedPlan({ risks: "", scope: "" })
  assert.equal(fullMode(prior).status, 0, "full mode must keep accepting plans that predate the abort fields")
  const result = planOnly(prior)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Accepted residual risks/)
})

test("#given a criteria header with an inline comment #when validated in full mode #then it exits zero", () => {
  const result = fullMode(gatedPlan({ criteria: criteriaBlock.replace("- Feature-specific criteria:", "- Feature-specific criteria: <!-- note -->") }))
  assert.equal(result.status, 0, result.stderr)
})

for (const [name, text] of [
  ["inside a fence", `# Plan\n${fence}\n## Merge gate\n${criteriaBlock}${fence}\n`],
  ["inside an HTML comment", `# Plan\n<!--\n## Merge gate\n${criteriaBlock}-->\n`],
]) {
  test(`#given the only Merge gate heading ${name} #when validated in full mode #then section is required blocks`, () => {
    const result = fullMode(text)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Merge gate: section is required/)
  })
}

test("#given scaffolded behavioural criterion without negative control #when validated #then Negative control blocks", () => {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
  try {
    const badPlan = path.join(directory, "plan.md")
    const skeleton = buildPlanSkeleton("validator-seam", "exercise generated criterion contract")
      .replace("    Negative control: <mutation or omission that must fail>\n", "")
    writeFileSync(badPlan, skeleton)
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, badPlan)
    record.plan_sha256 = planDigest(badPlan)
    expectBlocked(record, "Negative control", { plan: badPlan })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given scaffolded behavioural criterion with negative control #when validated #then exits zero", () => {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
  try {
    const completePlan = path.join(directory, "plan.md")
    writeFileSync(completePlan, buildPlanSkeleton("validator-seam", "exercise generated criterion contract"))
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, completePlan)
    record.plan_sha256 = planDigest(completePlan)
    const result = run(record, { plan: completePlan })
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given mechanical criterion without negative control #when validated #then exits zero", () => {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
  try {
    const mechanicalPlan = path.join(directory, "plan.md")
    writeFileSync(mechanicalPlan, "## Merge gate\n\n- Feature-specific criteria:\n  - Mechanical: byte equality\n    Invariant: copies match\n    Positive witness: diff exits zero\n    Observable: exit code\n    Boundary: generated file\n")
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, mechanicalPlan)
    record.plan_sha256 = planDigest(mechanicalPlan)
    const result = run(record, { plan: mechanicalPlan })
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

for (const value of ["{", "[]", "\"str\"", "null"]) {
  test(`#given malformed or non-object JSON ${JSON.stringify(value)} #when validated #then record blocks without stack`, () => {
    expectBlocked(value, "record")
  })
}

// Brief fidelity. A folded brief loses a section without leaving a trace in the report, so the
// reviewer's own trailer is the only witness of what it was actually asked. These cases pin that
// the validator derives its facts from that artifact instead of trusting orchestrator-typed JSON.

test("#given the incident partial-brief record #when validated #then the missing sections block", () => {
  const record = { ...fixtureByName("partial-brief.json"), reviewed_sha: head }
  const result = run(record)
  assert.equal(result.status, 1, "a section-2-only brief must not validate")
  assert.match(result.stderr, /trailer/i)
})

test("#given a partial brief whose reviewer reported honestly #when validated #then sections_covered blocks", () => {
  const record = { ...fixtureByName("partial-brief-honest.json"), reviewed_sha: head }
  const result = run(record)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /sections_covered/)
  assert.match(result.stderr, /1/)
})

test("#given a complete honest trailer #when validated #then exits zero", () => {
  const result = runWithTrailer(validRecord(), buildTrailer())
  assert.equal(result.status, 0, result.stderr)
})

test("#given implementation_models absent #when validated #then implementation_models blocks", () => {
  const record = validRecord()
  delete record.implementation_models
  expectBlocked(record, "implementation_models")
})

test("#given implementation_models empty #when validated #then implementation_models blocks", () => {
  const record = validRecord()
  record.implementation_models = []
  expectBlocked(record, "implementation_models")
})

test("#given trailer_artifact absent #when validated #then trailer_artifact blocks", () => {
  const record = validRecord()
  delete record.verdicts[0].trailer_artifact
  expectBlocked(record, "trailer_artifact")
})

test("#given trailer_artifact pointing at a missing file #when validated #then trailer_artifact blocks", () => {
  const record = validRecord()
  record.verdicts[0].trailer_artifact = "skills/review-work/scripts/fixtures/trailers/absent.txt"
  expectBlocked(record, "trailer_artifact")
})

const trailerMutations = [
  ["missing sections_covered", "sections_covered", { sections_covered: null }],
  ["missing model_id", "model_id", { model_id: null }],
  ["missing security_delta", "security_delta", { security_delta: null }],
  ["missing verdict", "verdict", { verdict: null }],
  ["non-boolean security_delta", "security_delta", { security_delta: "maybe" }],
  ["section 3 dropped", "sections_covered", { sections_covered: "1,2,4,5" }],
  ["section 5 dropped", "sections_covered", { sections_covered: "1,2,3,4" }],
  ["unmapped APPROVE token", "verdict", { verdict: "APPROVE" }],
  ["no adversarial criterion", "adversarial_criteria", { criteria: [] }],
]

for (const [name, field, overrides] of trailerMutations) {
  test(`#given trailer with ${name} #when validated #then ${field} blocks`, () => {
    const result = runWithTrailer(validRecord(), buildTrailer(overrides))
    assert.equal(result.status, 1, `expected ${field} to block`)
    assert.match(result.stderr, new RegExp(field))
    assert.doesNotMatch(result.stderr, /\n\s+at /)
  })
}

test("#given an adversarial criterion missing a field #when validated #then adversarial_criteria blocks", () => {
  const criteria = [{
    invariant: "a partial criterion is not a criterion",
    positive_witness: "the validator names the missing field",
    observable: "process exit code",
    boundary: "validator process",
  }]
  const result = runWithTrailer(validRecord(), buildTrailer({ criteria }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /adversarial_criteria/)
  assert.match(result.stderr, /negative_control/)
})

test("#given every adversarial criterion copied verbatim from the plan #when validated #then adversarial_criteria blocks", () => {
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
  try {
    const planPath = path.join(directory, "plan.md")
    const invariant = "the copied invariant proves nothing the author had not already assumed"
    writeFileSync(planPath, `## Merge gate\n\n- Feature-specific criteria:\n  - Invariant: ${invariant}\n    Positive witness: witnessed\n    Negative control: mutation fails\n    Observable: exit code\n    Boundary: process\n`)
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, planPath)
    record.plan_sha256 = planDigest(planPath)
    const criteria = [{
      invariant,
      positive_witness: "witnessed",
      negative_control: "mutation fails",
      observable: "exit code",
      boundary: "process",
    }]
    const result = runWithTrailer(record, buildTrailer({ criteria }), { plan: planPath })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /adversarial_criteria/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given trailer verdict disagreeing with the record verdict #when validated #then verdicts blocks", () => {
  const record = validRecord()
  const result = runWithTrailer(record, buildTrailer({ verdict: "FAIL" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /verdict/)
})

test("#given trailer model_id disagreeing with the resolution model #when validated #then resolution model blocks", () => {
  const record = validRecord()
  const result = runWithTrailer(record, buildTrailer({ model_id: "some/other-model" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /model/)
})

test("#given an independence claim contradicting implementation_models #when validated #then independence blocks", () => {
  const record = validRecord()
  record.resolution[0].independence = "cross-provider"
  const result = runWithTrailer(record, buildTrailer())
  assert.equal(result.status, 1)
  assert.match(result.stderr, /independence/)
})

test("#given a genuinely cross-provider reviewer #when validated #then exits zero", () => {
  const record = validRecord()
  record.implementation_models = ["openai/gpt-6-astra"]
  record.resolution[0].independence = "cross-provider"
  const result = runWithTrailer(record, buildTrailer())
  assert.equal(result.status, 0, result.stderr)
})

test("#given an unresolved model id claiming cross-provider #when validated #then independence blocks", () => {
  const record = validRecord()
  record.resolution[0].model = "unresolved"
  record.resolution[0].independence = "cross-provider"
  const result = runWithTrailer(record, buildTrailer({ model_id: "unresolved" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /independence/)
})

test("#given an unresolved model id recorded as unprovable #when validated #then exits zero", () => {
  const record = validRecord()
  record.resolution[0].model = "unresolved"
  record.resolution[0].independence = "unprovable"
  const result = runWithTrailer(record, buildTrailer({ model_id: "unresolved" }))
  assert.equal(result.status, 0, result.stderr)
})

test("#given a reviewer-reported security delta under mandatory_class none #when validated #then mandatory_class blocks", () => {
  const record = validRecord()
  const result = runWithTrailer(record, buildTrailer({ security_delta: "yes" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /mandatory_class/)
})

test("#given a record written to an ignored path #when validated #then the record path blocks", () => {
  const record = validRecord()
  const result = runWithTrailer(record, buildTrailer(), { recordRoot: ignoredRecordRoot })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ignored|tracked/i)
})

test("#given a trailer artifact written to an ignored path #when validated #then the artifact path blocks", () => {
  const record = validRecord()
  const result = runWithTrailer(record, buildTrailer(), { root: ignoredRecordRoot })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ignored|tracked/i)
})

// Two-invocation records. Every case above drives a single-invocation fixture, which is exactly
// where a gate that mandates two reviewers can pass on one dispatch.

function twoInvocationRecord() {
  const record = validRecord()
  record.mandatory_class = "auth-secrets-pii"
  record.reviewers_run = ["implementation-audit", "strategic-risk-review"]
  record.resolution = [
    { invocation: "implementation-audit", agent: "auditor", model: "onara/cc/claude-opus-5", independence: "same-model" },
    { invocation: "strategic-risk-review", agent: "oracle", model: "onara/cc/claude-opus-5", independence: "same-model" },
  ]
  record.verdicts = [
    { invocation: "implementation-audit", verdict: "PASS" },
    { invocation: "strategic-risk-review", verdict: "PASS" },
  ]
  return record
}

// Writes one trailer per verdict and returns the directories to clean up.
function withTrailers(record, bodies) {
  const directories = bodies.map((body, index) => withTrailer(record, body, { index }).directory)
  return directories
}

function runWithTrailers(record, bodies, options = {}) {
  const directories = withTrailers(record, bodies)
  try {
    return run(record, options)
  } finally {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true })
  }
}

test("#given a mandatory-class record with two distinct honest trailers #when validated #then exits zero", () => {
  const record = twoInvocationRecord()
  const result = runWithTrailers(record, [
    buildTrailer(),
    buildTrailer({ invocation: "strategic-risk-review", sections_covered: "1,2,3,4" }),
  ])
  assert.equal(result.status, 0, result.stderr)
})

test("#given two verdicts pointing at one identical trailer artifact #when validated #then trailer_artifact blocks", () => {
  const record = twoInvocationRecord()
  const { directory } = withTrailer(record, buildTrailer(), { index: 0 })
  try {
    // The aliased pointer needs no forgery at all: one dispatched reviewer, cited twice.
    record.verdicts[1].trailer_artifact = record.verdicts[0].trailer_artifact
    const result = run(record)
    assert.equal(result.status, 1, "one reviewer must not satisfy two mandated invocations")
    assert.match(result.stderr, /trailer_artifact/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given a trailer whose invocation names another lane #when validated #then invocation blocks", () => {
  const record = twoInvocationRecord()
  const result = runWithTrailers(record, [
    buildTrailer(),
    // Copied from the audit trailer with only the section list narrowed.
    buildTrailer({ invocation: "implementation-audit", sections_covered: "1,2,3,4" }),
  ])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /invocation/)
})

test("#given a trailer with no invocation field #when validated #then invocation blocks", () => {
  const result = runWithTrailer(validRecord(), buildTrailer({ invocation: null }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /invocation/)
})

// A reviewer auditing this contract must cite the marker lines as file:line evidence. Rejecting
// that reply makes a correct FAIL unstorable, which biases the gate toward reviews finding nothing.
const MARKER_OPEN = `REVIEW-TRAILER${"-v1"}`
const MARKER_CLOSE = `END-REVIEW${"-TRAILER"}`

test("#given a reviewer citing the trailer markers in its prose #when validated #then exits zero", () => {
  const body = `Blocker B1: SKILL.md:239 introduces the ${MARKER_OPEN} block, closed by ${MARKER_CLOSE}.\n\n${buildTrailer()}`
  const result = runWithTrailer(validRecord(), body)
  assert.equal(result.status, 0, result.stderr)
})

test("#given prose mentioning only the close marker #when validated #then exits zero", () => {
  const body = `The reply must end with ${MARKER_CLOSE} to be storable.\n\n${buildTrailer()}`
  const result = runWithTrailer(validRecord(), body)
  assert.equal(result.status, 0, result.stderr)
})

// Evidence lifecycle. The gate requires the record and its trailers to be durable in the
// repository, and requires reviewed_sha to equal HEAD. Committing the evidence moves HEAD, so
// those two demands collide unless the reviewed target ignores the evidence paths themselves.
// These cases run against a scratch repository because they turn on real commits.

function scratchRepo() {
  const directory = mkdtempSync(path.join(tmpdir(), "omo-gate-repo-"))
  const git = (...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim()
  git("init", "-q", "-b", "main")
  git("config", "user.email", "gate@test")
  git("config", "user.name", "Gate Test")
  writeFileSync(path.join(directory, "source.txt"), "base\n")
  git("add", "source.txt")
  git("commit", "-q", "-m", "base")
  writeFileSync(path.join(directory, "source.txt"), "reviewed change\n")
  git("add", "source.txt")
  git("commit", "-q", "-m", "the change under review")
  return { directory, git }
}

function scratchArtifacts({ directory, git }, overrides = {}) {
  const evidence = path.join(directory, "evidence")
  execFileSync("mkdir", ["-p", evidence])
  const planPath = path.join(directory, "plan.md")
  writeFileSync(planPath, buildPlanSkeleton("gate-lifecycle", "exercise the evidence lifecycle"))
  const trailerPath = path.join(evidence, "trailer.txt")
  writeFileSync(trailerPath, buildTrailer())
  const record = {
    ...structuredClone(pass),
    plan: path.relative(directory, planPath),
    plan_sha256: planDigest(planPath),
    reviewed_sha: git("rev-parse", "HEAD"),
    diff_base: git("rev-parse", "HEAD~1"),
    ...overrides,
  }
  record.verdicts[0].trailer_artifact = path.relative(directory, trailerPath)
  record.verdicts[0].trailer_sha256 = planDigest(trailerPath)
  const recordPath = path.join(evidence, "merge-gate.json")
  writeFileSync(recordPath, JSON.stringify(record, null, 2))
  // Staged, not yet committed: the state an operator is in when running the validator before merge.
  git("add", "--intent-to-add", "--", path.relative(directory, planPath), path.relative(directory, trailerPath), path.relative(directory, recordPath))
  return { planPath, recordPath, trailerPath }
}

function runScratch({ directory }, { recordPath, planPath }) {
  return spawnSync(process.execPath, [validator, "--record", recordPath, "--plan", planPath, "--repo", directory], { encoding: "utf8" })
}

test("#given gate evidence committed after the review #when re-validated #then it still validates", () => {
  const repository = scratchRepo()
  try {
    const artifacts = scratchArtifacts(repository)
    assert.equal(runScratch(repository, artifacts).status, 0, "must validate before the evidence is committed")
    // The skill requires the record and trailers to be tracked, so committing them is the
    // prescribed path - not an operator deviation.
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 0, `committing the prescribed evidence must not invalidate it: ${result.stderr}`)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a source commit after the review #when validated #then reviewed_sha blocks", () => {
  const repository = scratchRepo()
  try {
    const artifacts = scratchArtifacts(repository)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    // A change to reviewed CODE must still invalidate the record; only evidence commits are exempt.
    writeFileSync(path.join(repository.directory, "source.txt"), "unreviewed change\n")
    repository.git("add", "source.txt")
    repository.git("commit", "-q", "-m", "code the reviewer never saw")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 1, "a later source commit must invalidate the record")
    assert.match(result.stderr, /reviewed_sha/)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a trailer artifact carrying source alongside the trailer #when that source changes after the review #then reviewed_sha still blocks", () => {
  const repository = scratchRepo()
  try {
    // The R4 analogue on the sibling field. Being read constrains only the region BETWEEN the
    // markers, so one file can hold a genuine trailer and arbitrary reviewed source - and the path
    // exemption then covers the source half too. Nothing here is forged: the trailer is verbatim
    // and the verdict honest.
    const artifacts = scratchArtifacts(repository)
    const trailer = readFileSync(artifacts.trailerPath, "utf8")
    // The reviewed state: the artifact already carries source beside the trailer, so the record's
    // digest is the honest one for that combined file.
    writeFileSync(artifacts.trailerPath, `export const canEdit = (user) => user.role === "admin"\n\n${trailer}`)
    const record = JSON.parse(readFileSync(artifacts.recordPath, "utf8"))
    record.verdicts[0].trailer_sha256 = planDigest(artifacts.trailerPath)
    writeFileSync(artifacts.recordPath, JSON.stringify(record, null, 2))
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    assert.equal(runScratch(repository, artifacts).status, 0, "storing the evidence must still validate")

    writeFileSync(artifacts.trailerPath, `export const canEdit = () => true\n\n${trailer}`)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "unreviewed authorization change")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 1, "a source change inside an exempt artifact must not pass the gate")
    assert.match(result.stderr, /trailer_sha256|reviewed_sha/)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a qa artifact naming a source path #when that source changes after the review #then reviewed_sha still blocks", () => {
  const repository = scratchRepo()
  try {
    // The record names the reviewed source file as its own QA artifact. Nothing here is forged:
    // the trailer is real and the verdict honest. Only the declared evidence path is chosen badly,
    // which is what a QA row pointing at the file the QA exercised looks like in practice.
    const artifacts = scratchArtifacts(repository, {
      qa: [{ name: "suite", passed: true, artifact: "source.txt" }],
    })
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    writeFileSync(path.join(repository.directory, "source.txt"), "unreviewed change\n")
    repository.git("add", "source.txt")
    repository.git("commit", "-q", "-m", "code the reviewer never saw")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 1, "naming a source path as a QA artifact must not exempt it from the SHA binding")
    assert.match(result.stderr, /reviewed_sha/)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a criterion copied from the plan #when the plan is edited after the review #then the laundered criterion still blocks", () => {
  const repository = scratchRepo()
  try {
    // D8 rejects a criterion lifted from the plan, but it tests the CURRENT plan text. The plan is
    // exempt from the SHA binding, so editing the invariant out afterwards would turn a copied
    // criterion into an apparently independent one - without touching the reviewer's trailer.
    const copiedInvariant = "the laundering invariant this plan already states"
    const artifacts = scratchArtifacts(repository)
    const planText = readFileSync(artifacts.planPath, "utf8")
    // The plan the reviewer saw already carries the invariant, so the record binds THAT digest.
    writeFileSync(artifacts.planPath, `${planText}\n- invariant: ${copiedInvariant}\n`)
    const record = JSON.parse(readFileSync(artifacts.recordPath, "utf8"))
    record.plan_sha256 = planDigest(artifacts.planPath)
    writeFileSync(artifacts.recordPath, JSON.stringify(record, null, 2))
    const trailer = readFileSync(artifacts.trailerPath, "utf8").replace(/- invariant: .*/, `- invariant: ${copiedInvariant}`)
    writeFileSync(artifacts.trailerPath, trailer)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    assert.equal(runScratch(repository, artifacts).status, 1, "a criterion copied from the plan must block")

    writeFileSync(artifacts.planPath, planText)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "evidence-only commit that edits the plan")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 1, "editing the plan after the review must not launder a copied criterion")
    assert.match(result.stderr, /plan/)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a criterion with an appended duplicate field #when validated #then the repeated field blocks", () => {
  const record = validRecord()
  // The scalar parser blocks a repeated key; the criteria parser was last-wins, so one appended
  // indented line rewrote the invariant while the reviewer's real one stayed verbatim above it.
  const trailer = buildTrailer().replace("END-REVIEW-TRAILER", "  invariant: a fabricated invariant nobody wrote\nEND-REVIEW-TRAILER")
  const result = runWithTrailer(record, trailer)
  assert.equal(result.status, 1, "an appended field inside a criterion must not override what the reviewer wrote")
  assert.match(result.stderr, /invariant/)
})

test("#given duplicate record keys spelled with unicode escapes #when validated #then the duplicated key blocks", () => {
  // The sixth level, one encoding away from the fifth: the scanner keyed its Set on the RAW source
  // slice while JSON.parse keys on the DECODED name, so `mandatory_cla\u0073s` is one key to the
  // parser and a different string to the guard. The two must agree for every legal spelling.
  const record = validRecord()
  record.mandatory_class = "auth-secrets-pii"
  record.reviewers_run = ["implementation-audit", "strategic-risk-review"]
  const honest = JSON.stringify(record, null, 2).trimEnd()
  const escaped = String.raw`,"mandatory_cla\u0073s":"none","reviewers_ru\u006e":[],"re\u0073olution":[],"verdict\u0073":[]}`
  const attacked = honest.slice(0, -1) + escaped
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "evidence", "gate-esc-record-"))
  const recordPath = path.join(directory, "record.json")
  try {
    writeFileSync(recordPath, attacked)
    stage(recordPath)
    const result = spawnSync(process.execPath, [validator, "--record", recordPath, "--plan", plan, "--repo", sandboxRepo], { encoding: "utf8" })
    assert.equal(result.status, 1, "an escaped spelling of a duplicate key must block like the plain one")
    assert.match(result.stderr, /mandatory_class/)
  } finally {
    unstage(recordPath)
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given a record with duplicate keys appended #when validated #then the duplicated key blocks", () => {
  // The fifth level of the same class, one above the trailer parsers: JSON.parse is last-wins, so
  // appending `,"mandatory_class":"none","reviewers_run":[]` downgrades an auth record to zero
  // reviewers while both honest values stay byte-present. It needs no trailer at all, because an
  // empty reviewers_run makes every trailer check vacuous.
  const record = validRecord()
  record.mandatory_class = "auth-secrets-pii"
  record.reviewers_run = ["implementation-audit", "strategic-risk-review"]
  const honest = JSON.stringify(record, null, 2).trimEnd()
  const attacked = `${honest.slice(0, -1)},"mandatory_class":"none","reviewers_run":[],"resolution":[],"verdicts":[]}`
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "evidence", "gate-dup-record-"))
  const recordPath = path.join(directory, "record.json")
  try {
    writeFileSync(recordPath, attacked)
    stage(recordPath)
    const result = spawnSync(process.execPath, [validator, "--record", recordPath, "--plan", plan, "--repo", sandboxRepo], { encoding: "utf8" })
    assert.equal(result.status, 1, "appended duplicate keys must not silently override the record")
    assert.match(result.stderr, /mandatory_class/)
  } finally {
    unstage(recordPath)
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given a criterion copied from the plan #when a second criterion is appended #then adversarial_criteria still blocks", () => {
  // The rule holds against criterion COUNT, not only field content. Appending a well-formed block
  // must not satisfy a rule the pre-existing criteria alone violate - otherwise five appended lines
  // launder a wholly copied criterion, which is cheaper than the declared forgery boundary.
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "gate-plan-test-"))
  try {
    const planPath = path.join(directory, "plan.md")
    const invariant = "the copied invariant proves nothing the author had not already assumed"
    writeFileSync(planPath, `## Merge gate\n\n- Feature-specific criteria:\n  - Invariant: ${invariant}\n    Positive witness: witnessed\n    Negative control: mutation fails\n    Observable: exit code\n    Boundary: process\n`)
    const record = validRecord()
    record.plan = path.relative(sandboxRepo, planPath)
    record.plan_sha256 = planDigest(planPath)
    const criteria = [
      { invariant, positive_witness: "witnessed", negative_control: "mutation fails", observable: "exit code", boundary: "process" },
      { invariant: "appended by the orchestrator, never written by the reviewer", positive_witness: "p", negative_control: "n", observable: "o", boundary: "b" },
    ]
    const result = runWithTrailer(record, buildTrailer({ criteria }), { plan: planPath })
    assert.equal(result.status, 1, "an appended criterion must not launder a copied one")
    assert.match(result.stderr, /adversarial_criteria/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given a trailer with two complete criteria #when validated #then both are accepted", () => {
  const record = validRecord()
  // Negative control for the rule above: repeated fields block, but a second CRITERION is legal.
  const trailer = buildTrailer().replace(
    "END-REVIEW-TRAILER",
    "- invariant: a second criterion of the reviewer's own\n  positive_witness: w\n  negative_control: n\n  observable: o\n  boundary: b\nEND-REVIEW-TRAILER",
  )
  assert.equal(runWithTrailer(record, trailer).status, 0, "a legitimate second criterion must still validate")
})

test("#given a trailer artifact that is a symlink pointing outside the repository #when validated #then it blocks", () => {
  const repository = scratchRepo()
  try {
    // check-ignore and ls-files both accept a tracked symlink, and path.resolve is lexical, so the
    // containment check passed while the trailer really lived outside any checkout.
    const artifacts = scratchArtifacts(repository)
    const outside = mkdtempSync(path.join(tmpdir(), "omo-gate-outside-"))
    const target = path.join(outside, "trailer.txt")
    writeFileSync(target, readFileSync(artifacts.trailerPath, "utf8"))
    rmSync(artifacts.trailerPath)
    symlinkSync(target, artifacts.trailerPath)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "trailer replaced by a symlink")
    const result = runScratch(repository, artifacts)
    rmSync(outside, { recursive: true, force: true })
    assert.equal(result.status, 1, "a trailer outside the repository cannot be read from another checkout")
    assert.match(result.stderr, /outside the repository/)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given the validator run from a subdirectory #when paths are repo-relative #then the record still validates", () => {
  const repository = scratchRepo()
  try {
    // The record was tracked-checked against the repo root but read against cwd, so the guarantee
    // and the parsed bytes could be different files - and the documented flow broke from any
    // subdirectory.
    const artifacts = scratchArtifacts(repository)
    repository.git("add", "-A")
    repository.git("commit", "-q", "-m", "gate evidence")
    const nested = path.join(repository.directory, "sub")
    execFileSync("mkdir", ["-p", nested])
    const result = spawnSync(
      process.execPath,
      [validator, "--record", path.relative(repository.directory, artifacts.recordPath), "--plan", path.relative(repository.directory, artifacts.planPath), "--repo", repository.directory],
      { encoding: "utf8", cwd: nested },
    )
    assert.equal(result.status, 0, `repo-relative paths must resolve against the repo, not the cwd: ${result.stderr}`)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

test("#given a trailer artifact that was never added to the index #when validated #then the artifact blocks", () => {
  const repository = scratchRepo()
  try {
    const artifacts = scratchArtifacts(repository)
    repository.git("add", "-A")
    repository.git("reset", "-q", "--", path.relative(repository.directory, artifacts.trailerPath))
    repository.git("commit", "-q", "-m", "record committed, trailer left behind")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 1, "an untracked trailer disappears for the next reviewer")
    assert.match(result.stderr, /track/i)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

// Independence granularity. Error correlation follows the model vendor, not the routing prefix:
// openrouter/anthropic/claude-opus-5, github-copilot/claude-opus-5 and onara/cc/claude-opus-5 are
// all Anthropic weights. Exact string comparison called every one of those pairings independent.

function independenceCase(implementationModels, reviewModel, claim) {
  const record = validRecord()
  record.implementation_models = implementationModels
  record.resolution[0].model = reviewModel
  record.resolution[0].independence = claim
  return record
}

const independenceScale = [
  // [implementation models, review model, correct label, why]
  [["onara/cc/claude-opus-5"], "onara/cc/claude-opus-5", "same-model", "identical string"],
  [["openai/gpt-5.6-sol:medium"], "openai/gpt-5.6-sol:xhigh", "same-model", "same model, different variant"],
  [["anthropic/claude-opus-5"], "openrouter/anthropic/claude-opus-5", "same-model", "same model reached through a router"],
  [["openrouter/anthropic/claude-opus-5"], "openrouter/anthropic/claude-fable-5-1", "same-provider", "both Anthropic weights, different model"],
  [["onara/cc/claude-sonnet-5"], "github-copilot/claude-opus-5", "same-provider", "Anthropic through two different routing prefixes"],
  [["openrouter/anthropic/claude-opus-5"], "openrouter/openai/gpt-6-astra", "cross-provider", "genuinely different vendors"],
  [["onara/cc/claude-opus-5"], "openai/gpt-5.6-sol", "cross-provider", "Anthropic implemented, OpenAI reviewed"],
  [["anthropic/claude-opus-5"], "google/gemini-3.1-pro", "cross-provider", "third vendor"],
]

for (const [implementationModels, reviewModel, expected, why] of independenceScale) {
  test(`#given ${why} #when validated #then ${expected} is accepted`, () => {
    const result = runWithTrailer(independenceCase(implementationModels, reviewModel, expected), buildTrailer({ model_id: reviewModel }))
    assert.equal(result.status, 0, result.stderr)
  })

  test(`#given ${why} #when a different label is claimed #then independence blocks`, () => {
    const wrong = expected === "cross-provider" ? "same-model" : "cross-provider"
    const result = runWithTrailer(independenceCase(implementationModels, reviewModel, wrong), buildTrailer({ model_id: reviewModel }))
    assert.equal(result.status, 1, `claiming ${wrong} for a ${expected} pairing must block`)
    assert.match(result.stderr, /independence/)
  })
}

test("#given a combo alias that names no known model family #when validated #then independence blocks", () => {
  // `onara/auditor` is a roster entry, not a model ID. It resolved to `independent` in the incident.
  const result = runWithTrailer(independenceCase(["onara/cc/claude-opus-5"], "onara/auditor", "cross-provider"), buildTrailer({ model_id: "onara/auditor" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /independence/)
})

test("#given an unknown model family recorded as unprovable #when validated #then exits zero", () => {
  const result = runWithTrailer(independenceCase(["onara/cc/claude-opus-5"], "onara/auditor", "unprovable"), buildTrailer({ model_id: "onara/auditor" }))
  assert.equal(result.status, 0, result.stderr)
})

test("#given the superseded independent label #when validated #then independence blocks", () => {
  const result = runWithTrailer(independenceCase(["onara/cc/claude-opus-5"], "openai/gpt-5.6-sol", "independent"), buildTrailer({ model_id: "openai/gpt-5.6-sol" }))
  assert.equal(result.status, 1)
  assert.match(result.stderr, /independence/)
})

// Trailer cardinality. The duplicate-scalar rule works per block, so appending a whole second
// block walks straight past it - and the reviewer's real verdict stays verbatim in the cited file
// while the validator reads the appended one.
test("#given an appended second trailer block flipping FAIL to PASS #when validated #then the artifact blocks", () => {
  // The record claims PASS, matching the appended block, so nothing but cardinality catches it.
  const appended = `${buildTrailer({ verdict: "FAIL" })}\n${buildTrailer({ verdict: "PASS" })}`
  const result = runWithTrailer(validRecord(), appended)
  assert.equal(result.status, 1, "an artifact holding two blocks must not silently adopt the appended one")
  assert.match(result.stderr, /trailer/)
})

test("#given an appended block widening the section list #when validated #then the artifact blocks", () => {
  const honest = buildTrailer({ sections_covered: "2" })
  const appended = `${honest}\n${buildTrailer()}`
  const result = runWithTrailer(validRecord(), appended)
  assert.equal(result.status, 1, "appending a block must not override an honest narrow answer")
  assert.match(result.stderr, /trailer/)
})

test("#given a duplicated scalar key appended after a narrow answer #when validated #then the duplicate blocks", () => {
  const body = buildTrailer().replace("sections_covered: 1,2,3,4,5", "sections_covered: 2\nsections_covered: 1,2,3,4,5")
  const result = runWithTrailer(validRecord(), body)
  assert.equal(result.status, 1, "appending one permissive line must not override the honest answer")
  assert.match(result.stderr, /sections_covered/)
})

// The contract sentence in SKILL.md and the predicate in the validator are maintained separately,
// and drift between them has now shipped twice: `some` -> `every` left "at least one" in all three
// copies, and the QA-artifact exemption was re-licensed in prose after the code removed it. A
// denylist of known-stale phrases is a lagging indicator, so this binds the doc to the CURRENT
// predicate instead: whichever quantifier the validator uses, the shipped sentence must not claim
// the opposite one. These are the predicate's own tokens, not authored prose.
test("#given the shipped contract text #when compared with the D8 predicate #then they agree on the quantifier", () => {
  // given
  const validatorSource = readFileSync(validator, "utf8")
  const skill = readFileSync(path.join(scriptsDir, "..", "SKILL.md"), "utf8")

  // when
  const requiresEvery = validatorSource.includes("criteria.every((criterion) => !planText.includes(criterion.invariant))")

  // then
  assert.ok(requiresEvery, "D8 must hold against criterion count; `some` lets an appended criterion launder a copied one")
  assert.ok(
    !/at least one[^.]*adversarial criterion whose invariant is not restated/i.test(skill),
    "SKILL.md still promises `at least one` original criterion while the validator requires every one",
  )
})

// Differential, not anecdotal. The guard exists to agree with `JSON.parse` about which key names
// collide; six rounds showed that hand-written agreement drifts. So the oracle is the real parser:
// for each spelling, a source whose literal key count exceeds `Object.keys(...).length` HAS a
// collision and must block, and one where they match must not. Point cases only prove the spellings
// somebody thought of - a unicode-escaped key is exactly what nobody thought of.
const keySpellings = [
  ["plain", String.raw`"mandatory_class"`],
  ["unicode-escaped letter", String.raw`"mandatory_cla\u0073s"`],
  ["fully unicode-escaped", String.raw`"\u006dandatory_class"`],
  ["escaped solidus in a value key", String.raw`"mandatory_class"`],
]

for (const [label, spelling] of keySpellings) {
  test(`#given a duplicate key spelled ${label} #when validated #then the guard agrees with JSON.parse`, () => {
    // given
    const source = `{"schema":"omo.merge-gate/v2","mandatory_class":"auth-secrets-pii",${spelling}:"none"}`
    const parsedKeys = Object.keys(JSON.parse(source)).length
    const literalKeys = 3

    // when
    const collides = parsedKeys < literalKeys

    // then
    assert.ok(collides, `${label} must collide with mandatory_class, otherwise this case proves nothing`)
    const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "evidence", "gate-diff-"))
    const recordPath = path.join(directory, "record.json")
    try {
      writeFileSync(recordPath, source)
      stage(recordPath)
      const result = spawnSync(process.execPath, [validator, "--record", recordPath, "--plan", plan, "--repo", sandboxRepo], { encoding: "utf8" })
      assert.equal(result.status, 1, `${label}: a colliding key must block`)
      assert.match(result.stderr, /appears more than once/, `${label}: must block ON THE DUPLICATE, not on some later field`)
    } finally {
      unstage(recordPath)
      rmSync(directory, { recursive: true, force: true })
    }
  })
}

// Structural guards assert on CODE. The validator's comments quote the very constructs they
// describe - `readFileSync`, `"-z"`, the C-quoted example path - so a guard reading raw source
// counts prose as implementation and can be satisfied, or broken, by an edit that changes nothing.
function stripComments(source) {
  return source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n")
}

// Three of thirteen blockers on this branch came from `evidencePaths()` reading a record-authored
// path field, twice on the field the previous fix did not audit. The exemption is now a by-product
// of `verifyAndPinArtifact`, and these two guards keep it that way: they fail if a future change
// re-introduces record data as authority over the exemption, or admits a path without verifying it.
// Both assert on source structure the security property depends on, not on prose.
test("#given the validator source #when the SHA binding is inspected #then its exemption set is not an argument", () => {
  // given
  const source = readFileSync(validator, "utf8")

  // when
  const body = source.slice(source.indexOf("function commitsTouchOnlyEvidence"))
  const fn = body.slice(0, body.indexOf("\n}") + 2)
  const callSites = [...source.matchAll(/commitsTouchOnlyEvidence\(/g)]

  // then
  // The set must be READ here, never passed in: an argument is a place the caller can widen, and
  // widening at the call site kept the producer-side guards green.
  assert.match(fn, /const evidencePaths = context\.pinned/, `the set must be read from the context: ${fn}`)
  // Comments are stripped because the `-z` comment legitimately says "records"; the predicate over
  // the remaining CODE stays the strict one. Narrowing it to `record\.` would admit
  // `record["reviewed_sha"]` and destructuring, and the strict form passes on stripped source, so
  // the narrowing bought nothing and cost the guard its reach.
  const code = stripComments(fn)
  assert.ok(!/record/.test(code), `the SHA binding must not reference the record: ${code}`)
  assert.equal(callSites.length, 2, "one definition and exactly one call site")
  assert.match(source, /commitsTouchOnlyEvidence\(context\.repo, record\.reviewed_sha, context\.head, context\)/, "the call site must pass the context, not a set")
})

test("#given the validator source #when pinned admissions are counted #then only the verifier admits paths", () => {
  // given
  const source = readFileSync(validator, "utf8")

  // when
  const admissions = [...source.matchAll(/\.pinned\.add\(/g)]
  const writer = source.slice(source.indexOf("function pin(context, absolutePath)"))
  const writerBody = writer.slice(0, writer.indexOf("\n}") + 2)
  const pinCalls = [...source.matchAll(/^\s*pin\(context, /gm)]
  const recordAdmissions = [...source.matchAll(/pinRecordPath\(context, /g)].filter((m) => !source.slice(0, m.index).endsWith("function "))

  // then
  assert.equal(admissions.length, 1, "exactly one place may write the exemption set")
  assert.match(writerBody, /context\.pinned\.add\(/, "the sole writer must be pin()")
  // Two callers only: the digest-verifying path, and the record's own admission. A nullable digest
  // argument used to make the verifier itself an unverified-admission path, which every guard
  // tolerated; keeping the record's escape hatch in its own function bounds it to one call site.
  assert.equal(pinCalls.length, 2, `pin() must have exactly two callers, found ${pinCalls.length}`)
  assert.equal(recordAdmissions.length, 1, "the undigested record admission must have exactly one call site")

  const verifier = source.slice(source.indexOf("function verifyAndPinArtifact"))
  const verifierBody = verifier.slice(0, verifier.indexOf("\n}") + 2)
  assert.ok(!/expectedDigest !== null/.test(verifierBody), "the verifier must not accept a digest-optional admission")
  assert.match(verifierBody, /if \(typeof expectedDigest !== "string"/, "the verifier must always require a digest")
})

// R12 blocker 1. The size cap used to live inside `verifyAndPinArtifact`, so moving the record's
// undigested admission into its own function dropped the bound for the one artifact read with the
// least prior validation - and 130 tests stayed green because the cap had no coverage on any field.
// A 3 MB record validated where the parent commit blocked it. These pin the bound to the READ.
test("#given an oversized record #when validated #then the byte limit blocks", () => {
  const record = validRecord()
  // Valid JSON, so nothing but the bound itself can reject it: the padding sits in a field the
  // validator never reads, exactly as an accidental or hostile blow-up would.
  record._pad = "x".repeat(2 * 1024 * 1024)
  const result = run(record)
  assert.equal(result.status, 1, "a record above the artifact byte limit must block")
  assert.match(result.stderr, /record: is \d+ bytes, above the 1048576-byte limit/)
})

test("#given an oversized plan #when validated #then the byte limit blocks", () => {
  // The plan's first read happens in `main` before any artifact check runs, so it was never
  // covered even before this round. Whichever read comes first must carry the bound.
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "plans", "gate-big-plan-"))
  const bigPlan = path.join(directory, "plan.md")
  try {
    writeFileSync(bigPlan, `${readFileSync(plan, "utf8")}\n<!-- ${"x".repeat(2 * 1024 * 1024)} -->\n`)
    const result = run(validRecord(), { plan: bigPlan })
    assert.equal(result.status, 1, "a plan above the artifact byte limit must block")
    assert.match(result.stderr, /plan: is \d+ bytes, above the 1048576-byte limit/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given an oversized trailer artifact #when validated #then the byte limit blocks under its own field", () => {
  // The third admission path. The record and the plan each had an oversized test; the trailer -
  // the ONLY artifact whose path comes from the record itself, so the only one an author picks -
  // had none, and the structural guard below cannot supply one: it asserts that each reader calls
  // the bound, never that this path reaches a bounded reader at all. Routing the trailer around
  // `readBytes` would leave every source-text guard green.
  // The assertion is on the FIELD NAME, which is what makes this a test of this path rather than a
  // second test of the record's: only a bound that fired inside `verifyAndPinArtifact` can name
  // `verdicts.0.trailer_artifact`.
  const body = `${buildTrailer()}\n${"x".repeat(2 * 1024 * 1024)}\n`
  const result = runWithTrailer(validRecord(), body)
  assert.equal(result.status, 1, "a trailer above the artifact byte limit must block")
  assert.match(result.stderr, /verdicts\.0\.trailer_artifact: is \d+ bytes, above the 1048576-byte limit/)
})

test("#given the validator source #when its fs surface is counted #then only the two bounded readers can reach a whole file", () => {
  // given
  const source = readFileSync(validator, "utf8")

  // when
  const readers = ["readBytes", "readText"]

  // then
  // The bound belongs to the read, not to a caller. Asserting it at each `readFileSync` site means
  // a new admission path cannot acquire an unbounded read by simply not calling a guard function.
  for (const reader of readers) {
    const body = source.slice(source.indexOf(`function ${reader}(file, field)`))
    const fn = body.slice(0, body.indexOf("\n}") + 2)
    assert.match(fn, /assertWithinSizeLimit\(file, field\)/, `${reader} must bound the read: ${fn}`)
  }
  const code = stripComments(source)
  // Counting the CALL FORM is not counting the reads: `const rawRead = readFileSync` adds a real
  // unbounded read while leaving `readFileSync(` at two. Round 13 answered that by forbidding the
  // spellings it had found - an exact import line, no `= readFileSync` - and round 14 walked
  // through three more: `= (readFileSync)` sidesteps the anti-rebind regex, `from "fs"` is invisible
  // to a `"node:fs"` literal and resolves identically, and `readFileSync.call(…)` never produces the
  // call token at all. Each fix enumerated evasions; each round found another spelling, because a
  // list of forbidden spellings is open by construction.
  //
  // So this counts the IDENTIFIER instead. Three occurrences: the import specifier and the two
  // calls. Any fourth - in any syntax, including ones nobody has thought of - is a name reaching
  // `readFileSync` outside the two bounded readers, and the count says so without naming the shape.
  // The import is matched specifier-agnostically because Node resolves `fs` and `node:fs` alike.
  //
  // Counting alone is still not enough, and the round that introduced it proved the point against
  // itself: it dropped the exact-import assertion, and with it the only pin on WHICH fs primitives
  // the file may hold. Widening that one permitted line to carry `openSync`, `fstatSync` and
  // `readSync` buys a whole-file read that never spells `readFileSync` at all - so the occurrence
  // count stays at three and says nothing. That mutation allocated 3145785 bytes ahead of the bound
  // while this test was green, and the assertion the round deleted had caught it.
  //
  // So both halves are needed, and they are different in kind. The occurrence count is open-ended:
  // it rejects a fourth mention in any syntax, including ones nobody enumerated. The name set is a
  // list - but it is the list of the three primitives this file legitimately needs, closed by its
  // own requirements rather than by guessing at attacks, which is the one list that does not grow
  // each time somebody thinks of another spelling. The specifier is matched
  // spelling-agnostically, because Node resolves `fs` and `node:fs` alike.
  //
  // This is still text, and it is deliberately not claimed to be more. It constrains this file's
  // authors, not a hostile committer, which is the right ceiling for a bound the validator itself
  // documents as robustness rather than trust. Real closure would need the module parsed and every
  // binding resolved; the honest statement is that the fs surface is pinned and the occurrence
  // count is total, not that the name set is provably closed.
  // The counter and the specifier matcher below must range over the SAME set of imports, or an
  // import can be visible to one and invisible to the other. `from"node:fs"` without the space is
  // exactly that: it was uncounted here while the specifier matcher - which reads only the FIRST
  // match - happily reported the three legitimate names from a decoy line, leaving a second real
  // import free to carry `openSync`, `readSync` and `fstatSync`. Both halves therefore tolerate the
  // same whitespace, which is what makes "exactly one" mean "the only one the matcher can see".
  assert.equal([...code.matchAll(/from\s*"(?:node:)?fs(?:\/promises)?"/g)].length, 1, "fs must be imported exactly once, under any specifier spelling, so one line is the whole binding surface")
  // The specifier list is read as a SET of names, not as a piece of punctuation. A formatter that
  // breaks the import across lines and adds a trailing comma changes nothing about which primitives
  // the file holds, and the earlier `split(",")` turned that no-op into a suite failure whose
  // message accused the file of holding forbidden primitives - a false accusation about a file that
  // had only been reformatted. Empty entries are therefore dropped before the comparison. The
  // security property is untouched: a real fourth specifier is a fourth NON-empty name and still
  // fails, which the negative control in `mutations.txt` records.
  const specifiers = code.match(/import\s*\{([^}]*)\}\s*from\s*"(?:node:)?fs"/)
  assert.ok(specifiers, `fs must be imported with a named specifier list: ${code.match(/^.*from "(?:node:)?fs".*$/m)?.[0]}`)
  const names = specifiers[1].split(",").map((name) => name.trim()).filter((name) => name !== "").sort()
  assert.deepEqual(names, ["readFileSync", "realpathSync", "statSync"], `the file may hold exactly these three fs primitives, so no unbounded read can be assembled from others: ${names.join(", ")}`)
  assert.equal([...code.matchAll(/\breadFileSync\b/g)].length, readers.length + 1, `readFileSync must occur exactly once per bounded reader plus its import: ${[...code.matchAll(/^.*\breadFileSync\b.*$/gm)].map((m) => m[0].trim()).join(" | ")}`)
  const reads = [...code.matchAll(/\breadFileSync\(/g)]
  assert.equal(reads.length, readers.length, `readFileSync must occur exactly ${readers.length} times as a call, found ${reads.length}`)
  const limit = code.slice(code.indexOf("function assertWithinSizeLimit"))
  assert.match(limit.slice(0, limit.indexOf("\n}") + 2), /stats\.size > MAX_ARTIFACT_BYTES/, "the bound must compare the real file size")
})

test("#given an artifact whose stat fails #when validated #then the reader reports it with its field name", () => {
  // R13 blocker 3. `throwIfNoEntry: false` suppresses ENOENT and ENOTDIR only; EACCES and ELOOP
  // still throw. Placing the stat ahead of the reader made those two escape as a generic
  // `validator: EACCES …`, losing the field name the parent commit reported - the exact burial the
  // containment comment forbids. A stat that fails is not a size verdict.
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "plans", "gate-eloop-"))
  const looping = path.join(directory, "plan.md")
  try {
    // A symlink pointing at itself: stat raises ELOOP, and so does the read.
    symlinkSync(looping, looping)
    const result = run(validRecord(), { plan: looping })
    assert.equal(result.status, 1, "an unreadable plan must block")
    assert.match(result.stderr, /^plan: cannot read /, `the reader must name the field: ${result.stderr}`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given the validator source #when the pinned path is built #then it is normalized to git's separator", () => {
  // given
  const source = readFileSync(validator, "utf8")

  // when
  const writer = source.slice(source.indexOf("function pin(context, absolutePath)"))
  const writerBody = writer.slice(0, writer.indexOf("\n}") + 2)

  // then
  // git emits `/` on every platform; an unnormalized path.relative yields backslashes on Windows,
  // which never compare equal - leaving the exemption dead and every evidence commit blocking.
  assert.match(writerBody, /\.split\(path\.sep\)\.join\("\/"\)/, `pinned paths must use git's separator: ${writerBody}`)
})

// R12 blocker 2, revised by R13. The round claimed three mechanisms guarded the path-serialization
// hazard and gave each a guard. Measurement showed only two: `core.quotePath=false` governs git's
// human-readable form alone, so under `-z` the output is byte-identical with and without it, and
// its "control" was a source literal a dead `const` could satisfy. It is gone. What remains -
// `-z`, splitting on NUL, not trimming - is one mechanism whose behavioural control is the umlaut
// test below, with this structural guard pinning the pieces that test cannot distinguish.
test("#given the validator source #when git's diff is invoked #then names are NUL-separated and never trimmed", () => {
  // given
  const source = readFileSync(validator, "utf8")

  // when
  const body = source.slice(source.indexOf("function commitsTouchOnlyEvidence"))
  const fn = stripComments(body.slice(0, body.indexOf("\n}") + 2))

  // then
  assert.match(fn, /"-z"/, `git must separate names with NUL: ${fn}`)
  // `.trim()` on a newline-split name silently corrupts a filename with leading or trailing spaces,
  // so the NUL split and the absence of trimming are one rule.
  assert.match(fn, /\.split\("\\0"\)/, `names must be split on NUL: ${fn}`)
  assert.ok(!/\.trim\(\)/.test(fn), `a NUL-separated name must not be trimmed: ${fn}`)
  // A redundant second mechanism cannot have a behavioural control, so it must not come back:
  // whoever re-adds it would be re-adding a guard this suite can only mirror, never test.
  assert.ok(!/quotePath/.test(fn), `core.quotePath is a no-op under -z and must not return: ${fn}`)
})

test("#given an evidence path carrying non-ASCII bytes #when the evidence is committed #then the exemption still holds", () => {
  const repository = scratchRepo()
  try {
    // The diff's own motivating example. git C-quotes `ü` by default, so the reported name never
    // matched the pinned string and the PRESCRIBED lifecycle blocked: evidence committed as the
    // skill requires, then rejected for having been committed.
    const artifacts = scratchArtifacts(repository)
    const renamed = path.join(path.dirname(artifacts.trailerPath), "trailer-überprüfung.txt")
    writeFileSync(renamed, readFileSync(artifacts.trailerPath))
    rmSync(artifacts.trailerPath)
    const record = JSON.parse(readFileSync(artifacts.recordPath, "utf8"))
    record.verdicts[0].trailer_artifact = path.relative(repository.directory, renamed)
    record.verdicts[0].trailer_sha256 = planDigest(renamed)
    writeFileSync(artifacts.recordPath, JSON.stringify(record, null, 2))
    repository.git("add", "-A")
    const staged = runScratch(repository, artifacts)
    assert.equal(staged.status, 0, `a non-ASCII evidence path must validate before the commit: ${staged.stderr}`)

    repository.git("commit", "-q", "-m", "gate evidence")
    const result = runScratch(repository, artifacts)
    assert.equal(result.status, 0, `committing evidence at a non-ASCII path must not invalidate the record: ${result.stderr}`)
  } finally {
    rmSync(repository.directory, { recursive: true, force: true })
  }
})

// Every fixture is ASCII, so a digest computed over a UTF-8 round-trip agreed with one computed
// over raw bytes on all 127 cases - which is exactly how a byte-vs-text regression shipped green.
// These pin the byte semantics the operator's documented `shasum -a 256` command produces.
test("#given a trailer artifact containing invalid UTF-8 #when its shasum digest is recorded #then it validates", () => {
  const record = validRecord()
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "evidence", "gate-bytes-"))
  const artifact = path.join(directory, "trailer.txt")
  try {
    // A reviewer reply plus a region no UTF-8 decode can represent losslessly.
    writeFileSync(artifact, Buffer.concat([Buffer.from(buildTrailer(), "utf8"), Buffer.from([0x0a, 0xff, 0xfe, 0x80, 0x0a])]))
    record.verdicts[0].trailer_artifact = path.relative(sandboxRepo, artifact)
    record.verdicts[0].trailer_sha256 = planDigest(artifact)
    stage(artifact)
    assert.equal(run(record).status, 0, "a digest taken from the raw bytes must be the one the validator accepts")
  } finally {
    unstage(artifact)
    rmSync(directory, { recursive: true, force: true })
  }
})

test("#given an exempt artifact whose invalid-UTF-8 bytes change after the review #when validated #then the digest blocks", () => {
  const record = validRecord()
  const directory = mkdtempSync(path.join(sandboxRepo, ".omo", "evidence", "gate-bytes-tamper-"))
  const artifact = path.join(directory, "trailer.txt")
  try {
    const head = Buffer.from(buildTrailer(), "utf8")
    writeFileSync(artifact, Buffer.concat([head, Buffer.from([0x0a, 0xff, 0xfe, 0x80, 0x0a])]))
    record.verdicts[0].trailer_artifact = path.relative(sandboxRepo, artifact)
    record.verdicts[0].trailer_sha256 = planDigest(artifact)
    stage(artifact)
    // Different bytes, identical UTF-8 round-trip: a text-semantics digest cannot tell these apart.
    writeFileSync(artifact, Buffer.concat([head, Buffer.from([0x0a, 0x80, 0x81, 0xfd, 0x0a])]))
    stage(artifact)
    const result = run(record)
    assert.equal(result.status, 1, "changed bytes must break the binding even when the decode collides")
    assert.match(result.stderr, /trailer_sha256/)
  } finally {
    unstage(artifact)
    rmSync(directory, { recursive: true, force: true })
  }
})
