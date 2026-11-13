#!/usr/bin/env python3
"""Fills the delta brief of the deployed review-work SKILL.md for F1 rows m3 and m4; only the {...} inputs change.
Usage: brief.py m3|m4 DELTA_DIR REPO OUT_FILE"""
import json, os, re, sys
kind, delta, repo, out = sys.argv[1:]
skill = open(os.path.expanduser('~/.omp/agent/skills/review-work/SKILL.md')).read()
block = re.search(r'^Delta brief \(substitute.*?\n```\n(.*?)\n```\n', skill, re.S | re.M).group(1)
manifest = json.load(open(os.path.join(delta, 'manifest.json')))
shas = ' '.join(c['sha'][:12] for c in manifest['commits'])
inputs = os.path.join(os.path.dirname(os.path.abspath(out)), 'f2-delta-inputs.md')
if kind == 'm3':
    values = {
        'REPO ROOT': repo,
        'PLAN PATH': 'openspec/changes/m5-app-design-workspace',
        'PLAN INVARIANTS': f"see section 'Plan invariants' of {inputs} (verbatim copy of gate.md).",
        'FIX ROWS': "tasks 4.22, 4.23, 4.24, 4.25 in the inputs file (section 'Fix entries').",
        'CARRIED ROWS': "No F1 row is carried on this range's strength: the rows this range's code can change were re-run on the later app identities 32dc8c5d, 8cccd07e and f26a3349 (sections 'Fix round 3' and 'Fix round 4' of the row files under .omp/team-config/evidence/gate/m5-app-design-workspace/f1/), each other row carries with its one-line reason in its row file; wave 3 judges the rows on the final head.",
    }
else:
    plan = open(os.path.join(repo, '.omp/plans/demo.md')).read()
    values = {
        'REPO ROOT': repo,
        'PLAN PATH': '.omp/plans/demo.md',
        'PLAN INVARIANTS': 'Feature-specific criteria: not in plan\nAccepted residual risks: not in plan\nOut of scope for blocking: not in plan',
        'FIX ROWS': plan[plan.index('- [x] 1.1'):].rstrip('\n') + '\n  Reviewer: state in your reply the measured stop time, in ms, that this RED record shows for the unfixed engine.',
        'CARRIED ROWS': 'none',
    }
values.update({'BASE SHA': manifest['base_sha'], 'HEAD SHA': manifest['head_sha'], 'FIX SHAS': shas, 'MANIFEST PATH': os.path.join(delta, 'manifest.json')})
text = block
for k, v in values.items():
    assert text.count('{' + k + '}') == 1, k
    text = text.replace('{' + k + '}', v)
assert not re.search(r'\{[A-Z ]+\}', text), re.findall(r'\{[A-Z ]+\}', text)
open(out, 'w').write(text + '\n')
print(out)
