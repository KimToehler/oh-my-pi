# stage-nc

Run 2026-11-15T19:50:30+01:00 on head `8f119544403ccba950c33c3697143895166bf8ee` (deployed). Home paths are written as `~` (the host user name is also a dev-account username, which the evidence scan flags as a whole word).

## Commands and output

`$HOST_TMP` is the host's `$TMPDIR`.

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm down
vm down: deleted app-qa-slot-2, slot 2 is free
[exit 0]
```

Appended a type error to `app_kmp/shared/src/commonMain/kotlin/eu/onara/app/AppRoot.kt` in `app-qa-vm-f1c` (no lease after the `vm down` above): `private val f1StageNcCompileError: Int = "not an int"`.

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=13958 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
> Task :platform:downloadKotlinNativeDistribution UP-TO-DATE
> Task :shared:kmpPartiallyResolvedDependenciesChecker
> Task :shared:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :shared:downloadKotlinNativeDistribution UP-TO-DATE
> Task :shared:generateBuildInfo UP-TO-DATE

> Task :shared:compileKotlinIosSimulatorArm64 FAILED
/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c/app_kmp/shared/src/commonMain/kotlin/eu/onara/app/AppRoot.kt:81:40: error: Initializer type mismatch: expected 'Int', actual 'String'.
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors

[Incubating] Problems report is available at: file:///Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1c/app_kmp/build/reports/problems/problems-report.html

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':shared:compileKotlinIosSimulatorArm64' (registered in build file 'shared/build.gradle.kts').
> Compilation finished with errors

* Try:
> Run with --stacktrace option to get the stack trace.
> Run with --info or --debug option to get more log output.
> Run with --scan to get full insights from a Build Scan (powered by Develocity).
> Get more help at https://help.gradle.org.

Deprecated Gradle features were used in this build, making it incompatible with Gradle 10.

You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.

For more on this, please refer to https://docs.gradle.org/9.6.1/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.

BUILD FAILED in 29s
16 actionable tasks: 6 executed, 10 up-to-date
note: Using codesigning identity override: -
note: Run script build phase 'Compile Kotlin Framework' will be run during every build because the option to run the script phase "Based on dependency analysis" is unchecked. (in target 'iosApp' from project 'iosApp')
** BUILD FAILED **

vm up: ios build exited 65
[exit 2]
```

took 42 s

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=13958 holder=none busy=none last used 1 min ago
slot 2: free
[exit 0]
```

`lume ls` names before: ["app-qa-build","app-qa-golden","app-qa-slot-1"]; after: ["app-qa-build","app-qa-golden","app-qa-slot-1"].

Type error removed again in `app-qa-vm-f1c`; its `.omp/app-qa.json` `vm.ios.artifact` pointed at `.../Debug-iphonesimulator/missing.app`.

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
2026-11-15 19:24:52.244 xcodebuild[36084:35895322] [MT] IDESchemeActionsInvocationRecord: Device <DVTiOSDeviceSimulatorPlaceholder: 0x7bcbd59f40 (Any iOS Simulator Device | undefined_arch)> is missing operatingSystemVersion, operatingSystemVersionWithBuildNumber.
vm up: ios build left no app_kmp/iosApp/build/Build/Products/Debug-iphonesimulator/missing.app
[exit 2]
```

took 12 s

```
$ (cwd .worktrees/app-qa-vm-f1c) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=ios,desktop forward=13958 holder=none busy=none last used 1 min ago
slot 2: free
[exit 0]
```

Same type error appended to `AppRoot.kt` in `app-qa-vm-f1` (lease with `ios` and `desktop` staged).

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
> Task :platform:downloadKotlinNativeDistribution UP-TO-DATE
> Task :shared:kmpPartiallyResolvedDependenciesChecker
> Task :shared:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :shared:downloadKotlinNativeDistribution UP-TO-DATE
> Task :shared:generateBuildInfo UP-TO-DATE

> Task :shared:compileKotlinIosSimulatorArm64 FAILED
/Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/app_kmp/shared/src/commonMain/kotlin/eu/onara/app/AppRoot.kt:81:40: error: Initializer type mismatch: expected 'Int', actual 'String'.
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors
error: Compilation finished with errors

[Incubating] Problems report is available at: file:///Users/[redacted]/git/onara/.worktrees/app-qa-vm-f1/app_kmp/build/reports/problems/problems-report.html

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':shared:compileKotlinIosSimulatorArm64' (registered in build file 'shared/build.gradle.kts').
> Compilation finished with errors

* Try:
> Run with --stacktrace option to get the stack trace.
> Run with --info or --debug option to get more log output.
> Run with --scan to get full insights from a Build Scan (powered by Develocity).
> Get more help at https://help.gradle.org.

Deprecated Gradle features were used in this build, making it incompatible with Gradle 10.

You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.

For more on this, please refer to https://docs.gradle.org/9.6.1/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.

BUILD FAILED in 8s
16 actionable tasks: 6 executed, 10 up-to-date
note: Using codesigning identity override: -
note: Run script build phase 'Compile Kotlin Framework' will be run during every build because the option to run the script phase "Based on dependency analysis" is unchecked. (in target 'iosApp' from project 'iosApp')
** BUILD FAILED **

