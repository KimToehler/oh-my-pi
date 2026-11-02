# Design

## Context

See proposal.md - Why. `:shared` is a Kotlin Multiplatform module (`androidTarget`, `iosArm64`, `iosSimulatorArm64`); `Backup.kt` lives in `commonMain`. The Kotlin common stdlib has no CRC-32: `java.util.zip.CRC32` is JVM-only, ktor 3.3.1 exposes no common CRC-32, and okio's `okio.internal.CRC32` is internal (okio is not a dependency either). The backup format is UTF-8 text, one note per line, tab-separated, no header or trailer. `BackupExporter`/`BackupImporter` have no callers in the repository yet.

## Goals / Non-Goals

**Goals:**
- Compute CRC-32 in `commonMain` without a new dependency and without platform source sets.
- Fix an exact, line-compatible trailer format that exporter writes and importer verifies before parsing.

**Non-Goals:**
- Accepting backups without a trailer (none are in circulation - proposal.md).
- Changing how a checksum-valid file with a malformed note line is handled.
- Authenticity: CRC-32 detects accidental corruption, not tampering.

## Decisions

**1. Pure-Kotlin, table-driven CRC-32 in `commonMain`, private to `Backup.kt`.**
Standard CRC-32 (IEEE 802.3 / zlib): reflected polynomial `0xEDB88320`, initial value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`, 256-entry lookup table built once. Result matches `java.util.zip.CRC32` and zlib `crc32`, so a check value (`"123456789"` → `cbf43926`) and cross-checks against the JVM implementation in tests pin it.
- Alternative: `expect`/`actual` over `java.util.zip.CRC32` (Android) and `platform.zlib.crc32` (iOS). Rejected: three source sets plus Kotlin/Native interop for ~15 lines of code, and it breaks the proposal's single-file impact.
- Alternative: add okio or kotlinx-io. Rejected: neither exposes a public common CRC-32 (okio's is `internal`), and the proposal excludes new dependencies.

**2. Trailer: a final line `crc32:` + 8 lowercase hex digits.**
Exported bytes = `payload + "\ncrc32:" + hex8(crc32(payload))`, where `payload` is exactly what `export` produces today (including the empty payload for no notes). The trailer is a fixed 15 bytes (`\n` + `crc32:` + 8 hex).
- Text, not 4 raw bytes: the file stays valid UTF-8 and readable in an editor, and the label leaves room for a different algorithm later.
- Identified by position (last 15 bytes), never by scanning for the prefix, so a note whose text contains `crc32:` cannot collide.

**3. Verify before decoding.**
`import` first checks that the file is at least 15 bytes long and that the last 15 bytes match `\ncrc32:[0-9a-f]{8}` exactly. It then computes CRC-32 over the preceding bytes and compares. Only on a match does it UTF-8-decode and parse the payload with the existing line logic. A short file, a missing or malformed trailer, or a mismatch all raise `CorruptBackup`. Truncation therefore fails closed, and garbled bytes never reach the parser.

**4. `CorruptBackup` is an exception; `import` keeps returning `List<Note>`.**
`class CorruptBackup(message: String) : Exception(message)` in the `backup` package. The importer already signals malformed input by throwing, and there are no callers, so a result type would add API churn without benefit.

## Risks / Trade-offs

- [Rollback: an importer without this change reads the trailer line as a note, and `split(limit = 3)` destructuring throws] → Rollback is safe only before any checksummed backup has been exported. After that, a rollback must keep a trailer-stripping importer.
- [CRC-32 misses 1 in 2^32 random corruptions and any deliberate edit] → Acceptable for transit damage, which is the stated goal. Tamper detection is a non-goal.
- [Hand-rolled CRC could be subtly wrong (bit order, final XOR)] → Pin it with the standard check value and a JVM cross-check against `java.util.zip.CRC32` in Android unit tests.

## Migration Plan

None: no checksum-less backups exist (proposal.md). Deploy exporter and importer together, since they share one file. See Risks for rollback.
