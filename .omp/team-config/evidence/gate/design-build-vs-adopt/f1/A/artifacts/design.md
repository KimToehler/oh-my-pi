# Design

## Context

See proposal.md - Why. State of the repository that shapes the approach:

- The build includes one module, `:shared` (`settings.gradle.kts:2`). The Android and iOS app shells named in the proposal's Impact are not in this repository.
- `:shared` is built with Kotlin `2.2.20` and `com.android.library` `8.12.0` (`shared/build.gradle.kts:2-3`), targets `androidTarget()`, `iosArm64()`, `iosSimulatorArm64()` (`:7-9`), compiles against SDK 36 with `minSdk` 26 (`:26-27`), and depends only on Ktor `3.3.1` core plus the OkHttp and Darwin engines (`:13`, `:16`, `:19`). No version catalog and no Gradle wrapper are checked in.
- `ApiClient` (`shared/src/commonMain/kotlin/http/Client.kt:9-11`) takes an `HttpClient` and a base URL; each `get` accepts an optional `token` and, when given, writes `Authorization: Bearer <token>` itself. Nothing in the repository calls it, stores credentials, or talks to an identity provider.
- Keycloak realm `fieldnotes` at `https://sso.fieldnotes.example` publishes OIDC discovery at `https://sso.fieldnotes.example/realms/fieldnotes/.well-known/openid-configuration`; the redirect URI is `com.example.fieldnotes:/oauth2redirect` (a private-use scheme as RFC 8252 §7.1 describes).

## Goals / Non-Goals

**Goals:**
- Delegate every protocol, crypto and storage concern (PKCE, code exchange, token validation, encrypted persistence, refresh) to one maintained Kotlin Multiplatform library, so `:shared` owns only configuration and glue.
- Make the access token reach the API without any caller handling it: `ApiClient` obtains, attaches and recovers tokens itself.
- Keep the shells' part to a fixed, small integration contract (D6), so the same `:shared` code serves both platforms.

**Non-Goals:**
- User-initiated sign-out and Keycloak RP-initiated logout (`end_session_endpoint`); the proposal only requires local sign-out after a failed refresh.
- Offline tokens (`offline_access` scope); sessions stay bounded by the realm's SSO session limits (see Risks).
- Verified App Links / Universal Links; the proposal fixes a custom-scheme redirect.
- Reading identity claims (name, roles) from the ID token in the app.
- Desktop and Web targets, although the adopted library supports them.

## Decisions

### D1. Adopt Lokksmith for the whole OIDC client side

`dev.lokksmith:lokksmith-core` covers the authorization code flow with PKCE, the system-browser launch and redirect capture on both platforms, encrypted token persistence, and preemptive refresh with session reset on `invalid_grant`. One library covers three of the four mechanisms below, so the app holds one token store and one refresh path instead of stitching two libraries together. The per-mechanism searches follow.

