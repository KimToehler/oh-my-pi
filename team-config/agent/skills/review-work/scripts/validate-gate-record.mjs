#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, realpathSync, statSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { buildBundle, bundleDigest, FolderPlanError, snapshotFolder } from "./folder-plan.mjs"
import { RECORD_SCHEMA } from "./gate-layout.mjs"
import { abortRuleDefects, CRITERIA_HEADER_PATTERN, criteriaShapeDefect, mergeGateSection, planContent, readRiskTier, scanMarkdown, topLevelField } from "./plan-contract.mjs"
import { validateOpenSpecFiles } from "./validate-openspec-change.mjs"

class GateError extends Error {}

function block(field, detail) {
  throw new GateError(`${field}: ${detail}`)
}

// A tracked file is authored by whoever can commit, so this is a robustness bound rather than a
// trust boundary - but every artifact is read whole into memory before anything is known about it.
const MAX_ARTIFACT_BYTES = 1024 * 1024

// The bound belongs to the READ, not to any admission path. It used to sit in
// `verifyAndPinArtifact`, so splitting the record's undigested admission out of that function
// silently dropped it for the one artifact read with the least prior validation - and the plan's
// first read, in `main` before any artifact check runs, was never covered at all. Here every read
// carries it, and a structural guard asserts that no read bypasses this pair.
// A stat that FAILS is not a size verdict: `throwIfNoEntry` suppresses ENOENT and ENOTDIR, but
// EACCES and ELOOP still throw, and letting one escape here would replace the reader's field-named
// GateError with a generic one - burying the field exactly as this file forbids elsewhere. An
// unreadable file is the reader's diagnosis to report, so a failed stat defers rather than decides.
function assertWithinSizeLimit(file, field) {
  let stats
  try {
    stats = statSync(file, { throwIfNoEntry: false })
  } catch {
    return
  }
  if (stats !== undefined && stats.size > MAX_ARTIFACT_BYTES) {
    block(field, `is ${stats.size} bytes, above the ${MAX_ARTIFACT_BYTES}-byte limit for a gate artifact`)
  }
}

// Digests are taken over BYTES, never over a decoded string. `readFileSync(file, "utf8")` replaces
// every invalid sequence with U+FFFD and re-encoding is not the identity, so hashing a round-trip
// makes distinct files collide - and disagrees with the `shasum -a 256` the skill tells the operator
// to run. Read the bytes once, hash those, decode only for the parsers.
function readBytes(file, field) {
  assertWithinSizeLimit(file, field)
  try {
    return readFileSync(file)
  } catch (error) {
    if (error instanceof Error) block(field, `cannot read ${file}: ${error.message}`)
    throw error
  }
}

function readText(file, field) {
  assertWithinSizeLimit(file, field)
  try {
    return readFileSync(file, "utf8")
  } catch (error) {
    if (error instanceof Error) block(field, `cannot read ${file}: ${error.message}`)
    throw error
  }
}

// `JSON.parse` is last-wins on duplicate keys, so appending `,"mandatory_class":"none"` to a valid
// record silently overrides it while the honest value stays byte-present in the tracked file. Both
// trailer parsers already reject a repeated key for exactly this reason; the record is the fifth
// level of the same class and the most severe, because an appended `"reviewers_run":[]` makes every
// trailer check vacuous and bypasses the contract entirely. The reviver sees each pair in source
// order, so a key arriving twice is caught where `JSON.parse` alone cannot see it.
// `JSON.parse` is last-wins on duplicate keys AND collapses them before any reviver runs, so the
// duplicate is invisible to the parsed value - it has to be found in the source text. Appending
// `,"mandatory_class":"none"` to a valid record therefore overrode it silently while the honest
// value stayed byte-present in the tracked file. Both trailer parsers already reject a repeated key
// for exactly this reason; the record is the fifth level of the same class and the most severe,
// because an appended `"reviewers_run":[]` makes every trailer check vacuous.
// The scan tracks string literals with their escapes, so a brace or a colon inside a value cannot
// desynchronise the object nesting.
function decodeKey(quotedLiteral) {
  try {
    const decoded = JSON.parse(quotedLiteral)
    return typeof decoded === "string" ? decoded : quotedLiteral
  } catch {
    return quotedLiteral
  }
}

function assertNoDuplicateKeys(source, field) {
  const stack = []
  let index = 0
  let expectKey = false
  while (index < source.length) {
    const char = source[index]
    if (char === '"') {
      let end = index + 1
      while (end < source.length && source[end] !== '"') {
        end += source[end] === "\\" ? 2 : 1
      }
      // Decode with the same grammar the record parse used. Keying on the raw slice made the guard
      // and `JSON.parse` disagree about which names collide: JSON permits `\u0073` for `s`, so
      // `mandatory_cla\u0073s` is one key to the parser and a different string to a byte comparison.
      // Agreement now holds by construction rather than by hand-written escape arithmetic.
      const literal = decodeKey(source.slice(index, end + 1))
      if (expectKey && stack.length > 0) {
        const keys = stack[stack.length - 1]
        if (keys !== null) {
          if (keys.has(literal)) block(field, `${literal} appears more than once; an appended key would override what the record states`)
          keys.add(literal)
        }
        expectKey = false
      }
      index = end + 1
      continue
    }
    if (char === "{") {
      stack.push(new Set())
      expectKey = true
    } else if (char === "[") {
      stack.push(null)
      expectKey = false
    } else if (char === "}" || char === "]") {
      stack.pop()
      expectKey = false
    } else if (char === ",") {
      expectKey = stack.length > 0 && stack[stack.length - 1] !== null
    }
    index += 1
  }
}

function parseRecord(file) {
  const source = readText(file, "record")
  let value
  try {
    value = JSON.parse(source)
  } catch (error) {
    if (error instanceof SyntaxError) block("record", `invalid JSON: ${error.message}`)
    throw error
  }
  assertNoDuplicateKeys(source, "record")
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    block("record", "must be a JSON object")
  }
  return value
}

function requireArray(record, field) {
  if (!Array.isArray(record[field])) block(field, "must be an array")
  return record[field]
}

function invocationSet(entries, field) {
  const result = new Set()
  for (const [index, entry] of entries.entries()) {
    if (entry === null || typeof entry !== "object" || typeof entry.invocation !== "string") {
      block(`${field}.${index}.invocation`, "must be a string")
    }
    if (result.has(entry.invocation)) block(field, `duplicate invocation ${entry.invocation}`)
    result.add(entry.invocation)
  }
  return result
}