vm up: ios build exited 65
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs preflight ios
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs flow ios app_kmp/maestro/f1-signin-home.yaml --account 1 --expect home
lane: this worktree's lease did not stage ios; run node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm up ios
[exit 2]
```

```
$ (cwd .worktrees/app-qa-vm-f1) node ~/.omp/agent/skills/app-qa-drivers/scripts/qa.mjs vm status
slot 1: ready worktree=~/git/onara/.worktrees/app-qa-vm-f1 clone=app-qa-slot-1 targets=none forward=13958 holder=none busy=none last used less than a minute ago
slot 2: free
[exit 0]
```

```
$ (cwd .worktrees/app-qa-vm-f1) lume ls --format json 2>/dev/null | awk 'f||/^\[[ \t]*([{]|\]|$)/{f=1} f' | jq -c '[.[].name]'
["app-qa-build","app-qa-golden","app-qa-slot-1"]
[exit 0]
```

Both edits and the config change reverted; `git status --short` of both worktrees shows only the F1 scratch changes.

### Test controls (broken copies through `QA_UNDER_TEST`, run by `/tmp/aqvl/controls/ctl2.mjs` against the driver of head `8f11954440` (the driver files are unchanged at the current head), `/tmp/aqvl/controls/stage-nc.md`)

#### Case: a changed artifact after the snapshot

Covering test(s), verbatim:
- `stage: snapshot - an artifact rewritten after the snapshot leaves the guest with the snapshot's bytes`

##### Control 1

- Broken line(s):
  - qa.mjs:1991
    - before: `{ cwd: join(slotPath(n), 'stage', target), paths: [ctx.config.vm[target].artifact] }`
    - after: `{ cwd: ctx.root, paths: [ctx.config.vm[target].artifact] }`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-stage-nc-1/qa.mjs node --test --test-name-pattern='stage: snapshot' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1659:1
✖ stage: snapshot - an artifact rewritten after the snapshot leaves the guest with the snapshot's bytes (6949.357958ms)
  AssertionError [ERR_ASSERTION]: ssh: settle: load 1.00 below 8 CPUs after 0 s
  vm up: starting ios in the guest failed
  ssh: warning: templates not found in /private$HOST_TMP/T/qa-test-PF73AB/guest/share/git-core/templates
  ssh: start-target: cannot read CFBundleIdentifier from /private$HOST_TMP/T/qa-test-PF73AB/guest/home/work/onara/build/App.app/Info.plist
  
  
  2 !== 0
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1670:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 2,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

#### Case: a credential printed by the build

Covering test(s), verbatim:
- `stage: redact - a build printing account 1's password prints [redacted], and only the two credentials files hold it afterwards`

Related but not controlled here: the two 'stage: memory' tests (build output never written to a file) also print the password from the build; they guard a different line (no file writes), and no single driver line disabling them was broken. Two layers print the build tail redacted: the tail buffer and say(); each alone leaves the test passing (first attempt with only the tail line: pass 1, fail 0), so the control breaks both.

##### Control 1

- Broken line(s):
  - qa.mjs:1882
    - before: `tail.push(redact(line, redactValues));`
    - after: `tail.push(line);`
  - qa.mjs:430
    - before: `const say = (line) => process.stdout.write(redact(line, redactValues) + '\n');`
    - after: `const say = (line) => process.stdout.write(line + '\n');`
- Command (run from the worktree root; the copy is removed afterwards):
  `QA_UNDER_TEST=/tmp/aqvl/controls-head/broken-stage-nc-2/qa.mjs node --test --test-name-pattern='stage: redact' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`
- Broken copy: tests 1, pass 0, fail 1, exit 1 => control FAILED as required
- Failing assertion (trimmed):
```
✖ failing tests:

test at team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1559:1
✖ stage: redact - a build printing account 1's password prints [redacted], and only the two credentials files hold it afterwards (8240.9875ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /login with \[redacted\] and \[redacted\]/. Input:
  
  'compiling\n' +
    'login with Synthetic-Pw-One-7f3a and qa-user-one@example.test\n' +
    'vm up: ios build exited 1\n'
  
      at TestContext.<anonymous> (file://~/git/oh-my-pi/.worktrees/app-qa-vm-lane/team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs:1567:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'compiling\nlogin with Synthetic-Pw-One-7f3a and qa-user-one@example.test\nvm up: ios build exited 1\n',
    expected: /login with \[redacted\] and \[redacted\]/,
    operator: 'match',
    diff: 'simple'
  }

```
- Unbroken driver, same pattern (QA_UNDER_TEST unset): tests 1, pass 1, fail 0, exit 0

## Observation

Without a lease, a compile error makes `vm up ios` print the build's tail and exit 2 with no slot taken and `lume ls` unchanged; a missing artifact path exits 2 (`build left no ...missing.app`). With a staged lease, the same compile error exits 2, routed `preflight ios` and the sign-in flow each exit 2 naming `vm up ios`, and `vm status` shows the lease with `targets=none`. The changed artifact after the snapshot and the credential printed by the build are covered by named tests with failing broken-copy controls; they pass on the real driver.

## Verdict

PASS
