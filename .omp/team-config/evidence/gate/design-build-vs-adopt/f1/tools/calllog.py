#!/usr/bin/env python3
"""Extract the ordered user turns, assistant text and tool calls with results from omp session JSONL files.
One-off F1 evidence helper. It collects; it never assigns a verdict.
usage: calllog.py <session-dir> > calls.md
Full text for ask/task/write/edit/bash results; read results truncated to 1500 chars (marked).
"""
import glob, json, os, sys

FULL = {"ask", "task", "write", "edit", "bash", "todo"}
d = sys.argv[1]
files = sorted(glob.glob(os.path.join(d, "*.jsonl")))
out = []
n = 0
for f in files:
    out.append(f"# Session file {os.path.basename(f)}\n")
    for line in open(f):
        e = json.loads(line)
        if e.get("type") != "message":
            continue
        m = e["message"]
        ts = e.get("timestamp", "")
        role = m.get("role")
        content = m.get("content")
        if role == "user":
            text = content if isinstance(content, str) else "".join(c.get("text", "") for c in content if c.get("type") == "text")
            out.append(f"## [{ts}] USER\n\n{text}\n")
        elif role == "assistant":
            for c in content or []:
                if c.get("type") == "text" and c.get("text", "").strip():
                    out.append(f"## [{ts}] ASSISTANT TEXT\n\n{c['text']}\n")
                elif c.get("type") == "toolCall":
                    n += 1
                    args = json.dumps(c.get("arguments"), indent=1, ensure_ascii=False)
                    out.append(f"## [{ts}] CALL {n} {c.get('name')} ({c.get('id')})\n\n```json\n{args}\n```\n")
        elif role == "toolResult":
            name = m.get("toolName")
            text = "".join(c.get("text", "") for c in m.get("content", []) if c.get("type") == "text")
            if name not in FULL and len(text) > 1500:
                text = text[:1500] + f"\n…[truncated by calllog.py: {len(text)} chars total]"
            out.append(f"## [{ts}] RESULT {name} ({m.get('toolCallId')}) error={m.get('isError')}\n\n```text\n{text}\n```\n")
sys.stdout.write("\n".join(out))
