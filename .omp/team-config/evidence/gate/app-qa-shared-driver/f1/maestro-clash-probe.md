# Maestro 2.12.1: two screenshots of one name leave one file

Probe for design D6, 2026-11-08, Maestro 2.12.1, weaver app on Android emulator `emulator-5554` (no credentials involved). Maestro run directly, with the arguments the shared driver passes, into a scratch directory `<scratch>`, from the scratch weaver worktree.

Flow `qa-f1/clash.yaml` and its subflow `qa-f1/sub-home.yaml`:

```yaml
appId: eu.weaver.app
---
- launchApp
- assertVisible: "Needs you"
- takeScreenshot: home
- runFlow: sub-home.yaml
---- sub-home.yaml
appId: eu.weaver.app
---
- takeScreenshot: home
```

Command: `maestro test --no-ansi --udid emulator-5554 --debug-output <scratch>/debug --test-output-dir <scratch>/out --format junit --output <scratch>/report.xml qa-f1/clash.yaml` (exit 0).

Every PNG below `<scratch>` afterwards (`find <scratch> -iname "*.png"`):

```
out/2026-11-08_131247/clash/takeScreenshot/home.png
```

Command-record entries with a screenshot artifact, and the `runFlowCommand` (`jq` over `out/*/clash/commands.json`):

```
{"command":"takeScreenshotCommand","path":"home","sourceDescription":null,"artifacts":[{"type":"TAKE_SCREENSHOT","path":"takeScreenshot/home.png"}],"sequenceNumber":4,"depth":0}
{"command":"runFlowCommand","path":null,"sourceDescription":"sub-home.yaml","artifacts":null,"sequenceNumber":5,"depth":0}
{"command":"takeScreenshotCommand","path":"home","sourceDescription":null,"artifacts":[{"type":"TAKE_SCREENSHOT","path":"takeScreenshot/home.png"}],"sequenceNumber":7,"depth":1}
```

Observation: both `takeScreenshot: home` calls (the flow at depth 0, the subflow at depth 1) were written to the one file `out/<run>/clash/takeScreenshot/home.png`, the second overwriting the first; only the command record holds both, each with its artifact path, sequence number and depth, the subflow named by the preceding `runFlowCommand`.

The same flow through the shared driver at oh-my-pi `cc62771944837a4add35e50f57cbffb4b4e5346e` (file-based manifest carried from onara's driver at `a6807335b`), F1 row `shot-clash` before the D6 fix, cwd `~/git/weaver/.worktrees/qa-shared-f1`:

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/clash.yaml --out /tmp/app-qa-impl/f1out/shot-clash
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-F3I7GT
out: /tmp/app-qa-impl/f1out/shot-clash
sweep: deleted out/2026-11-08_131228/clash/commands.json
screenshot: /tmp/app-qa-impl/f1out/shot-clash/home.png
PASS clash 1.7s
(exit 0)
```

It exported one `home.png` and printed `PASS clash`: the clash went undetected.
