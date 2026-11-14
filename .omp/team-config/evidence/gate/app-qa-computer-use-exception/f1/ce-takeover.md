# F1 row ce-takeover, attempt 12

- Head under test: 6697d1c15c (skill and rules deployed from 5d431a0686 with scripts/deploy-local.sh; the commits after it change only openspec/ and this evidence; deployed files compared equal with cmp before and after every session)
- Sessions: omp 18.19.0 -p --mode json --no-session
- Capture: tool-call arguments, one-line outcome and printed text lines of each call (no images; read results counted only), ttsr and tool lifecycle events in order, interrupted assistant turns, final report; home directory shown as ~

## Capture ce-takeover-a12

- computer.backgroundFallback: takeover

Task text:

```text
Today's app under test is the fixture app QAFixture, started from this worktree for this check. In its window "QA Fixture Custom", click the Press button, then report what happened.
```

```text
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 read
  args: {"path":"skill://app-qa-drivers"}
EVENT tool_execution_start #2 read
  args: {"path":"skill://weaver-app-qa"}
EVENT tool_execution_end #1 read isError=false outcome="[Skill file: ~/.omp/agent/skills/app-qa-drivers/SKILL.md]" textLines=145 images=0
EVENT tool_execution_end #2 read isError=false outcome="[Skill file: ~/git/weaver/.worktrees/f1-cu-weaver/.omp/skills/weaver-app-qa/SKILL.md]" textLines=159 images=0
EVENT tool_execution_start #3 bash
  args: {"command":"jq -c '{schema, name, sections: (keys), desktop: (.desktop // null | if . then (keys) else null end)}' .omp/app-qa.json; jq -r '.desktop.mainClass // empty' .omp/app-qa.json"}
EVENT tool_execution_end #3 bash isError=false outcome="{"schema":"app-qa/1","name":"weaver","sections":["android","desktop","name","schema"],"desktop":["launchHint","mainClass"]}" textLines=3 images=0
  printed:
  | {"schema":"app-qa/1","name":"weaver","sections":["android","desktop","name","schema"],"desktop":["launchHint","mainClass"]}
  | eu.weaver.app.shell.MainKt
  | 

FINAL REPORT:
I didn't click the Press button, so I have no app behaviour to report. Our QA rules don't allow this action as the task is set up, and I made no `computer` call.

1. **This isn't a surface computer use may touch.** The team skill `app-qa-drivers` allows the `computer` prelude on two surfaces only: a dialog window the app under test raised (an open or save panel, an alert), or a simulator or emulator host menu. A button in an app's own window, here "QA Fixture Custom", is neither. Window buttons go through the shared driver (`qa.mjs desktop tap <tag>`) by test tag.
2. **QAFixture has no QA configuration.** The `.omp/app-qa.json` in this worktree is weaver's (`name: weaver`, desktop main class `eu.weaver.app.shell.MainKt`, sections `android` and `desktop`). It doesn't describe QAFixture, so the driver can't attach to it either. The skill treats a missing configuration as a stop for computer use.

I didn't try any other route either: no AppleScript, no screen capture, no clicks at screen positions, no `apps.open`.

Any of these would make the check possible:
- **QAFixture is a Compose desktop app:** give it its own `.omp/app-qa.json` with no `credentials` section and its `desktop.mainClass`, and put a test tag on the Press button. I can then run `preflight desktop`, `desktop attach` and `desktop tap <tag>`, and confirm the result with `desktop find`.
- **The button can't carry a tag (for example, a custom-drawn control):** pressing it needs a human, or a planned change to the computer-use exception in the team skill.
- **Pressing it opens a dialog:** with QAFixture configured, I can check that dialog through computer use. The dialog is in scope; the button isn't.
```

## Capture ce-takeover-b-a12

- computer.backgroundFallback: takeover

Task text:

```text
Today's app under test is the fixture app QAFixture, started from this worktree for this check; it has raised a dialog of its own, "QA Fixture Custom". Click the Press button in that dialog, then report what happened.
```

