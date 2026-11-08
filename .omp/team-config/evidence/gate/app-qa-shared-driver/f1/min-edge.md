# F1 min-edge

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree `~/git/onara/.worktrees/qa-shared-f1`

## Commands and output

Driver state under the temporary directory before the row.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ find "${TMPDIR:-/tmp}/app-qa" 2>&1 | sort | while read -r p; do stat -f "%Sp %z %Sm %N" "$p"; done
drwx------ 96 Nov  8 14:39:05 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa
drwx------ 160 Nov  8 15:04:22 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions
-rw------- 197 Nov  8 15:21:46 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/2232988a363f7b96.json
-rw------- 208 Nov  8 15:02:55 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/dd69b8d8f71bbc55.json
-rw------- 206 Nov  8 15:04:22 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/e7c4acf968d3b37e.json
(exit 0)
```

A copy of the onara configuration with an extra top-level key.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ jq '. + {extra: true}' .omp/app-qa.json > /tmp/app-qa-impl/onara-extra.json && jq -c 'keys' /tmp/app-qa-impl/onara-extra.json
["android","backend","credentials","desktop","expect","extra","name","scan","schema"]
(exit 0)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios --config /tmp/app-qa-impl/onara-extra.json
config: /tmp/app-qa-impl/onara-extra.json: extra: unknown key
(exit 2)
```

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs desktop attach --config /tmp/app-qa-impl/onara-extra.json
config: /tmp/app-qa-impl/onara-extra.json: extra: unknown key
(exit 2)
```

Afterwards, the same listing.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ find "${TMPDIR:-/tmp}/app-qa" 2>&1 | sort | while read -r p; do stat -f "%Sp %z %Sm %N" "$p"; done
drwx------ 96 Nov  8 14:39:05 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa
drwx------ 160 Nov  8 15:04:22 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions
-rw------- 197 Nov  8 15:21:46 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/2232988a363f7b96.json
-rw------- 208 Nov  8 15:02:55 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/dd69b8d8f71bbc55.json
-rw------- 206 Nov  8 15:04:22 2026 /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T//app-qa/sessions/e7c4acf968d3b37e.json
(exit 0)
```

## Observation

With `--config` naming a file holding an extra top-level key, preflight ios and desktop attach each exited 2 with only the configuration line naming the file and the key; no check ran. The driver's state directory `$TMPDIR/app-qa` lists the same entries with the same modes, sizes and times before and after, so neither command wrote a session or lock.
