# Design

## Context

See proposal.md - Why. `shared/src/commonMain/kotlin/backup/Backup.kt` exports notes as UTF-8 text, one line per note (`id\ttitle\tbody`, newlines in the body escaped as `\n`), and imports by decoding the bytes and splitting lines. Nothing in the module computes a checksum today. `:shared` targets `androidTarget()`, `iosArm64()` and `iosSimulatorArm64()` (`shared/build.gradle.kts:7-9`), so the checksum must be available from `commonMain`, and the Kotlin common stdlib has no CRC-32.

## Goals / Non-Goals

**Goals:**
- Detect truncated or accidentally altered backup files before any note is parsed.
- Keep the exported file plain UTF-8 text, as the existing line format promises.
- Produce the same checksum on Android and iOS so a backup moves between platforms.

**Non-Goals:**
- Tamper resistance or authenticity. CRC-32 detects accidental corruption only; a deliberate edit can recompute it.
- Reading backups that have no checksum (proposal: none are in circulation).
- Changing how malformed note lines inside a checksum-valid file fail; that is an exporter bug, not transit damage.
- Streaming; export and import keep working on a whole `ByteArray`, as today.

## Decisions

### Checksum trailer: fixed-length text line at the end of the file

`export` builds the note bytes `B` exactly as today, then appends the 15-byte ASCII trailer `"\ncrc32:" + hex8(crc32(B))`, with `hex8` as 8 lowercase hex digits, zero-padded. The trailer is always present, also for an empty note list.

`import` checks, before decoding anything: length is at least 15, the last 15 bytes start with `\ncrc32:` and end in 8 lowercase hex digits, and that value equals `crc32` of every byte before the trailer. Any failure refuses the file with `CorruptBackup`. Only then are the bytes before the trailer parsed with the existing line logic.

Why: a fixed length makes the trailer position independent of note content, so no note text can be mistaken for it, and truncation always removes or damages it. The file stays valid UTF-8 text and readable in an editor.

Alternatives considered:
- 4 raw big-endian bytes at the end: equally unambiguous and 11 bytes smaller, but makes the file no longer UTF-8 text. Rejected for that reason.
- Header line instead of trailer: truncation would leave the header intact, and the reader would still detect the mismatch, but the exporter would have to build the body before writing the header anyway. No gain over a trailer.
- Variable-length trailer found by "last line": a note line could imitate it, and import would need content-dependent parsing. Rejected.

### `CorruptBackup` is an exception thrown by `BackupImporter.import`

`class CorruptBackup(message: String) : Exception(message)` in `backup/Backup.kt`; `import` keeps its `List<Note>` return type and throws it on any trailer or checksum failure.

Why: the current import already signals a malformed file by throwing, and keeping the signature leaves every caller source-compatible. Alternative: return a sealed `ImportResult` (`Ok(notes)` / `CorruptBackup`). It makes the failure explicit in the type, but changes the signature for every caller for a single new failure case. Rejected.

### CRC-32 through `expect`/`actual` over the platform implementations

`internal expect fun crc32(bytes: ByteArray): UInt` in `commonMain/kotlin/backup/`, with:
- `androidMain`: `java.util.zip.CRC32().apply { update(bytes) }.value.toUInt()`.
- `iosMain` (default hierarchy, shared by both iOS targets): `platform.zlib.crc32(0u, ptr, bytes.size.convert())` over `bytes.usePinned`. An empty array is passed as a null pointer with length 0, because `addressOf(0)` on an empty array throws.

Both compute the same CRC-32 variant (ISO-HDLC / IEEE 802.3: reflected polynomial `0xEDB88320`, init and final XOR `0xFFFFFFFF`). A common test pins the check value `crc32("123456789") == 0xCBF43926u` and runs on both targets, so a divergent `actual` fails the build.

### Build vs. adopt: CRC-32 checksum
- Repository: none. Searched the `-sources.jar` of every `commonMain` dependency of `io.ktor:ktor-client-core:3.3.1` (`shared/build.gradle.kts:13`): ktor-client-core, ktor-events, ktor-http, ktor-http-cio, ktor-sse, ktor-websocket-serialization, ktor-websockets, ktor-serialization, ktor-utils, ktor-io 3.3.1; kotlinx-io-core and kotlinx-io-bytestring 0.8.0; kotlinx-coroutines-core 1.10.2; kotlinx-serialization-core 1.9.0; kotlin-stdlib 2.2.20. The only hits are a MIME type in ktor-http `Mimes.kt:653` and `@sample` references to non-shipped samples in kotlinx-io-core (`RawSink.kt:40`, `unsafe/UnsafeBufferOperations.kt:305`). Platform-engine dependencies (`ktor-client-okhttp`, `ktor-client-darwin`) are not visible to `commonMain` and were not searched.
- Platform: Android: `java.util.zip.CRC32`, https://developer.android.com/reference/java/util/zip/CRC32. iOS: zlib `crc32()`, https://zlib.net/manual.html. The Kotlin/Native platform library `platform.zlib` binds it with `linkerOpts = -lz` (https://github.com/JetBrains/kotlin/blob/v2.2.20/kotlin-native/platformLibs/src/platform/ios/zlib.def; platform libraries: https://kotlinlang.org/docs/native-platform-libs.html). Both platforms are covered.
- Candidates: not searched, covered above.
- Decision: adopt `java.util.zip.CRC32` (Android) and `platform.zlib.crc32` (iOS) behind one `internal expect fun crc32`. No new dependency, as the proposal requires.

## Risks / Trade-offs

- [The Android and iOS `actual`s disagree on variant, sign or byte range] → shared check-value test (`123456789` → `cbf43926`) plus an export→import round-trip test, both run on Android unit tests and `iosSimulatorArm64Test`.
- [Trailer parsing accepts uppercase or otherwise non-canonical hex, so two byte sequences decode to the same backup] → import accepts only the exact form export writes (8 lowercase hex digits).
- [Empty `ByteArray` pinned on iOS] → null pointer with length 0; covered by the empty-note-list round trip.
- [A backup produced before this change is refused] → accepted. The proposal states none are in circulation, so no compatibility path is built.
- [CRC-32 misses some multi-bit errors (about 1 in 2³² for random damage)] → acceptable for accidental transit corruption, which is the proposal's goal; authenticity is a non-goal.