// Section sets differ per invocation: the audit brief prescribes five sections, the strategic
// brief poses four questions. Both are the reviewer's own account of what it was asked.
const REQUIRED_SECTIONS = {
  "implementation-audit": [1, 2, 3, 4, 5],
  "strategic-risk-review": [1, 2, 3, 4],
}
const CRITERION_FIELDS = ["invariant", "positive_witness", "negative_control", "observable", "boundary"]
const TRAILER_OPEN = "REVIEW-TRAILER-v1"
const TRAILER_CLOSE = "END-REVIEW-TRAILER"
const UNRESOLVED_MODEL = "unresolved"

// Error correlation follows the weights, not the route. `anthropic/claude-opus-5`,
// `openrouter/anthropic/claude-opus-5`, `github-copilot/claude-opus-5` and `onara/cc/claude-opus-5`
// are one model behind four prefixes, so the vendor is read from the model NAME and the routing
// prefix is discarded. This table duplicates `model-family-detectors.ts` on purpose: the validator
// ships standalone into each harness's skills directory and may not import from the workspace.
const MODEL_VENDORS = [
  [/^claude-/, "anthropic"],
  [/^gpt-/, "openai"],
  [/^o[0-9]/, "openai"],
  [/^gemini-/, "google"],
  [/^glm-/, "zai"],
  [/^kimi-/, "moonshot"],
  [/^deepseek-/, "deepseek"],
  [/^grok-/, "xai"],
  [/^qwen/, "alibaba"],
  [/^minimax-/i, "minimax"],
  [/^mimo-/, "xiaomi"],
]

// `openrouter/anthropic/claude-opus-5:thinking` -> `claude-opus-5`. The variant suffix is a
// reasoning-effort knob on one model, so keeping it would call two efforts different models.
function bareModelName(modelID) {
  return modelID.split("/").pop().split(":")[0].trim().toLowerCase()
}

function modelVendor(modelID) {
  const bare = bareModelName(modelID)
  return (MODEL_VENDORS.find(([pattern]) => pattern.test(bare)) ?? [null, null])[1]
}

// Returns the label the record must carry, or null when nothing can be proven.
function deriveIndependence(implementationModels, reviewModel) {
  if (reviewModel === UNRESOLVED_MODEL || implementationModels.includes(UNRESOLVED_MODEL)) return null
  const reviewBare = bareModelName(reviewModel)
  if (implementationModels.some((model) => bareModelName(model) === reviewBare)) return "same-model"
  const reviewVendor = modelVendor(reviewModel)
  // An unrecognized name is usually a roster alias such as `<project>/auditor` rather than a model
  // ID, and an alias cannot substantiate an independence claim.
  if (reviewVendor === null) return null
  const vendors = implementationModels.map(modelVendor)
  if (vendors.some((vendor) => vendor === null)) return null
  return vendors.includes(reviewVendor) ? "same-provider" : "cross-provider"
}

// Evidence must survive for the next reader, and "not ignored" does not mean "will survive": a file
// nobody ever added is un-ignored and vanishes from any other checkout. So the artifact must be in
// the index. It is checked against the index rather than HEAD because the record is written, staged
// and validated before the evidence commit exists.
function tryRealpath(target) {
  try {
    return realpathSync.native(target)
  } catch {
    return null
  }
}

// The ONLY way a path enters the SHA-binding exemption. Verification and admission are one step on
// purpose: three separate `pin` calls beside three separate digest checks would be barely better
// than the field list they replaced, because a future caller could pin without verifying. Here an
// unverified path is unexemptable, so widening the exemption means changing this function rather
// than adding a field somewhere else.
// The record is the one artifact that cannot self-bind - a digest of the record stored inside the
// record proves nothing - so it is admitted from the trusted `--record` path with no digest.
// `requireTracked` is false for the plan alone. The plan is a review INPUT that commonly lives on an
// ignored path - `.omp/plans/` is ignored in many repositories - and it is bound by content, so
// its durability comes from `plan_sha256` rather than from an index entry. The record and the
// trailers are review OUTPUT that a later reviewer must be able to open, so they must be tracked.
// `pathField` names the field that supplied the path and `digestField` the one that pinned it, so a
// path problem and a digest mismatch stay distinguishable to the operator reading stderr.
// `admit` is the one extra gate on pinning: a verified artifact is pinned only when it returns true for
// the artifact's bytes. Only the whole-diff report passes one, because it alone has a free-form path.
//
// A folder plan is bound by the digest of the bundle rebuilt from the one snapshot `main` took, and
// every snapshot file is admitted to the exemption. The single `pin` call below serves both shapes,
// so this function stays the only admission path.
function verifyAndPinArtifact(context, absolutePath, pathField, digestField, expectedDigest, { requireTracked = true, folder = null, admit = null } = {}) {
  const field = digestField
  let bytes = null
  let digest
  let targets = [absolutePath]
  if (folder) {
    digest = folder.digest
    targets = [...folder.snapshot.keys()].map((file) => path.join(absolutePath, file))
  } else {
    if (requireTracked) assertTracked(context, absolutePath, pathField)
    else assertInsideRepo(context.repo, absolutePath, pathField)
    bytes = readBytes(absolutePath, pathField)
    digest = createHash("sha256").update(bytes).digest("hex")
  }
  if (typeof expectedDigest !== "string" || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
    block(field, "must be the sha256 of the stored artifact bytes, so a later edit to that file cannot ride the path exemption")
  }
  if (expectedDigest !== digest) {
    block(field, `records ${expectedDigest} but the artifact now hashes to ${digest}; it changed after the review, so re-review against it as it now stands`)
  }
  if (admit === null || admit(bytes)) {
    for (const target of targets) {
      pin(context, target)
    }
  }
  return { digest, text: bytes === null ? "" : bytes.toString("utf8") }
}

// The record is the one artifact that cannot self-bind: a digest of the record stored inside the
// record proves nothing. It is therefore admitted from the trusted `--record` path with no digest.
// This lives in its own function rather than as a `null` argument to `verifyAndPinArtifact`, because
// a nullable digest parameter is an unverified-admission path sitting inside the sanctioned
// verifier - any later caller could pass a record-authored path with `null` and widen the exemption
// while every structural guard stayed green. Here the escape hatch has exactly one call site.
function pinRecordPath(context, recordPath) {
  assertTracked(context, recordPath, "record")
  readBytes(recordPath, "record")
  pin(context, recordPath)
}

