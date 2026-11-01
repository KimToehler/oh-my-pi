# Design

## Context

See proposal.md - Why. Current state in `:shared`:

- `Settings.apiToken` (`shared/src/commonMain/kotlin/settings/Settings.kt:11`) is a plain in-memory `var` initialised to `null`.
- `Settings` already persists one secret, `syncPassphrase` (`Settings.kt:6-8`), through the injected `SecureStore("settings")` under the key `sync-passphrase`; `null` removes the entry, anything else writes it.
- `SecureStore` (`shared/src/commonMain/kotlin/storage/SecureStore.kt:9`) is an `expect class` with `put`/`get`/`remove`. Android actual: `EncryptedSharedPreferences` with an AES256-GCM `MasterKey` from the Android Keystore (`SecureStore.android.kt:10-16`). iOS actual: the Keychain through the `KeychainBridge` Swift helper (`SecureStore.ios.kt:5-17`).
- `ApiClient.get(path, token)` (`shared/src/commonMain/kotlin/http/Client.kt:10-11`) takes the token per call and sends it as `Authorization: Bearer`; it does not read `Settings` itself.

## Goals / Non-Goals

**Goals:**
- `Settings.apiToken` reads and writes through the existing `SecureStore`, so the token survives restarts and is encrypted at rest on both platforms.
- Clearing the token in settings deletes the stored entry.
- Keep the public shape of `Settings.apiToken` (`String?` property) so existing callers compile unchanged.

**Non-Goals:**
- No change to `SecureStore`, its platform actuals, or `KeychainBridge`.
- No change to `ApiClient` or how the token is attached to requests.
- No token validation, expiry, refresh, or server-side revocation.
- No migration of previously entered tokens: they were never persisted, so nothing exists to migrate.

## Decisions

### Store the token in the existing `settings` SecureStore namespace under key `api-token`

`apiToken` becomes a delegating property identical in shape to `syncPassphrase`: getter `secrets.get("api-token")`, setter `secrets.remove("api-token")` for removal and `secrets.put("api-token", value)` otherwise.

- Why: one convention for secrets in `Settings`; the same `secrets` instance is constructor-injected, so tests can pass a fake `SecureStore` exactly as they can for the passphrase.
- Alternative: a separate `SecureStore("api-token")` namespace. Rejected: a second Android `EncryptedSharedPreferences` file and a second Keychain service for one value, with no isolation benefit since both secrets belong to the same user and settings screen.

### Blank input counts as removal

The setter removes the entry when the value is `null` or blank, and stores it otherwise.

- Why: a cleared text field in settings typically yields `""`, not `null`. Storing `""` would persist a token that makes `ApiClient` send `Authorization: Bearer ` and would not satisfy "removing the token deletes it from the device".
- Alternative: remove only on `null` (the `syncPassphrase` behaviour) and rely on the UI to map empty input to `null`. Rejected: puts a storage guarantee on every caller.

### Read through on every access, no in-memory cache

The getter calls `secrets.get` each time, as `syncPassphrase` does.

- Why: no second copy that can diverge from the store after `remove`, and no cache invalidation to get wrong. A Keychain or decrypted-preferences read per API call is negligible next to the network request.
- Alternative: cache in a backing field loaded once. Rejected: saves nothing measurable and adds a stale-state path.

### Scope

One subsystem: `Settings` in `:shared` commonMain. Both platform behaviours come from the unchanged `SecureStore` actuals, so no platform code changes.

### Build vs. adopt: encrypted token storage
- Repository: `shared/src/commonMain/kotlin/storage/SecureStore.kt:9` (`expect class SecureStore`, encrypted key-value store for small secrets), with actuals at `shared/src/androidMain/kotlin/storage/SecureStore.android.kt:9` (Android Keystore-backed `EncryptedSharedPreferences`) and `shared/src/iosMain/kotlin/storage/SecureStore.ios.kt:14` (Keychain via `KeychainBridge`); already used for `syncPassphrase` at `shared/src/commonMain/kotlin/settings/Settings.kt:5-8`.
- Platform: not searched, covered above
- Candidates: not searched, covered above
- Decision: adopt `SecureStore` from this repository.

## Risks / Trade-offs

- [iOS Keychain items survive app uninstall, so a reinstalled app may find the old token] → Accepted: matches existing `syncPassphrase` behaviour; the user can remove the token in settings. Changing Keychain lifetime belongs to `KeychainBridge`, out of scope here.
- [Android `remove`/`put` use `SharedPreferences.apply()`, which writes to disk asynchronously; a process kill immediately after clearing could leave the old token on disk] → Accepted for parity with `syncPassphrase`; in-process reads see the change immediately. Switching `SecureStore` to `commit()` would affect every secret and is out of scope.
- [`androidx.security:security-crypto` (used by `SecureStore.android.kt:4-5`) is not declared in `shared/build.gradle.kts`'s `androidMain.dependencies`] → Pre-existing; this change adds no new dependency. The task list should confirm the Android target builds before relying on it.
- [`EncryptedSharedPreferences` corrupt-keyset failures (e.g. after a backup restore to another device) make `get` throw instead of returning `null`] → Pre-existing for `syncPassphrase`; not changed here, the user re-enters the token if the store is reset.

## Migration Plan

No data migration: the token was memory-only. After upgrade, users enter the token once more and it persists from then on. Rollback: reverting `Settings.kt` restores memory-only behaviour; any stored `api-token` entry is then ignored and stays in the store until the user clears app data (iOS: until the Keychain item is deleted).
