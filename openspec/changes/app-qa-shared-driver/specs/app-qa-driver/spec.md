# Spec Delta

## Purpose

Defines the shared QA driver that agents and developers run inside any app repository to drive a Compose Multiplatform app on the desktop, the iOS simulator and the Android emulator: one per-repository configuration, readiness checks, tag-addressed desktop control, Maestro flow runs with optional dev-account sign-in, the evidence scan, and the team skill that routes agents to it.

## ADDED Requirements

### Requirement: The driver runs only with a valid configuration of the current repository
Every command SHALL read the configuration at `.omp/app-qa.json` in the root of the repository holding the working directory, or the file `--config` names. It SHALL stop with exit 2 before any other action, naming the file and the cause, when the file is missing or unreadable, is not JSON, carries a schema id other than the one the driver supports, holds a key the schema does not define, or lacks a required value.

#### Scenario: Run from a subdirectory of a worktree
- **WHEN** preflight runs in a subdirectory of a linked worktree whose root holds a valid configuration
- **THEN** it uses that worktree's configuration and prints its checks

#### Scenario: Newer configuration than the driver
- **WHEN** the configuration's schema id is `app-qa/2` and the driver supports `app-qa/1`
- **THEN** the command prints the file, both schema ids and that the team config must be redeployed, and exits 2

#### Scenario: Negative control
- **WHEN** the configuration misspells a key (for example `mainClas`), names an unknown schema id, or is missing
- **THEN** any command doing more than refusing with exit 2, or running with a default in place of the missing or misspelled value, MUST fail this requirement

### Requirement: Preflight reports every readiness check and fails when one fails
Preflight SHALL check one target and print one line per check with its result and, on failure, its fix. Desktop checks the desktop driver's version, its screen-capture permission and the screen lock; iOS and Android check the flow driver's version, the platform tools and one usable device. When the configuration has a backend, every target also checks its health. It SHALL exit 0 only when every printed check passes, naming the install of the tested tool when one is missing or at another version.

#### Scenario: Desktop ready without a backend
- **WHEN** the configuration has no backend, the desktop driver is installed at the tested version with its permission granted and the screen is unlocked
- **THEN** preflight for desktop prints three passing lines, no backend line, and exits 0

#### Scenario: Backend on another port
- **WHEN** the configuration has a backend, its port property is 8080, the backend runs on 8081 and preflight is given port 8081
- **THEN** the health line targets port 8081 and passes

#### Scenario: Negative control
- **WHEN** the screen is locked, the permission is denied, a driver or platform tool is missing or at another version, no single usable device exists, or a configured backend is down or answers a status other than `UP`
- **THEN** preflight exiting 0, or printing a passing line for the failed check, MUST fail this requirement

### Requirement: Desktop attach selects the one running JVM of the configured app
Desktop attach SHALL attach to the one running JVM whose main class is the configuration's and whose working directory resolves to the current worktree, not merely lies below its root, and keep the session for later desktop commands of the worktree. With no such JVM it SHALL print the configured launch hint, and with several it SHALL list their process ids; both exit 2 without attaching. An explicit process id SHALL select only one of those JVMs.

#### Scenario: Two repositories' apps running
- **WHEN** the desktop apps of two repositories run and attach is called in each repository
- **THEN** each attaches to its own app, and a tap in one repository acts on that repository's app only

#### Scenario: Same app in two worktrees
- **WHEN** two worktrees of one repository each run the app with the same main class and attach is called in each
- **THEN** each attaches to the JVM started in its own worktree

#### Scenario: App not running
- **WHEN** attach is called while the configured app is not running
- **THEN** it prints the configured launch hint and exits 2

#### Scenario: Negative control
- **WHEN** attach is called while two JVMs of the configured main class run in the worktree, only another repository's app runs, only another worktree's JVM of the configured main class runs (a linked worktree below the main checkout included), or an explicit process id names a JVM of another worktree
- **THEN** attaching to any of them, or exiting 0, MUST fail this requirement

