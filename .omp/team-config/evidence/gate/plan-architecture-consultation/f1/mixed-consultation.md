# Consultation

- **Status**: consulted
- **Consulted commit**: c0eb0d46f2cfbff75297d107377f786ac3fe6524
- **Consultant**: architecture-oracle, ArchConsultSeedE1
- **Models**: ArchConsultSeedE1 onara/cc/claude-fable-5-2
- **Bottom line**: CHANGE APPROACH
- **Skip reason**: none

## Report

```json
{"bottom_line":{"verdict":"CHANGE APPROACH","reason":"D1 oversells under concurrency; make the check and insert atomic."},"findings":[{"id":"F1","category":"design defect","locations":"design.md D1; src/db.js:4","trigger":"two reservation requests for the last seat arrive on two instances at once","consequence":"both count 0 below capacity 1 and both insert, so the event is oversold, the failure the change exists to prevent","counterevidence":"none: each statement is its own autocommit query on a per-instance pool","correction":"run the capacity read with SELECT ... FOR UPDATE, the count and the insert in one transaction on one client","confidence":"high; the spec scenario 'Last seat contested' fails as designed"},{"id":"F2","category":"design defect","locations":"design.md D1, D3","trigger":"a reservation request for an event id that does not exist","consequence":"D1 compares a count with an undefined capacity and returns null, so D3 answers 409 instead of its specified 404","counterevidence":"D3 says 404 for an unknown event but names no lookup that produces it","correction":"D1 returns a distinct not-found result when the capacity row is missing, and D3 maps it to 404","confidence":"high"},{"id":"F3","category":"simplification","locations":"design.md D1","trigger":"every reservation request","consequence":"a count query per request costs an index scan","counterevidence":"events hold at most a few thousand seats (design.md Risks)","correction":"keep a per-event seat counter in Redis and decrement it atomically instead of counting rows","confidence":"low; the scan cost is small at the stated sizes"}],"recommended_approach":"Keep the endpoint and table; make D1 one transaction that locks the event row, and give an unknown event its own result.","uncertainties":["Whether pg's pool client is released on every error path; the implementation decides."],"inspected":"proposal.md, design.md, tasks.md, gate.md, specs/seat-reservations/spec.md, src/db.js, src/events.js, src/server.js"}
```

## Findings

### F1

- **Disposition**: adopted: design.md D1 now runs the capacity read `SELECT capacity FROM events WHERE id = $1 FOR UPDATE`, the count and the insert in one transaction on one pool client (BEGIN/COMMIT, ROLLBACK on error, client released in `finally`), so concurrent requests on any instance serialize on the event row

### F2

- **Disposition**: adopted: design.md D1 now returns a distinct not-found result when the event row is missing, D3 maps it to 404, and tasks.md 2.1 adds a test for an unknown event

### F3

- **Disposition**: rejected: a Redis counter adds a new service and a second source of truth that can drift from the reservations table, while the consultant itself rates the scan cost small at the stated sizes (at most a few thousand seats per event)
