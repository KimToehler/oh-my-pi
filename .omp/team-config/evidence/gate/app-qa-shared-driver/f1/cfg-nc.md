# F1 cfg-nc

Head: `4601774ed7365d589e38f609e5d0df23c1fbf309` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch weaver worktree

## Commands and output

Driver state under the temporary directory before the row.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ find "${TMPDIR:-/tmp}/app-qa" 2>&1 | sort | while read -r p; do stat -f "%Sp %z %Sm %N" "$p"; done
drwx------ 96 Nov  8 18:13:50 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa
drwx------ 96 Nov  8 18:16:30 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions
-rw------- 197 Nov  8 18:12:00 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/2232988a363f7b96.json
(exit 0)
```

`desktop.mainClass` misspelled as `mainClas`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ grep -n mainClas .omp/app-qa.json
4:  "desktop": { "mainClas": "eu.weaver.app.shell.MainKt", "launchHint": "./gradlew :shell:run in app/" },
(exit 0)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: desktop.mainClas: unknown key
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: desktop.mainClass: missing
(exit 2)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: desktop.mainClas: unknown key
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: desktop.mainClass: missing
(exit 2)
```

The configuration file removed.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ ls .omp/; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight desktop
plans
rules
team-config
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: missing
(exit 2)
```

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
config: ~/git/weaver/.worktrees/qa-shared-f1/.omp/app-qa.json: missing
(exit 2)
```

Afterwards, the same listing.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ find "${TMPDIR:-/tmp}/app-qa" 2>&1 | sort | while read -r p; do stat -f "%Sp %z %Sm %N" "$p"; done
drwx------ 96 Nov  8 18:13:50 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa
drwx------ 96 Nov  8 18:16:30 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions
-rw------- 197 Nov  8 18:12:00 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/2232988a363f7b96.json
(exit 0)
```

## Observation

Misspelled `mainClas`: preflight desktop and desktop attach each exited 2 with only the configuration lines (the unknown key and the missing `desktop.mainClass`, both naming the file); no preflight check line and no attach output. With the file moved aside (`app-qa.json.off`) both exited 2 naming the missing file. The driver's state directory `$TMPDIR/app-qa` lists the same entries with the same modes, sizes and times before and after the row, so no command wrote a session or lock. Configuration restored afterwards.
