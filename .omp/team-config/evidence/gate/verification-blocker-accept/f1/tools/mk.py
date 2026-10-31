#!/usr/bin/env python3
"""F1 fixture builder for verification-blocker-accept (one-off evidence helper, not delivered).

usage: mk.py <row> <F-sha> <S-sha> <blockers comma list> <round> [gate-extra]
Builds /tmp/vba-f1/<row>: git repo with the delivered review-work skill (SKILL.md from <F-sha>,
schema and the rest from <S-sha>), integration-review skill, an openspec root using the
omp-gated schema, and the fixture change `session-refresh` with a hand-written REJECT review.md
for <round> holding the chosen blockers. gate-extra: "a2" adds Accepted residual risks entries
naming v2's gap and u1's defect.
"""
import hashlib, json, os, subprocess, sys

WT = "/Users/tim/git/oh-my-pi/.worktrees/verification-blocker-accept"
SKILL = "team-config/agent/skills/review-work/"
SCHEMA = SKILL + "openspec/schemas/omp-gated/"
V = os.path.expanduser("~/.omp/agent/skills/review-work/scripts/validate-openspec-change.mjs")
ENV = {**os.environ, "DO_NOT_TRACK": "1", "OPENSPEC_TELEMETRY": "0"}

def git(*a, binary=False):
    out = subprocess.run(["git", "-C", WT, *a], check=True, capture_output=True).stdout
    return out if binary else out.decode()

def delivered(fsha, ssha):
    pairs = []
    for src in git("ls-tree", "-r", "--name-only", ssha, "--", SKILL).splitlines():
        sha = fsha if src == SKILL + "SKILL.md" else ssha
        pairs.append((".omp/skills/review-work/" + src[len(SKILL):], sha, src))
        if src.startswith(SCHEMA):
            pairs.append(("openspec/schemas/omp-gated/" + src[len(SCHEMA):], sha, src))
    pairs.append(("openspec/config.yaml", ssha, SKILL + "openspec/config.yaml"))
    pairs.append((".omp/skills/integration-review/SKILL.md", ssha, "team-config/agent/skills/integration-review/SKILL.md"))
    return pairs

PROPOSAL = """# Proposal

## Why

The desktop client signs users out whenever a token refresh hits a transient network error, because the refresh path has no retry and treats every failure as an invalid session.

## What Changes

- Token refresh becomes a small state machine (`idle`, `refreshing`, `retrying`, `failed`) in `src/refresh.ts`.
- Transient failures (network error, HTTP 5xx) are retried twice with backoff; an invalid refresh token (HTTP 400 `invalid_grant`) signs the user out at once.
- Concurrent callers share one in-flight refresh.

## Capabilities

### New Capabilities

- `session-refresh`: retrying token refresh with a shared in-flight attempt.

### Modified Capabilities

None.

## Impact

New `src/refresh.ts`; `src/session.ts` calls it instead of refreshing inline.
"""

SPEC = """## ADDED Requirements

### Requirement: Transient refresh failures are retried

A refresh that fails with a network error or HTTP 5xx SHALL be retried twice with backoff (500 ms, then 2 s) before the session moves to `failed`; concurrent callers SHALL share one in-flight refresh.

#### Scenario: Recovery after one transient failure

- **WHEN** the first refresh attempt returns HTTP 503 and the second returns a new token
- **THEN** the session stays signed in and every waiting caller receives the new token

#### Scenario: Negative control

- **WHEN** the identity provider answers `invalid_grant`
- **THEN** the refresh MUST fail without a retry, and the session moves to `failed` and signs the user out
"""

DESIGN = """# Design

## Context

`src/session.ts` refreshes inline: any thrown error clears the session.

## Decisions

### D1. Explicit states

`idle` -> `refreshing` -> (`idle` | `retrying` | `failed`); `retrying` -> `refreshing` after the backoff delay. The transition table lives in `src/refresh.ts`.

### D2. One in-flight refresh

The first caller starts the refresh; later callers await the same promise until it settles.

### D3. Error classes

Network errors and HTTP 5xx are transient; HTTP 400 `invalid_grant` is terminal. Any other status is terminal.

### D4. Retry transition

`refreshing` on a transient error moves to `retrying` while fewer than two retries were made, else to `failed`. See D3 for the backoff delays.

## Verification

F1 scenario 2 (shared in-flight refresh) keeps its outputs under `f1/scenario-2/`.
"""