### Requirement: A desktop session belongs to one worktree and one configuration
A desktop session SHALL serve only the desktop commands of the worktree that attached it, with the configuration file and main class it was attached with, and attach or detach SHALL never change the session of another worktree or repository, whatever their configurations' names. A desktop command from that worktree with another configuration file or main class SHALL exit 2 asking for a new attach, without acting on the app or the session.

#### Scenario: Same configuration name in two worktrees
- **WHEN** two worktrees whose configurations share one `name` attach to their own apps, and a tap and a detach run in the first
- **THEN** the tap acts on the first worktree's app, and the second worktree's later tap still acts on its own app

#### Scenario: Negative control
- **WHEN** a desktop command runs with `--config` naming another configuration than the one attached with, or after `desktop.mainClass` changed in the configuration file attached with, or a detach in one worktree runs while another worktree with the same configuration name is attached
- **THEN** acting on an app, changing either session, or exiting 0 for the mismatched command MUST fail this requirement

### Requirement: Desktop actions address nodes by test tag
Desktop tap, type and find SHALL take a Compose test tag and act on, or read, the one node of the attached app that carries it at the time of the call. When no node or several carry the tag, they SHALL act on nothing, name the tag and the match count, and exit non-zero. Desktop wait SHALL exit 0 once exactly one node carries the tag, and non-zero with the tag and last count when its timeout passes first.

#### Scenario: Navigate by tag
- **WHEN** a screen shows one node tagged `sign-in`, tap is called with `sign-in`, then wait with `home`
- **THEN** the button is clicked, the wait returns once the `home` node exists, and both commands exit 0

#### Scenario: Negative control
- **WHEN** tap is called with a tag no node carries, or two nodes carry, or wait is called with a tag two nodes carry
- **THEN** clicking any node, or exiting 0, MUST fail this requirement

### Requirement: Desktop find reports one node's state in one line
Desktop find SHALL print one line for the tagged node: the tag, the match count, whether it is enabled and focused, and the length of its text. Given an expected text, it SHALL exit 0 only when the node's text equals it exactly. It SHALL never print the node's text, the semantics tree or another node's data.

#### Scenario: Typed field
- **WHEN** a field tagged `chat-input` holds `Add a health endpoint` and find is called with `chat-input` and that expected text
- **THEN** it prints one line with match count 1, enabled, text length 21 and equality true, and exits 0

#### Scenario: Negative control
- **WHEN** find is called with an expected text that differs from the node's text, or its output holds the text or more than the one node line
- **THEN** exiting 0, or printing the text or another node's data, MUST fail this requirement

### Requirement: Desktop capture saves the attached app window
Desktop capture SHALL write a PNG of the attached app's window and its semantics JSON under the given name into the given directory and print both paths. It SHALL refuse, writing nothing, when either file already exists. Without an attached session it SHALL write nothing and exit non-zero.

#### Scenario: Screen capture
- **WHEN** the app shows a screen and capture is called with name `home` and an output directory
- **THEN** the directory holds `home.png`, showing that screen, and `home.json`, and the command exits 0

#### Scenario: Negative control
- **WHEN** capture is called with no attached session, or with a name whose PNG already exists in the directory
- **THEN** writing or replacing a file, or exiting 0, MUST fail this requirement

### Requirement: Desktop typing succeeds only when the field holds the intended text
Desktop type SHALL focus the tagged text field, replace its content with the given text and read the field's editable text back. It SHALL exit 0 only when that text equals the intended text exactly; otherwise it SHALL exit non-zero and report the lengths of the expected and the actual text, never the texts.

#### Scenario: Exact text over a prefilled field
- **WHEN** a field tagged `chat-input` holds `draft` and type is called with `chat-input` and `Add a health endpoint`
- **THEN** the field's editable text is `Add a health endpoint` and the command exits 0

#### Scenario: Negative control
- **WHEN** the field ends with `dd a health endpointA`, or with `draftAdd a health endpoint`, after typing
- **THEN** exiting 0 MUST fail this requirement

### Requirement: Flow runs pass configured dev credentials only through the driver's environment
When the configuration names a credentials file, a flow run SHALL read the chosen account's username and password (keys from the configuration) from that file at the main checkout's root, or from `--credentials FILE`, print the file's path, and hand them to Maestro only as `MAESTRO_DEV_USER` and `MAESTRO_DEV_PW` in its environment. A missing file or key SHALL stop the run before Maestro starts, naming the key.

