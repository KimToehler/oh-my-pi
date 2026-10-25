# Spec Delta

## Purpose

Keeps the agents of a relocating session from starting work against the checkout the session is
leaving: peer messages and revivals for that agent tree wait until the relocation has settled.

## ADDED Requirements

### Requirement: Peer messages to a relocating agent tree wait for settlement
While a session relocates, a peer message to that session or to a subagent whose transcript lies
under its artifacts directory SHALL NOT start a turn or revive the recipient. It SHALL be delivered
once the relocation has settled (moved, failed or rolled back), in the order the messages were
sent, and the sender's call SHALL return only after that delivery. No such message is dropped or
rejected because of the relocation.

#### Scenario: Message to the relocating session
- **WHEN** the session's relocation is paused inside its host relocator and a peer sends the session a message
- **THEN** no turn of the session starts until the relocator returns, and the turn that the message wakes afterwards runs in the session's new working directory

#### Scenario: Message to the session accepted just before the barrier
- **WHEN** a peer message to the session is accepted and wakes it after the session has gone idle for its relocation but before the barrier is taken, and the woken turn has not yet started
- **THEN** that turn does not start before the relocation settles, then it starts in the session's resulting working directory

#### Scenario: Message to an idle live subagent
- **WHEN** the relocation is paused and a peer sends a message to an idle, live subagent of the session
- **THEN** the subagent starts no turn until the relocation settles, then wakes and handles the message

#### Scenario: Message to a parked subagent
- **WHEN** the relocation is paused and a peer sends a message to a parked subagent of the session
- **THEN** the subagent is not revived until the relocation settles, then it is revived from its transcript at the relocated path and handles the message

#### Scenario: Arrival order is kept
- **WHEN** two messages for the same tree member arrive while the relocation is paused
- **THEN** after settlement the member receives them in the order they were sent

#### Scenario: Negative control
- **WHEN** the relocation is paused and a peer message to an idle subagent of the session starts a provider turn before the relocator returns
- **THEN** the implementation is wrong and the requirement MUST fail

### Requirement: Revivals in a relocating agent tree wait for settlement
While a session relocates, reviving a parked or killed subagent of that session from its
transcript, for any reason (peer message, task resume, task restore of an interrupted turn, TUI
agent-hub focus, collaboration chat or revive), SHALL wait until the relocation has settled and
SHALL then read the transcript at its current path. RPC `steer_subagent` is not a revival route:
it reaches only running subagents and refuses a parked one before reviving anything.

#### Scenario: Focus or resume during relocation
- **WHEN** the relocation is paused and the TUI agent hub focuses a parked subagent of the session, or another agent resumes it with `task`
- **THEN** the revival completes only after the relocation settles, and the revived subagent's transcript is the one under the relocated artifacts directory

#### Scenario: Negative control
- **WHEN** the relocation is paused and a parked subagent of the session is revived from its transcript before the relocator returns
- **THEN** the implementation is wrong and the requirement MUST fail

### Requirement: The relocation's running-work check sees admitted turns
The final running-work check before a `session_move` relocation SHALL run while the barrier is
held and only after every delivery, revival or revive-then-turn for the tree admitted before the
barrier has either submitted or scheduled its resulting turn or ended without one. A subagent of
the session whose turn was submitted or scheduled, even if its status does not yet read running,
SHALL count as running work, so the move is refused and names that agent.

#### Scenario: Wake admitted just before the barrier
- **WHEN** a peer message wakes an idle subagent of the session immediately before the relocation takes the barrier, and the subagent's status has not yet changed to running
- **THEN** the relocation is refused, the session stays in its directory, and the continuation names the subagent

#### Scenario: Task resume admitted just before the barrier
- **WHEN** another agent resumes a parked subagent of the session with `task`, its revival completes immediately before the relocation takes the barrier, and its follow-up prompt has not yet been submitted
- **THEN** the relocation is refused naming the subagent, or the follow-up prompt is submitted only after the relocation settles; the subagent's turn never runs while the relocation moves its transcript

#### Scenario: Task restore admitted just before the barrier
- **WHEN** a task restore revives a parked subagent of the session and schedules the continuation of its interrupted turn immediately before the relocation takes the barrier
- **THEN** the relocation is refused naming the subagent and does not wait for the restored turn to finish

#### Scenario: Negative control
- **WHEN** a subagent's wake was admitted before the barrier and the relocation proceeds while that subagent's turn runs in the source checkout
- **THEN** the implementation is wrong and the requirement MUST fail

### Requirement: Every relocation path holds the barrier
The barrier SHALL be held by every session relocation: the agent's `session_move`, the TUI `/move`
and `/wt` commands, and the ACP, RPC and headless builtin `/move` and `/wt` relocations. It SHALL be
held from before the session file is moved until the host rescope or the rollback has finished.

#### Scenario: Headless `/move` with a slow rescope
- **WHEN** an ACP session runs `/move <path>` and a peer message for that session arrives while the host rescope is paused
- **THEN** the message wakes no turn until the rescope finishes

#### Scenario: Negative control
- **WHEN** a TUI `/move` is paused after renaming the session file and a peer message wakes the session's turn before the host has applied the new working directory
- **THEN** the implementation is wrong and the requirement MUST fail

### Requirement: The barrier is released on every outcome and scoped to one tree
The barrier SHALL be released when the relocation succeeds, fails, is refused or is rolled back,
and held messages and revivals then proceed. Agents outside the relocating tree, including other
sessions and their subagents in the same process, SHALL NOT wait for it.

#### Scenario: Release after a failed relocation
- **WHEN** the host relocator fails and rolls the move back while a message for a subagent of the session is held
- **THEN** the message is delivered after the rollback and the subagent handles it in the unchanged directory

#### Scenario: Another session is unaffected
- **WHEN** one ACP session relocates and a peer message goes to a subagent of a second session in the same process
- **THEN** that message is delivered without waiting for the relocation

#### Scenario: Negative control
- **WHEN** a relocation fails and a message held for a subagent of the session is never delivered, or a message to another session's subagent waits for the relocation
- **THEN** the implementation is wrong and the requirement MUST fail
