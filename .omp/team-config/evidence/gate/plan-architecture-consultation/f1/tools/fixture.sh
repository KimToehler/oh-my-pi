#!/bin/bash
# F1 fixture builder for plan-architecture-consultation (one-off evidence helper, not delivered).
# usage: fixture.sh <dir> <risky|standard>
# Creates a git repository at <dir> (refuses an existing one): a small Node service, the omp-gated
# workflow installed from the disposable home's deployed installer, and one change folder that
# `V <change-dir>` accepts. risky: change seat-reservation, Mandatory class concurrency-state, with one
# planted design defect (design.md D1 counts and inserts in two pool statements without a lock or
# transaction, so concurrent requests oversell). standard: change event-description, class none.
set -euo pipefail
dir=$1 kind=$2
H=${PAC_HOME:?set PAC_HOME to the disposable home}/.omp/agent
[ -e "$dir" ] && { echo "refusing: $dir exists" >&2; exit 1; }
mkdir -p "$dir/src" "$dir/test"
cd "$dir"
git init -q -b main
git config user.name "F1 Fixture"
git config user.email "f1-fixture@example.invalid"

cat > package.json <<'EOF'
{
  "name": "tickets",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" },
  "dependencies": { "pg": "^8.13.0" }
}
EOF
cat > README.md <<'EOF'
# tickets

HTTP service for event ticketing. Production runs three instances behind a load balancer, all
sharing one PostgreSQL database through `src/db.js`.
EOF
cat > src/db.js <<'EOF'
import pg from "pg";

// One pool per instance; every query may run on a different connection.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
EOF
cat > src/events.js <<'EOF'
import { pool } from "./db.js";

export async function getEvent(id) {
	const { rows } = await pool.query("SELECT id, name, capacity FROM events WHERE id = $1", [id]);
	return rows[0] ?? null;
}
EOF
cat > src/server.js <<'EOF'
import http from "node:http";
import { getEvent } from "./events.js";

export const server = http.createServer(async (req, res) => {
	const match = /^\/events\/(\d+)$/.exec(req.url ?? "");
	if (req.method === "GET" && match) {
		const event = await getEvent(Number(match[1]));
		res.writeHead(event ? 200 : 404, { "content-type": "application/json" });
		res.end(JSON.stringify(event ?? { error: "not found" }));
		return;
	}
	res.writeHead(404).end();
});
EOF
mkdir -p migrations
cat > migrations/001_events.sql <<'EOF'
CREATE TABLE events (
  id serial PRIMARY KEY,
  name text NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0)
);
EOF
cat > test/events.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { getEvent } from "../src/events.js";

test("unknown event is null", async () => {
	assert.equal(await getEvent(-1), null);
});
EOF
git add -A && git commit -q -m "tickets service"

DO_NOT_TRACK=1 OPENSPEC_TELEMETRY=0 HOME=$PAC_HOME node "$H/skills/review-work/scripts/install-openspec-workflow.mjs" "$dir" > /dev/null
git add -A && git commit -q -m "install omp-gated workflow"

if [ "$kind" = risky ]; then
c=openspec/changes/seat-reservation
mkdir -p "$c/specs/seat-reservations"
printf 'schema: omp-gated\ncreated: 2026-11-12\n' > "$c/.openspec.yaml"
cat > "$c/proposal.md" <<'EOF'
# Proposal

## Why

Events have a capacity but no way to reserve a seat, so the box office tracks reservations in a
spreadsheet and regularly sells more seats than the venue holds.

## What Changes

- Add `POST /events/:id/reservations`, which reserves one seat for a user while seats remain.
- Add a `reservations` table.

## Capabilities

### New Capabilities
- `seat-reservations`: reserving seats for an event without exceeding its capacity

### Modified Capabilities

## Impact

`src/server.js`, a new `src/reservations.js`, a new migration, and their tests. All three production
instances serve the new endpoint against the shared database.
EOF
cat > "$c/specs/seat-reservations/spec.md" <<'EOF'
# Spec Delta

## Purpose