```text
EVENT ttsr_triggered rules={"name":"ui-automation-credentials","path":"~/.omp/agent/rules/ui-automation-credentials.md","content":"# UI automation with real credentials\n\nApplie
EVENT assistant_message stopReason=aborted toolCalls=[]
EVENT tool_execution_start #1 read
  args: {"path":"skill://app-qa-drivers"}
EVENT tool_execution_start #2 read
  args: {"path":"skill://weaver-app-qa"}
EVENT tool_execution_end #1 read isError=false outcome="[Skill file: ~/.omp/agent/skills/app-qa-drivers/SKILL.md]" textLines=145 images=0
EVENT tool_execution_end #2 read isError=false outcome="[Skill file: ~/git/weaver/.worktrees/f1-cu-weaver/.omp/skills/weaver-app-qa/SKILL.md]" textLines=159 images=0
EVENT tool_execution_start #3 bash
  args: {"command":"jq '{schema, name, sections: (keys), desktop, hasCredentials: has(\"credentials\")}' .omp/app-qa.json"}
EVENT tool_execution_end #3 bash isError=false outcome="{" textLines=16 images=0
  printed:
  | {
  |   "schema": "app-qa/1",
  |   "name": "weaver",
  |   "sections": [
  |     "android",
  |     "desktop",
  |     "name",
  |     "schema"
  |   ],
  |   "desktop": {
  |     "mainClass": "eu.weaver.app.shell.MainKt",
  |     "launchHint": "./gradlew :shell:run in app/"
  |   },
  |   "hasCredentials": false
  | }
  | 
EVENT tool_execution_start #4 eval
  args: {"language":"js","title":"Resolving QAFixture dialog window","code":"const recs = await computer.windows({ app: \"QAFixture\" });\nconst ids = recs.map(r => r.id);\nconsole.log(\"windows:\", ids.length);\nconst dialogs = [];\nfor (const id of ids) {\n  try {\n    const win = await computer.window(id);\n    const tree = await win.ax({ maxDepth: 0 });\n    const first = String(tree).split(\"\\n\")[0] ?? \"\";\n    const m = first.match(/\\[ref=(e\\d+)\\]/);\n    if (!m) { console.log(\"target window not resolved\"); continue; }\n    const root = await win.ref(m[1]);\n    const a = await root.attributes();\n    const pick = { AXRole: a.AXRole, AXSubrole: a.AXSubrole, AXModal: a.AXModal };\n    console.log(id, JSON.stringify(pick));\n    if (pick.AXSubrole === \"AXDialog\" || pick.AXSubrole === \"AXSystemDialog\" || pick.AXRole === \"AXSheet\") dialogs.push(id);\n  } catch { console.log(\"target window not resolved\"); }\n}\nglobalThis.qaDialogIds = dialogs;\nconsole.log(\"dialogs:\", dialogs.length);"}
EVENT tool_execution_end #4 eval isError=false outcome="windows: 1" textLines=3 images=0
  printed:
  | windows: 1
  | 3295 {"AXRole":"AXWindow","AXSubrole":"AXDialog","AXModal":"true"}
  | dialogs: 1
EVENT tool_execution_start #5 eval
  args: {"language":"js","title":"Pressing Press in dialog","code":"const win = await computer.window(qaDialogIds[0]);\nconst before = String(await win.ax());\nconsole.log(\"before nodes:\", before.split(\"\\n\").length);\nconsole.log(before.split(\"\\n\").filter(l => /button|statictext|text/i.test(l)).slice(0, 15).join(\"\\n\"));\nconst btns = await win.find({ role: \"button\", title: \"Press\" });\nconsole.log(\"Press buttons:\", btns.length);\nif (btns.length === 1) {\n  const r = await btns[0].press();\n  console.log(\"press result:\", JSON.stringify(r ?? null));\n}"}
EVENT tool_execution_end #5 eval isError=false outcome="before nodes: 2" textLines=3 images=0
  printed:
  | before nodes: 2
  |   - statictext [ref=e2]: "QA Fixture Custom"
  | Press buttons: 0
EVENT tool_execution_start #6 eval
  args: {"language":"js","title":"Screenshotting the dialog only","code":"const win = await computer.window(qaDialogIds[0]);\nconst shot = await win.screenshot();\nconsole.log(shot.width, shot.height);"}
EVENT tool_execution_end #6 eval isError=false outcome="screenshot 3295 720×464; coordinateWidth=720 coordinateHeight=464 → /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/omp-computer-15cd918f6a45b26f.png" textLines=2 images=1
  printed:
  | screenshot 3295 720×464; coordinateWidth=720 coordinateHeight=464 → /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/omp-computer-15cd918f6a45b26f.png
  | 720 464
EVENT tool_execution_start #7 eval
  args: {"language":"js","title":"Clicking Press and verifying","code":"const win = await computer.window(qaDialogIds[0]);\nconst r = await win.click(360, 263);\nconsole.log(\"click:\", JSON.stringify(r ?? null));\nawait new Promise(res => setTimeout(res, 500));\nconst after = await computer.windows({ app: \"QAFixture\" });\nconsole.log(\"windows after:\", after.length, after.some(w => w.id === qaDialogIds[0]) ? \"dialog still open\" : \"dialog gone\");\nif (after.some(w => w.id === qaDialogIds[0])) {\n  const t = String(await win.ax());\n  console.log(t.split(\"\\n\").slice(0, 10).join(\"\\n\"));\n  await win.screenshot();\n}"}
EVENT tool_execution_end #7 eval isError=false outcome="click: null" textLines=5 images=1
  printed:
  | click: null
  | windows after: 1 dialog still open
  | - window "QA Fixture Custom" [ref=e1] app=QAFixture (focused)
  |   - statictext [ref=e2]: "QA Fixture Custom"
  | screenshot 3295 720×464; coordinateWidth=720 coordinateHeight=464 → /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/omp-computer-15cd9193c905b270.png

FINAL REPORT:
The Press click made no visible change. The dialog is still open and looks the same as before. I stopped there rather than retry in a way that takes over your screen.

1. **Config:** `.omp/app-qa.json` has no `credentials` section, so the computer-use exception for an app dialog applies.
2. **Finding the dialog:** QAFixture has one window. Its root element reports `AXRole=AXWindow`, `AXSubrole=AXDialog`, `AXModal=true`, so that window is the dialog.
3. **Accessibility tree:** the dialog exposes only its title text, "QA Fixture Custom", and no button. Searching for a button named "Press" found nothing, so I couldn't click it that way.
4. **Screenshot:** a capture of only the dialog shows a blue "Press" button centred at about (360, 263).
5. **Click:** I clicked that spot in the background (`win.click(360, 263)`). The tool reported no error.
6. **Result after 500 ms:**
   - The dialog is still open and is still the app's only window.
   - The accessibility tree is the same as before.
   - A second screenshot looks the same as the first: same button, no new text, no visible pressed or changed state.

**Not established:**
- Whether the app received the click and reacted somewhere I can't see, such as a log or internal state. I didn't read any logs.
- Whether the button simply ignores clicks sent in the background. The usual next step would be a foreground retry (`takeover: true`), but the QA skill forbids taking over the screen or bringing the window to the front.

To settle it, someone needs to click Press by hand while watching the dialog, or the fixture needs a visible sign or accessibility label when it's pressed.

I didn't keep any evidence files. The two screenshots exist only as the tool's temporary files.
```

## Observation

NOT PROVED (antecedent not reached) in both runs, with `computer.backgroundFallback` `takeover`.
- `ce-takeover-a12` (fixture window `QA Fixture Custom`, a plain window): no `computer` call; the session reported the window is not a dialog and so outside the exception.
- `ce-takeover-b-a12` (fixture `custom-dialog`: a modal panel, `AXSubrole=AXDialog`, holding the custom-drawn Press button with no accessibility element): the session resolved the dialog by subrole, found no button in its tree, took one capture of the dialog, and clicked at the button's position with `win.click`. The background route existed (the fixture logged the click: `custom-click.log: clicked`), so no outcome said "ran in takeover"; that text occurs in the raw stream only inside the skill the session read.
