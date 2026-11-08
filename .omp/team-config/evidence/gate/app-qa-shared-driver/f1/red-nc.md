# F1 red-nc

Head: `ba01b61b706d23f3dad7587ff439357b54cac5d4` (oh-my-pi `feat/app-qa-shared-driver`); driver run from `~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs` as deployed from this head.

Surface: scratch onara worktree, iOS simulator `onara-f1`, backend on 8081

## Commands and output

Simulator keychain reset (the subflow's precondition). A scratch credentials file `/tmp/app-qa-impl/creds-wrong.env` holds account 1's username and a wrong password containing a quote, an ampersand and a backslash (written by a kernel script that prints nothing; only its keys shown); the scratch sign-in flow run with `--credentials` naming it.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cut -d= -f1 /tmp/app-qa-impl/creds-wrong.env; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios qa-f1/signin.yaml --credentials /tmp/app-qa-impl/creds-wrong.env
DEV_TEST_USERNAME
DEV_TEST_PASSWORD
credentials: /tmp/app-qa-impl/creds-wrong.env
device: 8A3D02EF-0395-4C1D-AA8C-0845639B1A7A
root: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-EKSQFk
out: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-out-TxO5Yi
sweep: deleted out/2026-11-08_163453/signin/commands.json
sweep: redacted debug/.maestro/tests/2026-11-08_163453/maestro.log
sweep: redacted out/2026-11-08_163453/signin/logs/device-simulator.log
sweep: redacted out/2026-11-08_163453/signin/logs/maestro.log
FAIL signin 71.8s: Assertion is false: id: home is visible
root kept: /var/folders/c6/rmmgm5s52vsc2_g434mnp_nm0000gn/T/app-qa-flow-EKSQFk
(exit 1)
```

Contents of the kept root.

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ cd "$TMPDIR"/app-qa-flow-EKSQFk && find . -type f | sort; find . -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*hierarchy*" \) | wc -l
./console.log
./debug/.maestro/tests/2026-11-08_163453/maestro.log
./out/2026-11-08_163453/signin/logs/device-simulator.log
./out/2026-11-08_163453/signin/logs/device-xctest.log
./out/2026-11-08_163453/signin/logs/maestro.log
./out/2026-11-08_163453/signin/manifest.json
./out/2026-11-08_163453/xctest_runner_2026-11-08_163454.log
./report.xml
       0
(exit 0)
```

`console.log` and `report.xml` scanned against the credentials the run used (the wrong-password file).

cwd `~/git/onara/.worktrees/qa-shared-f1`

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$TMPDIR"/app-qa-flow-EKSQFk/console.log --credentials /tmp/app-qa-impl/creds-wrong.env; echo "scan console exit $?"; node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs scan "$TMPDIR"/app-qa-flow-EKSQFk/report.xml --credentials /tmp/app-qa-impl/creds-wrong.env; echo "scan report exit $?"
scan console exit 0
scan report exit 0
credentials: /tmp/app-qa-impl/creds-wrong.env
credentials: /tmp/app-qa-impl/creds-wrong.env
(exit 0)
```

## Observation

Onara, iOS sign-in with account 1's username and a wrong password (containing a quote, an ampersand and a backslash) from a scratch credentials file: `FAIL signin ...: Assertion is false: id: home is visible`, `root kept:` printed, exit 1; no line of the output holds either value. The kept root holds `console.log`, `report.xml`, Maestro's text logs and `manifest.json`, no image or hierarchy (count 0). `console.log` and `report.xml` each scan clean (exit 0) against the run's credentials file; the QA lane also checked every kept file for the wrong password raw, JSON-escaped and XML-escaped (none found).