Reserve seats for an event so that the number of reservations never exceeds the event's capacity.

## ADDED Requirements

### Requirement: Reserve a seat

`POST /events/:id/reservations` with a JSON body `{"userId": <string>}` SHALL create one reservation
and answer 201 with the reservation while the event has fewer reservations than its capacity, and
answer 409 when it has none left. Concurrent requests, on any instance, SHALL never create more
reservations than the capacity.

#### Scenario: Seat available
- **WHEN** an event with capacity 2 and one reservation receives a reservation request
- **THEN** the response is 201 and the event has two reservations

#### Scenario: Last seat contested
- **WHEN** an event with capacity 1 and no reservation receives two reservation requests at the same time on two instances
- **THEN** exactly one response is 201, the other is 409, and the event has one reservation

#### Scenario: Negative control
- **WHEN** an event with capacity 1 and one reservation receives a reservation request
- **THEN** the request MUST fail with 409 and no reservation is created
EOF
cat > "$c/design.md" <<'EOF'
# Design

## Context

`src/db.js` exposes one `pg.Pool` per instance; three instances share one PostgreSQL database.
`src/events.js` reads events with single pool queries. There is no reservation code yet.

## Goals / Non-Goals

**Goals:**
- One endpoint that reserves a seat while seats remain.

**Non-Goals:**
- Cancelling reservations, payment, seat numbers.

## Decisions

### D1. Reserve with a count check followed by an insert

`reserveSeat(eventId, userId)` in `src/reservations.js` runs
`SELECT count(*) FROM reservations WHERE event_id = $1` and `SELECT capacity FROM events WHERE id = $1`
on the pool, compares the two in JavaScript, and when the count is below the capacity runs
`INSERT INTO reservations (event_id, user_id) VALUES ($1, $2) RETURNING *` as a separate pool
query. Otherwise it returns `null`, which the route answers with 409. Each statement is a single
autocommit query, like `getEvent`, which keeps the code consistent with the existing module.

### D2. Table

Migration `002_reservations.sql` creates `reservations (id serial primary key, event_id integer
not null references events(id), user_id text not null, created_at timestamptz not null default now())`
with an index on `event_id`.

### D3. Route

`src/server.js` matches `POST /events/(\d+)/reservations`, parses the JSON body, answers 400 without
a string `userId`, 404 for an unknown event, 409 when `reserveSeat` returns `null`, and 201 with
the row otherwise.

## Risks / Trade-offs

- Counting on every request is a scan of the event's index entries; events have at most a few
  thousand seats.
EOF
cat > "$c/gate.md" <<'EOF'
# Gate

- **Mandatory class**: concurrency-state
- **Depth**: risky (Mandatory class concurrency-state)
- **Risk tier**: product
- **Author's risk assessment**: an oversold event is the failure the change exists to prevent; a wrong 409 refuses a paying customer
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: none (every requirement has a scenario and a QA row)
- **Out of scope for blocking**: none (the change is self-contained)
EOF
cat > "$c/tasks.md" <<'EOF'
# Tasks

## 1. Storage

- [ ] 1.1 Add `migrations/002_reservations.sql` per design D2. Verify: `node --test test/migrations.test.js`

## 2. Reservation

- [ ] 2.1 Implement `reserveSeat` in `src/reservations.js` per design D1, with tests for a free seat, a full event and two concurrent calls for the last seat. Verify: `node --test test/reservations.test.js`
- [ ] 2.2 Add the route of design D3 with tests for 201, 400, 404 and 409. Verify: `node --test test/server.test.js`

## 3. Final verification

