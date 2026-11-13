#!/usr/bin/env python3
"""F1 row m3: from a reviewer transcript (.jsonl) and a delta manifest, lists for every manifest patch the read calls
on it (path selectors included), the byte length of each read result, whether a result carries a cut marker and
whether one read result equals the file's text (trailing newlines aside), plus every evidence-file read.
Usage: reads.py TRANSCRIPT MANIFEST DELTA_DIR"""
import json, os, re, sys
transcript, manifest_path, delta = sys.argv[1:]
manifest = json.load(open(manifest_path))
calls, results = {}, {}
for line in open(transcript):
    e = json.loads(line)
    if e.get('type') != 'message': continue
    m = e['message']
    if m['role'] == 'assistant':
        for c in m.get('content') or []:
            if c.get('type') == 'toolCall': calls[c['id']] = c
    elif m['role'] == 'toolResult':
        results[m.get('toolCallId')] = ''.join(x.get('text', '') for x in m.get('content') or [] if isinstance(x, dict))
reads = {}
others = []
for cid, c in calls.items():
    a = c.get('arguments') or {}
    p = a.get('path', '')
    base = re.sub(r':[^/]*$', '', p) if p.startswith(delta) else p
    name = os.path.basename(base) if base.startswith(delta) else None
    if c['name'] == 'read' and name:
        reads.setdefault(name, []).append((p, results.get(cid, '')))
    elif c['name'] != 'read' or not p.startswith(delta):
        others.append(f"{c['name']} {json.dumps(a)[:160]}")
missing = []
for entry in manifest['commits']:
    rs = reads.get(entry['patch'], [])
    if not rs: missing.append(entry['patch'])
    size = os.path.getsize(os.path.join(delta, entry['patch']))
    lines = sum(1 for _ in open(os.path.join(delta, entry['patch']), 'rb'))
    cut = [bool(re.search(r'Showing lines \d+-\d+ of \d+|more lines in file|elided|lines truncated|Use :\d+ to continue', r)) for _, r in rs]
    text = open(os.path.join(delta, entry['patch']), encoding='utf-8', errors='replace').read().rstrip('\n')
    whole = any(r.rstrip('\n') == text for _, r in rs)
    print(f"{entry['patch']} {size} bytes {lines} lines: {len(rs)} read(s) {[p.replace(delta + '/', '') for p, _ in rs]} result bytes {[len(r.encode()) for _, r in rs]} cut={cut} whole-read={whole}")
for name in sorted(n for n in reads if n.endswith('.evidence.patch')):
    print(f"evidence {name}: {[p.replace(delta + '/', '') for p, _ in reads[name]]}")
print(f"manifest reads: {len(reads.get('manifest.json', []))}")
print(f"patch files never read: {missing or 'none'}")
print(f"other tool calls: {len(others)}")
for o in others: print('  ' + o)
