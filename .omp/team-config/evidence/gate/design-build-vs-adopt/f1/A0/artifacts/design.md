# Design

## Context

See proposal.md - Why for motivation.

Current state of the repository:

- `settings.gradle.kts` includes only `:shared`, a Kotlin Multiplatform library (Kotlin 2.2.20, targets `androidTarget`, `iosArm64`, `iosSimulatorArm64`, Android `minSdk 26`). The Android and iOS app projects are not in this repository.
- `:shared` depends only on Ktor 3.3.1 (`ktor-client-core`, OkHttp engine on Android, Darwin engine on iOS). There is no auth, storage, serialization or test code yet.
- `shared/src/commonMain/kotlin/http/Client.kt`: `ApiClient(http, baseUrl).get(path, token: String? = null)` adds `Authorization: Bearer <token>` only when the caller passes a token. Nothing in the repository supplies one.

Constraints that shape the approach:

- The API accepts only Keycloak access tokens, so this change is a single cutover: no period where both sign-in methods are served.
- Native apps must use the system browser with authorization code + PKCE (RFC 8252); the redirect URI is the private-use scheme `com.example.fieldnotes:/oauth2redirect`.
- Keycloak issues a new refresh token on every refresh and, when the realm enables "Revoke Refresh Token", invalidates the old one on first reuse.
- Field use means the device is often offline.

## Goals / Non-Goals

**Goals:**

- All protocol logic (PKCE, authorization URL, code exchange, refresh, session state, expiry) lives in `commonMain` and is tested in `commonTest` without a device.
- Platform code is limited to three narrow seams: browser hand-off, secure token storage, and crypto primitives (SHA-256, secure random).
- The redirect is handled entirely inside `:shared` (library manifest on Android, `ASWebAuthenticationSession` on iOS), so the app shells only call the shared API.
- Tokens, authorization codes and PKCE verifiers never reach logs or plain-text storage.

**Non-Goals:**

- User-initiated sign-out, Keycloak RP-initiated logout and token revocation.
- Reading ID token claims or a user profile; the ID token is not stored or parsed.
- Refresh-and-retry when the API answers 401; `ApiClient` reports the 401 to its caller.
- OIDC discovery, dynamic client registration, multiple accounts, biometric unlock.
- UI changes in the Android and iOS app projects (outside this repository); they consume the API defined here.

## Decisions

### 1. Hand-written OIDC client on Ktor in `commonMain`

`com.example.fieldnotes.auth` (source dir `shared/src/commonMain/kotlin/auth/`, matching the `http/` convention) holds:

- `KeycloakConfig(issuer, clientId, redirectUri, scopes = "openid")`. Endpoints are derived from the issuer with Keycloak's fixed paths: `{issuer}/protocol/openid-connect/auth` and `{issuer}/protocol/openid-connect/token`, issuer `https://sso.fieldnotes.example/realms/fieldnotes`.
- `Pkce`: 32 random bytes → base64url verifier (43 chars), `S256` challenge; 16 random bytes → `state`.
- `TokenEndpoint`: `exchangeCode(code, verifier)` and `refresh(refreshToken)` as `application/x-www-form-urlencoded` POSTs with `client_id` (public client, no secret); parses `access_token`, `refresh_token`, `expires_in`.
- `AuthSession`: owns `StateFlow<AuthState>` (`SignedOut`, `SignedIn`), `signIn()`, and `suspend fun accessToken(): String`.

Alternatives considered:

- AppAuth-Android + AppAuth-iOS (via cinterop): two libraries with two token-state models, so refresh, single-flight and sign-out rules would be implemented twice and untestable in `commonTest`; cinterop for AppAuth-iOS adds a CocoaPods/SPM build path the project does not have. Rejected.
- A third-party KMP OIDC library: the protocol surface used here is two endpoints; owning roughly 300 lines of tested common code beats depending on a small library on the security-critical path. Rejected.
- OIDC discovery (`/.well-known/openid-configuration`): adds a network round trip and cache before every cold sign-in or refresh for a single, known IdP whose paths are stable. Rejected; a different path prefix (for example `/auth`) is a config change to `issuer`.

New dependencies: `ktor-client-content-negotiation` and `ktor-serialization-kotlinx-json` at 3.3.1, the `kotlin("plugin.serialization")` plugin at 2.2.20, `androidx.browser` (Custom Tabs) in `androidMain`; for tests `kotlin("test")`, `kotlinx-coroutines-test` and `ktor-client-mock` 3.3.1. SHA-256 and secure random are `expect`/`actual` (`MessageDigest`/`SecureRandom` on Android, `CC_SHA256`/`SecRandomCopyBytes` on iOS) instead of a crypto library; base64url uses the stdlib `kotlin.io.encoding.Base64`.

