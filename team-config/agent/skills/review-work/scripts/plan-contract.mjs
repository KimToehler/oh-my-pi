// omp-local plan contract. Code fences and HTML comments are not plan content: a template or an
// example quoted there must neither satisfy nor skip a plan check. Every plan parser reads the
// content-only text, so a plan without fences or comments parses exactly as before.
export const SECTION_PATTERN = /^## Merge gate\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m

export function scanMarkdown(text) {
  const lines = []
  let fence = null
  let inComment = false
  for (const raw of text.split("\n")) {
    if (fence !== null) {
      // A closer may not sit deeper than its opener: plans quote list-indented fences inside an
      // outer fence, and CommonMark's 0-3 space closer would end the outer fence there.
      const close = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(raw)
      if (close && close[1].length <= fence.indent && close[2][0] === fence.marker[0] && close[2].length >= fence.marker.length) fence = null
      lines.push({ text: raw, content: false })
      continue
    }
    if (!inComment) {
      const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(raw)
      // A backtick fence's info string carries no backtick; "```a``` b" is inline code, not a fence.
      if (open && !(open[2][0] === "`" && open[3].includes("`"))) {
        fence = { indent: open[1].length, marker: open[2] }
        lines.push({ text: raw, content: false })
        continue
      }
    }
    let rest = raw
    let kept = ""
    while (rest.length > 0) {
      if (inComment) {
        const end = rest.indexOf("-->")
        if (end === -1) break
        rest = rest.slice(end + 3)
        inComment = false
      } else {
        const start = rest.indexOf("<!--")
        if (start === -1) {
          kept += rest
          break
        }
        kept += rest.slice(0, start)
        rest = rest.slice(start + 4)
        inComment = true
      }
    }
    if (kept === raw) lines.push({ text: raw, content: true })
    else lines.push({ text: kept.trimEnd(), content: kept.trim() !== "" })
  }
  return lines
}

export function planContent(lines) {
  return lines.filter((line) => line.content).map((line) => line.text).join("\n")
}

export function mergeGateSection(content) {
  return content.match(SECTION_PATTERN)?.[1]
}

const TIER_LINE = /^-\s+(?:\*\*)?Risk tier(?:\*\*)?\s*:(?:\*\*)?(.*)$/i
const CLASS_LINE = /^-\s+(?:\*\*)?Mandatory class(?:\*\*)?\s*:(?:\*\*)?(.*)$/i

const normalise = (value) => value.replace(/[`*]/g, "").trim().toLowerCase()

// Reads the plan's Risk tier from the output of mergeGateSection (possibly undefined). Never throws.
export function readRiskTier(section) {
  if (section === undefined) return { tier: "product" }
  const lines = section.split("\n")
  const tierLines = lines.map((line) => TIER_LINE.exec(line)).filter(Boolean)
  if (tierLines.length === 0) return { tier: "product" }
  if (tierLines.length > 1) return { error: "duplicate" }
  const tier = normalise(tierLines[0][1])
  if (tier === "personal") {
    return { error: "personal plans run no merge gate; replace the section with the top-level bullet - Merge gate: not applicable (<reason>)" }
  }
  if (tier !== "product" && tier !== "internal-tooling") {
    return { error: "must be exactly product or internal-tooling; put the reason in Author's risk assessment" }
  }
  if (tier === "internal-tooling") {
    const classLines = lines.map((line) => CLASS_LINE.exec(line)).filter(Boolean)
    if (classLines.length !== 1 || normalise(classLines[0][1]) !== "none") {
      return { error: "internal-tooling requires exactly one Mandatory class bullet whose whole value is none; a mandatory class makes the plan product" }
    }
  }
  return { tier }
}

// ---- Criteria and value grammar -------------------------------------------------------------
// Shared by the gate validator (file plans, folder plans) and the OpenSpec checker, so a change
// folder fails at `validate-openspec-change.mjs` for exactly the reasons the gate would give.
// Every function takes content-only text (the output of `planContent(scanMarkdown(...))`) and
// returns defects instead of throwing; the callers decide how a defect is reported.
export const CRITERIA_HEADER_PATTERN = /^(\s*)-\s+(?:\*\*)?Feature-specific criteria\b[^\n]*(?:\*\*)?\s*:?\s*$/mi
const DEFERRAL_MARKERS = new Set(["tbd", "tba", "tbc", "todo", "fixme", "xxx", "n/a", "na", "?", "-", "...", "\u2026"])
const DEFERRAL_PREFIX = /^(?:tbd|tba|tbc|todo|fixme|xxx|n\/a)(?!\p{L})/u

export function criterionBullets(section) {
  const headerMatch = section.match(CRITERIA_HEADER_PATTERN)
  const headerIndent = headerMatch[1].length
  const criteriaSource = section.slice(headerMatch.index + headerMatch[0].length)
  return [...criteriaSource.matchAll(/^(\s*)-\s+([\s\S]*?)(?=^\s*-\s+|$(?![\s\S]))/gm)]
    .filter((match) => match[1].length > headerIndent && /^\s*(?:\*\*)?Invariant\s*:/mi.test(match[2]))
}

// The shape check of `- Feature-specific criteria:`: the first defect as { field, detail }, or undefined.
export function criteriaShapeDefect(section, label = "plan Merge gate criteria") {
  if (!CRITERIA_HEADER_PATTERN.test(section)) {
    return { field: label, detail: "Feature-specific criteria header is required: one `- Feature-specific criteria:` bullet with each criterion nested below it as `  - Invariant: ...` and its fields indented under that; flat `- Invariant I1:` bullets are not read as criteria" }
  }
  const bullets = criterionBullets(section)
  if (bullets.length === 0) return { field: label, detail: "header requires at least one criterion with Invariant" }
  for (const [index, match] of bullets.entries()) {
    const criterion = match[2]
    if (/^\s*(?:\*\*)?Mechanical\b/i.test(criterion)) continue
    if (!/^\s*(?:\*\*)?Negative control\s*:/mi.test(criterion)) {
      return { field: `${label}.${index}.Negative control`, detail: "behavioural criterion requires this field" }
    }
  }
  return undefined
}

export function isDeferral(text) {
  const lowered = text.toLowerCase().replace(/[`*]/g, "").trim()
  const bare = lowered.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "")
  return DEFERRAL_MARKERS.has(lowered) || DEFERRAL_MARKERS.has(bare) || DEFERRAL_PREFIX.test(bare)
}

