# Proposal

## Why

Users of the Kotlin Multiplatform app (Android and iOS) must sign in with the company Keycloak before they can see their orders. The app's API calls carry no credential today: `shared/http/Client.kt:5` returns an unconfigured `HttpClient()`.

## What Changes

- A Gradle Kotlin Multiplatform build for `shared/` (Android and iOS targets). The repository has none today, so nothing in `shared/` can be compiled or tested.
- OIDC sign-in against Keycloak with authorization code, PKCE (S256), `state` and `nonce`, built on the `kotlin-multiplatform-oidc` library (`io.github.kalinjul.kotlin.multiplatform`, 0.18.4). The app validates the token response before it accepts a session.
- A session held in platform-protected storage (Android Keystore-encrypted DataStore, iOS Keychain with a this-device-only accessibility class). The session is refreshed before the access token expires and signed out when Keycloak rejects the refresh token.
- An API client that sends the access token only to the configured API origin and never follows redirects. It replaces `httpClient()` in `shared/http/Client.kt`.
- A platform entry point per target that builds these parts from build-config values (issuer, client ID, redirect URI, API origin).

**Scope narrowed by user decision (2026-10-31, plan review round 3, "Shared only + contract"):** this change delivers the shared module only. Platform wiring is a separate change, `oidc-app-integration`, proposed and reviewed before it is implemented: Activity/redirect registration, URL schemes, backup rules, build-config values per flavor and showing the order list after sign-in. design.md, "Platform contract", defines what that change must do. Until it lands, no user-visible behaviour changes.

## Capabilities

### New Capabilities

- `oidc-sign-in`: signing in with Keycloak, holding and refreshing the session, and authenticating API requests.

### Modified Capabilities

None.

## Impact

- New build: `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`, Gradle wrapper, `shared/build.gradle.kts`.
- `shared/http/Client.kt` moves to `shared/src/commonMain/kotlin/app/http/Client.kt`; `httpClient()` is replaced by `apiHttpClient(...)`. The repository has no caller of `httpClient()`.
- New `shared/src/{commonMain,androidMain,iosMain}/kotlin/app/auth/`.
- New dependencies: kotlin-multiplatform-oidc 0.18.4 (`oidc-appsupport`), Ktor 3.3.3 (core, OkHttp, Darwin, mock for tests), kotlinx-serialization 1.9.0, kotlinx-coroutines 1.10.2.
- Test fixture: a disposable local Keycloak realm under `shared/testing/keycloak/`.
- Operational prerequisite (outside this repository): the production Keycloak client is a public client with PKCE method S256 enforced and standard flow only.
