# F1 scan-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara and weaver worktrees, evidence scan

## Commands and output

`/tmp/app-qa-impl/scan/scan-nc` holds eight entries written by a kernel script that prints nothing: `acc2-password.log` (account 2's password), `token-only.log` (a synthetic JWT), `sentinel-only.log` (the configuration's sentinel word), `acc1-user-slash.log` (account 1's username between a slash and a space), `clean.log`, a clean file whose name holds account 2's password, a file named after the sentinel word plus `.log` holding the synthetic JWT, and a folder named after the sentinel word plus `-run` holding `run.log` with the synthetic JWT (names not listed here)

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ ls /tmp/app-qa-impl/scan/scan-nc | wc -l; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-nc
       8
/tmp/app-qa-impl/scan/scan-nc/[redacted]-run/run.log
/tmp/app-qa-impl/scan/scan-nc/[redacted].log
/tmp/app-qa-impl/scan/scan-nc/acc1-user-slash.log
/tmp/app-qa-impl/scan/scan-nc/acc2-password.log
/tmp/app-qa-impl/scan/scan-nc/named-[redacted].log
/tmp/app-qa-impl/scan/scan-nc/sentinel-only.log
/tmp/app-qa-impl/scan/scan-nc/token-only.log
credentials: /Users/[redacted]/git/onara/.dev-credentials.env
(exit 1)
```

Weaver, no `credentials` section: `/tmp/app-qa-impl/scan/scan-nc-weaver` holds `CANARY.log` and `CANARY-run/run.log`, each with the synthetic JWT; `--config` names a scratch copy of weaver's configuration that adds `scan.sentinels` `["CANARY"]`.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ jq -c "{credentials, scan}" /tmp/app-qa-impl/weaver-canary.json; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-nc-weaver --config /tmp/app-qa-impl/weaver-canary.json > /tmp/app-qa-impl/scan-w.out 2> /tmp/app-qa-impl/scan-w.err; echo "scan exit $?"; cat /tmp/app-qa-impl/scan-w.out /tmp/app-qa-impl/scan-w.err; grep -c CANARY /tmp/app-qa-impl/scan-w.out /tmp/app-qa-impl/scan-w.err
{"credentials":null,"scan":{"sentinels":["CANARY"]}}
scan exit 1
/tmp/app-qa-impl/scan/scan-nc-weaver/[redacted]-run/run.log
/tmp/app-qa-impl/scan/scan-nc-weaver/[redacted].log
/tmp/app-qa-impl/scan-w.out:0
/tmp/app-qa-impl/scan-w.err:0
(exit 1)
```

Weaver: `/tmp/app-qa-impl/scan/scan-links` holds `clean.log` and `latest.log`, a symbolic link to `/tmp/app-qa-impl/scan/outside/secret.log` (the synthetic JWT); `stat -f %HT` prints entry types only.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ stat -f "%HT %N" /tmp/app-qa-impl/scan/scan-links/*; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-links; echo "scan exit $?"
Regular File /tmp/app-qa-impl/scan/scan-links/clean.log
Symbolic Link /tmp/app-qa-impl/scan/scan-links/latest.log
scan: not scanned: /tmp/app-qa-impl/scan/scan-links/latest.log
scan exit 2
(exit 0)
```

Weaver: the scan of the link itself.

cwd `~/git/weaver/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan /tmp/app-qa-impl/scan/scan-links/latest.log; echo "scan exit $?"
scan: not scanned: /tmp/app-qa-impl/scan/scan-links/latest.log
scan exit 2
(exit 0)
```

## Test part

`f1/qa-test-log.txt` (the full suite on this head) passes `scan: a FIFO is reported as not scanned without being opened`, `scan: a symbolic link is not followed but reported as not scanned`, and `scan: a sentinel in a matching file's name or folder is redacted (foreign)` and `(minimal)`. `f1/broken-copies-log.txt` shows `scan-contents-only`, `scan-skips-links-silently`, `scan-follows-links`, `scan-paths-without-sentinels` and `scan-sentinels-redacted-only-with-credentials` each caught by the scan tests.

## Observation

Onara: every one of the seven flagged entries is printed (account 2's password, token only, sentinel only, account 1's username between a slash and a space, the clean file whose name holds account 2's password as `named-[redacted].log`, and the two token-bearing entries named after the sentinel word as `[redacted].log` and `[redacted]-run/run.log`); `clean.log` is not; exit 1. No configured value and no sentinel word appears in the output (the home path's username prints as `[redacted]`).

Weaver without a `credentials` section, with a scratch configuration adding the sentinel `CANARY`: both token-bearing entries are printed as `[redacted].log` and `[redacted]-run/run.log`, exit 1, and `grep -c CANARY` counts 0 in stdout and in stderr (that `grep` makes the step's own exit 1).

Weaver, a folder holding `clean.log` and the symbolic link `latest.log` to a token-bearing file outside it: the scan prints `scan: not scanned:` with the link's path and exits 2; scanning the link itself does the same. The token appears in neither output, and the link's target was not followed.

The FIFO case and the broken copies of task 1.8 (contents only, links skipped silently, links followed, paths printed without the sentinels, sentinels redacted only with credentials) are covered by the suite: see the test part.
