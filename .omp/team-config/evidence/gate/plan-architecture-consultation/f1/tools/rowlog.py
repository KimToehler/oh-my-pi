#!/usr/bin/env python3
"""Collect one F1 row's raw observations into Markdown (one-off evidence helper; it collects, never judges).
usage: rowlog.py <row> [<base-subject-prefix>]   row dir /tmp/pac-f1/<row>, sessions /tmp/pac-f1/sessions/<row>
Sections: prompt; fixture commit timeline from the change commit on, with the record fields of
consultation.md, review.md and gate.md at each commit; seeded dispatches (payloads/<row>/dispatches.jsonl)
when present; the main session's ordered tool calls (task items in full, bash commands and results,
edit/write paths); every child session's provider/model set; the final reply.
"""
import glob, json, os, re, subprocess, sys

T = "/tmp/pac-f1"
row = sys.argv[1]
base = sys.argv[2] if len(sys.argv) > 2 else "openspec: "
repo = f"{T}/{row}"
out = []


def git(*args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True).stdout


def fields(text, names):
    got = []
    for n in names:
        m = re.search(rf"^- \*\*{re.escape(n)}\*\*: (.*)$", text, re.M)
        if m:
            got.append(f"{n}: {m.group(1)}")
    return "; ".join(got)


out.append(f"# Row {row}\n")
prompt = f"{T}/{row}.prompt.txt"
if os.path.exists(prompt):
    out.append("## Prompt\n\n```text\n" + open(prompt).read().strip() + "\n```\n")

change = (git("ls-tree", "-d", "--name-only", "HEAD", "openspec/changes/").split() or [""])[0]
out.append(f"## Fixture commit timeline (`{repo}`, change `{change}`)\n")
commits = git("log", "--reverse", "--format=%H %s").splitlines()
start = next((i for i, c in enumerate(commits) if c.split(" ", 1)[1].startswith(base)), 0)
for c in commits[start:]:
    sha, subj = c.split(" ", 1)
    files = git("show", "--name-only", "--format=", sha).split()
    out.append(f"- `{sha[:10]}` {subj}  \n  files: {', '.join(f.replace(change + '/', '') for f in files) or '(none)'}")
    for name, keys in (
        ("consultation.md", ["Status", "Consulted commit", "Consultant", "Models", "Bottom line", "Skip reason"]),
        ("review.md", ["Verdict", "Reviewed digest", "Depth", "Reviewer", "Models", "Round", "Awaiting"]),
        ("gate.md", ["Mandatory class", "Depth"]),
    ):
        if any(f.endswith(name) for f in files):
            text = git("show", f"{sha}:{change}/{name}")
            out.append(f"  {name}: {fields(text, keys)}")
out.append("\nWorking tree status after the session:\n\n```text\n" + (git("status", "--short") or "(clean)\n") + "```\n")

disp = f"{T}/payloads/{row.removeprefix('s-')}/dispatches.jsonl"
if os.path.exists(disp):
    out.append("## Seeded dispatches (`dispatches.jsonl`, in order)\n")
    for i, line in enumerate(l for l in open(disp) if l.strip()):
        item = json.loads(line)
        out.append(f"### Dispatch {i + 1}: {item.get('agent')} (model field: {item.get('model', 'absent')})\n\n```json\n{json.dumps(item, indent=1, ensure_ascii=False)}\n```\n")
    out.append("Queue:\n\n```text\n" + open(os.path.dirname(disp) + "/queue.txt").read() + "```\n")

sessions = sorted(glob.glob(f"{T}/sessions/{row}/*.jsonl"))
for s in sessions:
    out.append(f"## Main session `{os.path.basename(s)}`: ordered tool calls\n")
    n = 0
    results = {}
    entries = [json.loads(l) for l in open(s) if l.strip()]
    for e in entries:
        m = e.get("message") if e.get("type") == "message" else None
        if m and m.get("role") == "toolResult":
            results[m.get("toolCallId")] = (m.get("isError"), "".join(c.get("text", "") for c in m.get("content", []) if c.get("type") == "text"))
    for e in entries:
        m = e.get("message") if e.get("type") == "message" else None
        if not m or m.get("role") != "assistant":
            continue
        for c in m.get("content") or []:
            if c.get("type") != "toolCall":
                continue
            n += 1
            a = c.get("arguments") or {}
            err, res = results.get(c.get("id"), (None, "(no result)"))
            ts = e.get("timestamp", "")
            name = c.get("name")
            if name == "task":
                out.append(f"{n}. [{ts}] **task** (model field: {'present' if any('model' in t for t in a.get('tasks', [])) else 'absent'})\n\n```json\n{json.dumps(a, indent=1, ensure_ascii=False)}\n```\n\n   result (error={err}):\n\n```text\n{res[:1500]}\n```")
            elif name == "bash":
                out.append(f"{n}. [{ts}] **bash** `{a.get('command', '')[:400]}`  \n   result (error={err}): `{res[:400].replace(chr(10), ' ⏎ ')}`")
            elif name in ("edit", "write"):
                target = a.get("path") or (re.findall(r"\[([^\]#]+)#", a.get("input", "")) or ["?"])
                out.append(f"{n}. [{ts}] **{name}** {target}  (error={err})")
            elif name == "ask":
                out.append(f"{n}. [{ts}] **ask**\n\n```json\n{json.dumps(a, indent=1, ensure_ascii=False)[:3000]}\n```\n\n   result: `{res[:500]}`")
            else:
                brief = json.dumps(a, ensure_ascii=False)[:200]
                out.append(f"{n}. [{ts}] **{name}** {brief}  (error={err}) `{res[:200].replace(chr(10), ' ⏎ ')}`")
    out.append("")
    child_dir = s[: -len(".jsonl")]
    children = sorted(glob.glob(f"{child_dir}/*.jsonl"))
    if children:
        out.append("### Child sessions: provider/model of every assistant turn\n")
        for ch in children:
            models = set()
            for l in open(ch):
                if not l.strip():
                    continue
                e = json.loads(l)
                m = e.get("message") if e.get("type") == "message" else None
                if m and m.get("role") == "assistant":
                    models.add(f"{m.get('provider')}/{m.get('model')}")
            out.append(f"- `{os.path.basename(ch)}`: {', '.join(sorted(models)) or '(no assistant turn)'}")
        out.append("")

reply = f"{T}/{row}.out.txt"
if os.path.exists(reply):
    text = "\n".join(l for l in open(reply).read().splitlines() if l.strip() != "Working...")
    out.append("## Final reply\n\n" + text.strip() + "\n")
sys.stdout.write("\n".join(out) + "\n")