- [ ] 3.1 F1. Manual QA on the real surface: merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then, against a local PostgreSQL with two server instances on one database, run one row per scenario: `f1/seat-available.md` (curl transcript showing 201 and the reservation count 2), `f1/last-seat-contested.md` (two concurrent curls to the two instances: one 201, one 409, count 1), `f1/negative-control.md` (409 and count unchanged). One evidence path per row in `.omp/team-config/evidence/gate/seat-reservation/f1/`, on the head after the last code commit; the QA lane judges the observations. Verify: `cd .omp/team-config/evidence/gate/seat-reservation/f1 && test -s seat-available.md && test -s last-seat-contested.md && test -s negative-control.md`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
EOF
else
c=openspec/changes/event-description
mkdir -p "$c/specs/event-details"
printf 'schema: omp-gated\ncreated: 2026-11-12\n' > "$c/.openspec.yaml"
cat > "$c/proposal.md" <<'EOF'
# Proposal

## Why

The event page shows only the name; organisers want a short description shown with it.

## What Changes

- Add an optional `description` column to `events` and return it from `GET /events/:id`.

## Capabilities

### New Capabilities
- `event-details`: the fields `GET /events/:id` returns for an event

### Modified Capabilities

## Impact

`src/events.js`, a new migration, and the event test.
EOF
cat > "$c/specs/event-details/spec.md" <<'EOF'
# Spec Delta

## Purpose

Describe which fields an event lookup returns, so the event page can show more than the name.

## ADDED Requirements

### Requirement: Event description

`GET /events/:id` SHALL return the event's `description`, or `null` when the event has none.

#### Scenario: Event with a description
- **WHEN** an event with description "Open-air concert" is requested
- **THEN** the response is 200 and its `description` is "Open-air concert"

#### Scenario: Negative control
- **WHEN** an event id that does not exist is requested
- **THEN** the request MUST fail with 404 and no event fields are returned
EOF
cat > "$c/design.md" <<'EOF'
# Design

## Context

`getEvent` in `src/events.js` selects `id, name, capacity` with one pool query.

## Goals / Non-Goals

**Goals:**
- Return an optional description.

**Non-Goals:**
- Editing descriptions; Markdown rendering.

## Decisions

### D1. Column and query

Migration `002_event_description.sql` adds `description text NULL` to `events`; `getEvent` adds
`description` to its select list, so a missing value is returned as `null` by `pg`.

## Risks / Trade-offs

- None beyond a nullable column added to a small table.
EOF
cat > "$c/gate.md" <<'EOF'
# Gate

- **Mandatory class**: none
- **Depth**: standard (the class is none and no review, gate or release mechanism changes)
- **Risk tier**: product
- **Author's risk assessment**: a wrong query breaks the event page, caught by the event test
- **Whole-diff review**: not needed (whole-diff surface reviewed in F2)
- **Accepted residual risks**: none (every requirement has a scenario and a QA row)
- **Out of scope for blocking**: none (the change is self-contained)
EOF
cat > "$c/tasks.md" <<'EOF'
# Tasks

## 1. Description

- [ ] 1.1 Add `migrations/002_event_description.sql` per design D1. Verify: `node --test test/migrations.test.js`
- [ ] 1.2 Select `description` in `getEvent` with tests for a set and a missing description. Verify: `node --test test/events.test.js`

## 2. Final verification

- [ ] 2.1 F1. Manual QA on the real surface: merge the default branch (`main`) into the work branch when it is not an ancestor of the head, and commit; then, against a local PostgreSQL, run `f1/event-description.md` (curl showing the description), `f1/no-description.md` (curl showing `"description":null`) and `f1/unknown-event.md` (curl showing 404). One evidence path per row in `.omp/team-config/evidence/gate/event-description/f1/`, on the head after the last code commit; the QA lane judges the observations. Verify: `cd .omp/team-config/evidence/gate/event-description/f1 && test -s event-description.md && test -s no-description.md && test -s unknown-event.md`

## Workflow follow-up

- F2 merge gate (`review-work`), after 3.1 and never a checkbox: the record binds every file of this folder by `plan_sha256`, tasks.md included, so the folder is final before the F2 snapshot.
- Merge only after the F2 record validates.
EOF
fi
HOME=$PAC_HOME node "$H/skills/review-work/scripts/validate-openspec-change.mjs" "$c"
git add -A && git commit -q -m "openspec: $(basename "$c")"
echo "built $dir ($kind): $c at $(git rev-parse HEAD)"
