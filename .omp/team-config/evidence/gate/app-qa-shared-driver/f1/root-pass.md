# F1 root-pass

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree, Android emulator `emulator-5554`

## Commands and output

Scratch worktree status before.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ git status --porcelain
?? .omp/app-qa.json
?? qa-f1/
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ cat qa-f1/shot.yaml; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow android qa-f1/shot.yaml --out /tmp/app-qa-impl/f1out/root-pass
appId: eu.weaver.app
---
- launchApp
- assertVisible: "Needs you"
- takeScreenshot: home
device: emulator-5554
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-mwWAml
out: /tmp/app-qa-impl/f1out/root-pass
sweep: deleted out/2026-11-08_162049/shot/commands.json
screenshot: /tmp/app-qa-impl/f1out/root-pass/home.png
PASS shot 3.1s
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ stat -f "%z %Sm %N" /tmp/app-qa-impl/f1out/root-pass/*; ls -d "$TMPDIR"/app-qa-flow-* 2>&1 | head -3; git status --porcelain
165700 Nov  8 16:20:56 2026 /tmp/app-qa-impl/f1out/root-pass/home.png
ls: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa-flow-*: No such file or directory
?? .omp/app-qa.json
?? qa-f1/
(exit 0)
```

Every new entry of the temporary directory after the run.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls -1 "$TMPDIR" | sort > /tmp/app-qa-impl/tmp-after.txt; comm -13 /tmp/app-qa-impl/tmp-before.txt /tmp/app-qa-impl/tmp-after.txt
(exit 0)
```

## Observation

Weaver Android flow taking one named screenshot `home`: `PASS shot`, `home.png` exported into `--out` (viewed by the QA lane: the weaver app's Needs you screen), the run's root `app-qa-flow-mwWAml` gone afterwards (no `app-qa-flow-*` remains), `git status --porcelain` of the scratch worktree unchanged (only the untracked configuration and scratch flows that predate the run), and the temporary directory has no new entry after the run (`comm -13` of its listing before and after is empty).
