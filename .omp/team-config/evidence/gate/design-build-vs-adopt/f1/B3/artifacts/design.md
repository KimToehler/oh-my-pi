# Design

## Context

See proposal.md - Why.

`UploadStore` (`src/main/kotlin/Upload.kt:8-16`) is the whole storage layer. `store` writes the bytes to `root/<random UUID>` and returns the UUID. `load` reads `root/<id>`. Nothing on disk records what a file contains, the constructor does no I/O, and the class has no locking. Random UUID names let any number of writers, threads or processes, share `root` without coordinating. The build declares no dependencies beyond the Kotlin JVM plugin 2.2.20 (`build.gradle.kts:1-5`).

Scope: the change touches one class, so there is one testable subsystem and no split is needed.

## Goals / Non-Goals

**Goals:**
- An upload whose SHA-256 digest matches a file already in `root` returns that file's existing id and writes nothing. This includes files stored before this change.
- Ids stay opaque random UUIDs. `load(id)` keeps working for every id issued before or after the change.
- Two concurrent `store` calls on one `UploadStore` with identical bytes store the content once.

**Non-Goals:**
- Removing duplicates already in `root`. Clients hold their ids, so deleting or merging those files would break `load` for those clients.
- Deduplicating across `UploadStore` instances or processes that share one `root`. They can still store duplicates, but they never return a wrong id.
- Making writes atomic (temp file plus move). Today's partial-write behaviour stays as it is.
- Persisting the index, or adding a delete API.

## Decisions

### D1: Keep UUID ids and look duplicates up in a digest → id index

`store` computes the SHA-256 digest of the bytes and looks up the hex digest in an index. On a hit it returns the mapped id. On a miss it writes the bytes to `root/<new UUID>` as today, then records digest → id.

Alternative rejected: using the hex digest as the file name and id (content-addressed naming). Files stored before the change have UUID names and are unknown to a digest-named lookup, so an index would still be needed for them. The change would also give ids two formats. Worse, ids would become derivable from content: anyone holding the bytes could compute an id and probe `load` without uploading. Random ids keep `load` limited to ids the store has issued.

### D2: In-memory index built by scanning `root` at construction

The constructor lists the regular files directly under `root` (`Files.list`, not recursive) and hashes each one into the index. When several existing files share a digest, the first one listed wins. A missing `root` yields an empty index, which keeps today's behaviour of a constructor that does not fail on a missing directory. `store` still fails on write, as it does now.

Alternatives considered:
- A persisted sidecar index file: rejected. It adds an on-disk format, needs crash consistency between the index and the files, and goes stale when files change outside the store. The startup scan is always consistent with the directory.
- Lazy population on the first `store`: rejected. It costs the same I/O but moves scan failures from construction to the first upload. That makes a misconfigured `root` show up later and in the wrong place.

### D3: Hash outside the lock; lookup, write and insert under one lock

The digest is computed before the lock is taken, because it is the CPU-bound part and depends only on the input. The index lookup, the write on a miss and the index insert run in one `synchronized` section on the store instance. Without that section, two concurrent identical uploads would both miss and store twice.

Alternative rejected: `ConcurrentHashMap.computeIfAbsent` with the write inside the mapping function. That does file I/O while holding a map bin lock, and a failed write needs care so it does not leave a mapping behind. One plain lock is easier to reason about, and the index is only touched in `store` and the constructor.

### D4: Re-verify the file on an index hit

On a hit, `store` checks that `root/<id>` still exists. If the file is gone (deleted outside the store), it treats the lookup as a miss: it writes a new file and replaces the mapping. This costs one `exists` call per duplicate, and it means `store` never returns an id that `load` cannot read.

### D5: No byte-for-byte comparison on a digest match

The capability defines equality by SHA-256 digest (proposal.md - What Changes). With SHA-256, an accidental collision is negligible and a crafted one is computationally infeasible. Comparing bytes would cost a full read of the stored file for every duplicate upload and would guard against nothing practical.