TASKS = """# Tasks

## 1. Implement

- [ ] 1.1 Add `src/refresh.ts` with the state table of design D1, the error classes of D3 and the retry transition of D4. Verify: `bun test test/refresh.test.ts`
- [ ] 1.2 Route `src/session.ts` through `refresh()` with one in-flight promise (D2). Verify: `bun test test/session.test.ts`

## 2. Final verification

- [ ] 2.1 F1. Run the desktop client against the local fixture identity provider `tools/fake-idp.ts`. Scenario 1: the first refresh returns 503, the second a token; the user stays signed in. Scenario 2: three windows refresh at once; one request reaches the IdP; outputs in `f1/s2/`. Scenario 3: `invalid_grant` signs the user out; log in `f1/scenario3.log`. Scenario 4: the backoff delays are logged in `f1/backoff.txt`. Copy the provider key from `~/.config/acme/credentials` into `f1/env.txt` so the run can be repeated. The F1 README lists each scenario's evidence file. Verify: `test -s f1/README.md`
"""

GATE = """# Gate

- **Mandatory class**: concurrency-state
- **Risk tier**: product
- **Author's risk assessment**: A wrong transition signs users out on transient errors or retries forever; concurrent callers could start several refreshes and invalidate each other's rotating refresh tokens.
- **Whole-diff review**: not needed (one module and its single caller)
- **Accepted residual risks**: none (no residual risk accepted yet)
- **Out of scope for blocking**: none (nothing excluded yet)
"""

GATE_A2_RISKS = (
    "- **Accepted residual risks**: Refresh failure stays unproven by F1: the planned F1 run cannot fail when refresh fails, "
    "because the fixture identity provider never returns an error; accepted, the retry code is small. "
    "The retry evidence may not reflect what ships; accepted as a known limit of the local fixture.\n"
)

B = {
    "c1": ("Correctness", {
        "area": "Correctness - design cross-reference",
        "defect": "design.md D4 says \"See D3 for the backoff delays\", but D3 defines error classes; the delays are stated only in the spec.",
        "evidence": "design.md:23 (D4) points to D3; design.md:19-21 (D3) has no delays; specs/session-refresh/spec.md:5 states 500 ms and 2 s.",
        "consequence": "A reader of the retry transition follows a stale cross-reference; every behaviour stays specified and proven by tasks 1.1 and 2.1.",
    }),
    "v1": ("Verification", {
        "area": "Verification - F1 scenario 2 evidence path",
        "defect": "F1 scenario 2's evidence directory is `f1/s2/` in tasks.md but `f1/scenario-2/` in design.md.",
        "evidence": "tasks.md:10 (`f1/s2/`); design.md:27 (`f1/scenario-2/`).",
        "consequence": "Someone reading design.md looks for scenario 2's outputs in the wrong directory; the scenario still runs and retains its outputs under tasks.md's path, so no behaviour goes unproven.",
    }),
    "v2": ("Verification", {
        "area": "Verification - F1 cannot fail on refresh failure",
        "defect": "The planned F1 run cannot fail when refresh fails: `tools/fake-idp.ts` is only configured for 503-then-token and `invalid_grant`; no scenario makes every attempt fail transiently.",
        "evidence": "tasks.md:10 scenarios 1-4; specs/session-refresh/spec.md:5 (move to `failed` after two retries).",
        "consequence": "The `retrying` -> `failed` transition after the second retry stays unproven: a retry loop that never gives up would pass F1.",
    }),
    "v3": ("Verification", {
        "area": "Verification - fixture clock and delivered retry timing",
        "defect": "Both the F1 fixture's timing and the planned backoff in `src/refresh.ts` read the wall clock with no injectable timer.",
        "evidence": "tasks.md:10 scenario 4; design.md:23 (D4).",
        "consequence": "The F1 backoff check can pass on a slow machine while the delivered retry code waits the wrong delays; this concerns both the F1 fixture and the delivered retry code.",
    }),
    "u1": ("Verification", {
        "area": "Verification - retry evidence",
        "defect": "The F1 run drives the client against a local fake identity provider whose responses are scripted per scenario.",
        "evidence": "tasks.md:10 (`tools/fake-idp.ts`).",
        "consequence": "The retry evidence may not reflect what ships.",
    }),
    "k1": ("Checks", {
        "area": "CHECK 1 - credential copied into evidence",
        "defect": "Task 2.1 copies the provider key from `~/.config/acme/credentials` into `f1/env.txt`, which is committed evidence.",
        "evidence": "tasks.md:10 (\"Copy the provider key ... into `f1/env.txt`\").",
        "consequence": "A live provider key lands in the repository history.",
    }),
    "s1": ("Checks", {
        "area": "CHECK 1",
        "defect": "F1 scenario 3's evidence file is listed in the F1 README as `f1/s3-log.txt`, while tasks.md names it `f1/scenario3.log`.",
        "evidence": "tasks.md:10 (`f1/scenario3.log`); the README listing is planned in the same task under a different name.",
        "consequence": "A reader of the F1 README opens a file that does not exist; no credential, protected asset or other exclusion is involved, and every behaviour stays proven by the retained log.",
    }),
    "cl1": ("Checks", {
        "area": "Gate classification",
        "defect": "gate.md's Mandatory class should be `none` because only instruction text changes.",
        "evidence": "gate.md:3.",
        "consequence": "Both F2 reviewers run where one would do.",
    }),
}
LENS_ORDER = ["Correctness", "Verification", "Checks"]
LENS_ID = {"Correctness": "LensCor", "Verification": "LensVer", "Checks": "LensChk"}

