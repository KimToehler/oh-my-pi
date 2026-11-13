# Consultation

- **Status**: consulted
- **Consulted commit**: a173873f7b9ea70123a6cedad8cdbef1ad5c8507
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

- **Disposition**: adopted: design.md D1 now runs the capacity read with `SELECT ... FOR UPDATE`, the count and the insert in one transaction on one client checked out with `pool.connect()`, with ROLLBACK on error and release in every case

### F2

- **Disposition**: adopted: design.md D1 returns `{ status: "not_found" }` when the capacity row is missing (and `full` / `reserved` otherwise), D3 maps `not_found` to 404, and tasks.md 2.1 adds a test for an unknown event

### F3

- **Disposition**: rejected: the repository has no Redis (package.json depends only on `pg`), a second store's counter can drift from the reservations table that the capacity requirement is stated over, and the report itself rates the count cost small at the stated sizes; the locked count in D1 keeps one source of truth