### 2. Authorization request and redirect validation

`signIn()` creates `state` and verifier, persists them as a pending request (decision 5), and opens the authorization URL with `response_type=code`, `client_id`, `redirect_uri`, `scope=openid`, `state`, `code_challenge`, `code_challenge_method=S256`. The redirect is accepted only if `state` matches the pending request and, when Keycloak sends `iss` (RFC 9207), `iss` equals the configured issuer. An `error` parameter, a mismatch, or user cancellation leaves the session `SignedOut` and clears the pending request; cancellation is not reported as an error.

### 3. Platform browser seam: `AuthBrowser`

`commonMain` declares `interface AuthBrowser { suspend fun authorize(url: String): AuthRedirect }`, returning the redirect URL or `Cancelled`.

- **iOS:** `ASWebAuthenticationSession` with callback scheme `com.example.fieldnotes`, `prefersEphemeralWebBrowserSession = false` so the Keycloak SSO cookie is shared with Safari. The presentation anchor is the key window of the foreground `UIWindowScene`. The session delivers the callback in-process; no `Info.plist` URL type is needed, so the iOS shell has no redirect configuration.
- **Android:** mirrors AppAuth's activity pattern, all declared in `shared/src/androidMain/AndroidManifest.xml` and merged into the app:
  - `AuthorizationActivity` (not exported) is started from the caller's `Activity`, opens a Custom Tab (falling back to `ACTION_VIEW` when no Custom Tabs provider exists), and stays beneath it.
  - `RedirectActivity` (exported, `intent-filter` on scheme `com.example.fieldnotes`; Android ignores path attributes without a host, so the filter matches the scheme) restarts `AuthorizationActivity` with `FLAG_ACTIVITY_CLEAR_TOP | FLAG_ACTIVITY_SINGLE_TOP`, which removes the Custom Tab from the back stack, then finishes.
  - `AuthorizationActivity` posts the URI (or `Cancelled` when it resumes without one, i.e. the user backed out of the tab) to a process-wide `AuthRedirects` channel with replay of one, then finishes.

Alternative: one exported redirect activity without the management activity. Rejected: the Custom Tab would stay on top of the app after the redirect.

### 4. Secure storage seam: `TokenStore`

`interface TokenStore { load(): StoredTokens?; save(StoredTokens); clear() }`, where `StoredTokens(accessToken, refreshToken, expiresAtEpochMs)` is serialized as one JSON blob so every write replaces access and refresh tokens together.

- **Android:** an AES-256-GCM key in the Android Keystore (alias `fieldnotes_tokens`, not user-authentication-bound), IV + ciphertext stored base64 in a private `SharedPreferences` file written with `commit()`. A blob that fails to decrypt (key lost, backup restored onto another device) is deleted and treated as signed out.
- **iOS:** one Keychain generic-password item with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (readable for background work after first unlock, excluded from iCloud Keychain and device migration). Keychain items survive app deletion, so a `NSUserDefaults` install marker (deleted with the app) is checked at startup; when it is missing the Keychain item is deleted before loading.

Alternative: `EncryptedSharedPreferences` (androidx.security-crypto). Rejected: the library is deprecated; the Keystore + GCM wrapper is small and has no third-party dependency.

### 5. Pending sign-in survives Android process death

The user often leaves the browser for a password manager or OTP app, and Android may kill the app process meanwhile. The pending request (`state`, verifier, created-at) is therefore written to the `TokenStore`'s backing store under a separate key before the browser opens, with a 10-minute validity. On creation, `AuthSession` collects `AuthRedirects`; a replayed redirect with a valid pending request completes the code exchange in the new process and moves the state to `SignedIn`. `AuthState` is the source of truth for the UI; `signIn()`'s return value is a convenience for the case without process death.

Alternative: treat process death as cancellation. Rejected: it fails the sign-in exactly in the OTP flow, after the user has already authenticated.

### 6. Token lifecycle in `AuthSession`