// Sole writer of the exemption set. Git serializes paths with `/` on every platform, so the pinned
// string is normalized to match: `path.relative` yields backslashes on Windows, which would never
// compare equal and would leave the exemption dead - every post-review evidence commit blocking.
function pin(context, absolutePath) {
  context.pinned.add(path.relative(context.repo, absolutePath).split(path.sep).join("/"))
}

// Containment is asserted for every artifact, tracked or not: a path outside the repository cannot
// be read from any other checkout regardless of whether an index entry was required.
function assertInsideRepo(repo, file, field) {
  const resolved = path.resolve(repo, file)
  const relative = path.relative(repo, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    block(field, `${file} resolves outside the repository, so no reviewer can read it from a checkout`)
  }
  // `path.resolve` is lexical, and a symlink is a perfectly trackable object: `check-ignore` and
  // `ls-files` both accept one whose target is outside the repository, and the read then follows
  // it off-tree. The artifact would exist only on the validating machine - exactly what requiring
  // an index entry is meant to prevent - so containment is re-asserted against the real path.
  // A missing file is reported by its own reader, with a message naming the field. Resolving it
  // here would raise ENOENT first and bury that.
  const realPath = tryRealpath(resolved)
  if (realPath !== null) {
    const realRelative = path.relative(tryRealpath(repo) ?? repo, realPath)
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      block(field, `${file} resolves outside the repository through a symlink, so no reviewer can read it from a checkout`)
    }
  }
  return relative
}

// The record's own state picks the reference every tracked artifact is compared with, because the
// gate runs twice: while the record is still being written, and again once it is committed.
// - Record's working-tree bytes equal its raw HEAD blob: it is committed. Every artifact must equal
//   its HEAD blob in the working tree AND in the index, so a staged change hidden by a working tree
//   restored to HEAD fails as well. What is validated is then what the commit stores.
// - Otherwise the record is being written: every artifact's working tree must equal its index blob,
//   so a file staged as A and edited to B cannot validate as B while the commit stores A.
// All comparisons are on raw bytes. `git diff` normalizes line endings under `core.autocrlf` and
// text filters, so a CRLF working file and an LF blob compare equal there while the commit stores
// bytes other than the ones that were hashed.
function blobBytes(repo, spec, field) {
  const blob = spawnSync("git", ["-C", repo, "cat-file", "blob", spec], { maxBuffer: MAX_ARTIFACT_BYTES * 2 })
  if (blob.error) block(field, `cannot read ${spec}: ${blob.error.message}`)
  if (blob.status !== 0) return null
  return blob.stdout
}

function recordIsCommitted(context) {
  if (context.recordCommitted === undefined) {
    const relative = path.relative(context.repo, context.recordPath).split(path.sep).join("/")
    const head = blobBytes(context.repo, `HEAD:${relative}`, "record")
    context.recordCommitted = head !== null && head.equals(readBytes(context.recordPath, "record"))
  }
  return context.recordCommitted
}

function assertTracked(context, file, field) {
  const repo = context.repo
  const relative = assertInsideRepo(repo, file, field)
  const ignored = spawnSync("git", ["-C", repo, "check-ignore", "-q", "--no-index", "--", relative], { encoding: "utf8" })
  if (ignored.error) block(field, `cannot check ${relative}: ${ignored.error.message}`)
  if (ignored.status === 0) block(field, `${relative} sits on a git-ignored path and cannot be reviewed; write it to a tracked path`)
  if (ignored.status !== 1) block(field, `git check-ignore failed for ${relative}: ${ignored.stderr.trim()}`)
  const tracked = spawnSync("git", ["-C", repo, "ls-files", "--error-unmatch", "--", relative], { encoding: "utf8" })
  if (tracked.status !== 0) {
    block(field, `${relative} is not tracked by git; stage it so the record survives for the next reviewer`)
  }
  const working = readBytes(file, field)
  const staged = blobBytes(repo, `:${relative}`, field)
  if (recordIsCommitted(context)) {
    const head = blobBytes(repo, `HEAD:${relative}`, field)
    if (head === null || !working.equals(head)) {
      block(field, `${relative} differs from its HEAD blob in the working tree while the record is committed; validate the bytes the commit stores`)
    }
    if (staged === null || !staged.equals(head)) {
      block(field, `${relative} differs from its HEAD blob in the index while the record is committed; a staged change must not hide behind a restored working tree`)
    }
  } else if (staged === null || !working.equals(staged)) {
    block(field, `${relative} differs from its staged blob; stage the bytes that were validated, since the commit stores the index`)
  }
}

const REPORT_MARKER = "INTEGRATION-REVIEW-REPORT-v1"

// The only way the whole-diff report enters the exemption; see the exemption comment below.
function reportMayBePinned(context, reviewedSha, absolutePath, bytes) {
  const relative = path.relative(context.repo, absolutePath).split(path.sep).join("/")
  if (!relative.endsWith(".md")) return false
  if (bytes.toString("utf8").split("\n", 1)[0] !== REPORT_MARKER) return false
  const insideRecordDir = path.relative(path.dirname(context.recordPath), absolutePath)
  if (insideRecordDir === ".." || insideRecordDir.startsWith(`..${path.sep}`) || path.isAbsolute(insideRecordDir)) return false
  const existed = spawnSync("git", ["-C", context.repo, "cat-file", "-e", `${reviewedSha}:${relative}`], { encoding: "utf8" })
  return existed.status !== 0
}

