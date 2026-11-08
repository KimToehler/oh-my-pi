# F1 shot-clash

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, Android emulator `emulator-5554`

## Commands and output

A scratch flow and its subflow each taking `home`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat qa-f1/clash.yaml qa-f1/sub-home.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/clash.yaml --out /tmp/app-qa-impl/f1out/shot-clash
appId: eu.weaver.app
---
- launchApp
- assertVisible: "Needs you"
- takeScreenshot: home
- runFlow: sub-home.yaml
appId: eu.weaver.app
---
- takeScreenshot: home
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-KxbgL5
out: /tmp/app-qa-impl/f1out/shot-clash
sweep: deleted out/2026-11-08_202236/clash/commands.json
flow: screenshot home.png taken 2 times (out/2026-11-08_202236/clash/takeScreenshot/home.png step 4, out/2026-11-08_202236/clash/takeScreenshot/home.png step 7 in sub-home.yaml)
FAIL clash 3s: named screenshots not exported
(exit 1)
```

`--out` and the run roots afterwards.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ find /tmp/app-qa-impl/f1out/shot-clash | sort; ls -d "$TMPDIR"/app-qa-flow-* 2>&1
/tmp/app-qa-impl/f1out/shot-clash
/var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa-flow-ZKeWZa
(exit 0)
```

## Observation

Weaver, Android: a scratch flow takes `home`, then its subflow `sub-home.yaml` takes `home` again. Maestro passed and wrote both to one file (`takeScreenshot/home.png`); the driver counted two `home` screenshots from Maestro's command records and printed `home.png` taken 2 times with both sources and their steps (step 4 in the flow, step 7 in `sub-home.yaml`), then `FAIL clash ...: named screenshots not exported`, exit 1, no `PASS` line. `--out` exists and is empty (no `home.png`). The run root `KxbgL5` is gone afterwards (the listed `ZKeWZa` is the root `root-fail` kept), as for a run Maestro passed. The driver of commit `cc62771944`, which counted `takeScreenshot/` files instead of the command records, fails the clash tests of the suite (row `shot-nc`, `f1/cc6277-driver-log.txt`).
