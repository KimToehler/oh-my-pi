# F1 cap-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara and weaver worktrees, desktop

## Commands and output

Setup: detach the weaver session.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop detach
detach: no attached session for this worktree; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
(exit 2)
```

Setup: capture folder removed (`rm -rf /tmp/app-qa-impl/f1caps/cap-nc`), then one capture `home` in a new folder (onara, attached).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-nc/first
capture: /tmp/app-qa-impl/f1caps/cap-nc/first/home.png
capture: /tmp/app-qa-impl/f1caps/cap-nc/first/home.json
(exit 0)
```

Setup: a folder holding only a copy of `home.json` and one holding only a copy of `home.png`, both copied from the first capture (`cp -p`).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ mkdir /tmp/app-qa-impl/f1caps/cap-nc/json-only /tmp/app-qa-impl/f1caps/cap-nc/png-only && cp -p /tmp/app-qa-impl/f1caps/cap-nc/first/home.json /tmp/app-qa-impl/f1caps/cap-nc/json-only/ && cp -p /tmp/app-qa-impl/f1caps/cap-nc/first/home.png /tmp/app-qa-impl/f1caps/cap-nc/png-only/
(exit 0)
```

Folders before (size, modification time, name), and each file's SHA-1.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls -lRT /tmp/app-qa-impl/f1caps/cap-nc | awk '{ if (NF>=10) print $5, $6, $7, $8, $9, $10; else print }'; shasum /tmp/app-qa-impl/f1caps/cap-nc/*/*
total 0
128 Nov 8 16:12:35 2026 first
96 Nov 8 16:12:35 2026 json-only
96 Nov 8 16:12:35 2026 png-only

/tmp/app-qa-impl/f1caps/cap-nc/first:
total 48
3689 Nov 8 16:12:35 2026 home.json
17408 Nov 8 16:12:35 2026 home.png

/tmp/app-qa-impl/f1caps/cap-nc/json-only:
total 8
3689 Nov 8 16:12:35 2026 home.json

/tmp/app-qa-impl/f1caps/cap-nc/png-only:
total 40
17408 Nov 8 16:12:35 2026 home.png
09e0761a9e192f7f147c71ad501c33258a425aec  /tmp/app-qa-impl/f1caps/cap-nc/first/home.json
aca091b12c89f06299817567b58762c5a98e585f  /tmp/app-qa-impl/f1caps/cap-nc/first/home.png
09e0761a9e192f7f147c71ad501c33258a425aec  /tmp/app-qa-impl/f1caps/cap-nc/json-only/home.json
aca091b12c89f06299817567b58762c5a98e585f  /tmp/app-qa-impl/f1caps/cap-nc/png-only/home.png
(exit 0)
```

Weaver, not attached: capture into the folder.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-nc/first; echo "capture exit $?"
capture: no attached session for this worktree; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach
capture exit 2
(exit 0)
```

Onara: capture `home` again into the same folder.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-nc/first; echo "capture exit $?"
capture: home.png or home.json already exists in /tmp/app-qa-impl/f1caps/cap-nc/first
capture exit 2
(exit 0)
```

Onara: capture `home` into the folder holding only `home.json`.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-nc/json-only; echo "capture exit $?"
capture: home.png or home.json already exists in /tmp/app-qa-impl/f1caps/cap-nc/json-only
capture exit 2
(exit 0)
```

Onara: capture `home` into the folder holding only `home.png`.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop capture home --out /tmp/app-qa-impl/f1caps/cap-nc/png-only; echo "capture exit $?"
capture: home.png or home.json already exists in /tmp/app-qa-impl/f1caps/cap-nc/png-only
capture exit 2
(exit 0)
```

Folders after.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls -lRT /tmp/app-qa-impl/f1caps/cap-nc | awk '{ if (NF>=10) print $5, $6, $7, $8, $9, $10; else print }'; shasum /tmp/app-qa-impl/f1caps/cap-nc/*/*
total 0
128 Nov 8 16:12:35 2026 first
96 Nov 8 16:12:35 2026 json-only
96 Nov 8 16:12:35 2026 png-only

/tmp/app-qa-impl/f1caps/cap-nc/first:
total 48
3689 Nov 8 16:12:35 2026 home.json
17408 Nov 8 16:12:35 2026 home.png

/tmp/app-qa-impl/f1caps/cap-nc/json-only:
total 8
3689 Nov 8 16:12:35 2026 home.json

/tmp/app-qa-impl/f1caps/cap-nc/png-only:
total 40
17408 Nov 8 16:12:35 2026 home.png
09e0761a9e192f7f147c71ad501c33258a425aec  /tmp/app-qa-impl/f1caps/cap-nc/first/home.json
aca091b12c89f06299817567b58762c5a98e585f  /tmp/app-qa-impl/f1caps/cap-nc/first/home.png
09e0761a9e192f7f147c71ad501c33258a425aec  /tmp/app-qa-impl/f1caps/cap-nc/json-only/home.json
aca091b12c89f06299817567b58762c5a98e585f  /tmp/app-qa-impl/f1caps/cap-nc/png-only/home.png
(exit 0)
```

## Observation

Weaver capture without an attached session (its session was already detached by `min-happy`, so the setup detach itself exits 2): exit 2 naming the attach command. Onara capture `home` again into the folder that already holds `home.png` and `home.json`: exit 2 naming the existing files. Onara capture `home` into a folder holding only `home.json`, and into one holding only `home.png` (each a `cp -p` copy from the first capture): exit 2 each naming the existing file. The listing and the SHA-1 of every file before and after are identical (same entries, sizes, modification times to the second and bytes), so no file was written or replaced. The capture folder scanned clean; the onara app was showing its sign-in entry, so the image was not viewed.
