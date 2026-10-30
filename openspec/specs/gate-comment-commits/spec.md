# gate-comment-commits Specification

## Purpose
Decides how a commit that changes only comments is handled during the post-implementation merge gate, so informative comments cost no review round while comments a tool or review input reads are still reviewed as code.

## Requirements

### Requirement: Comment kind is the orchestrator's decision

The `review-work` instruction SHALL define a comment as behaviour-changing when a tool acts on its text, changing what the tool builds, checks, generates or decides, or when a review input reads it, and every other comment as informative, including one a parser only skips and one a tool only shows, diffs or keeps. The orchestrator SHALL decide the kind; uncertainty SHALL count as behaviour-changing.

#### Scenario: Directive comment

- **WHEN** a commit adds `// @ts-expect-error`, `//go:build`, `# noqa`, `# type: ignore`, a code-generation marker, or a doc comment that runs as a test or generates a shipped API document
- **THEN** the instruction classifies it as behaviour-changing

#### Scenario: Explanatory comment

- **WHEN** a commit only rewords, adds or removes comments that explain code, whose text no tool acts on (a parser or lexer that only skips comments does not count) and that no reviewer brief, criterion or agent-loaded instruction reads
- **THEN** the instruction classifies it as informative

#### Scenario: Negative control

- **WHEN** the orchestrator is unsure whether a tool reads a changed comment, and the instruction lets it treat the comment as informative
- **THEN** review of that instruction MUST fail

### Requirement: Informative comment commits between waves are exempt

Between fix waves, the instruction SHALL allow a commit that changes only informative comments to be exempted with `GC exempt`, with a reason that names the comment as informative. A commit with a behaviour-changing comment, or with comments and any change that is not itself exemptible, SHALL be delta-reviewed like code.

#### Scenario: Informative comment between waves

- **WHEN** a commit between two F2 waves only rewords informative comments
- **THEN** the orchestrator may run `GC exempt --sha <commit> --reason <text>` with a reason naming the comments as informative, and dispatches no delta review

#### Scenario: Mixed commit

- **WHEN** a commit between waves changes comments and one line of code
- **THEN** the instruction requires a delta review for it

#### Scenario: Negative control

- **WHEN** a commit between waves adds a linter suppression comment and the instruction allows exempting it
- **THEN** review of that instruction MUST fail

### Requirement: Informative comments after the final verdict land after the merge

The final F2 verdict is the F2 wave that printed `DECISION: PASS`, or the STOP the user resolved with freeze. After it, the instruction SHALL keep a commit whose only changes are informative comments off the reviewed branch until the merge, then make it as its own commit in the task worktree and merge it into the default branch without a gate, never directly on the default branch. A commit that also changes anything else SHALL follow the route of that other change.

#### Scenario: Comment fix after PASS

- **WHEN** the record validates and the orchestrator wants to reword an informative comment in reviewed source
- **THEN** the instruction directs it to commit the change alone in the task worktree after the merge and merge it into the default branch, and the merged record stays settled for the stop hook after that merge

#### Scenario: Code fix that also rewords a comment after PASS

- **WHEN** after a PASS wave a needed code fix also rewords an informative comment in the same commit
- **THEN** the instruction routes the commit as code on the branch, and the merge waits for a new wave that passes

#### Scenario: Comment fix after an authorized freeze

- **WHEN** the user resolved an F2 STOP with freeze, the record validates, and the orchestrator wants to reword an informative comment
- **THEN** the instruction routes it exactly as after a PASS wave

#### Scenario: Negative control

- **WHEN** after the final verdict the instruction directs an informative-comment commit onto the reviewed branch before the merge
- **THEN** review of that instruction MUST fail

### Requirement: Behaviour-changing comments after the final verdict are code

After a PASS wave, the instruction SHALL treat a behaviour-changing comment as code: it is committed on the branch and the gate continues with a new wave as for any code commit after `reviewed_sha`. After an authorized freeze, where the lane takes no further wave, it SHALL become a follow-up change after the merge. It SHALL never land unreviewed.

#### Scenario: Directive after PASS

- **WHEN** after a PASS wave a needed change adds a type-checker suppression comment
- **THEN** the instruction treats it as a code commit on the branch, and the merge waits for the gate on that commit

#### Scenario: Directive after an authorized freeze

- **WHEN** after an F2 STOP resolved with freeze a needed change adds a linter suppression comment
- **THEN** the instruction makes it a follow-up change after the merge, gated on its own, and nothing is committed to the frozen branch

#### Scenario: Negative control

- **WHEN** the instruction lets a behaviour-changing comment be committed on the default branch after the merge without review, or onto a frozen branch
- **THEN** review of that instruction MUST fail

### Requirement: No human-readable gate summary

The `review-work` gate record phase SHALL NOT ask for a human-readable Markdown summary of the gate. The record, the reviewer trailers, the QA artifacts, the F3 report when it ran and `review.md` for an OpenSpec change SHALL carry the gate.

#### Scenario: Record phase after PASS

- **WHEN** the orchestrator reaches the gate record phase of an OpenSpec change
- **THEN** the instruction asks for the JSON record and its tracked artifacts only, and names no summary file or `Evidence:` path

#### Scenario: Negative control

- **WHEN** the record phase still directs the orchestrator to write a Markdown summary to a plan's `Evidence:` path
- **THEN** review of that instruction MUST fail
