#!/usr/bin/env python3
"""Block until one F1 TUI session needs attention: a pending ask, or an idle turn end after <min-lines> JSONL lines.
usage: watch.py <session-dir-name> [<min-lines>] ; prints the event and exits. One-off F1 evidence helper; it never judges."""
import glob, json, sys, time

name = sys.argv[1]
min_lines = int(sys.argv[2]) if len(sys.argv) > 2 else 0
deadline = time.time() + 1500


def state():
    files = sorted(glob.glob(f"/tmp/fur-f1/sessions/{name}/*.jsonl"))
    if not files:
        return None
    lines = open(files[-1]).readlines()
    last_call, results, last_assistant = None, set(), None
    for line in lines:
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
                if c.get("type") == "toolCall":
                    last_call = c
        elif m.get("role") == "toolResult":
            results.add(m.get("toolCallId"))
    if last_call and last_call.get("name") == "ask" and last_call.get("id") not in results:
        return "ask " + json.dumps(last_call.get("arguments"), ensure_ascii=False)
    if len(lines) > min_lines and last_assistant and not any(c.get("type") == "toolCall" for c in last_assistant.get("content") or []):
        return f"idle lines={len(lines)}"
    return None


while time.time() < deadline:
    s = state()
    if s:
        print(s)
        sys.exit(0)
    time.sleep(3)
print("timeout")