export function withoutTemplates(text) {
  let current = text
  for (;;) {
    const next = current.replace(/<\p{L}[^<>]*>/gu, "")
    if (next === current) return current
    current = next
  }
}

// One verdict per value: undefined accepts, a string names the defect. The grammar rejects
// non-answers only; whether a named risk is real is the reviewer's PROCESS 1 check.
// `allowNone` turns on the abort fields' `none (<reason>)` branch; without it a bare `none` is a
// non-answer and any other value starting with the word none is judged like ordinary text.
export function valueDefect(value, { allowNone = false } = {}) {
  if (value === "") return "empty"
  const residue = withoutTemplates(value).trim()
  if (/^[\s\p{P}\p{S}]*$/u.test(residue) && residue !== value.trim()) return "template placeholder"
  if (isDeferral(residue)) return "deferral marker"
  if (!allowNone && /^[`*\s]*none[\s\p{P}]*$/iu.test(residue)) return "none is not an answer here"
  if (allowNone && /^none(?!\p{L})/iu.test(residue.replace(/^[`*]+/, ""))) {
    const open = residue.indexOf("(")
    const close = residue.lastIndexOf(")")
    const reason = open !== -1 && close > open ? withoutTemplates(residue.slice(open + 1, close)).trim() : ""
    return /\p{L}{3,}/u.test(reason) && !isDeferral(reason) ? undefined : "none needs a reason"
  }
  return /\p{L}{3,}/u.test(residue) ? undefined : "no substance"
}

export const abortFieldDefect = (value) => valueDefect(value, { allowNone: true })

export const ABORT_FIELDS = ["Accepted residual risks", "Out of scope for blocking"]

// The value of one top-level bullet `- Label: value` plus its indented continuation lines, or
// undefined when the label is absent; `count` tells a duplicate from a single occurrence.
export function topLevelField(section, field) {
  const lines = section.split("\n")
  const label = new RegExp(`^-\\s+(?:\\*\\*)?${field}(?:\\*\\*)?\\s*:(?:\\*\\*)?(.*)$`, "i")
  const starts = lines.flatMap((line, index) => (label.test(line) ? [index] : []))
  if (starts.length === 0) return { count: 0 }
  const parts = [label.exec(lines[starts[0]])[1]]
  for (const line of lines.slice(starts[0] + 1)) {
    if (/^\S/.test(line)) break
    parts.push(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""))
  }
  return { count: starts.length, value: parts.join(" ").replace(/\s+/g, " ").trim() }
}

// The abort fields' defects as `<field>: <defect>` strings; empty when both are acceptable.
export function abortRuleDefects(section) {
  const defects = []
  for (const field of ABORT_FIELDS) {
    const found = topLevelField(section, field)
    if (found.count === 0) defects.push(`${field}: missing`)
    else if (found.count > 1) defects.push(`${field}: duplicate`)
    else {
      const defect = abortFieldDefect(found.value)
      if (defect) defects.push(`${field}: ${defect}`)
    }
  }
  return defects
}

const CRITERION_LABEL = /^\s*(?:-\s+)?(?:\*\*)?(Invariant|Positive witness|Negative control|Observable|Boundary|Mechanical)\b/i

function criterionField(criterion, field) {
  const lines = criterion.split("\n")
  const label = new RegExp(`^\\s*(?:-\\s+)?(?:\\*\\*)?${field}(?:\\*\\*)?\\s*:(?:\\*\\*)?(.*)$`, "i")
  const start = lines.findIndex((line) => label.test(line))
  if (start === -1) return undefined
  const parts = [label.exec(lines[start])[1]]
  for (const line of lines.slice(start + 1)) {
    if (CRITERION_LABEL.test(line)) break
    parts.push(line)
  }
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

// Criteria carried by a plan that has no requirements to derive them from: the shape check, then
// `Invariant`, `Negative control` (behavioural only) and `Observable` held to the content grammar.
// Returns every defect as { field, detail }.
export function substantiveCriteriaDefects(section, label = "plan Merge gate criteria") {
  const shape = criteriaShapeDefect(section, label)
  if (shape) return [shape]
  const defects = []
  for (const [index, criterion] of criterionBullets(section).entries()) {
    const fields = /^\s*(?:\*\*)?Mechanical\b/i.test(criterion[2]) ? ["Invariant", "Observable"] : ["Invariant", "Negative control", "Observable"]
    for (const field of fields) {
      const defect = valueDefect(criterionField(criterion[2], field) ?? "")
      if (defect) defects.push({ field: `${label}.${index}.${field}`, detail: `${defect}; the criteria need concrete text when the change carries no requirements` })
    }
  }
  return defects
}
