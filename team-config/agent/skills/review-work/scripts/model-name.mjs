#!/usr/bin/env node
// The one rule for "same model" in review-work: the validators import it, and the plan-review and
// F2 instructions run this file on the provider/model lists they read from session files.
import * as fs from "node:fs/promises"
import { pathToFileURL } from "node:url"

// `openrouter/anthropic/claude-opus-5:thinking` -> `claude-opus-5`. The provider prefix is the route,
// not the model, and the variant suffix is a reasoning-effort knob on one model, so keeping either
// would call one model two.
export function bareModelName(modelID) {
  return modelID.split("/").pop().split(":")[0].trim().toLowerCase()
}

// Usage: model-name.mjs <selector>... prints one model name per selector. Without a selector it
// exits 2, so an empty list piped through xargs never compares equal to a pin.
function main() {
  const selectors = process.argv.slice(2)
  if (selectors.length === 0) {
    process.stderr.write("usage: model-name.mjs <selector>...\n")
    process.exit(2)
  }
  process.stdout.write(selectors.map((selector) => `${bareModelName(selector)}\n`).join(""))
}

// Node resolves the entry module's URL to its real path; a symlinked argv[1] (e.g. a linked agent dir) must too.
const entry = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => process.argv[1]) : ""
if (import.meta.url === pathToFileURL(entry).href) main()
