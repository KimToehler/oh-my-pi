# Design

## Context

See proposal.md - Why. `BackupExporter.export` in `src/main/kotlin/Backup.kt:7-8` writes one UTF-8 line per note, joined by `\n`, with no header or trailer. `BackupImporter.import` (`Backup.kt:12-17`) decodes the bytes with `decodeToString()`, which replaces malformed UTF-8 instead of failing, then splits lines and drops empty ones. So a file cut at a line boundary imports as fewer notes, and a cut inside a line or a flipped byte imports as a garbled note, both without error. The project is Kotlin/JVM (`build.gradle.kts`) with no declared dependencies.

## Goals / Non-Goals

**Goals:**
- Detect accidental truncation or modification of a backup file before any note is parsed.
- Keep `export(notes): ByteArray` and `import(bytes): List<Note>` signatures unchanged.

**Non-Goals:**
- Authenticity or tamper resistance: CRC-32 is not a cryptographic MAC, and anyone who edits a file can recompute it.
- Repairing or partially importing a corrupt file.
- Reading backups that have no checksum (proposal.md: none are in circulation).

## Decisions

### File layout: checksum as a fixed-width trailer line

An exported file is `payload + "\n" + "crc32:" + 8 lowercase hex digits`, where `payload` is today's export output, unchanged. Import splits at the last `\n` byte: everything before it is the payload, everything after it must match `crc32:[0-9a-f]{8}` exactly.

- The trailer is found by position (last line), not by prefix, so a note whose title starts with `crc32:` cannot be confused with it.
- Fixed-width hex means a cut inside the trailer leaves a malformed trailer and is refused, rather than parsed as a shorter number.
- An empty note list exports as `"\ncrc32:00000000"` (CRC-32 of zero bytes is 0), so the empty backup is verified the same way.
- Alternatives: a header line (rejected: truncation removes the tail, so the reader would need the payload length too); a separate sidecar file (rejected: two files can be separated in transit, and the API returns one `ByteArray`); a decimal value (rejected: variable width hides a cut inside the trailer).

### Verify raw bytes before decoding

Import computes CRC-32 over the payload bytes and compares it with the trailer before calling `decodeToString()`. Checking after decoding would miss corruption that the lenient decoder already replaced with U+FFFD.

### Refusal: `CorruptBackup` exception

`import` throws `class CorruptBackup(message: String) : Exception(message)` when the file has no `\n`, the trailer is malformed, or the checksum does not match. The message names which of the three happened. This keeps the `List<Note>` return type, so existing callers compile unchanged and cannot ignore the failure by mistake.

- Alternative: return a sealed `Result`-style type (rejected: changes the public signature for every caller for a single failure mode; Kotlin has no checked exceptions, so the exception must be documented in KDoc on `import`).

### Build vs. adopt: CRC-32 checksum
- Repository: none; searched `src/main/kotlin/` (only `Backup.kt`, no checksum code) and `build.gradle.kts` (no dependencies declared).
- Platform: `java.util.zip.CRC32` in `java.base`, since Java 1.1 — https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/zip/CRC32.html (`update(byte[], int, int)`, `getValue(): Long`).
- Candidates: not searched, covered above.
- Decision: adopt `java.util.zip.CRC32`; format `getValue()` as `"%08x"`.

## Risks / Trade-offs

- [Random corruption that preserves the CRC-32, about 1 in 2^32] → Accepted; the proposal targets accidental corruption, and the alternative (SHA-256 via `java.security.MessageDigest`) adds 56 more trailer characters for no stated need.
- [Deliberate edits with a recomputed checksum pass] → Out of scope (Non-Goals); a later change would need an HMAC with a key, which this format can grow into by a new trailer prefix.
- [A file saved by a tool that appends a trailing newline is refused] → The trailer regex is exact by design; any added byte is a modification. Documented in the `CorruptBackup` message for a malformed trailer.
- [Whole file is held in memory for the CRC pass] → Same as today: both `export` and `import` already work on a full `ByteArray`.
