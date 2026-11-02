# Design

## Context

See proposal.md - Why. `src/main/kotlin/Backup.kt` holds `BackupExporter` and `BackupImporter` for the line-based backup file.

## Goals / Non-Goals

Goals: detect truncated or altered backups on import. Non-Goals: repairing damaged backups, encryption.

## Decisions

### D1. CRC-32 written in `Backup.kt`

A private `Crc32` object in `Backup.kt` builds the 256-entry lookup table for the reflected polynomial `0xEDB88320` on first use and updates the running value byte by byte (`crc = table[(crc xor b) and 0xFF] xor (crc ushr 8)`), starting at `0xFFFFFFFF` and inverting at the end. Export appends `crc32:<hex>`; import recomputes it over every byte before the last line and refuses a mismatch with `CorruptBackup`.

### D2. Checksum line last

The checksum is the file's last line, so a truncated file loses or breaks it and fails the check.

## Risks / Trade-offs

- [CRC-32 does not detect deliberate tampering] → Backups are not a security boundary; the check targets transfer damage.

## Migration Plan

Ship in the next release. Rollback: the previous release.