### Build vs. adopt: OIDC authorization code flow with PKCE (browser launch, redirect capture, code exchange)
- Repository: none. Searched `settings.gradle.kts`, `shared/build.gradle.kts` and `shared/src/**`; the only dependencies are `io.ktor:ktor-client-core`/`-okhttp`/`-darwin` 3.3.1 (`shared/build.gradle.kts:13,16,19`), which offer no OAuth/OIDC client.
- Platform: partial. Android Custom Tabs (https://developer.chrome.com/docs/android/custom-tabs) and iOS `ASWebAuthenticationSession` (https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession) open the system browser and return the redirect, but neither implements PKCE, discovery, the token request or response validation.
- Candidates:
  - Lokksmith, https://github.com/svenjacobs/lokksmith (docs https://lokksmith.dev); newest `dev.lokksmith:lokksmith-core` 2.6.0, 2026-10-12; Apache-2.0; maintained (50 releases, 1.0.0 on 2026-06-08 through 2.6.0). Authorization code flow with PKCE, discovery, ID-token validation, Custom Tab / Auth Tab on Android via `LokksmithAuthFlowActivity`, `ASWebAuthenticationSession` on iOS, persisted in-flight flow state for process death. Adopt.
  - kotlin-multiplatform-oidc, https://github.com/kalinjul/kotlin-multiplatform-oidc; newest `io.github.kalinjul.kotlin.multiplatform:oidc-appsupport` 0.18.4, 2026-09-29; Apache-2.0; maintained. Reject, gap: its token store keeps no expiry and `oidc-ktor` refreshes only after a 401, so refresh-before-expiry and the `invalid_grant`-versus-transport distinction would be built; token store and Ktor integration are marked experimental; no client-side signature validation.
  - AppAuth-Android, https://github.com/openid/AppAuth-Android; newest `net.openid:appauth` 0.11.1, 2021-12-22; Apache-2.0; no release since 2021. Reject, gap: Android only (AppAuth-iOS is a separate Objective-C SDK), so no shared Kotlin flow, and no token persistence.
  - oauth-kmp, https://github.com/collectiveidea/oauth-kmp; newest `com.collectiveidea.oauth:oauth-core` 0.3.0, 2026-07-21; MIT; maintained but self-described work in progress before 1.0. Reject, gap: no token persistence or refresh policy, no OIDC discovery, and a transitive dependency served from a non-Central repository (`repo.repsy.io`).
- Decision: adopt `dev.lokksmith:lokksmith-core` 2.6.0.

### Build vs. adopt: on-device token storage
- Repository: none. Searched `shared/build.gradle.kts` and `shared/src/**`; no settings, key-value or keychain dependency exists.
- Platform: partial. iOS Keychain Services (https://developer.apple.com/documentation/security/keychain-services) stores secrets directly; Android Keystore (https://developer.android.com/privacy-and-security/keystore) stores only keys, so Android would need a built AES-GCM envelope around a file or preferences store, plus `expect`/`actual` glue.
- Candidates:
  - Lokksmith (see above): persists all client state, tokens included, encrypted with AES-256-GCM under a key held in the Android Keystore / iOS Keychain (https://lokksmith.dev/getting-started/encryption/). Adopt; it is the store the flow and refresh already read and write.
  - KVault, https://github.com/Liftric/KVault; newest `com.liftric:kvault` 1.12.0, 2023-10-11; MIT; no release since 2023. Reject, gap: a second store would duplicate the tokens Lokksmith already persists and would need glue to keep both in sync.
- Decision: adopt Lokksmith's encrypted persistence.

### Build vs. adopt: access-token refresh (OAuth 2.0 refresh grant, before expiry, sign-out on rejection)
- Repository: none. Searched `shared/src/**`; `ApiClient` never refreshes (`shared/src/commonMain/kotlin/http/Client.kt:10-11`).
- Platform: none. Searched the web for an iOS AuthenticationServices or Android platform API that performs the OAuth refresh-token grant. The results showed only third-party SDKs (AppAuth-iOS) and Apple Platform SSO (https://support.apple.com/guide/security/single-sign-on-security-sec0c87ccc6d/web), which is device-level enterprise SSO for MDM-managed devices and not an app token refresh. The browser APIs above end at the redirect.
- Candidates:
  - Lokksmith (see above): `Client.runWithTokens` refreshes when the access or ID token expires within `Client.Options.preemptiveRefreshSeconds` (default 60); `refresh()` holds a mutex across read, request and write so a concurrent caller uses the rotated refresh token; `runWithTokensOrReset` / `refreshOrReset` clear local tokens when the token endpoint answers `invalid_grant` and rethrow other failures. Adopt.
  - kotlin-multiplatform-oidc (see above): `TokenRefreshHandler` serialises refreshes, but no expiry is stored. Reject, gap: refresh-before-expiry would be built.
- Decision: adopt Lokksmith's `runWithTokensOrReset` / `refreshOrReset`.

### Build vs. adopt: attaching the Bearer token and retrying once after a 401
- Repository: none in use. `ApiClient` writes the header by hand from a caller-supplied string (`shared/src/commonMain/kotlin/http/Client.kt:10-11`); installed `ktor-client-core` 3.3.1 (`shared/build.gradle.kts:13`) does not contain the `Auth` plugin.
- Platform: not applicable; this is HTTP-client infrastructure, and the HTTP client is Ktor.
- Candidates:
  - `io.ktor:ktor-client-auth`, https://ktor.io/docs/client-bearer-auth.html; newest 3.6.1, 2026-10-29; Apache-2.0; maintained, same release train as the installed Ktor. `bearer { loadTokens; refreshTokens; sendWithoutRequest }` attaches the token, refreshes once on 401 and retries, and runs a single refresh for concurrent 401s. Adopt.
- Decision: adopt `io.ktor:ktor-client-auth`, version aligned with the other Ktor artifacts.

### D2. Upgrade the `:shared` toolchain to what Lokksmith 2.6.0 requires

Lokksmith 2.6.0 is compiled with Kotlin 2.4.21 and depends on Ktor 3.6.0 (https://lokksmith.dev/dependency-matrix/; its Gradle module metadata pins `kotlin-stdlib` 2.4.21 and `ktor-client-core` 3.6.0), and its AAR declares `minCompileSdk=37`. `:shared` therefore moves to Kotlin 2.4.21, all Ktor artifacts to 3.6.1, and `compileSdk` 37. Android Gradle Plugin 8.12 predates API 37, so AGP moves to 9.5.0; AGP 9 no longer accepts `com.android.library` together with the Kotlin Multiplatform plugin (https://developer.android.com/build/releases/agp-9-0-0-release-notes), so `:shared` switches to `com.android.kotlin.multiplatform.library` (https://developer.android.com/kotlin/multiplatform/plugin) and its `android {}` block moves into the Kotlin `android {}` target configuration. `minSdk` 26 already exceeds Lokksmith's 23.

Alternatives: Lokksmith 0.5.0, the last release built for Kotlin 2.2.20 / Ktor 3.3, stores state in plaintext (2.x migrates "state previously written as plaintext"), so it fails the storage requirement. kotlin-multiplatform-oidc 0.16.5 (2026-02-12) matches the current toolchain but leaves the refresh gap named above; its current line 0.18.x needs Kotlin 2.3.0 anyway. The upgrade touches one 28-line build file and one source file, which is the cheapest point to take it.

### D3. A `KeycloakSession` facade in `:shared` owns the Lokksmith client

`commonMain` gets one class, `KeycloakSession`, created once from the process-wide `Lokksmith` instance. It calls `lokksmith.getOrCreate("keycloak")` with the realm's discovery URL and client ID, and uses `Client.Options(preemptiveRefreshSeconds = 60)`. It exposes:

- `signedIn: StateFlow<Boolean>`, derived from `client.tokens`; consumers never see token values.
- `suspend fun prepareSignIn(): Initiation`, building `AuthorizationCodeFlow.Request(redirectUri = "com.example.fieldnotes:/oauth2redirect")` with scope `openid`. Lokksmith applies PKCE S256.
- `suspend fun accessToken(): String?` for `ApiClient`: `client.runWithTokensOrReset { tokens -> ... }`, returning `null` when no session exists or the session was reset.
- `suspend fun forceRefresh(): String?` for the 401 path: `client.refreshOrReset()`.

The launch is platform code, because each platform hands the browser a different object. `androidMain` adds `fun signInIntent(context: Context, initiation: Initiation): Intent` via `LokksmithAuthFlowActivity.createCustomTabsIntent`, and `iosMain` adds `suspend fun signIn()` via Lokksmith's `launchAuthFlow`. The result arrives through `client.authFlowResult` and `client.tokens`, so it survives Android process death, because Lokksmith persists the in-flight flow and receives the redirect in its own `LokksmithRedirectActivity`.

Alternative: expose the Lokksmith `Client` to callers. Rejected: callers could read raw tokens or call `resetTokens` with their own rules, and a later library swap would touch every caller.

### D4. "A failed refresh signs the user out" means the token endpoint rejected the grant

The session is cleared only when the token endpoint answers `invalid_grant`, which Keycloak returns for an expired, revoked or replayed refresh token or an ended SSO session. This is Lokksmith's default `DEFAULT_ERRORS`. A transport failure (no network, timeout, 5xx) or a malformed response keeps the stored tokens, and the API call fails with that error. Rejected alternative: clear the session on any refresh exception. A field app that starts offline after the access token expired would then lose its session every time. The specs should state this distinction as the sign-out trigger.

### D5. `ApiClient` installs Ktor `Auth` itself and drops the `token` parameter

`ApiClient(http, baseUrl, session)` builds its own client with `http.config { install(Auth) { bearer { ... } } }`:
- `cacheTokens = false` and `loadTokens { session.accessToken()?.let { BearerTokens(it, null) } }`, so every request goes through Lokksmith's preemptive check and no stale token is held in Ktor's cache.
- `sendWithoutRequest { it.url.host == Url(baseUrl).host }`: the token is sent up front, and only to the API host.
- `refreshTokens { session.forceRefresh()?.let { BearerTokens(it, null) } }`: a 401 caused by server-side revocation or clock skew past the leeway gets one forced refresh and one retry. A `null` result, meaning the session was reset, stops the retry, so the 401 reaches the caller.

The `token: String? = null` parameter of `get` (`shared/src/commonMain/kotlin/http/Client.kt:10`) is removed rather than kept beside the plugin, so no path can send a caller-chosen credential. `ApiClient` reads the token through a one-method `fun interface` that `KeycloakSession` implements, so `commonTest` can drive `ApiClient` with `ktor-client-mock` and a fake token source without Lokksmith.

Alternative: wrap each call in `runWithTokensOrReset` inside `ApiClient` and set the header by hand. Rejected: it rebuilds 401 detection, single-flight refresh and retry, which `ktor-client-auth` already provides.

### D6. Shell integration contract

The shells are outside this repository, so `:shared` documents these items in its README (new) and the shells must apply them:
- Android app: `defaultConfig.addManifestPlaceholders(mapOf("lokksmithRedirectScheme" to "com.example.fieldnotes"))`; `compileSdk` 37 and an AGP that supports it; `SingletonLokksmithProvider.set(createLokksmith(context), scope)` and `KeycloakSession` creation in `Application.onCreate`; exclude `lokksmith_clients.preferences_pb` and `lokksmith_clients.key.preferences_pb` from Auto Backup and device transfer (`fullBackupContent`, `dataExtractionRules`).
- iOS app: register `com.example.fieldnotes` under `CFBundleURLTypes`; call `SingletonLokksmithProvider.set(createLokksmith(), scope)` at launch.
- Both: construct `ApiClient` with the `KeycloakSession` (constructor change from D5).

### D7. Scope: one cutover, not separable changes

The change touches the `:shared` build, `KeycloakSession`, `ApiClient`, and two shells. They cannot ship separately. The API already accepts only Keycloak access tokens (proposal - Why), so an `ApiClient` without sign-in has nothing to send, sign-in without the `ApiClient` wiring authenticates nothing, and neither works until the shells register the redirect. The toolchain upgrade has no behaviour of its own and exists only so that the adopted library compiles. It lands first in this change instead of as a separate change. The shared contract between the parts is D3's `KeycloakSession` and D6's shell list.

## Risks / Trade-offs

- [Toolchain jump: Kotlin 2.2.20→2.4.21, AGP 8.12→9.5, plugin switch to `com.android.kotlin.multiplatform.library`, `compileSdk` 37] → Done as the first, separately verified step (D2). The `:shared` source is one file, so breakage shows up at compile time. The shells must match `compileSdk` 37 (D6).
- [Lokksmith is young (1.0.0 June 2026), single-maintainer, 2.x in four months] → Only `KeycloakSession` imports it (D3), so a replacement stays inside one class. Pin the exact version.
- [Keycloak SSO Session Idle / Max bound refresh-token lifetime, so "stays signed in across restarts" ends when the realm session expires] → Refresh then returns `invalid_grant` and D4 signs the user out cleanly. Realm timeouts are a Keycloak setting, outside the app.
- [Refresh-token rotation: two concurrent preemptive refreshes] → Lokksmith's `refresh()` re-reads the token under `refreshMutex`, so the second caller uses the rotated refresh token rather than replaying the spent one. This costs at most one extra refresh, never a false `invalid_grant`.
- [Custom-scheme redirect can be claimed by another Android app] → PKCE S256 binds the code to the verifier, which only this app holds. App Links remain a Non-Goal.
- [Encrypted state does not survive backup restore to a new device (non-exportable Keystore key)] → Lokksmith treats unreadable state as absent, so the user signs in again. The D6 backup exclusions avoid restoring useless files.
- [`cacheTokens = false` reads the session for every request] → The read is an in-memory snapshot check, and the network is touched only inside the refresh window.

## Migration Plan

1. Upgrade the `:shared` toolchain (D2) with no source change, and confirm both targets compile.
2. Add Lokksmith and `ktor-client-auth`, then `KeycloakSession` (D3, D4).
3. Change `ApiClient` (D5) and remove the `token` parameter.
4. Apply the shell contract (D6) in both shells.

Rollback: revert the change in `:shared` and the shell commits together. No server-side or data migration exists; the previous password sign-in no longer works against the API (proposal - Why), so rollback restores the build, not a working login.

## Open Questions

- The Keycloak client ID for the app and confirmation that the realm client is public, requires PKCE S256 and lists `com.example.fieldnotes:/oauth2redirect` as a valid redirect URI. This is a configuration constant that changes neither the specs, the approach nor the task list.
