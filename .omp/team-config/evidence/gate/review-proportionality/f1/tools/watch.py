#!/usr/bin/env python3
"""Block until a watched F1 session needs attention: a pending ask, an idle turn end, or B finished.
usage: watch.py <row>... ; prints the events and exits. Rows already reported in /tmp/rp-f1/watch.seen are skipped."""
import glob, json, os, sys, time

rows = sys.argv[1:]
seen_path = "/tmp/rp-f1/watch.seen"
seen = set(open(seen_path).read().split()) if os.path.exists(seen_path) else set()


def state(row):
    files = sorted(glob.glob(f"/tmp/rp-f1/sessions/{row}/*.jsonl"))
    if not files:
        return None
    last_call = None
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
                if c.get("type") == "toolCall":
                    last_call = c
        elif m.get("role") == "toolResult":
            results.add(m.get("toolCallId"))
    if last_call and last_call.get("name") == "ask" and last_call.get("id") not in results:
        return f"ask:{last_call.get('id')}"
    if last_assistant and not any(c.get("type") == "toolCall" for c in last_assistant.get("content") or []):
        if last_assistant.get("stopReason") in ("stop", "end_turn", None):
            return f"idle:{len(open(files[-1]).readlines())}"
    return None


deadline = time.time() + 1700
while time.time() < deadline:
    events = []
    for r in rows:
        if r == "B":
            p = "/tmp/rp-f1/B.exit.txt"
            n = len(open(p).read().splitlines()) if os.path.exists(p) else 0
            key = f"B:done{n}"
            if n >= 2 and key not in seen:
                events.append(key)
            continue
        s = state(r)
        if s and f"{r}:{s}" not in seen:
            events.append(f"{r}:{s}")
    if events:
        with open(seen_path, "a") as f:
            f.write("\n".join(events) + "\n")
        print("\n".join(events))
        sys.exit(0)
    time.sleep(10)
print("timeout")
