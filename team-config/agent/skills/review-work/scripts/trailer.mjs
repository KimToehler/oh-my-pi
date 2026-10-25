// The reviewer trailer contract: one parser and every rule that depends only on the trailer text,
// the invocation it is checked for, the expected verdict and the plan text. The gate record check,
// the standalone trailer check and `GC wave` all call `checkTrailer`, so the three cannot drift.
// The record check adds the one rule that needs the record: `model_id` equals the resolution.

export class TrailerError extends Error {
  constructor(field, detail) {
    super(`${field}: ${detail}`)
    this.field = field
    this.detail = detail
  }
}

function fail(field, detail) {
  throw new TrailerError(field, detail)
}

// Section sets differ per invocation: the audit brief prescribes five sections, the strategic
// brief poses four questions. Both are the reviewer's own account of what it was asked.
export const REQUIRED_SECTIONS = {
  "implementation-audit": [1, 2, 3, 4, 5],
  "strategic-risk-review": [1, 2, 3, 4],
}
export const UNRESOLVED_MODEL = "unresolved"
const CRITERION_FIELDS = ["invariant", "positive_witness", "negative_control", "observable", "boundary"]
const TRAILER_OPEN = "REVIEW-TRAILER-v1"
const TRAILER_CLOSE = "END-REVIEW-TRAILER"
const VERDICTS = new Set(["PASS", "FAIL", "INCONCLUSIVE"])

function parseCriteriaBlock(lines, field) {
  const criteria = []
  for (const line of lines) {
    const entry = line.match(/^-\s+([a-z_]+)\s*:\s*(.*)$/)
    if (entry) {
      criteria.push({ [entry[1]]: entry[2].trim() })
      continue
    }
    const continuation = line.match(/^\s+([a-z_]+)\s*:\s*(.*)$/)
    if (!continuation) continue
    if (criteria.length === 0) fail(field, `field ${continuation[1]} appears before any criterion`)
    // Same rule as the scalar parser, for the same reason: last-wins would let one appended
    // indented line rewrite a criterion while the reviewer's real answer sits verbatim above it.
    // A second criterion is legal; a repeated field inside one is ambiguous.
    if (Object.hasOwn(criteria[criteria.length - 1], continuation[1])) {
      fail(`${field}.${criteria.length - 1}.${continuation[1]}`, "appears more than once in the criterion; an appended field would override what the reviewer wrote")
    }
    criteria[criteria.length - 1][continuation[1]] = continuation[2].trim()
  }
  return criteria
}

// Two distinct failures meet here, and fixing one must not reopen the other.
// A reviewer auditing this contract cites the marker lines as file:line evidence, so a bare mention
// inside prose cannot invalidate the reply: rejecting it would make a correct FAIL unstorable and
// bias the gate toward reviews that found nothing. Line anchoring alone solves that.
// Cardinality is the other half. If a second block were tolerated, an orchestrator holding an
// honest FAIL could append a PASS block and have the validator read it, while the reviewer's real
// verdict sits verbatim in the same committed file. So exactly one block, matched on whole lines.
function markerLineIndexes(lines, marker) {
  return lines.flatMap((line, index) => (line.trim() === marker ? [index] : []))
}

function parseTrailer(text, field) {
  const lines = text.split("\n")
  const openIndexes = markerLineIndexes(lines, TRAILER_OPEN)
  const closeIndexes = markerLineIndexes(lines, TRAILER_CLOSE)
  if (openIndexes.length === 0 || closeIndexes.length === 0) {
    fail(field, `trailer is missing: no ${TRAILER_OPEN} / ${TRAILER_CLOSE} block on its own line, so what the reviewer was asked cannot be established`)
  }
  if (openIndexes.length > 1 || closeIndexes.length > 1) {
    fail(field, "carries more than one trailer block; an appended block would override what the reviewer actually answered")
  }
  if (closeIndexes[0] < openIndexes[0]) fail(field, "trailer close marker precedes its open marker")
  // The reply around the block is the reviewer's narrative: its `Blocker B<n>:` lines are the
  // findings the trailer's `blockers:` list must account for.
  const narrative = lines.slice(0, openIndexes[0]).concat(lines.slice(closeIndexes[0] + 1))
  return { ...parseTrailerBody(lines.slice(openIndexes[0] + 1, closeIndexes[0]), field), narrative }
}

function parseTrailerBody(lines, field) {
  const criteriaIndex = lines.findIndex((line) => /^adversarial_criteria\s*:/.test(line))
  const scalarLines = criteriaIndex === -1 ? lines : lines.slice(0, criteriaIndex)
  const scalars = {}
  for (const line of scalarLines) {
    const match = line.match(/^([a-z_]+)\s*:\s*(.*)$/)
    if (!match) continue
    // Last-wins assignment would let one appended line override an honest narrow answer, which is
    // cheaper than rewriting the reviewer's reply. A repeated key is ambiguous, so it blocks.
    if (Object.hasOwn(scalars, match[1])) fail(`${field}.${match[1]}`, "appears more than once in the trailer; a repeated field is ambiguous")
    scalars[match[1]] = match[2].trim()
  }
  if (criteriaIndex === -1) fail(`${field}.adversarial_criteria`, "trailer must carry an adversarial_criteria block")
  return { scalars, criteria: parseCriteriaBlock(lines.slice(criteriaIndex + 1), `${field}.adversarial_criteria`) }
}

const BLOCKER_LIST = /^B[1-9]\d*(?:\s*,\s*B[1-9]\d*)*$/
const NARRATIVE_BLOCKER = /^\s*(?:[-*]\s+)?(?:\*\*)?Blocker (B[1-9]\d*)(?:\*\*)?\s*:/

