// Rewrites a delta directory's patches into the form a verifier trusting the manifest's directory would recompute
// for <dir> (evidence-elided with <dir> in place of the evidence directory), with matching hashes, so that only the
// manifest's left_out value is wrong. Mirrors deltaArtifacts in gate-convergence.mjs with <dir> as the left-out directory. Usage: node src-form.mjs <repo> <delta dir> <dir>
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
const [repo, deltaDir, dir] = process.argv.slice(2)
const show = (...args) => execFileSync("git", ["-C", repo, "show", ...args])
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const manifest = JSON.parse(readFileSync(path.join(deltaDir, "manifest.json"), "utf8"))
manifest.commits.forEach((entry, index) => {
  const n = String(index + 1).padStart(3, "0")
  for (const file of [`${n}.patch`, `${n}.evidence.patch`]) if (existsSync(path.join(deltaDir, file))) rmSync(path.join(deltaDir, file))
  delete entry.evidence
  delete entry.evidence_sha256
  const numstat = show("--numstat", "--no-renames", "-z", "--format=", entry.sha, "--", `:(top)${dir}`).toString().split("\0").filter((line) => line.trim() !== "")
  let patch
  if (numstat.length === 0) patch = show("--format=fuller", "--no-renames", "--patch", entry.sha)
  else {
    const byDir = new Map()
    for (const line of numstat) {
      const [added, removed, file] = line.trim().split("\t")
      const key = `${path.posix.dirname(file)}/`
      const sum = byDir.get(key) ?? { files: 0, added: 0, removed: 0 }
      sum.files += 1
      sum.added += added === "-" ? 0 : Number(added)
      sum.removed += removed === "-" ? 0 : Number(removed)
      byDir.set(key, sum)
    }
    const lines = [...byDir].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, s]) => `${s.files} files, +${s.added} -${s.removed}\t${key}\n`)
    patch = Buffer.concat([show("-s", "--format=fuller", entry.sha), Buffer.from("\n"), show("--format=", "--no-renames", "--patch", entry.sha, "--", ":(top)", `:(top,exclude)${dir}`), Buffer.from(`Left out by GC patch: the hunks of files under ${dir}, in ${n}.evidence.patch beside this patch\n${lines.join("")}`)])
    const evidence = show("--format=", "--no-renames", "--patch", entry.sha, "--", `:(top)${dir}`)
    writeFileSync(path.join(deltaDir, `${n}.evidence.patch`), evidence)
    Object.assign(entry, { evidence: `${n}.evidence.patch`, evidence_sha256: hash(evidence) })
  }
  writeFileSync(path.join(deltaDir, `${n}.patch`), patch)
  entry.sha256 = hash(patch)
})
writeFileSync(path.join(deltaDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