#### Scenario: Second account
- **WHEN** the configuration maps account 2 to its keys and a flow runs with `--account 2`
- **THEN** Maestro's environment holds account 2's username and password, and its command line holds neither

#### Scenario: Missing key
- **WHEN** the credentials file has no value for account 2's password key and a flow runs with `--account 2`
- **THEN** the run stops before Maestro starts, names the missing key and exits 2

#### Scenario: Negative control
- **WHEN** a flow run puts a credential value into Maestro's arguments, or reads a credentials file other than the main checkout's or the named one
- **THEN** the run MUST fail this requirement

### Requirement: Flow runs without configured credentials carry none
Without a credentials section in the configuration, a flow run SHALL start Maestro with neither `MAESTRO_DEV_USER` nor `MAESTRO_DEV_PW` in its environment, even when the calling environment holds them, and SHALL refuse `--account` and `--credentials` with exit 2 before Maestro starts.

#### Scenario: Plain flow
- **WHEN** the configuration has no credentials section, the calling shell exports `MAESTRO_DEV_PW`, and a flow runs without `--account`
- **THEN** Maestro runs with neither variable in its environment

#### Scenario: Negative control
- **WHEN** the configuration has no credentials section and a flow run is given `--account 1`, or the calling shell's `MAESTRO_DEV_PW` reaches Maestro
- **THEN** Maestro starting with the flag accepted, or with that variable, MUST fail this requirement

### Requirement: Flow runs name the expected screen by its configured tag
When the configuration maps screen names to test tags, a flow run SHALL set `MAESTRO_EXPECT_TAG` to the tag of `--expect NAME`, or of the configured default name without the flag, and refuse an unmapped name with exit 2 before Maestro starts. Without such a map it SHALL refuse `--expect` and set no `MAESTRO_EXPECT_TAG`.

#### Scenario: Onboarding screen
- **WHEN** the configuration maps `onboarding` to `onboarding-welcome` and a flow runs with `--expect onboarding`
- **THEN** Maestro's environment holds `MAESTRO_EXPECT_TAG=onboarding-welcome`

#### Scenario: Negative control
- **WHEN** a flow runs with `--expect settings` while the map has no `settings`, or the configuration has no map and the flow runs with `--expect home`
- **THEN** Maestro starting MUST fail this requirement

### Requirement: Flow driver output reaches the caller only redacted
A flow run SHALL start Maestro without a terminal and print only its own summary lines. Every line it prints or keeps SHALL have each configured credential value, of every configured account whether or not the run uses it, and each token replaced by `[redacted]`, a value written to the stream in two pieces included.

#### Scenario: Driver echoes a credential
- **WHEN** Maestro writes the username and the password to its standard output and standard error, the password split across two writes
- **THEN** the run's output and its kept console log hold `[redacted]` in their place and neither value

#### Scenario: Negative control
- **WHEN** a flow run starts Maestro on a terminal, or prints or keeps a credential value of any configured account or a token
- **THEN** the run MUST fail this requirement

### Requirement: Flow runs use one device and never overlap another flow run on the host
A flow run SHALL target the given device or else the platform's only booted device. Before starting Maestro it SHALL atomically take the host-wide lock `${TMPDIR}/app-qa/flow.lock`, a directory holding the holder's process id, shared by every repository, hold it until Maestro exits and never remove another run's lock. It SHALL refuse, naming the cause, an ambiguous or empty device choice, any held lock (a stale one with its removal command) or an unlocked Maestro test run.

#### Scenario: Run in another repository
- **WHEN** a flow run in one repository holds the lock and a flow run starts in another repository
- **THEN** the second run exits 2 naming the holder's process id, without touching any device

#### Scenario: Lock held by an app script
- **WHEN** an app script holds the lock with a `pid` file holding only its process id, and a flow run starts, then starts again after the script has ended and removed its lock
- **THEN** the first start exits 2 naming the script's process id as a live holder; the second takes the lock, and the lock is gone once that run finishes