### Build vs. adopt: SHA-256 digest and hex encoding
- Repository: none. `build.gradle.kts:1-5` declares only the Kotlin JVM plugin and no dependencies, and `src/main/kotlin/Upload.kt:3-5` imports only `java.nio.file.Files`, `java.nio.file.Path` and `java.util.UUID`.
- Platform: `java.security.MessageDigest.getInstance("SHA-256")`, which every Java platform implementation must support (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/security/MessageDigest.html). Hex encoding uses Kotlin stdlib `ByteArray.toHexString()` (https://kotlinlang.org/api/core/2.2/kotlin-stdlib/kotlin.text/to-hex-string.html), whose `HexFormat` API is stable since Kotlin 2.2.0 (https://kotlinlang.org/docs/whatsnew22.html#stable-base64-encoding-and-decoding). The project builds with 2.2.20 (`build.gradle.kts:2`).
- Candidates: not searched, covered above.
- Decision: adopt `MessageDigest` SHA-256 and Kotlin stdlib `ByteArray.toHexString()`.

### Build vs. adopt: content-digest dedupe index over stored files
- Repository: none. There are no dependencies (`build.gradle.kts:1-5`), and `UploadStore` (`src/main/kotlin/Upload.kt:8-16`) keeps no index or metadata.
- Platform: `java.util.HashMap` (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) covers the digest → id map. Nothing in the JDK maps a directory's files to content digests.
- Candidates:
  - JGit, https://github.com/eclipse-jgit/jgit. Newest release `7.8.0.202609011348-r`, published 2026-09-08 (deps.dev). Licence: Eclipse Distribution License v1.0. Maintained, not archived. Reject. Its object database names objects by git object ids (a hash over a git header plus the content) in its own layout. Adopting it would replace the UUID-named files and the id format, and it is a heavy dependency for what is a map.
  - FastCDC4J, https://github.com/Zabuzard/FastCDC4J. Newest release `1.3`, published 2021-02-12 (deps.dev). Licence: GPL-3.0. Not archived, last push 2023-09-21. Reject. It does content-defined chunking for sub-file dedupe, not whole-file lookup of existing ids, and GPL-3.0 is unsuitable as a library dependency here.
  - Searches run: `Java Kotlin library content-addressable storage deduplicate files by SHA-256` and `JVM library deduplicating file store "content addressable" java github maintained`.
- Decision: partial. Adopted: `java.util.HashMap` as the index. Built: the startup scan of `root` and the lookup/insert glue in `UploadStore`. Gap: no platform API or library maps existing UUID-named files to their digests without replacing the storage layout and id format.

## Risks / Trade-offs

- [Construction now reads every byte in `root`, so startup time and I/O grow with total stored size] → The scan is sequential and runs once per instance. If startup cost becomes a problem, a persisted index can be added later behind the same `store` contract.
- [`store` calls on one instance are serialized during lookup, write and insert] → Hashing, the CPU-heavy part, runs outside the lock. Writes to one directory were already disk-bound, so the lock costs little extra throughput.
- [Several instances or processes sharing `root` do not see each other's writes after construction] → The only effect is duplicate storage. A returned id always names an existing file (D4). Cross-instance dedupe is a non-goal.
- [Each index entry holds a 64-char hex digest and a 36-char UUID in memory] → This is about 100 characters of string data per stored file. For very large directories, the persisted-index alternative (D2) is the next step.
- [A truncated file left by a crashed write is indexed under the digest of its truncated bytes] → It can only match an upload of exactly those bytes, and then `load` returns exactly those bytes. No wrong content is ever returned.
- [Non-UUID regular files in `root` get indexed and can be returned as ids] → `load` already reads any name under `root`, so such an id is readable. The scan skips directories.

## Migration Plan

No data migration and no on-disk format change. Existing files are indexed when an `UploadStore` is constructed after deploy. To roll back, revert `Upload.kt`. Every file written under the new code is an ordinary UUID-named file, so rollback loses nothing and all issued ids stay loadable.
