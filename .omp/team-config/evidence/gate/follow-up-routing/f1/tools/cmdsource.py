#!/usr/bin/env python3
"""Validity control: which opsx command text each F1 session ran. One-off F1 evidence helper.
For every session JSONL under /tmp/fur-f1/sessions/<row>/, report whether the expanded command prompt carries the
delivered step (archive: "Route the change's follow-ups"; propose: "Take matching follow-ups (proposal only)") and
whether any tool call names a profile command file (~/.omp/agent/commands or /Users/tim/.omp/agent/commands)."""
import glob, json, os
for d in sorted(glob.glob("/tmp/fur-f1/sessions/*")):
    for f in sorted(glob.glob(os.path.join(d, "*.jsonl"))):
        first_user, profile_refs = None, 0
        for line in open(f):
            e = json.loads(line)
            if e.get("type") != "message":
                continue
            m = e["message"]
            if m.get("role") == "user" and first_user is None:
                c = m.get("content")
                first_user = c if isinstance(c, str) else "".join(x.get("text", "") for x in c if x.get("type") == "text")
            if m.get("role") == "assistant":
                for c in m.get("content") or []:
                    if c.get("type") == "toolCall" and "agent/commands" in json.dumps(c.get("arguments")):
                        profile_refs += 1
        kind = "archive" if "Archive a completed change" in (first_user or "") else "propose" if "Take matching" in (first_user or "") or "Propose" in (first_user or "")[:200] else "other"
        marker = {"archive": "Route the change's follow-ups", "propose": "Take matching follow-ups (proposal only)"}.get(kind)
        ok = marker is not None and marker in first_user
        print(f"{os.path.basename(d)}/{os.path.basename(f)}: command={kind} delivered-step-present={ok} profile-command-refs={profile_refs}")
