#!/usr/bin/env python3
"""Compare a fixture's delivered files with their manifest (sha256  dst  sha:src). usage: check.py <row>; exit 1 on mismatch.
One-off F1 evidence helper."""
import hashlib, os, sys

row = sys.argv[1]
bad = n = 0
for line in open(f"/tmp/vba-f1/{row}.delivered.sha256"):
    want, dst, ref = line.rstrip("\n").split("  ")
    n += 1
    try:
        have = hashlib.sha256(open(f"/tmp/vba-f1/{row}/{dst}", "rb").read()).hexdigest()
    except FileNotFoundError:
        have = "missing"
    if have != want:
        bad += 1
        print(f"MISMATCH {dst}")
print(f"checked {n} delivered files of {row}: {'OK' if not bad else f'{bad} MISMATCH'}")
sys.exit(1 if bad else 0)