// The gate demands two things that collide head-on: the evidence must be durable in the repository,
// and `reviewed_sha` must still describe the tree under review. Committing the prescribed evidence
// moves HEAD, so a naive HEAD comparison invalidates the record the moment it is stored - and the
// cheap way out is to leave the evidence untracked, which destroys the record instead.
// The reviewed target is therefore the CODE: HEAD counts as unchanged while every commit on top of
// `reviewed_sha` touches evidence paths only. A single source file in those commits fails it.
// The exemption covers ONLY files whose existence is caused by storing the record: the record, the
// reviewer trailers it cites, the plan, and the whole-diff report under the conditions below.
// The report is the one artifact whose path is free-form AND whose bytes are not a parsed format, so
// a path-only rule would let the record name any new file in a post-review commit and exempt it. It
// is pinned only when `reportMayBePinned` holds: `.md` path, first line `INTEGRATION-REVIEW-REPORT-v1`,
// absent from the `reviewed_sha` tree, and inside the record's directory. A report that fails any
// condition is still bound by its digest but not pinned, so a commit touching it voids the record.
// Being read is NOT what constrains them: reading a trailer constrains only the region between the
// markers, so one file could hold a genuine trailer and arbitrary reviewed source, and the path
// exemption would cover the source half too - an authorization rule could be rewritten after the
// review with the gate still passing. What constrains an exempt path is CONTENT: the plan is bound
// by `plan_sha256` and each trailer by `verdicts[].trailer_sha256`, so an exempt file whose bytes
// move at all stops matching the record.
// `qa[].artifact` is deliberately NOT exempt. It is orchestrator-typed JSON that nothing else
// validates, so honouring it would let one free-form string decide which code counts as reviewed -
// and a QA row pointing at the file its QA exercised would silently disable the binding for that
// path. QA artifacts are written before validation, so the normal flow never needs them exempt.
function commitsTouchOnlyEvidence(repo, reviewedSha, head, context) {
  const evidencePaths = context.pinned
  // `-z` is the whole mechanism, and it does three things the default output cannot. git's
  // human-readable form C-quotes and octal-escapes any non-ASCII path and any path containing a
  // quote or backslash, so `.omp/team-config/evidence/trailer-überprüfung.txt` arrives as
  // `".omp/team-config/evidence/trailer-\303\274berpr\303\274fung.txt"` and never matches the pinned string;
  // it separates on LF, which cannot represent a filename containing one; and splitting on LF
  // invites a `.trim()` that corrupts names with leading or trailing spaces. `-z` emits raw bytes
  // separated by NUL, so none of the three arise.
  // `-c core.quotePath=false` was here too and has been removed deliberately: it governs only the
  // human-readable form, so under `-z` the output is byte-identical with and without it. Two
  // mechanisms for one hazard cannot both have a behavioural control - the second is satisfiable by
  // a source literal, which is the guard style this branch keeps finding holes in.
  const names = spawnSync("git", ["-C", repo, "diff", "--name-only", "-z", `${reviewedSha}..${head}`], { encoding: "utf8" })
  if (names.status !== 0) return false
  const changed = names.stdout.split("\0").filter(Boolean)
  if (changed.length === 0) return false
  return changed.every((file) => evidencePaths.has(file))
}

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
    if (criteria.length === 0) block(field, `field ${continuation[1]} appears before any criterion`)
    // Same rule as the scalar parser, for the same reason: last-wins would let one appended
    // indented line rewrite a criterion while the reviewer's real answer sits verbatim above it.
    // A second criterion is legal; a repeated field inside one is ambiguous.
    if (Object.hasOwn(criteria[criteria.length - 1], continuation[1])) {
      block(`${field}.${criteria.length - 1}.${continuation[1]}`, "appears more than once in the criterion; an appended field would override what the reviewer wrote")
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
    block(field, `trailer is missing: no ${TRAILER_OPEN} / ${TRAILER_CLOSE} block on its own line, so what the reviewer was asked cannot be established`)
  }
  if (openIndexes.length > 1 || closeIndexes.length > 1) {
    block(field, "carries more than one trailer block; an appended block would override what the reviewer actually answered")
  }
  if (closeIndexes[0] < openIndexes[0]) block(field, "trailer close marker precedes its open marker")
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
    if (Object.hasOwn(scalars, match[1])) block(`${field}.${match[1]}`, "appears more than once in the trailer; a repeated field is ambiguous")
    scalars[match[1]] = match[2].trim()
  }
  if (criteriaIndex === -1) block(`${field}.adversarial_criteria`, "trailer must carry an adversarial_criteria block")
  return { scalars, criteria: parseCriteriaBlock(lines.slice(criteriaIndex + 1), `${field}.adversarial_criteria`) }
}

