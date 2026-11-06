#!/usr/bin/env python3
"""F1 fixture builder for follow-up-routing. One-off evidence helper; it builds inputs and never judges a run.
usage: fixture.py <row> <dest> <sha>
<sha>: the W commit whose team-config/agent/commands/opsx-*.md and openspec/schemas/omp-gated are installed.
"""
import hashlib, json, os, subprocess, sys

W = "/Users/tim/git/oh-my-pi/.worktrees/follow-up-routing"
row, dest, sha = sys.argv[1], sys.argv[2], sys.argv[3]
CH = "openspec/changes/widget-cache"
EV = ".omp/team-config/evidence/gate/widget-cache"
REC = ".omp/team-config/evidence/gate/widget-cache.json"


def w(rel, text):
    p = os.path.join(dest, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(text)


def git_show(path):
    return subprocess.run(["git", "-C", W, "show", f"{sha}:{path}"], check=True, capture_output=True, text=True).stdout


def sha256(rel):
    return hashlib.sha256(open(os.path.join(dest, rel), "rb").read()).hexdigest()


def git(*args):
    subprocess.run(["git", "-C", dest, *args], check=True, capture_output=True)


os.makedirs(dest)
git("init", "-q", "-b", "main")

# Delivered commands (all six, so no session falls back to a profile copy) and the schema, from the commit under test.
for name in subprocess.run(["git", "-C", W, "ls-tree", "--name-only", sha, "team-config/agent/commands/"], check=True, capture_output=True, text=True).stdout.split():
    base = os.path.basename(name)
    if base.startswith("opsx-"):
        w(f".omp/commands/{base}", git_show(name))
SCHEMA = "team-config/agent/skills/review-work/openspec/schemas/omp-gated/"  # target of W's openspec/schemas/omp-gated symlink
for name in subprocess.run(["git", "-C", W, "ls-tree", "-r", "--name-only", sha, SCHEMA], check=True, capture_output=True, text=True).stdout.split():
    w("openspec/schemas/omp-gated/" + name[len(SCHEMA):], git_show(name))

roadmap_in_context = row in ("propose-take", "round-trip")
ctx_doc = "docs/roadmap/widgets.md" if row == "propose-take" else "docs/roadmap/w.md"
config = "schema: omp-gated\n\ncontext: |\n  Widget dashboard. TypeScript under src/.\n"
if roadmap_in_context:
    config += f"  The widget program's roadmap is {ctx_doc}.\n"
w("openspec/config.yaml", config)

w("package.json", '{\n  "name": "widget-dashboard",\n  "private": true,\n  "type": "module"\n}\n')
w("src/widget.ts", "export interface Widget {\n\tid: string;\n\tprops: Record<string, unknown>;\n\trender(): string;\n}\n")
w("src/render.ts", 'import type { Widget } from "./widget";\n\nexport const renderWidget = (w: Widget): string => `<div data-id="${w.id}">${w.render()}</div>`;\n')
CACHE = """// Render cache for dashboard widgets: keeps the rendered HTML of each widget by id.
import type { Widget } from "./widget";
import { renderWidget } from "./render";

export interface CacheEntry {
	html: string;
	storedAt: number;
}

const entries = new Map<string, CacheEntry>();

export const get = (id: string): string | undefined => entries.get(id)?.html;

export function has(id: string): boolean {
	return entries.has(id);
}

export function invalidate(id: string): void {
	entries.delete(id);
}

export function clear(): void {
	entries.clear();
}

export function size(): number {
	return entries.size;
}

export function render(widget: Widget): string {
	const hit = get(widget.id);
	if (hit !== undefined) return hit;
	return set(widget);
}

function set(widget: Widget): string {
	const storedAt = Date.now();
	const html = renderWidget(widget);
	const entry: CacheEntry = { html, storedAt };
	entries.set(widget.id, entry);
	return html;
}
"""
w("src/cache.ts", CACHE)
lines = CACHE.split("\n")
assert lines[11].startswith("export const get"), lines[11]
assert lines[39].startswith("\tentries.set("), lines[39]

# Fixture change widget-cache, all tasks ticked.
named = row not in ("entered-path",)
road = "`docs/roadmap/widgets.md`"
w(f"{CH}/.openspec.yaml", "schema: omp-gated\ncreated: 2026-11-01\n" + ("" if row == "no-items" else "skip_specs: true\n"))
taken = ""
if row == "remove-taken":
    taken = (
        "\n## Follow-ups taken\n\n"
        "- `docs/roadmap/widgets.md`: `clear()` leaves no trace in the logs, so a support engineer cannot tell a cleared cache from a cold start. `src/cache.ts:22`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 1\n"
        "- `docs/roadmap/widgets.md`: `size()` counts entries, not bytes, so the dashboard's memory panel under-reports large widgets. `src/cache.ts:26`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 2\n"
    )
w(f"{CH}/proposal.md", f"""# Proposal

## Why

Every dashboard refresh re-renders all widgets, which takes 900 ms on the reference board. Most widgets did not change.

## What Changes

- Add `src/cache.ts`, a render cache keyed by widget id; `render(widget)` returns cached HTML when present.
- Add `invalidate`, `clear` and `size` for the dashboard shell.

## Capabilities

### New Capabilities

None (instruction-level change set; `skip_specs`).

### Modified Capabilities

None.

## Impact

- `src/cache.ts` (new), `src/render.ts` (unchanged API).
{"- The widget program's roadmap is " + road + "." if named else "- No other documents."}
{taken}""")
if row == "no-items":
    w(f"{CH}/specs/widget-cache/spec.md", """# Spec Delta

## Purpose

Caches the rendered HTML of dashboard widgets by id so an unchanged widget is not rendered again on refresh.

## ADDED Requirements

### Requirement: Cached render
`render(widget)` SHALL return the cached HTML for a widget id it has rendered before, without rendering again.

#### Scenario: Second render
- **WHEN** a widget is rendered twice
- **THEN** its `render()` runs once

#### Scenario: Negative control
- **WHEN** the second call renders again
- **THEN** that outcome MUST fail the requirement
""")
w(f"{CH}/design.md", "# Design\n\n## Decisions\n\n**D1. Map keyed by widget id.** Simple and enough for the dashboard's 40 widgets.\n")
w(f"{CH}/gate.md", """# Gate

- **Mandatory class**: none
- **Depth**: standard
- **Risk tier**: internal-tooling
- **Author's risk assessment**: A cache inside the dashboard; worst case a stale widget until refresh.
- **Whole-diff review**: not needed
- **Accepted residual risks**: none
- **Out of scope for blocking**: cache memory accounting
""")
w(f"{CH}/tasks.md", "# Tasks\n\n## 1. Cache\n\n- [x] 1.1 Add `src/cache.ts` with `get`, `has`, `invalidate`, `clear`, `size` and `render`.\n- [x] 1.2 Use `render` from the dashboard shell.\n\n## 2. Verification\n\n- [x] 2.1 F1. Manual QA on the dashboard.\n")
w(f"{CH}/review.md", "# Review\n\n- **Verdict**: OKAY\n- **Round**: 1\n\n## Blockers\n\nnone\n\n## Residuals\n\nnone\n")

# Destination documents.
SRC = "Source: `widget-cache` .omp/team-config/evidence/gate/widget-cache/f2/trailer-implementation-audit.txt"
roadmap_head = "# Widget roadmap\n\n## Next\n\n- Size-based eviction for the render cache.\n- Keyboard navigation between widgets.\n"
if row in ("collect", "whole-diff", "no-record", "no-items"):
    w("docs/roadmap/widgets.md", roadmap_head + "\n## Follow-ups\n\n- `renderWidget` does not escape `w.id`, so an id with a quote breaks the markup. `src/render.ts:3`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 1\n")
elif row in ("ask-destination", "skip"):
    w("docs/roadmap/widgets.md", roadmap_head)
    if row == "ask-destination":
        w("docs/roadmap/other.md", "# Other roadmap\n\n## Follow-ups\n\n- Export dashboards as PNG. `src/export.ts`. Source: `export-png` .omp/team-config/evidence/gate/export-png/f2/trailer-implementation-audit.txt, note 1\n")
elif row == "entered-path":
    w("docs/roadmap/widgets.md", roadmap_head + "\n## Follow-ups\n\n")
elif row == "dedupe":
    w("docs/roadmap/widgets.md", roadmap_head + "\n## Follow-ups\n\n"
      f"- `set` never evicts, so the cache grows without bound in a long-running dashboard. `src/cache.ts:40`. {SRC}, note 1\n"
      "- `set` takes `storedAt` before rendering, so an entry looks older than its HTML. `src/cache.ts:40`. Source: `widget-cache-old` .omp/team-config/evidence/gate/widget-cache/f2/trailer-implementation-audit.txt, note 2\n")
elif row == "propose-take":
    w("docs/roadmap/widgets.md", roadmap_head + "\n## Follow-ups\n\n"
      "- `get` keys entries by widget id only, so a widget whose props changed still renders its old HTML. `src/cache.ts:12`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-strategic-risk-review.txt, B1\n"
      "- `renderWidget` does not escape `w.id`, so an id with a quote breaks the markup. `src/render.ts:3`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 1\n")
elif row == "round-trip":
    w("docs/roadmap/w.md", "# Widget program\n\n## Follow-ups\n\n"
      "- `get` keys entries by widget id only, so a widget whose props changed still renders its old HTML. `src/cache.ts:12`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-strategic-risk-review.txt, B1\n")
elif row == "remove-taken":
    w("docs/roadmap/widgets.md", roadmap_head + "\n## Follow-ups\n\n"
      "- `clear()` leaves no trace in the logs, so a support engineer cannot tell a cleared cache from a cold start. `src/cache.ts:22`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 1\n"
      "- `size()` counts entries, not bytes, so the dashboard memory panel under-reports large widgets. `src/cache.ts:26`. Source: `widget-shell` .omp/team-config/evidence/gate/widget-shell/f2/trailer-implementation-audit.txt, note 2\n")

# Gate record and the files it pins.
AUDIT_NOTES = """### 5. Non-blocking notes

- `src/cache.ts:40`: `set` never evicts, so the cache grows without bound in a long-running dashboard.
- `src/cache.ts:40`: `set` takes `storedAt` before rendering, so an entry looks older than its HTML and any later age check would expire it early.
"""
AUDIT_CLEAN = "### 5. Non-blocking notes\n\nnone\n"
def audit(notes):
    return f"""### 1. Goal and behavioural contract

`render(widget)` returns cached HTML for a known id and renders otherwise. The contract in tasks.md holds.

### 2. Correctness, regressions, architecture

`invalidate`, `clear` and `size` behave as named. No blocker.

### 3. Security and privacy delta

None: the cache holds rendered HTML of the user's own widgets in memory.

### 4. Verification adequacy

F1 shows a second render served from the cache.

{notes}
REVIEW-TRAILER-v1
invocation: implementation-audit
sections_covered: 1,2,3,4,5
model_id: fixture/auditor
security_delta: no
verdict: PASS
blockers: none
END-REVIEW-TRAILER
"""
STRAT = """### Strategic risk

**B1** `src/cache.ts:12`: `get` keys entries by widget id only, so a widget whose props changed still renders its old HTML after an edit.

**B2** `src/cache.ts:18`: `invalidate` is not called when a widget is removed, so a removed widget's HTML stays in memory until `clear`.

### Non-blocking notes

- `src/cache.ts:40`: `set` never evicts, so the cache grows without bound in a long-running dashboard.

REVIEW-TRAILER-v1
invocation: strategic-risk-review
sections_covered: 1,2,3
model_id: fixture/oracle
security_delta: no
verdict: FAIL
blockers: B1, B2
END-REVIEW-TRAILER
"""
if row != "no-record":
    w(f"{EV}/f1/a.md", "# F1 row A\n\nSecond `render` of widget `w1` served from the cache; `render()` ran once.\n")
    w(f"{EV}/wave-1/trailer-implementation-audit.md", audit("### 5. Non-blocking notes\n\n- `src/cache.ts:10`: the Map is module-global, so tests share cache state between cases.\n").replace("verdict: PASS", "verdict: FAIL").replace("blockers: none", "blockers: B1"))
    items_free = row == "no-items"
    w(f"{EV}/f2/trailer-implementation-audit.txt", audit(AUDIT_CLEAN if items_free else AUDIT_NOTES))
    rec = {
        "schema": "team-config.merge-gate/v3",
        "plan": CH,
        "plan_sha256": hashlib.sha256(b"widget-cache plan").hexdigest(),
        "reviewed_sha": "1111111111111111111111111111111111111111",
        "diff_base": "0000000000000000000000000000000000000000",
        "reviewers_run": ["implementation-audit"] if items_free else ["implementation-audit", "strategic-risk-review"],
        "decision_reason": "Mandatory class none; standard depth.",
        "mandatory_class": "none",
        "implementation_models": ["fixture/model"],
        "blockers": [],
        "whole_diff": {"run": False},
        "qa": [{"name": "F1 row A", "passed": True, "artifact": f"{EV}/f1/a.md", "artifact_sha256": sha256(f"{EV}/f1/a.md")}],
        "resolution": [{"invocation": "implementation-audit", "agent": "auditor", "model": "fixture/auditor", "independence": "cross-provider"}],
        "verdicts": [{"invocation": "implementation-audit", "verdict": "PASS", "trailer_artifact": f"{EV}/f2/trailer-implementation-audit.txt", "trailer_sha256": sha256(f"{EV}/f2/trailer-implementation-audit.txt")}],
    }
    if not items_free:
        w(f"{EV}/f2/trailer-strategic-risk-review.txt", STRAT)
        rec["resolution"].append({"invocation": "strategic-risk-review", "agent": "oracle", "model": "fixture/oracle", "independence": "cross-provider"})
        rec["verdicts"].append({"invocation": "strategic-risk-review", "verdict": "FAIL", "trailer_artifact": f"{EV}/f2/trailer-strategic-risk-review.txt", "trailer_sha256": sha256(f"{EV}/f2/trailer-strategic-risk-review.txt")})
        rec["blockers"] = [
            {"id": "B1", "severity": "medium", "location": "src/cache.ts:12", "coverage": "not-testable:deferred"},
            {"id": "B2", "severity": "low", "location": "src/cache.ts:18", "coverage": "not-testable:accepted"},
        ]
        rec["override"] = {"by": "Fixture User", "reason": "Ship the cache for the 1.4 dashboard; B1 is planned next, B2 is accepted."}
        rec["downgrades"] = [
            {"invocation": "strategic-risk-review", "blocker": "B1", "rule": "frozen", "reason": "Key by id and props hash; tracked in the widget roadmap.", "disposition": "follow-up"},
            {"invocation": "strategic-risk-review", "blocker": "B2", "rule": "frozen", "reason": "Removed widgets are rare; memory is freed on refresh.", "disposition": "residual"},
        ]
    if row == "whole-diff":
        rep = f"{EV}/f3-integration-review-report.md"
        w(rep, "# Integration review: widget-cache\n\n## Verdict\n\nPASS\n\n## Findings\n\nNo blocker across the whole diff.\n\n## Follow-ups\n\n- `src/render.ts:3`: the cache and `renderWidget` both build the widget wrapper markup, so a markup change has to be made twice.\n")
        rec["whole_diff"] = {"run": True, "report": rep, "report_sha256": sha256(rep)}
    w(REC, json.dumps(rec, indent=2) + "\n")

git("add", "-A")
git("-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", f"fixture {row}")
print(dest)
