// The gate record id and where team-config keeps gate state inside a checkout, defined once for
// validate-gate-record.mjs and gate-convergence.mjs. omp loads only fixed names under a project's
// `.omp/` (rules, skills, commands, prompts, ...), so nothing under `.omp/team-config/` is ever read
// as agent context. The merge-gate extension keeps its own copy of the record id: importing a skill
// file would make the stop hook's load depend on it, and a failed load opens the gate.
import path from "node:path"

export const RECORD_SCHEMA = "team-config.merge-gate/v3"

// Upper size of any gate artifact (record, plan, trailer, whole-diff report) a gate script reads.
// A tracked file is authored by whoever can commit, so this is a robustness bound rather than a
// trust boundary - but every artifact is read whole into memory before anything is known about it.
// `GC wave` applies the same bound to trailers, so it never records one the record check refuses.
export const MAX_ARTIFACT_BYTES = 1024 * 1024

// All paths are relative to the checkout root.
export const STATE_DIR = path.join(".omp", "team-config")
// QA artifacts and reviewer trailers, one directory per plan basename.
export const EVIDENCE_DIR = path.join(STATE_DIR, "evidence")
// Default home of gate records; the validator accepts a record at any tracked path.
export const GATE_RECORD_DIR = path.join(EVIDENCE_DIR, "gate")
export const LEDGER_PATH = path.join(STATE_DIR, "ledger.jsonl")
export const GATE_DELTAS_DIR = path.join(STATE_DIR, "gate-deltas")
