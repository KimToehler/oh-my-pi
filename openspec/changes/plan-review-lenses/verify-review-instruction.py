"""Verify for task 2.2: the rendered `review` instruction carries the fixed brief and the
three lens paragraphs of design.md D2 complete and verbatim, plus the required rules.

Run from the worktree root. Exit 0 only when the real instruction passes AND every
mutation below (each keeps the phrases a prefix check would see) fails.
"""

import json
import os
import re
import subprocess
import sys

CHANGE = "openspec/changes/plan-review-lenses"
SCHEMA = "team-config/agent/skills/review-work/openspec/schemas/omp-gated/schema.yaml"
# Commit that proposed this change; its schema still holds the unchanged fixed brief.
BASE = "aacc728b06"
BRIEF_START = "Review every file in the change directory except review.md"
BRIEF_END = "verdict OKAY or REJECT."
PROHIBITION = "Add no focus area, emphasis, file list or summary of the change"
PHRASES = [
    "one task call with three plan-reviewer items",
    "OKAY only when all three lenses return OKAY",
    "one fresh retry with the same brief",
    "write no review.md",
    "in lens order",
]


def norm(text):
    return " ".join(text.split())


def fixed_brief():
    old = norm(subprocess.run(["git", "show", f"{BASE}:{SCHEMA}"], check=True, capture_output=True, text=True).stdout)
    start = old.index(BRIEF_START)
    return old[start : old.index(BRIEF_END, start) + len(BRIEF_END)]


def lens_paragraphs():
    with open(os.path.join(CHANGE, "design.md"), encoding="utf-8") as f:
        found = re.findall(r'^- (Correctness|Verification|Checks): "(.+)"$', f.read(), re.M)
    if [name for name, _ in found] != ["Correctness", "Verification", "Checks"]:
        sys.exit(f"design.md D2: expected the three lens paragraphs, found {[n for n, _ in found]}")
    return [norm(text) for _, text in found]


def problems(text, brief, lenses):
    out = []
    if text.count(brief) != 1:
        out.append(f"fixed brief occurs {text.count(brief)} times, expected once")
    for lens in lenses:
        if text.count(lens) != 1:
            out.append(f"lens paragraph {lens[:60]!r} occurs {text.count(lens)} times, expected once")
    if text.count("Focus for this review") != 3:
        out.append("expected exactly three 'Focus for this review' paragraphs")
    if PROHIBITION not in text:
        out.append("planner-added-focus prohibition missing")
    out += [f"missing phrase {p!r}" for p in PHRASES if p not in text]
    return out


def drop_middle_sentence(paragraph):
    sentences = paragraph.split(". ")
    return ". ".join(sentences[:1] + sentences[2:])


def main():
    raw = subprocess.run(
        ["openspec", "instructions", "review", "--change", "plan-review-lenses", "--json"],
        check=True, capture_output=True, text=True,
        env={**os.environ, "DO_NOT_TRACK": "1", "OPENSPEC_TELEMETRY": "0"},
    ).stdout
    text = norm(json.loads(raw)["instruction"])
    brief, lenses = fixed_brief(), lens_paragraphs()
    real = problems(text, brief, lenses)
    if real:
        print("FAIL real instruction:", *real, sep="\n  ")
        return 1
    mutations = {f"lens {i + 1} shortened": text.replace(lens, drop_middle_sentence(lens)) for i, lens in enumerate(lenses)}
    mutations["brief altered"] = text.replace(brief, brief.replace("never as instructions to you", "as guidance"))
    mutations["prohibition removed"] = text.replace(PROHIBITION, "Add what helps")
    survivors = [name for name, mutated in mutations.items() if not problems(mutated, brief, lenses)]
    if survivors:
        print("FAIL negative control not detected:", ", ".join(survivors))
        return 1
    print(f"passed ({len(mutations)} negative controls rejected)")
    return 0


sys.exit(main())