function validateTrailer(trailer, options) {
  const { field, invocation, recordVerdict, resolvedModel, planText } = options
  const { scalars, criteria, narrative } = trailer

  // Without this binding a single dispatched reviewer satisfies every recorded invocation: the
  // section sets nest (1,2,3,4 is a subset of 1,2,3,4,5) and the model check only discriminates
  // when the two lanes resolved to different models, so nothing else catches a reused reply.
  if (typeof scalars.invocation !== "string" || scalars.invocation.trim() === "") {
    block(`${field}.invocation`, "trailer must name the invocation the reviewer was dispatched for")
  }
  if (scalars.invocation !== invocation) {
    block(`${field}.invocation`, `trailer was written for ${scalars.invocation} but the record cites it for ${invocation}`)
  }

  const sections = scalars.sections_covered
  if (typeof sections !== "string" || sections.trim() === "") {
    block(`${field}.sections_covered`, "trailer must state which brief sections the reviewer received")
  }
  const covered = new Set(sections.split(",").map((part) => Number.parseInt(part.trim(), 10)).filter((n) => Number.isInteger(n)))
  const missing = REQUIRED_SECTIONS[invocation].filter((section) => !covered.has(section))
  if (missing.length > 0) {
    block(`${field}.sections_covered`, `brief omitted section ${missing.join(", ")} of ${REQUIRED_SECTIONS[invocation].join(",")}; an incomplete brief cannot substantiate a verdict`)
  }

  if (typeof scalars.model_id !== "string" || scalars.model_id.trim() === "") {
    block(`${field}.model_id`, `trailer must echo the reviewer's exact model ID, or ${UNRESOLVED_MODEL}`)
  }
  if (scalars.model_id !== resolvedModel) {
    block(`${field}.model_id`, `trailer reports ${scalars.model_id} but resolution records model ${resolvedModel}`)
  }

  if (scalars.security_delta !== "yes" && scalars.security_delta !== "no") {
    block(`${field}.security_delta`, "trailer must answer yes or no from the reviewer's own security and privacy section")
  }

  if (!new Set(["PASS", "FAIL", "INCONCLUSIVE"]).has(scalars.verdict)) {
    block(`${field}.verdict`, `${scalars.verdict ?? "missing"} is not a verdict token; a brief soliciting APPROVE or REJECT breaks the verdict mapping`)
  }
  if (scalars.verdict !== recordVerdict) {
    block(`${field}.verdict`, `trailer reports ${scalars.verdict} but the record claims ${recordVerdict}`)
  }

  // An override may leave a FAIL's blockers unfixed only by downgrading each one, so the blocker
  // list has to be complete: it must equal the reply's own `Blocker B<n>:` lines. Either list alone
  // lets one finding drop out - an id the trailer omits, or a narrative blocker nobody numbered.
  const blockerIds = reconcileBlockers(scalars, narrative, field)

  if (criteria.length === 0) {
    block(`${field}.adversarial_criteria`, "reviewer must generate at least one adversarial criterion of its own")
  }
  for (const [index, criterion] of criteria.entries()) {
    for (const required of CRITERION_FIELDS) {
      if (typeof criterion[required] !== "string" || criterion[required].trim() === "") {
        block(`${field}.adversarial_criteria.${index}.${required}`, "every adversarial criterion carries all five fields")
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
    block(`${field}.adversarial_criteria`, "a criterion restates an invariant already in the plan; every criterion must be the reviewer's own")
  }

  return { securityDelta: scalars.security_delta === "yes", blockerIds }
}

const BLOCKER_LIST = /^B[1-9]\d*(?:\s*,\s*B[1-9]\d*)*$/
const NARRATIVE_BLOCKER = /^\s*(?:[-*]\s+)?(?:\*\*)?Blocker (B[1-9]\d*)(?:\*\*)?\s*:/

function reconcileBlockers(scalars, narrative, field) {
  if (scalars.verdict !== "FAIL") {
    if (scalars.blockers !== undefined && scalars.blockers !== "none") {
      block(`${field}.blockers`, "only a FAIL trailer lists blockers; a PASS or INCONCLUSIVE trailer carries none or omits the line")
    }
    return []
  }
  if (typeof scalars.blockers !== "string" || !BLOCKER_LIST.test(scalars.blockers)) {
    block(`${field}.blockers`, "a FAIL trailer lists its blocker ids as B1, B2, ...; without them no downgrade can be reconciled")
  }
  const ids = scalars.blockers.split(",").map((id) => id.trim())
  if (new Set(ids).size !== ids.length) block(`${field}.blockers`, "repeats a blocker id")
  // Two findings under one id would let a single downgrade account for both, so each narrative id
  // must name exactly one finding.
  const narrativeIds = narrative.flatMap((line) => NARRATIVE_BLOCKER.exec(line)?.[1] ?? [])
  const reported = new Set()
  for (const id of narrativeIds) {
    if (reported.has(id)) block(`${field}.blockers`, `narrative repeats Blocker ${id}; each finding needs its own id`)
    reported.add(id)
  }
  for (const id of reported) {
    if (!ids.includes(id)) block(`${field}.blockers`, `narrative reports ${id} but the trailer omits it`)
  }
  for (const id of ids) {
    if (!reported.has(id)) block(`${field}.blockers`, `no narrative Blocker ${id}: line in the reply`)
  }
  return ids
}

// The opt-out is one top-level bullet. A glued suffix (`not applicableXYZ`) is not a declaration.
const OPT_OUT_PATTERN = /^-\s+(?:\*\*)?Merge gate(?:\*\*)?\s*:\s*(?:\*\*)?\s*not applicable(?=$|[\s(.,;:\u2013\u2014])/i

function riskTier(section) {
  const parsed = readRiskTier(section)
  if (parsed.error) block("plan Risk tier", parsed.error)
  return parsed.tier
}

function validateCriteria(section) {
  if (section === undefined) block("plan Merge gate", "section is required")
  const defect = criteriaShapeDefect(section)
  if (defect) block(defect.field, defect.detail)
}

function validateAbortRuleFields(section) {
  const defects = abortRuleDefects(section)
  if (defects.length > 0) {
    block("plan Merge gate abort fields", `${defects.join("; ")}. Each is a top-level bullet in ## Merge gate with concrete text or none (<reason>)`)
  }
}

// --plan-only decision table: a real opt-out skips the contract unless the plan also declares
// criteria; otherwise criteria and both abort fields are required.
function validatePlanContract(planText) {
  const lines = scanMarkdown(planText)
  const section = mergeGateSection(planContent(lines))
  if (lines.some((line) => line.content && OPT_OUT_PATTERN.test(line.text))) {
    if (section !== undefined && CRITERIA_HEADER_PATTERN.test(section)) {
      block("plan Merge gate", "declares the opt-out `Merge gate: not applicable` and Feature-specific criteria; keep one")
    }
    return
  }
  validateCriteria(section)
  validateAbortRuleFields(section)
  riskTier(section)
}

// ---- Folder plans -------------------------------------------------------------------------------
// An OpenSpec change folder is the plan. One snapshot feeds the OpenSpec checks (which include the
// criteria), the classification and the bundle, so every check runs on exactly the bytes
// `plan_sha256` pins. `gate.md` is the folder's merge-gate section.

function isFolderPlan(planPath) {
  try {
    return statSync(planPath).isDirectory() && statSync(path.join(planPath, "gate.md"), { throwIfNoEntry: false }) !== undefined
  } catch {
    return false
  }
}

function takeSnapshot(folderPath) {
  try {
    return snapshotFolder(folderPath)
  } catch (error) {
    if (error instanceof FolderPlanError) block("plan", error.message)
    throw error
  }
}

const gateField = (gateContent, field) => topLevelField(gateContent, field).value ?? ""

function parseGateClassification(gateContent) {
  const wholeDiff = gateField(gateContent, "Whole-diff review").replace(/[`*]/g, "").trim()
  return {
    mandatoryClass: gateField(gateContent, "Mandatory class").replace(/[`*]/g, "").trim().split(/\s+/, 1)[0],
    wholeDiff: wholeDiff === "needed",
    wholeDiffReason: /^not needed\s*\((.*)\)$/.exec(wholeDiff)?.[1].trim(),
  }
}

// One snapshot of the live folder: the OpenSpec checks (fields, specs, criteria) block with their own
// text, then the bundle and its digest are built from the same map. A file plan never reaches this.
function loadFolderPlan(repo, planPath) {
  assertInsideRepo(repo, planPath, "plan")
  const snapshot = takeSnapshot(planPath)
  const errors = validateOpenSpecFiles(snapshot)
  if (errors.length > 0) block("plan OpenSpec change", errors.join("; "))
  const gateContent = planContent(scanMarkdown(snapshot.get("gate.md").toString("utf8")))
  const bundle = buildBundle(snapshot)
  return { snapshot, gateContent, gate: parseGateClassification(gateContent), bundle, digest: bundleDigest(bundle) }
}

// The folder's classification is whatever gate.md says; a record can neither reclassify the change
// nor swap the Whole-diff decision.
function checkFolderClassification(record, gate) {
  if (record.mandatory_class !== gate.mandatoryClass) {
    block("mandatory_class", `record says ${record.mandatory_class} but gate.md says ${gate.mandatoryClass}; the class comes from gate.md`)
  }
  if (record.whole_diff.run !== gate.wholeDiff) {
    block("whole_diff", `record says run ${record.whole_diff.run} but gate.md says Whole-diff review ${gate.wholeDiff ? "needed" : "not needed"}`)
  }
  if (!gate.wholeDiff && record.whole_diff.reason?.trim() !== gate.wholeDiffReason) {
    block("whole_diff.reason", `record says "${record.whole_diff.reason}" but gate.md says "${gate.wholeDiffReason}"; the reason comes from gate.md`)
  }
}

function validateRecord(record, context) {
  // One accepted id, defined in gate-layout.mjs. Every other value, a retired id included, gets the
  // same finding: a record under an old id was written for a different gate contract, so it is re-run, never edited.
  if (record.schema !== RECORD_SCHEMA) block("schema", `must equal ${RECORD_SCHEMA}; a record under any other id is not accepted, so re-run review-work to write a new one`)
  const sha = /^[0-9a-f]{40}$/i
  if (!sha.test(record.reviewed_sha)) block("reviewed_sha", "must be a full 40-hex SHA")
  if (!sha.test(record.diff_base)) block("diff_base", "must be a full 40-hex SHA")
  // An empty range contains no implementation to review, so it cannot substantiate a merge-gate PASS.
  if (record.diff_base === record.reviewed_sha) block("diff_base", "must differ from reviewed_sha")
  if (record.plan !== context.planRelative) {
    block("plan", `${record.plan ?? "missing"} does not equal --plan ${context.planRelative}`)
  }
  // The plan is a review INPUT, not review output, and it is mutable: `validateTrailer` tests each
  // adversarial criterion against the CURRENT plan text. Binding the path alone let an edit after
  // the review delete the invariant a criterion had copied, turning it into an apparently
  // independent one without touching the reviewer's trailer. Path exemption cannot catch that, and
  // where the plan is git-ignored - as `.omp/plans/` commonly is - no commit is needed at all.
  // So the plan is bound by CONTENT: the digest of the exact bytes the reviewer was given.
  verifyAndPinArtifact(context, context.planPath, "plan", "plan_sha256", record.plan_sha256, { requireTracked: false, folder: context.folder })
  if (typeof record.decision_reason !== "string" || record.decision_reason.trim() === "") {
    block("decision_reason", "must be a non-empty line")
  }
  if (record.decision_reason.includes("\n")) block("decision_reason", "must be one line")

  const hasOverride = Object.hasOwn(record, "override")
  if (hasOverride) {
    if (record.override === null || Array.isArray(record.override) || typeof record.override !== "object") {
      block("override", "must be an object")
    }
    if (typeof record.override.by !== "string" || record.override.by.trim() === "") {
      block("override.by", "must be a non-empty string")
    }
    if (typeof record.override.reason !== "string" || record.override.reason.trim() === "") {
      block("override.reason", "must be a non-empty string")
    }
  }
  if (record.whole_diff === null || typeof record.whole_diff !== "object" || Array.isArray(record.whole_diff)) {
    block("whole_diff", "must be an object")
  }
  if (typeof record.whole_diff.run !== "boolean") block("whole_diff.run", "must be a boolean")
  if (record.whole_diff.run === false && (typeof record.whole_diff.reason !== "string" || record.whole_diff.reason.trim() === "")) {
    block("whole_diff.reason", "required when whole_diff.run is false")
  }
  // The integration-review report is authenticated like a trailer: tracked, and bound by digest.
  // Its pin is conditional (`reportMayBePinned`), so a path alone never exempts a file.
  if (record.whole_diff.run === true) {
    if (typeof record.whole_diff.report !== "string" || record.whole_diff.report.trim() === "") {
      block("whole_diff.report", "required when whole_diff.run is true: the tracked integration-review report")
    }
    verifyAndPinArtifact(context, path.resolve(context.repo, record.whole_diff.report), "whole_diff.report", "whole_diff.report_sha256", record.whole_diff.report_sha256, {
      admit: (bytes) => reportMayBePinned(context, record.reviewed_sha, path.resolve(context.repo, record.whole_diff.report), bytes),
    })
  }

  const qa = requireArray(record, "qa")
  if (qa.length === 0) block("qa", "must contain at least one row")
  for (const [index, row] of qa.entries()) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      block(`qa.${index}`, "must be an object")
    }
    if (row.passed !== true) block(`qa.${index}.passed`, "must be true")
    if (typeof row.artifact !== "string" || row.artifact.trim() === "") {
      block(`qa.${index}.artifact`, "must be a non-empty string")
    }
  }

  const mandatoryClasses = new Set(["none", "auth-secrets-pii", "schema-migration", "wire-contract-api", "concurrency-state"])
  if (!mandatoryClasses.has(record.mandatory_class)) {
    block("mandatory_class", "must be none, auth-secrets-pii, schema-migration, wire-contract-api, or concurrency-state")
  }
  if (context.folder) checkFolderClassification(record, context.folder.gate)
  if (context.riskTier === "internal-tooling" && record.mandatory_class !== "none") {
    block("mandatory_class", "the plan declares Risk tier internal-tooling, which requires none; a mandatory class makes the work product: set - Risk tier: product, run gate-convergence retier, and review again")
  }

  const implementationModels = requireArray(record, "implementation_models")
  if (implementationModels.length === 0) {
    block("implementation_models", "must name at least one model that authored or rewrote the reviewed diff")
  }
  for (const [index, model] of implementationModels.entries()) {
    if (typeof model !== "string" || model.trim() === "") {
      block(`implementation_models.${index}`, "must be a non-empty model ID")
    }
  }

  const reviewers = requireArray(record, "reviewers_run")
  const allowedReviewers = new Set(["implementation-audit", "strategic-risk-review"])
  for (const reviewer of reviewers) {
    if (typeof reviewer !== "string") block("reviewers_run", "entries must be strings")
    if (!allowedReviewers.has(reviewer)) block("reviewers_run", `unknown invocation ${reviewer}`)
  }
  const reviewerSet = new Set(reviewers)
  if (reviewerSet.size !== reviewers.length) block("reviewers_run", "duplicate invocations are not allowed")
  if (record.mandatory_class !== "none") {
    for (const required of ["implementation-audit", "strategic-risk-review"]) {
      if (!reviewerSet.has(required)) block("reviewers_run", `mandatory_class requires missing invocation ${required}`)
    }
  }
  if (context.riskTier === "internal-tooling" && (reviewers.length !== 1 || reviewers[0] !== "implementation-audit")) {
    block("reviewers_run", "the plan declares Risk tier internal-tooling, which runs exactly implementation-audit; for no reviewer or a second one, use Risk tier product")
  }

  const resolutions = requireArray(record, "resolution")
  const verdicts = requireArray(record, "verdicts")
  const resolutionSet = invocationSet(resolutions, "resolution")
  const verdictSet = invocationSet(verdicts, "verdicts")
  const independenceValues = new Set(["cross-provider", "same-provider", "same-model", "unprovable"])
  const modelByInvocation = new Map()
  for (const [index, resolution] of resolutions.entries()) {
    if (typeof resolution.agent !== "string" || resolution.agent.trim() === "") {
      block(`resolution.${index}.agent`, "must be a non-empty string")
    }
    if (typeof resolution.model !== "string" || resolution.model.trim() === "") {
      block(`resolution.${index}.model`, `must be the exact resolved model ID, or ${UNRESOLVED_MODEL}`)
    }
    if (!independenceValues.has(resolution.independence)) {
      block(`resolution.${index}.independence`, "must be cross-provider, same-provider, same-model, or unprovable")
    }
    // Independence is derived, never accepted as asserted. `same-provider` is a legitimate result,
    // not a lesser one: a reviewer sharing the implementer's vendor still reads the diff with a
    // purpose-built contract. The label records which kind of review happened, and blocks nothing.
    const derived = deriveIndependence(implementationModels, resolution.model) ?? "unprovable"
    if (resolution.independence !== derived) {
      block(`resolution.${index}.independence`, `records ${resolution.independence} but model ${resolution.model} against implementation_models yields ${derived}`)
    }
    modelByInvocation.set(resolution.invocation, resolution.model)
  }
  for (const reviewer of reviewerSet) {
    if (!resolutionSet.has(reviewer)) block("resolution", `missing invocation ${reviewer}`)
    if (!verdictSet.has(reviewer)) block("verdicts", `missing invocation ${reviewer}`)
  }
  for (const invocation of resolutionSet) {
    if (!reviewerSet.has(invocation)) block("resolution", `invocation ${invocation} is not in reviewers_run`)
  }
  let reportedSecurityDelta = false
  const trailerArtifacts = new Map()
  const blockersByInvocation = new Map()
  for (const [index, verdict] of verdicts.entries()) {
    if (!reviewerSet.has(verdict.invocation)) block("verdicts", `invocation ${verdict.invocation} is not in reviewers_run`)
    if (!hasOverride && verdict.verdict !== "PASS") {
      block(`verdicts.${index}.verdict`, `${verdict.verdict ?? "missing"} blocks merge`)
    }
    // An override signs off on findings a reviewer delivered. INCONCLUSIVE delivered none, so it
    // is re-run, never overridden; otherwise a missing review would pass as a completed one.
    if (hasOverride && verdict.verdict === "INCONCLUSIVE") {
      block(`verdicts.${index}.verdict`, "INCONCLUSIVE cannot be overridden; re-run the invocation")
    }
    if (hasOverride && verdict.verdict !== "PASS" && verdict.verdict !== "FAIL" && verdict.verdict !== "INCONCLUSIVE") {
      block(`verdicts.${index}.verdict`, "must be PASS or FAIL")
    }
    // The reviewer's own trailer is the only witness of the brief it actually received. Deriving
    // the facts from it is what makes a folded brief fail loudly instead of silently.
    const field = `verdicts.${index}.trailer_artifact`
    if (typeof verdict.trailer_artifact !== "string" || verdict.trailer_artifact.trim() === "") {
      block(field, "must name the file holding the reviewer's verbatim trailer")
    }
    const artifactPath = path.resolve(context.repo, verdict.trailer_artifact)
    const alias = trailerArtifacts.get(artifactPath)
    if (alias !== undefined) {
      block(field, `reuses the trailer already cited for ${alias}; each invocation needs its own dispatched reviewer reply`)
    }
    trailerArtifacts.set(artifactPath, verdict.invocation)
    // The path exemption alone would cover everything else in this file, so the artifact is bound
    // by content. Any byte moving after the review stops matching the record.
    const { text: trailerText } = verifyAndPinArtifact(context, artifactPath, field, `verdicts.${index}.trailer_sha256`, verdict.trailer_sha256)
    const outcome = validateTrailer(parseTrailer(trailerText, field), {
      field,
      invocation: verdict.invocation,
      recordVerdict: verdict.verdict,
      resolvedModel: modelByInvocation.get(verdict.invocation),
      planText: context.planText,
    })
    if (outcome.securityDelta) reportedSecurityDelta = true
    blockersByInvocation.set(verdict.invocation, outcome.blockerIds)
  }
  // PHASE 3 - the SHA binding, once every artifact has been authenticated and pinned.
  // It cannot run earlier: the exemption set is now a by-product of `verifyAndPinArtifact`, so it is
  // only complete here. The ordering is deliberate rather than incidental - a tampered artifact
  // fails first, then code that moved on, then review semantics. Reversing those first two would
  // report "the code moved on" for a record whose evidence was already forged.
  if (record.reviewed_sha !== context.head && !commitsTouchOnlyEvidence(context.repo, record.reviewed_sha, context.head, context)) {
    block("reviewed_sha", `${record.reviewed_sha} does not equal current HEAD ${context.head}, and the commits between them change more than the gate evidence`)
  }

  // Classification is set while planning; a delta can appear mid-wave. The reviewer sees the final
  // diff, so its answer overrides a stale "none" rather than inheriting it.
  if (reportedSecurityDelta && record.mandatory_class === "none") {
    block("mandatory_class", "a reviewer reported a security or privacy delta, so none is stale; reclassify against the final diff and run both invocations")
  }

  const overallPass = verdicts.length === reviewers.length && verdicts.every((entry) => entry.verdict === "PASS")
  if (hasOverride && overallPass) block("override", "must not accompany a full PASS verdict set")
  for (const [index, blocker] of requireArray(record, "blockers").entries()) {
    const coverage = blocker?.coverage
    if (typeof coverage !== "string" || (!/^.+::.+$/.test(coverage) && !/^not-testable:.+/.test(coverage))) {
      block(`blockers.${index}.coverage`, "must be path::test name or not-testable:<reason>")
    }
    if (overallPass && (typeof blocker.fix_sha !== "string" || !sha.test(blocker.fix_sha))) {
      block(`blockers.${index}.fix_sha`, "full 40-hex SHA required when PASS is claimed")
    }
  }
  validateDowngrades(record, verdicts, hasOverride, blockersByInvocation)
  // An override reaching this point carries at least one non-PASS verdict (the full-PASS case
  // blocked above), so it must stay distinguishable from a clean PASS to anyone reading stdout.
  return hasOverride ? "overridden" : "passed"
}