- **Startup:** stored tokens → `SignedIn` without a network call, even when the access token has expired; refresh happens lazily on the next API call so the app starts offline.
- **Expiry:** `expiresAtEpochMs = receiveTime + expires_in`, both from the device clock, so device clock offset from the server does not matter. `accessToken()` refreshes when less than 60 s remain.
- **Single flight:** a `Mutex` serializes refresh, sign-in completion and sign-out. Callers re-check freshness after acquiring it, so concurrent API calls trigger one refresh and the rotated refresh token is never reused. Sign-out under the same lock prevents a late refresh response from resurrecting a cleared session.
- **Persist before publish:** the new token pair is saved before the new access token is returned.
- **Failure classification:** a 4xx response from the token endpoint to a refresh (`invalid_grant` and the like) is an authoritative rejection: clear the store, state `SignedOut`, the triggering call throws `SessionExpiredException`. Transport errors, timeouts and 5xx keep the session and its tokens; the call throws the transient error, and the next call retries. This is how this design reads the proposal's "a failed refresh signs the user out": an offline device does not lose its session.
- **Session lifetime** is governed by Keycloak's client session idle/max settings; the app requests `openid` only. Alternative `offline_access` rejected: it requires the `offline_access` role for every user, creates offline sessions that outlive the SSO session and normal session revocation, and lengthens the exposure of a token taken from a device.

### 7. `ApiClient` takes a token source, not a token

`ApiClient(http, baseUrl, tokens: AccessTokenSource)` where `fun interface AccessTokenSource { suspend fun accessToken(): String }`, implemented by `AuthSession`. `get(path)` loses its `token` parameter (clean cutover; no caller in the repository passes one) and always sends `Authorization: Bearer <token>`. When signed out, `accessToken()` throws `NotSignedInException` and no request is sent: the API rejects unauthenticated calls anyway.

Alternative: Ktor's `Auth` plugin with `bearer { loadTokens; refreshTokens }`. Rejected: its refresh is 401-driven (the proposal asks for refresh before expiry), it keeps its own token cache beside `TokenStore`, and it would mix sign-out policy into HTTP client configuration.

`AuthSession` uses its own `HttpClient` without logging for the token endpoint, so an app-level logging plugin on the API client cannot capture codes or refresh tokens.

### 8. One change, not one per subsystem

The change spans four independently testable parts: the common auth core, the Android platform seams, the iOS platform seams, and `ApiClient`. They ship as one cutover because the API already rejects anything but Keycloak tokens: `ApiClient` without a token source cannot call the API, the core without platform seams cannot sign in, and a release with only one platform's seams leaves the other app unable to reach the API. The shared contract binding them is `AuthBrowser`, `TokenStore` and `AccessTokenSource`; tasks are grouped along those interfaces so each part is tested on its own.

## Risks / Trade-offs

- [Another Android app registers the `com.example.fieldnotes` scheme and intercepts the redirect] → PKCE `S256`: the intercepted code is useless without the verifier, which never leaves the process.
- [Refresh response received but app killed before `save`; with refresh-token revocation enabled the stored token is now invalid] → persist-before-publish keeps the window to one write; the outcome is one forced sign-in, not data loss.
- [Offline for longer than the Keycloak session idle time; the UI shows `SignedIn` until the next refresh attempt is rejected] → accepted: the server is the authority on session validity, and the next online call signs out cleanly.
- [Hand-written protocol code has bugs AppAuth has already fixed] → the surface is limited to code exchange and refresh; `commonTest` covers state mismatch, `error` redirects, 4xx vs transient refresh failures and concurrent refresh against `ktor-client-mock`.
- [Keystore and Keychain behaviour cannot run in `commonTest`; Robolectric does not provide the Android Keystore, and Keychain calls from simulator test binaries can fail with `errSecMissingEntitlement`] → platform stores stay thin and are verified with Android instrumented tests on an emulator and iOS simulator tests; the tasks must confirm the simulator test harness can access the Keychain before relying on it.
- [Tokens leak through logs] → no token, code or verifier is passed to any logger; `toString()` of `StoredTokens` and the pending request is overridden to redact values.
- [Upgrade signs every user out once] → expected with the identity move; see Migration Plan.

## Migration Plan

1. Keycloak admin registers the client in realm `fieldnotes`: public client, standard flow enabled, direct access grants disabled, PKCE method `S256` required, exact valid redirect URI `com.example.fieldnotes:/oauth2redirect`, client session idle/max set for mobile use.
2. Release the `:shared` change in both apps. No local data is migrated: existing users start `SignedOut` and sign in through Keycloak once.
3. Rollback: rolling the apps back to password sign-in does not work against the current API, so faults are fixed forward. A Keycloak-side fault (client misconfiguration) is fixed in the realm without an app release.

## Open Questions

- The Keycloak `client_id` for the mobile client; it is a value in `KeycloakConfig`.
- The client session idle/max values the realm sets for the mobile client; they determine how long a user stays signed in, not how the app behaves.
