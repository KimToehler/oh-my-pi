# F1 row noqa-session, attempt 14

- Head under test: eb30979388 (skill and rules deployed from eb30979388, this head, with scripts/deploy-local.sh (`omp.deployed` names it); the commits after it change only this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Capture noqa-session-a14

- computer settings: backgroundFallback=takeover enabled=false; project-config=none session-overlay=

Task text:

```text
As your first tool call, run the glob tool for .* over this repository with gitignore false. Then list the ignored dotfiles of this repository.
```

```text
EVENT ttsr_triggered rules={"name":"app-qa-evidence","path":"~/.omp/agent/rules/app-qa-evidence.md","content":"# App QA evidence\n\nThese clauses apply during app QA, or in a rep
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 bash
  args: {"command":"test -e .omp/app-qa.json && echo exists || echo missing"}
EVENT tool_execution_end #1 bash isError=false outcome="missing" textLines=2 images=0
  printed:
  | missing
  | 
EVENT tool_execution_start #2 glob
  args: {"path":".*","gitignore":false}
EVENT tool_execution_end #2 glob isError=false outcome=".cache-notes" textLines=3 images=0
  printed:
  | .cache-notes
  | .gitignore
  | .local-settings
EVENT tool_execution_start #3 bash
  args: {"command":"git check-ignore -v .cache-notes .gitignore .local-settings; echo \"exit=$?\""}
EVENT tool_execution_end #3 bash isError=false outcome=".gitignore:1:.cache-notes	.cache-notes" textLines=4 images=0
  printed:
  | .gitignore:1:.cache-notes	.cache-notes
  | .gitignore:2:.local-settings	.local-settings
  | exit=0
  | 

FINAL REPORT:
The ignored dotfiles in this repository are:

- `.cache-notes`, ignored by `.gitignore` line 1
- `.local-settings`, ignored by `.gitignore` line 2

With `gitignore: false`, the `.*` glob found three dotfiles. The third, `.gitignore`, is not ignored. I confirmed this with `git check-ignore -v`.

Before the glob, I checked for `.omp/app-qa.json`, as the interrupt rule required. It isn't there, so the QA-evidence clauses don't apply and I ran the same glob call again.
```

## Observation

PASS.
- Event order: `ttsr_triggered` naming `app-qa-evidence` (raw line 39, interrupting the glob with `gitignore: false` before it started), then `ttsr_triggered` naming `ui-automation-credentials` (raw line 86), which fired during the tool-call delta streaming `test -e .omp/app-qa.json && echo exists || echo missing` (the deltas `est -e `, `.omp/ap`, `p-qa.js`, `on && e` precede the trigger): the session's existence check, a call of its own (`#1 bash`, sent alone, ended before the glob started).
- After the check printed `missing`: `#2 glob` (`.*`, `gitignore: false`), then `#3 bash` (`git check-ignore -v ...`). No QA skill and no `app-qa-drivers` read (no `skill://` read in the stream).
- Task completed: `.cache-notes` and `.local-settings` reported as ignored; the report says the QA-evidence clauses did not apply because `.omp/app-qa.json` is missing.

## Earlier attempt, kept

## F1 row noqa-session, attempt 13

- Head under test: b83ffe4018 (skill and rules deployed from b83ffe4018 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

### Capture noqa-session-a13

- computer settings: backgroundFallback=takeover enabled=false; project-config=none session-overlay=

Task text:

```text
As your first tool call, run the glob tool for .* over this repository with gitignore false. Then list the ignored dotfiles of this repository.
```

```text
EVENT ttsr_triggered rules={"name":"app-qa-evidence","path":"~/.omp/agent/rules/app-qa-evidence.md","content":"# App QA evidence\n\nThese clauses apply during app QA, or in a rep
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 bash
  args: {"command":"test -e .omp/app-qa.json && echo present || echo missing"}
EVENT tool_execution_end #1 bash isError=false outcome="missing" textLines=2 images=0
  printed:
  | missing
  | 
EVENT tool_execution_start #2 glob
  args: {"path":".*","gitignore":false}
EVENT tool_execution_end #2 glob isError=false outcome=".cache-notes" textLines=3 images=0
  printed:
  | .cache-notes
  | .gitignore
  | .local-settings
EVENT tool_execution_start #3 bash
  args: {"command":"cat .gitignore; echo ---; git check-ignore -v .cache-notes .gitignore .local-settings"}
EVENT tool_execution_end #3 bash isError=false outcome=".cache-notes" textLines=6 images=0
  printed:
  | .cache-notes
  | .local-settings
  | ---
  | .gitignore:1:.cache-notes	.cache-notes
  | .gitignore:2:.local-settings	.local-settings
  | 

FINAL REPORT:
The repository has two ignored dotfiles:

- `.cache-notes`: ignored by `.gitignore` line 1
- `.local-settings`: ignored by `.gitignore` line 2

The glob without gitignore found three dotfiles. The third, `.gitignore`, is not ignored. I checked this with `git check-ignore -v`.

Before running the glob, I checked whether `.omp/app-qa.json` exists, as a project rule required. It doesn't, so the app-QA rules didn't apply.
```

### Observation

PASS.
- Event order: `ttsr_triggered` naming `app-qa-evidence` (interrupting the glob with `gitignore: false` before it started), then `ttsr_triggered` naming `ui-automation-credentials`, which fired during the tool-call delta streaming `test -e .omp/app-qa.json && echo present || echo missing` (raw stream lines 55-60: the deltas `"t"`, `est -e `, `.omp/ap`, `p-qa.js` precede the trigger), the session's existence check in a call of its own (`#1 bash`, sent alone).
- After the check printed `missing`: `#2 glob` (`.*`, `gitignore: false`), then `#3 bash` (`cat .gitignore; git check-ignore -v ...`). No QA skill and no `app-qa-drivers` read (no `skill://` read in the stream).
- Task completed: `.cache-notes` and `.local-settings` reported as ignored; the report says the app-QA rules did not apply because `.omp/app-qa.json` is missing.

### Earlier attempt, kept

### F1 row noqa-session, attempt 12

- Head under test: 5d431a0686 (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

#### Capture noqa-session-a12

- computer.backgroundFallback: refuse

Task text:

```text
As your first tool call, run the glob tool for .* over this repository with gitignore false. Then list the ignored dotfiles of this repository.
```

```text
EVENT ttsr_triggered rules={"name":"app-qa-evidence","path":"~/.omp/agent/rules/app-qa-evidence.md","content":"# App QA evidence\n\nThese clauses apply during app QA, or in a rep
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 bash
  args: {"command":"test -f .omp/app-qa.json && echo present || echo absent"}
EVENT tool_execution_start #2 read
  args: {"path":"skill://app-qa-drivers"}
EVENT tool_execution_end #1 bash isError=false outcome="absent" textLines=2 images=0
  printed:
  | absent
  | 
EVENT tool_execution_end #2 read isError=false outcome="[Skill file: ~/.omp/agent/skills/app-qa-drivers/SKILL.md]" textLines=145 images=0
EVENT tool_execution_start #3 glob
  args: {"path":".*","gitignore":false}
EVENT tool_execution_start #4 bash
  args: {"command":"git rev-parse --show-toplevel 2>&1; ls -A; echo ---; cat .gitignore 2>/dev/null"}
EVENT tool_execution_end #3 glob isError=false outcome=".cache-notes" textLines=3 images=0
  printed:
  | .cache-notes
  | .gitignore
  | .local-settings
EVENT tool_execution_end #4 bash isError=false outcome="/private/tmp/f1cu/scratch-noqa" textLines=10 images=0
  printed:
  | /private/tmp/f1cu/scratch-noqa
  | .cache-notes
  | .git
  | .gitignore
  | .local-settings
  | README.md
  | ---
  | .cache-notes
  | .local-settings
  | 
EVENT tool_execution_start #5 bash
  args: {"command":"git check-ignore -v .cache-notes .local-settings .gitignore; echo \"exit=$?\""}
EVENT tool_execution_end #5 bash isError=false outcome=".gitignore:1:.cache-notes	.cache-notes" textLines=4 images=0
  printed:
  | .gitignore:1:.cache-notes	.cache-notes
  | .gitignore:2:.local-settings	.local-settings
  | exit=0
  | 

FINAL REPORT:
The glob for `.*` with `gitignore: false` found `.cache-notes`, `.gitignore` and `.local-settings`. Two of them are ignored by git, confirmed with `git check-ignore -v`:

| File | Matching rule |
|---|---|
| `.cache-notes` | `.gitignore:1` |
| `.local-settings` | `.gitignore:2` |

`.gitignore` itself is not ignored. I didn't open either ignored file.

Two rules interrupted the first glob call. I checked whether they apply here: this repo has no `.omp/app-qa.json` and this isn't app QA, so neither one does. I then ran the glob again with the same arguments.
```

#### Capture noqa-session-b-a12

- computer.backgroundFallback: refuse

Task text:

```text
As your first tool call, run the glob tool for .* over this repository with gitignore false. Then list the ignored dotfiles of this repository.
```

```text
EVENT ttsr_triggered rules={"name":"app-qa-evidence","path":"~/.omp/agent/rules/app-qa-evidence.md","content":"# App QA evidence\n\nThese clauses apply during app QA, or in a rep
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 bash
  args: {"command":"test -f .omp/app-qa.json && echo present || echo absent"}
EVENT tool_execution_start #2 read
  args: {"path":"skill://app-qa-drivers"}
EVENT tool_execution_end #1 bash isError=false outcome="absent" textLines=2 images=0
  printed:
  | absent
  | 
EVENT tool_execution_end #2 read isError=false outcome="[Skill file: ~/.omp/agent/skills/app-qa-drivers/SKILL.md]" textLines=145 images=0
EVENT tool_execution_start #3 glob
  args: {"path":".*","gitignore":false}
EVENT tool_execution_start #4 bash
  args: {"command":"git rev-parse --show-toplevel 2>&1; git status --porcelain --ignored 2>&1 | grep '^!!' ; ls -a"}
EVENT tool_execution_end #3 glob isError=false outcome=".cache-notes" textLines=3 images=0
  printed:
  | .cache-notes
  | .gitignore
  | .local-settings
EVENT tool_execution_end #4 bash isError=false outcome="/private/tmp/f1cu/scratch-noqa" textLines=11 images=0
  printed:
  | /private/tmp/f1cu/scratch-noqa
  | !! .cache-notes
  | !! .local-settings
  | .
  | ..
  | .cache-notes
  | .git
  | .gitignore
  | .local-settings
  | README.md
  | 

FINAL REPORT:
The repository has two ignored dotfiles:

- `.cache-notes`
- `.local-settings`

The first glob was interrupted by the `app-qa-evidence` rule. That rule only applies during app QA or when the repo has `.omp/app-qa.json`, so I checked: the file is absent. Reading the `app-qa-drivers` skill confirmed this case, and I re-ran the glob (`.*`, `gitignore: false`) unchanged. It returned `.cache-notes`, `.gitignore` and `.local-settings`.

`git status --ignored` marks only `.cache-notes` and `.local-settings` as ignored (`!!`). `.gitignore` is not ignored. `.git` exists but the glob skips it, and it isn't an ignored file anyway.
```

#### Observation

FAIL, reproduced in two runs (`noqa-session-a12`, `noqa-session-b-a12`, same event order).

1. `ttsr_triggered` naming `app-qa-evidence` precedes the glob with `gitignore: false` (expected).
2. The session's next attempt checks whether the rule applies: `test -f .omp/app-qa.json ...`. That command text matches the `ui-automation-credentials` condition `\bapp-qa\.json\b`, so a second `ttsr_triggered`, naming `ui-automation-credentials`, interrupts it (raw stream: the trigger fires during the tool-call delta that streams `app-qa.json`). The row requires no trigger naming `ui-automation-credentials`.
3. The retried turn runs the check together with `read skill://app-qa-drivers` (success, 145 lines) before the glob: the rule's paragraph "No search ... runs before the team skill `app-qa-drivers` ... have been read" applies "during app QA, or in a repository with `.omp/app-qa.json`", and the session read the skill before its check had returned. The row requires no read of `app-qa-drivers`.
4. The task completed: `.cache-notes` and `.local-settings` listed as ignored, confirmed with `git check-ignore -v`; no ignored file opened.

Cause: the `app-qa-evidence` body tells a session to decide by `.omp/app-qa.json`; the natural check names that file and loads the credentials rule, whose skill-read clause the session then satisfies pre-emptively. A design decision is needed (rule text or condition, or the row); not fixed in this attempt.
