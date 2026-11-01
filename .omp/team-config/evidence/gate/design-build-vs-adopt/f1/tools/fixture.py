#!/usr/bin/env python3
"""F1 fixture helper for design-build-vs-adopt (one-off evidence helper, not delivered).

build <fixture> <sha> <manifest>         : copy the omp-gated schema tree at <sha> into <fixture>/openspec/schemas/omp-gated/
                                           and write <manifest> (sha256, fixture path, <sha>:<source path> per file)
check <fixture> <sha> <manifest>         : compare every manifest file in <fixture> with `git show <sha>:<source>`;
                                           print MISMATCH per difference and exit 1 on any
"""
import hashlib, os, subprocess, sys

WT = "/Users/tim/git/oh-my-pi/.worktrees/design-build-vs-adopt"
SCHEMA = "team-config/agent/skills/review-work/openspec/schemas/omp-gated/"
DST = "openspec/schemas/omp-gated/"


def git(*args, binary=False):
    out = subprocess.run(["git", "-C", WT, *args], check=True, capture_output=True)
    return out.stdout if binary else out.stdout.decode()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build(fixture, sha, manifest):
    lines = []
    for src in git("ls-tree", "-r", "--name-only", sha, "--", SCHEMA).splitlines():
        data = git("show", f"{sha}:{src}", binary=True)
        dst = DST + src[len(SCHEMA):]
        path = os.path.join(fixture, dst)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        lines.append(f"{sha256(data)}  {dst}  {sha}:{src}")
    with open(manifest, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"built {fixture}: {len(lines)} delivered files from {sha[:10]}")


def check(fixture, sha, manifest):
    bad = n = 0
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
    cmd, fixture, sha, manifest = sys.argv[1:5]
    {"build": build, "check": check}[cmd](fixture, sha, manifest)