const DOWNGRADE_RULES = new Set(["below-threshold", "accepted-residual", "out-of-scope", "frozen"])
const DOWNGRADE_DISPOSITIONS = new Set(["residual", "follow-up"])

// An override over a FAIL leaves that reviewer's blockers unfixed. Each one must be accounted for
// by name, with the rule that lets it go and where it goes; an override naming only some of them
// would hide the rest behind one attributable signature.
function validateDowngrades(record, verdicts, hasOverride, blockersByInvocation) {
  const failing = new Set(verdicts.filter((entry) => entry.verdict === "FAIL").map((entry) => entry.invocation))
  if (!hasOverride || failing.size === 0) {
    if (Object.hasOwn(record, "downgrades")) block("downgrades", "only with an override over a FAIL verdict; nothing else leaves a blocker unfixed")
    return
  }
  const seen = new Set()
  for (const [index, entry] of requireArray(record, "downgrades").entries()) {
    const at = `downgrades.${index}`
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) block(at, "must be an object")
    if (!failing.has(entry.invocation)) block(`${at}.invocation`, "must name an invocation whose verdict is FAIL")
    if (!blockersByInvocation.get(entry.invocation).includes(entry.blocker)) {
      block(`${at}.blocker`, `${entry.blocker ?? "missing"} is not a blocker id in the ${entry.invocation} trailer`)
    }
    if (!DOWNGRADE_RULES.has(entry.rule)) block(`${at}.rule`, "must be below-threshold, accepted-residual, out-of-scope, or frozen")
    if (typeof entry.reason !== "string" || entry.reason.trim() === "" || entry.reason.includes("\n")) {
      block(`${at}.reason`, "must be one non-empty line")
    }
    if (!DOWNGRADE_DISPOSITIONS.has(entry.disposition)) block(`${at}.disposition`, "must be residual or follow-up")
    const key = `${entry.invocation}/${entry.blocker}`
    if (seen.has(key)) block(at, "downgrades the same blocker twice")
    seen.add(key)
  }
  for (const invocation of failing) {
    for (const id of blockersByInvocation.get(invocation)) {
      if (!seen.has(`${invocation}/${id}`)) block("downgrades", `blocker ${id} of ${invocation} has no downgrade entry`)
    }
  }
}

