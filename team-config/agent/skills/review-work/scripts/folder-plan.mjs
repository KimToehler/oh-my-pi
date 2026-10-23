// Folder plans for validate-gate-record.mjs: one snapshot of an OpenSpec change folder, and the
// bundle whose sha256 is the folder's `plan_sha256`. Lives beside the validator rather than inside
// it because the validator's fs surface is pinned to three primitives; this module is the only
// place that opens folder entries.
import { closeSync, constants, fstatSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"

export class FolderPlanError extends Error {}

const MAX_FILE_BYTES = 1024 * 1024

// Every file is opened with O_NOFOLLOW and judged by fstat on the HANDLE, so what is checked is
// what is read: a symlink swapped in after `readdir` fails with ELOOP, a FIFO swapped in fails the
// regular-file test (O_NONBLOCK keeps that open from hanging). The result maps change-relative
// paths (with `/`) to bytes; the checks, the criteria and the bundle all read this map and never
// the disk again. `hooks.beforeOpen` / `hooks.afterRead` are test seams for exactly those races.
export function snapshotFolder(root, hooks = {}) {
  const snapshot = new Map()
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) throw new FolderPlanError(`${rel}: symlink is not allowed in a change folder`)
      if (entry.isDirectory()) {
        walk(absolute, rel)
        continue
      }
      if (!entry.isFile()) throw new FolderPlanError(`${rel}: not a regular file; a change folder holds regular files and directories only`)
      hooks.beforeOpen?.(rel)
      let descriptor
      try {
        descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
      } catch (error) {
        throw new FolderPlanError(`${rel}: cannot open: ${error instanceof Error ? error.message : String(error)}`)
      }
      try {
        const stats = fstatSync(descriptor)
        if (!stats.isFile()) throw new FolderPlanError(`${rel}: not a regular file; a change folder holds regular files and directories only`)
        if (stats.size > MAX_FILE_BYTES) throw new FolderPlanError(`${rel}: is ${stats.size} bytes, above the ${MAX_FILE_BYTES}-byte limit for a gate artifact`)
        snapshot.set(rel, readFileSync(descriptor))
      } finally {
        closeSync(descriptor)
      }
      hooks.afterRead?.(rel)
    }
  }
  walk(root, "")
  return snapshot
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

// Manifest (`<sha256>  <path>` per file, sorted by path as UTF-8 bytes), then each file's bytes
// under a `===== <path> =====` line in the same order. The reviewer reads this as the plan.
export function buildBundle(snapshot) {
  const paths = [...snapshot.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
  const manifest = paths.map((rel) => `${sha256(snapshot.get(rel))}  ${rel}\n`).join("")
  const sections = paths.map((rel) => Buffer.concat([Buffer.from(`===== ${rel} =====\n`), snapshot.get(rel), Buffer.from("\n")]))
  return Buffer.concat([Buffer.from(manifest), ...sections])
}

export function bundleDigest(bundle) {
  return sha256(bundle)
}

export function writeBundleFile(file, bundle) {
  writeFileSync(file, bundle)
}
