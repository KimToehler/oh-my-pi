#!/usr/bin/env python3
"""Block until a watched F1 TUI session needs attention: a pending ask, a task dispatch, or an idle turn end.
usage: watch.py <row>... ; prints the events and exits. Events already reported in /tmp/vba-f1/watch.seen are skipped.
One-off evidence helper; it collects, it never assigns a verdict."""
import glob, json, os, sys, time

rows = sys.argv[1:]
seen_path = "/tmp/vba-f1/watch.seen"
seen = set(open(seen_path).read().split()) if os.path.exists(seen_path) else set()

def state(row):
    files = sorted(glob.glob(f"/tmp/vba-f1/sessions/{row}/*.jsonl"))
    if not files:
        return None
    pending = None
    results = set()
    last_assistant = None
    for line in open(files[-1]):
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("type") != "message":
            continue
        m = e["message"]
        if m.get("role") == "assistant":
            last_assistant = m
            for c in m.get("content") or []:
                if c.get("type") == "toolCall" and c.get("name") in ("ask", "task"):
                    pending = c
        elif m.get("role") == "toolResult":
            results.add(m.get("toolCallId"))
    if pending and pending.get("id") not in results:
        return f"{pending.get('name')}:{pending.get('id')}"
    if last_assistant and not any(c.get("type") == "toolCall" for c in last_assistant.get("content") or []):
        return f"idle:{len(open(files[-1]).readlines())}"
    return None

deadline = time.time() + 1700
while time.time() < deadline:
    events = []
    for r in rows:
        s = state(r)
        if s and f"{r}:{s}" not in seen:
            events.append(f"{r}:{s}")
    if events:
        with open(seen_path, "a") as f:
            f.write("\n".join(events) + "\n")
        print("\n".join(events))
        sys.exit(0)
    time.sleep(5)
print("timeout")