function main() {
  const { values } = parseArgs({ options: {
    record: { type: "string" },
    plan: { type: "string" },
    repo: { type: "string" },
    "plan-only": { type: "boolean" },
  }, strict: true })
  if (!values.plan) block("plan", "--plan is required")
  // --plan-only is the write-time check, run by the merge-gate extension on every proposal and by
  // review-work Phase 0.6. It owns the opt-out decision and requires the omp-local abort fields;
  // full mode keeps the prior plan shape (criteria only), so records of plans written before the
  // fields still validate. It never passes a gate, so a record alongside it is a mistaken invocation.
  if (values["plan-only"] && values.record) block("record", "--plan-only checks the plan alone; drop --record")
  if (!values["plan-only"] && !values.record) block("record", "--record is required")
  const repo = values.repo ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  // Every path resolves against the REPO, never the cwd. Anchoring the read to the cwd while the
  // tracked check anchored to the repo let the guarantee and the parsed bytes be different files,
  // and it broke the documented invocation from any subdirectory.
  const planPath = path.resolve(repo, values.plan)
  const folder = isFolderPlan(planPath) ? loadFolderPlan(repo, planPath) : null
  const planText = folder ? folder.bundle.toString("utf8") : readText(planPath, "plan")
  if (values["plan-only"]) {
    if (!folder) validatePlanContract(planText)
    return "passed"
  }
  // A folder's merge-gate section is its gate.md; its criteria were checked with the folder.
  const section = folder ? folder.gateContent : mergeGateSection(planContent(scanMarkdown(planText)))
  if (!folder) validateCriteria(section)
  const recordPath = path.resolve(repo, values.record)
  const context = {
    head: execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    planRelative: path.relative(repo, planPath),
    planPath,
    planText,
    folder,
    pinned: new Set(),
    repo,
    recordPath,
    riskTier: riskTier(section),
  }
  // PHASE 2 begins here. The plan and every trailer are pinned by `validateRecord` against their
  // recorded digests; the record itself cannot self-bind, so it has its own admission.
  pinRecordPath(context, recordPath)
  return validateRecord(parseRecord(recordPath), context)
}

// stdout carries exactly one outcome word (passed | overridden | blocked); stderr carries the
// blocking field and reason. The exit code stays the gate: 0 for passed or overridden, 1 for blocked.
try {
  console.log(main())
} catch (error) {
  console.log("blocked")
  if (error instanceof GateError) {
    console.error(error.message)
  } else if (error instanceof Error) {
    console.error(`validator: ${error.message}`)
  } else {
    console.error("validator: unknown failure")
  }
  process.exitCode = 1
}