#### Scenario: Simultaneous starts
- **WHEN** two flow runs start at the same moment
- **THEN** exactly one of them starts Maestro, and the other exits 2 naming the running one

#### Scenario: Negative control
- **WHEN** two simulators are booted and no device is given, another repository's run holds the lock, a stale lock exists, or a Maestro test run without the lock is alive
- **THEN** starting Maestro, removing a lock the run did not take, or leaving its own lock after it finishes, MUST fail this requirement

### Requirement: Flow driver files stay in one private temporary root
A flow run SHALL direct every Maestro file, its JVM temporary files included, into one owner-only directory it creates in the system temporary directory, never below the repository, and SHALL create the output directory itself, refusing an existing path. It SHALL delete Maestro's step screenshots and hierarchies after every run. A passing run SHALL copy the named screenshots out and remove the root; a failing run SHALL delete every image and print the root; an interrupted run SHALL remove it.

#### Scenario: Passing run
- **WHEN** a flow that takes one named screenshot passes
- **THEN** the output directory holds that screenshot, the run root no longer exists, and no file below the repository was created by the run

#### Scenario: Failing run
- **WHEN** a flow fails on an assertion
- **THEN** the run prints the kept root's path and the failure message; the root holds the redacted console log and the report, and no image or hierarchy

#### Scenario: Negative control
- **WHEN** a Maestro file is written below the repository or outside the root, the root survives a passing run, a step screenshot survives any run, an image survives a failing run, or an existing output directory is used
- **THEN** the run MUST fail this requirement

### Requirement: Kept flow output holds no dev credential
After every flow run, before the root is kept or screenshots are copied out, the run SHALL delete Maestro's command records and apply the evidence scan's credential and token matching to the root and to every copied file. It SHALL replace each match in a flagged text file by `[redacted]`, delete every other flagged file, print only the names of the files it changed or deleted, and never change a file it did not write. It SHALL also test the path of every file and folder below the root, relative to the root, for a configured username or password, matched as the evidence scan matches them, delete each file and folder whose path holds one, and print each such path with every value replaced by `[redacted]`.

#### Scenario: Driver logs record the typed values
- **WHEN** a sign-in flow fails and Maestro's log and report hold the account's username and a password containing a quote, an ampersand and a backslash
- **THEN** the command record is deleted, the log and report are kept with `[redacted]` in place of each value, their names are printed, and the run exits 1

#### Scenario: Credential in a file name
- **WHEN** a passing flow takes a screenshot named `sign-in-` followed by the account's username, whose bytes hold no credential
- **THEN** no path below the root or the output directory holds the username, the run prints that screenshot as removed by the sweep with `[redacted]` in place of the username, and exits 1 without `PASS`

#### Scenario: Negative control
- **WHEN** a kept root file or copied file contains a configured username or password, raw, JSON-escaped or XML-escaped, after the run ends, or the path of a kept root file or folder or of a copied file holds one where the evidence scan would match it, or a printed line holds one
- **THEN** the run MUST fail this requirement

### Requirement: Named screenshots leave a run under distinct names or not at all
A passing run SHALL copy each named screenshot to the output directory under its file name. It SHALL count the named screenshots from Maestro's command records, so two screenshots taken under one file name count twice even when Maestro wrote them to one file. When two named screenshots of the run share a file name, it SHALL copy neither, print the file name and each source relative to the root with the step that took it, and exit 1. A command record it cannot read SHALL make a passing run print the record's name and exit 1. Any other copy error SHALL be printed as that error and exit 1. A run SHALL report `PASS` only when every named screenshot was copied.

#### Scenario: Subflow and flow both name `home`
- **WHEN** a passing flow and its subflow each take a screenshot named `home`, and Maestro writes both to one file
- **THEN** the output directory holds no `home.png`, the run prints `home.png` with both sources and exits 1

#### Scenario: Negative control
- **WHEN** two screenshots named `home` produce one exported `home.png`, whether Maestro wrote them to two files or to one, an unreadable command record lets the run pass, or a copy fails for a reason other than a name clash and is reported as an existing target
- **THEN** the run exiting 0 or printing `PASS` MUST fail this requirement

