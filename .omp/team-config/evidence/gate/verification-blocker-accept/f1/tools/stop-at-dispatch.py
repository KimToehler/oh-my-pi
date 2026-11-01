#!/usr/bin/env python3
"""End an F1 TUI row at its first reviewer dispatch after a given line count: when a `task` tool call appears,
capture the screen to /tmp/vba-f1/<row>.screen-dispatch.txt and kill the tmux session before the dispatch runs.
usage: stop-at-dispatch.py <row> <after-line>   (one-off evidence helper)"""
import glob, json, subprocess, sys, time

row, after = sys.argv[1], int(sys.argv[2])
while True:
    files = sorted(glob.glob(f"/tmp/vba-f1/sessions/{row}/*.jsonl"))
    lines = open(files[-1]).readlines() if files else []
    for line in lines[after:]:
        try:
            e = json.loads(line)
        except Exception:
            continue
        m = e.get("message") or {}
        if e.get("type") == "message" and m.get("role") == "assistant":
            if any(c.get("type") == "toolCall" and c.get("name") == "task" for c in m.get("content") or []):
                scr = subprocess.run(["tmux", "capture-pane", "-p", "-t", f"vba-{row}", "-S", "-80"], capture_output=True, text=True).stdout
                subprocess.run(["tmux", "kill-session", "-t", f"vba-{row}"])
                open(f"/tmp/vba-f1/{row}.screen-dispatch.txt", "w").write(scr)
                open(f"/tmp/vba-f1/{row}.stopped", "w").write(e.get("timestamp", "") + "\n")
                sys.exit(0)
    time.sleep(0.3)