function reconcileBlockers(scalars, narrative, field) {
  if (scalars.verdict !== "FAIL") {
    if (scalars.blockers !== undefined && scalars.blockers !== "none") {
      fail(`${field}.blockers`, "only a FAIL trailer lists blockers; a PASS or INCONCLUSIVE trailer carries none or omits the line")
    }
    return []
  }
  if (typeof scalars.blockers !== "string" || !BLOCKER_LIST.test(scalars.blockers)) {
    fail(`${field}.blockers`, "a FAIL trailer lists its blocker ids as B1, B2, ...; without them no downgrade can be reconciled")
  }
  const ids = scalars.blockers.split(",").map((id) => id.trim())
  if (new Set(ids).size !== ids.length) fail(`${field}.blockers`, "repeats a blocker id")
  // Two findings under one id would let a single downgrade account for both, so each narrative id
  // must name exactly one finding.
  const narrativeIds = narrative.flatMap((line) => NARRATIVE_BLOCKER.exec(line)?.[1] ?? [])
  const reported = new Set()
  for (const id of narrativeIds) {
    if (reported.has(id)) fail(`${field}.blockers`, `narrative repeats Blocker ${id}; each finding needs its own id`)
    reported.add(id)
  }
  for (const id of reported) {
    if (!ids.includes(id)) fail(`${field}.blockers`, `narrative reports ${id} but the trailer omits it`)
  }
  for (const id of ids) {
    if (!reported.has(id)) fail(`${field}.blockers`, `no narrative Blocker ${id}: line in the reply`)
  }
  return ids
}

// Checks one stored reviewer reply. `verdict` is the verdict the caller expects (the record's, or
// the orchestrator's reading of the original reply), so a repair turn that changed it fails here.
export function checkTrailer(text, { field, invocation, verdict, planText }) {
  if (!Object.hasOwn(REQUIRED_SECTIONS, invocation)) {
    fail(`${field}.invocation`, `${invocation} is not a reviewer invocation; use implementation-audit or strategic-risk-review`)
  }
  const { scalars, criteria, narrative } = parseTrailer(text, field)

  // Without this binding a single dispatched reviewer satisfies every recorded invocation: the
  // section sets nest (1,2,3,4 is a subset of 1,2,3,4,5) and the model check only discriminates
  // when the two lanes resolved to different models, so nothing else catches a reused reply.
  if (typeof scalars.invocation !== "string" || scalars.invocation.trim() === "") {
    fail(`${field}.invocation`, "trailer must name the invocation the reviewer was dispatched for")
  }
  if (scalars.invocation !== invocation) {
    fail(`${field}.invocation`, `trailer was written for ${scalars.invocation} but is cited for ${invocation}`)
  }

  const sections = scalars.sections_covered
  if (typeof sections !== "string" || sections.trim() === "") {
    fail(`${field}.sections_covered`, "trailer must state which brief sections the reviewer received")
  }
  const covered = new Set(sections.split(",").map((part) => Number.parseInt(part.trim(), 10)).filter((n) => Number.isInteger(n)))
  const missing = REQUIRED_SECTIONS[invocation].filter((section) => !covered.has(section))
  if (missing.length > 0) {
    fail(`${field}.sections_covered`, `brief omitted section ${missing.join(", ")} of ${REQUIRED_SECTIONS[invocation].join(",")}; an incomplete brief cannot substantiate a verdict`)
  }

  if (typeof scalars.model_id !== "string" || scalars.model_id.trim() === "") {
    fail(`${field}.model_id`, `trailer must echo the reviewer's exact model ID, or ${UNRESOLVED_MODEL}`)
  }

  if (scalars.security_delta !== "yes" && scalars.security_delta !== "no") {
    fail(`${field}.security_delta`, "trailer must answer yes or no from the reviewer's own security and privacy section")
  }

  if (!VERDICTS.has(scalars.verdict)) {
    fail(`${field}.verdict`, `${scalars.verdict ?? "missing"} is not a verdict token; a brief soliciting APPROVE or REJECT breaks the verdict mapping`)
  }
  if (scalars.verdict !== verdict) {
    fail(`${field}.verdict`, `trailer reports ${scalars.verdict} but the expected verdict is ${verdict}`)
  }

  // An override may leave a FAIL's blockers unfixed only by downgrading each one, so the blocker
  // list has to be complete: it must equal the reply's own `Blocker B<n>:` lines. Either list alone
  // lets one finding drop out - an id the trailer omits, or a narrative blocker nobody numbered.
  const blockerIds = reconcileBlockers(scalars, narrative, field)

  if (criteria.length === 0) {
    fail(`${field}.adversarial_criteria`, "reviewer must generate at least one adversarial criterion of its own")
  }
  for (const [index, criterion] of criteria.entries()) {
    for (const required of CRITERION_FIELDS) {
      if (typeof criterion[required] !== "string" || criterion[required].trim() === "") {
        fail(`${field}.adversarial_criteria.${index}.${required}`, "every adversarial criterion carries all five fields")
      }
    }
  }
  // A criterion lifted verbatim from the plan re-tests the author's own assumption, which is the
  // failure mode the self-generated criteria exist to escape.
  // The rule holds against criterion COUNT, not only field content: with `some`, appending one
  // well-formed block satisfied a rule the reviewer's real criteria violated, laundering a wholly
  // copied criterion for five lines. That is cheaper than the declared forgery boundary, and it is
  // the fourth appearance of append-overrides-reviewer. No criterion may be copied.
  if (!criteria.every((criterion) => !planText.includes(criterion.invariant))) {
    fail(`${field}.adversarial_criteria`, "a criterion restates an invariant already in the plan; every criterion must be the reviewer's own")
  }

  return { scalars, securityDelta: scalars.security_delta === "yes", blockerIds }
}