### Requirement: Named screenshots the sweep removes fail the run
The run SHALL account for every named screenshot taken, as recorded before the sweep. A named screenshot the credential sweep deletes, before or after its copy, SHALL be printed by name as removed and make the run exit 1 without `PASS`; two named screenshots sharing a file name SHALL stay a clash when the sweep deleted one of them.

#### Scenario: Swept named screenshot
- **WHEN** a passing flow takes a named screenshot whose bytes match a configured credential
- **THEN** the screenshot is in neither the root nor the output directory, the run prints its name as removed by the sweep and exits 1 without `PASS`

#### Scenario: Negative control
- **WHEN** a named screenshot the sweep deleted goes unreported, or one of two screenshots named `home` is swept and the other is exported as `home.png`
- **THEN** the run exiting 0 or printing `PASS` MUST fail this requirement

### Requirement: The evidence scan reports leaking files by name only
The scan command SHALL search a file or folder for the JWT prefix `eyJ` (in a binary file, followed by ten base64url characters), the configured sentinels, and, when credentials are configured, each password anywhere and each username where neither neighbour is an ASCII letter or digit, raw, JSON-escaped and XML-escaped. When credentials are configured, a file whose path relative to the scanned folder holds a password or username, matched the same way, SHALL match whatever its contents. It SHALL print only matching paths, each configured value in them replaced by `[redacted]`, and exit 1 on a match, 0 on none, 2 when a path cannot be read.

#### Scenario: One leaking file
- **WHEN** a folder holds a clean log and a log containing account 1's password
- **THEN** the scan prints only the second log's path and exits 1

#### Scenario: No credentials configured
- **WHEN** the configuration has no credentials section and a folder holds a clean log and a log containing a token
- **THEN** the scan prints only the second log's path and exits 1

#### Scenario: Negative control
- **WHEN** a scanned file contains account 2's password, only a token, only a configured sentinel, or account 1's username between a slash and a space, or a clean file's name holds account 1's password
- **THEN** exiting 0, or printing the password, the username, the token or the sentinel, MUST fail this requirement

### Requirement: The team skill routes a fresh agent to the shared driver
The team skill `app-qa-drivers` SHALL lead an agent session without prior context, in a repository with a configuration, to do desktop and simulator QA through the shared driver: preflight first, tag-addressed desktop commands, sign-in only through the repository's sign-in subflow run by the driver, evidence scanned before it is kept, and a failed preflight reported with its fix instead of worked around.

#### Scenario: Desktop typing task
- **WHEN** a fresh agent session in such a repository is asked to type a text into a tagged field of the desktop app and prove the field holds it
- **THEN** its tool calls run the shared driver's preflight, attach, type and find or capture, and none runs an OS-level GUI scripting or screen-capture tool

#### Scenario: Missing driver
- **WHEN** a fresh agent session gets the same task while Spectre is missing from its `PATH`
- **THEN** it reports the preflight's failed line and its install hint, and drives the window by no other means

#### Scenario: Simulator sign-in task
- **WHEN** a fresh agent session in such a repository is asked to sign a configured account into the app on the simulator and show the screen after sign-in
- **THEN** its tool calls run the shared driver's preflight for the simulator and a flow run of the repository's sign-in subflow with `--account`, and none runs Maestro directly, reads the credentials file or types a credential

#### Scenario: Negative control
- **WHEN** a fresh agent session's tool calls include an OS-level GUI scripting or screen-capture tool, a direct Maestro run, a copy of the driver script into the repository, a read of the credentials file, or evidence reported as kept without a scan
- **THEN** reporting this requirement as met MUST fail

### Requirement: The team skill leaves a repository without a configuration on its own driver
In a repository without a configuration, the team skill `app-qa-drivers` SHALL lead an agent session without prior context to the driver that repository's own QA skill names, never to the shared driver.

#### Scenario: Repository without a configuration
- **WHEN** a fresh agent session in a repository whose own QA skill names its own driver, and which has no configuration, is asked to run the desktop preflight
- **THEN** its tool calls run that repository's driver's preflight and never the shared driver

#### Scenario: Negative control
- **WHEN** such a session's tool calls run the shared driver
- **THEN** reporting this requirement as met MUST fail
