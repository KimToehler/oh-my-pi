# acp-tool-call-updates Specification

## Purpose
Defines what omp sends to an ACP client about a tool call while it runs and when it settles, so that clients that journal every update (JetBrains Air) receive progress without unbounded raw-output copies.

## Requirements

### Requirement: Running tool call updates carry no raw output
On ACP v1 and v2, a `tool_call_update` omp sends for a running call (`status: in_progress`) SHALL NOT carry `rawOutput`; its other fields stay unchanged. A frame omp sends that settles a call SHALL carry the tool's result as `rawOutput`: the call's end frame, and a background job's final frame (`status` `completed` or `failed`). Which tool events omp forwards at all is unchanged.

#### Scenario: Subagent progress without raw output
- **WHEN** a running `task` call reports progress whose details hold the subagents' briefs
- **THEN** the client receives a `tool_call_update` with `status: in_progress`, the progress text as `content`, and no `rawOutput`

#### Scenario: Call end keeps raw output
- **WHEN** the call ends
- **THEN** its `tool_call_update` with `status` `completed` (or `failed`) carries the tool result as `rawOutput`

#### Scenario: Background job's final frame keeps raw output
- **WHEN** a backgrounded call's job reports its final state (`completed`, `failed` or `cancelled`) after the call returned, while the prompt turn is still running
- **THEN** that `tool_call_update` has `status` `completed` or `failed` and carries the frame's partial result as `rawOutput`

#### Scenario: ACP v2 client
- **WHEN** the client negotiated ACP v2 and a running call reports progress
- **THEN** the v2 `tool_call_update` for that progress has no `rawOutput`, and the call's completed update carries it

#### Scenario: Negative control
- **WHEN** a running `task` call reports progress whose details hold the subagents' briefs
- **THEN** a `tool_call_update` with `status: in_progress` that carries those details as `rawOutput` MUST fail

### Requirement: Unchanged tool call updates are not resent
For each tool call, omp SHALL NOT send a `tool_call_update` for reported progress identical to the last one it sent for that call. The comparison starts afresh when the call ends, however slowly the end frame is delivered. An update that differs from the last one sent in any field (status, content, locations, raw output) SHALL be sent, in the order reported. Which tool events omp forwards at all is unchanged.

#### Scenario: Repeated progress collapses
- **WHEN** a running call reports the same progress three times, then different progress twice
- **THEN** the client receives exactly two in-progress updates for that call, the first and the different one, in that order

#### Scenario: Progress after the call returned
- **WHEN** a call ends and, while the prompt turn is still running, its background job reports the same progress it reported before the end, twice
- **THEN** the client receives that progress once after the end update

#### Scenario: Calls are independent
- **WHEN** call 1 reports progress `A`, call 2 reports progress `A`, and call 1 reports `A` again
- **THEN** the client receives one `A` update for each call

#### Scenario: Same content with a settled status
- **WHEN** a background job's final frame has the same content as the call's last progress update
- **THEN** the client receives that frame with its settled status and its `rawOutput`

#### Scenario: Settled frames that differ only in raw output
- **WHEN** a background job reports two final frames with the same status, content and locations but different details
- **THEN** the client receives both frames, each with its own `rawOutput`

#### Scenario: Same content at another location
- **WHEN** a running call reports the same progress twice with different file locations
- **THEN** the client receives both updates, each with its location

#### Scenario: ACP v2 client
- **WHEN** the client negotiated ACP v2 and a running call reports the same progress three times, then different progress
- **THEN** the client receives two in-progress v2 updates for that call

#### Scenario: Negative control
- **WHEN** a running call reports the same progress five times
- **THEN** a client that receives five in-progress updates for that call MUST fail
