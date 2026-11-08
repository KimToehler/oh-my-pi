# F1 root-fail

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, Android emulator

## Commands and output

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat qa-f1/absent.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/absent.yaml --out /tmp/app-qa-impl/f1out/root-fail
appId: eu.weaver.app
---
- launchApp
- assertVisible: "qa-f1 text that is never shown"
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-ZKeWZa
out: /tmp/app-qa-impl/f1out/root-fail
sweep: deleted out/2026-11-08_202212/absent/commands.json
FAIL absent 18.7s: Assertion is false: "qa-f1 text that is never shown" is visible
root kept: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-ZKeWZa
(exit 1)
```

Contents of the kept root.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cd "$TMPDIR"/app-qa-flow-ZKeWZa && find . -type f | sort; find . -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*hierarchy*" \) | wc -l; stat -f "%Sp" .
./console.log
./debug/.maestro/tests/2026-11-08_202212/maestro.log
./out/2026-11-08_202212/absent/logs/device-logcat.txt
./out/2026-11-08_202212/absent/logs/maestro.log
./out/2026-11-08_202212/absent/manifest.json
./report.xml
       0
drwx------
(exit 0)
```

Kept root scanned.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$TMPDIR"/app-qa-flow-ZKeWZa
(exit 0)
```

## Observation

Weaver flow asserting an absent text: `FAIL absent` with the assertion message, exit 1, and `root kept:` printed. The kept root (mode `drwx------`) holds `console.log` and `report.xml`, plus Maestro's own text logs (`maestro.log` twice, `device-logcat.txt`) and `manifest.json`; it holds no image and no hierarchy file (count 0), as the spec requires (root "holds the redacted console log and the report, and no image or hierarchy"). `qa.mjs scan` of the kept root: exit 0, clean.
