# Spec Delta

## Purpose

Defines what a session store does after it deleted its own current session file, so that no later write silently recreates a deleted session as a file without its title and header.

## ADDED Requirements

### Requirement: A deleted current session is never recreated

After a session store deleted its current session file, no entry recorded for that session SHALL be written to that path or recreate a file there, in every mode. The session SHALL continue in memory only, and recording an entry SHALL NOT throw because the file is gone. Starting a new session or switching to another stored session SHALL restore persistence for that file. Deleting a file other than the current one SHALL NOT affect persistence of the current one.

#### Scenario: Write after deleting the current file

- **WHEN** a session store with a persisted session file deletes that file and then records a user message and an exit entry for the same session
- **THEN** no file exists at the deleted path and both calls return normally

#### Scenario: New session after delete

- **WHEN** the same store deletes its current file and then starts a new session and records a message
- **THEN** the new session's file exists, starts with its title and header entries, and contains the message

#### Scenario: Deleting another session's file

- **WHEN** a store deletes the file of a session other than its current one and then records a message
- **THEN** the message is persisted in the current session file

#### Scenario: Negative control

- **WHEN** a store deletes its current session file and a later recorded entry recreates a file at that path
- **THEN** the no-recreation check MUST fail
