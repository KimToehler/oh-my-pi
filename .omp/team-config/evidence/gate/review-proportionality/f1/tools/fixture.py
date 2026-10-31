#!/usr/bin/env python3
"""F1 fixture helper for review-proportionality (one-off evidence helper, not delivered).

build <fixture> <sha>   : git init <fixture>, install delivered files from <sha>, write <fixture>/../<name>.delivered.sha256
check <fixture> <sha> <manifest> : compare each delivered fixture file with `git show <sha>:<source>`; exit 1 on any mismatch
"""
import hashlib, os, subprocess, sys

WT = "/Users/tim/git/oh-my-pi/.worktrees/review-proportionality"
SKILL = "team-config/agent/skills/review-work/"
SCHEMA = SKILL + "openspec/schemas/omp-gated/"
RULES = ["plan-merge-gate.md", "plan-review-process.md", "plan-review-eval-domain.md"]


def git(*args, binary=False):
    out = subprocess.run(["git", "-C", WT, *args], check=True, capture_output=True)
    return out.stdout if binary else out.stdout.decode()


def mapping(sha):
    files = git("ls-tree", "-r", "--name-only", sha, "--", SKILL).splitlines()
    pairs = []
    for src in files:
        pairs.append((".omp/skills/review-work/" + src[len(SKILL):], src))
        if src.startswith(SCHEMA):
            pairs.append(("openspec/schemas/omp-gated/" + src[len(SCHEMA):], src))
    pairs.append(("openspec/config.yaml", SKILL + "openspec/config.yaml"))
    for r in RULES:
        pairs.append((".omp/rules/" + r, "team-config/agent/rules/" + r))
    pairs.append((".omp/agents/plan-reviewer.md", "packages/coding-agent/src/prompts/agents/plan-reviewer.md"))
    return pairs


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build(fixture, sha):
    os.makedirs(fixture, exist_ok=False)
    subprocess.run(["git", "init", "-q", fixture], check=True)
    lines = []
    for dst, src in mapping(sha):
        data = git("show", f"{sha}:{src}", binary=True)
        path = os.path.join(fixture, dst)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        lines.append(f"{sha256(data)}  {dst}  {sha}:{src}")
    manifest = fixture.rstrip("/") + ".delivered.sha256"
    with open(manifest, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"built {fixture}: {len(lines)} delivered files, manifest {manifest}")


def check(fixture, sha, manifest):
    bad = 0
    n = 0
    for line in open(manifest):
        recorded, dst, ref = line.rstrip("\n").split("  ")
        rsha, src = ref.split(":", 1)
        n += 1
        want = sha256(git("show", f"{sha}:{src}", binary=True))
        try:
            have = sha256(open(os.path.join(fixture, dst), "rb").read())
        except FileNotFoundError:
            have = "missing"
        if rsha != sha or recorded != want or have != want:
            bad += 1
            print(f"MISMATCH {dst} (have {have[:12]}, want {want[:12]}, recorded {recorded[:12]}, sha {rsha[:10]})")
    print(f"checked {n} delivered files against {sha[:10]}: {'OK' if bad == 0 else f'{bad} MISMATCH'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "build":
        build(sys.argv[2], sys.argv[3])
    elif cmd == "check":
        check(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        sys.exit("usage")
