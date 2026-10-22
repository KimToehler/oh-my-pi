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
