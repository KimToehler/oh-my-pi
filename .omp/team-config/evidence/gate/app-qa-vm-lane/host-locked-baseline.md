# Host baseline with the screen locked

Run 2026-11-15 on the host (Apple silicon, macOS 27.2.1), deployed driver of head `606d44aad8`, scratch onara worktree `.worktrees/app-qa-vm-f1`, every command with `--host`. `"CGSSessionScreenIsLocked"=Yes` before and after each part. Home paths are written as `~`, `$HOST_TMP` is the host's `$TMPDIR`. Purpose: what the host alone can do while locked, the premise of the proposal's "Why".

## iOS (Maestro) on the host

A throwaway simulator (`xcrun simctl create aqvl-host-probe "iPhone 17 Pro"`, booted, the worktree's built `iosApp.app` installed and launched), then:

```
$ node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home --host --device 63446C47-F9BD-460E-895D-D92FC7735A43
credentials: ~/git/onara/.dev-credentials.env
device: 63446C47-F9BD-460E-895D-D92FC7735A43
root: $HOST_TMP/app-qa-flow-wW8uF5
out: $HOST_TMP/app-qa-out-6QEXaC
sweep: deleted out/2026-11-15_133754/f1-signin-home/commands.json
sweep: redacted debug/.maestro/tests/2026-11-15_133754/maestro.log
sweep: redacted out/2026-11-15_133754/f1-signin-home/logs/device-simulator.log
sweep: redacted out/2026-11-15_133754/f1-signin-home/logs/maestro.log
screenshot: $HOST_TMP/app-qa-out-6QEXaC/f1-home.png
PASS f1-signin-home 40.4s
[exit 0]
```

The screenshot (viewed, not kept) shows the signed-in home screen, not a lock or black frame. The simulator was deleted afterwards.

## Compose desktop (Spectre) on the host

The worktree's desktop distributable started with `java -cp <launcher cfg classpath> eu.onara.app.MainKt` in the worktree, then:

```
$ qa.mjs desktop attach --host                         [exit 0]  attach: pid=70596 session=pid-70596
$ qa.mjs desktop wait sign-in --timeout 60 --host      [exit 0]  wait: tag=sign-in count=1
$ qa.mjs desktop tap sign-in --host                    [exit 0]  tap: tag=sign-in
$ qa.mjs desktop wait home --timeout 90 --host         [exit 0]  wait: tag=home count=1
$ qa.mjs desktop capture home --out $HOST_TMP/aqvl-hostdesk-ur8ja0yc --host   [exit 1]
  … spectre-screencapture, --mode, stills, --source, window, --pid, 70596, --title-contains, Onara, … Spectre does not substitute a desktop crop, because a crop can include other windows that cover the target.
$ qa.mjs desktop detach --host                         [exit 0]
```

No file was written to the `--out` folder.

## Reading

- With the host locked, iOS flows on the host pass, screenshots included, and Spectre's tag-based input and tree queries work.
- Only the desktop window capture fails, and `preflight desktop` refuses up front (`FAIL screen: locked`, rows `cfg-v1` and `route-host`).
- So the VM lane is not needed for iOS or desktop input while locked; it is needed for desktop captures while locked, for running two worktrees' QA at once (the host serializes every flow under one host-wide lock), and for an isolated, freshly reset simulator and app per worktree.