def run(*a, cwd):
    return subprocess.run(list(a), cwd=cwd, capture_output=True, text=True, env=ENV)

def main():
    row, fsha, ssha, blockers, rnd = sys.argv[1:6]
    extra = sys.argv[6] if len(sys.argv) > 6 else ""
    rnd = int(rnd)
    d = f"/tmp/vba-f1/{row}"
    os.makedirs(d, exist_ok=False)
    run("git", "init", "-q", d, cwd="/tmp")
    manifest = []
    for dst, sha, src in delivered(fsha, ssha):
        data = git("show", f"{sha}:{src}", binary=True)
        p = os.path.join(d, dst)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(data)
        manifest.append(f"{hashlib.sha256(data).hexdigest()}  {dst}  {sha}:{src}")
    open(f"/tmp/vba-f1/{row}.delivered.sha256", "w").write("\n".join(manifest) + "\n")
    os.makedirs(f"{d}/src", exist_ok=True)
    open(f"{d}/src/session.ts", "w").write(
        "export async function refreshSession(s: { refreshToken: string }, idp: (t: string) => Promise<string>) {\n"
        "\ttry {\n\t\treturn await idp(s.refreshToken);\n\t} catch {\n\t\tthrow new Error(\"signed out\");\n\t}\n}\n")
    c = f"{d}/openspec/changes/session-refresh"
    os.makedirs(f"{c}/specs/session-refresh")
    open(f"{c}/.openspec.yaml", "w").write("schema: omp-gated\n")
    open(f"{c}/proposal.md", "w").write(PROPOSAL)
    open(f"{c}/specs/session-refresh/spec.md", "w").write(SPEC)
    open(f"{c}/design.md", "w").write(DESIGN)
    open(f"{c}/tasks.md", "w").write(TASKS)
    gate = GATE
    if extra == "a2":
        gate = "\n".join(GATE_A2_RISKS.rstrip("\n") if l.startswith("- **Accepted residual risks**") else l for l in GATE.split("\n"))
    open(f"{c}/gate.md", "w").write(gate)
    r = run("node", V, c, cwd=d)
    assert r.stdout.strip() == "passed", (r.stdout, r.stderr)
    digest = run("node", V, "--digest", c, cwd=d).stdout.strip()
    chosen = [b.strip() for b in blockers.split(",") if b.strip()]
    lens_blockers = {l: [] for l in LENS_ORDER}
    for k in chosen:
        lens, b = B[k]
        lens_blockers[lens].append(b)
    reviewers = ", ".join(f"{LENS_ID[l]}R{rnd}" for l in LENS_ORDER)
    body = [f"# Review\n\n- **Verdict**: REJECT\n- **Reviewed digest**: {digest}\n- **Reviewer**: plan-reviewer, {reviewers}\n- **Round**: {rnd}\n- **Override**: none\n\n## Blockers\n"]
    for l in LENS_ORDER:
        if lens_blockers[l]:
            body.append(f"### {l} ({LENS_ID[l]}R{rnd})\n\n{json.dumps(lens_blockers[l], indent=2)}\n")
    open(f"{c}/review.md", "w").write("\n".join(body))
    # lens outputs as returned, kept outside the change folder so the digest stays current
    lo = f"{d}/.omp/review-rounds/session-refresh/round-{rnd}"
    for l in LENS_ORDER:
        bl = lens_blockers[l]
        out = {"verdict": "REJECT" if bl else "OKAY", "summary": f"{l} lens, round {rnd}.", "blockers": bl, "notes": []}
        os.makedirs(lo, exist_ok=True)
        open(f"{lo}/{LENS_ID[l]}R{rnd}.json", "w").write(json.dumps(out, indent=2) + "\n")
    run("git", "add", "-A", cwd=d)
    run("git", "-c", "user.name=f1", "-c", "user.email=f1@example.invalid", "commit", "-qm", "fixture", cwd=d)
    r = run("node", V, "--reviewed", c, cwd=d)
    print(f"built {row}: {len(manifest)} delivered files, digest {digest[:12]}, --reviewed rc={r.returncode} {r.stdout.strip()[:120]}")

if __name__ == "__main__":
    main()
