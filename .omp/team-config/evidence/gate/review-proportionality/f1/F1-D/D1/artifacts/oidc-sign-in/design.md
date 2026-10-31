# Design

## Context

Today the repository holds one source file, `shared/http/Client.kt`, whose `httpClient()` returns a bare `HttpClient()`. There is no Gradle build, no Android or iOS app and no order screen. These come from the prerequisite change `kmp-app-shell` (D2), which must be proposed, reviewed and merged before this change is applied. Task 1.1 refuses to start otherwise.

## Goals / Non-Goals

**Goals:**
- Every requirement in `specs/oidc-sign-in/spec.md` on Android and iOS, with one shared Kotlin implementation of the protocol.

**Non-Goals:**
- User-initiated sign-out, account switching, and Keycloak-side logout (`end_session`). The only sign-out in this change is the one forced by a rejected refresh (D9).
- Reading or trusting ID token claims. The ID token is discarded (D3).
- Background refresh timers. Refresh happens only before an API request (D8).
- Building the app shells, the order list or the Gradle build (D2).

## Decisions

### D1. Own OIDC client

The app implements the authorization code flow with PKCE and token refresh itself, in `shared/src/commonMain/kotlin/app/auth/`, so both platforms run the same protocol code. The alternative was AppAuth-Android plus AppAuth-iOS behind expect/actual: two implementations, two state machines and two sets of tests. Because the protocol is our own code, every validation that a library would hide is specified here: D3 to D9.

### D2. Prerequisite `kmp-app-shell` and the contract this change relies on

`kmp-app-shell` is a separate change, proposed and reviewed before this one is implemented. This change relies on exactly these parts of it:

1. `./gradlew` and `settings.gradle.kts` that include `:shared` and `:androidApp`.
2. `:shared` is a Kotlin Multiplatform module with `com.android.library` and the targets `androidTarget`, `iosArm64` and `iosSimulatorArm64`. Its source sets are `commonMain`, `commonTest`, `androidMain`, `androidUnitTest` (JVM), `androidInstrumentedTest` and `iosMain`. It has the Gradle tasks `:shared:testDebugUnitTest`, `:shared:iosSimulatorArm64Test` and `:shared:connectedDebugAndroidTest`. Its dependencies are Ktor client (core, OkHttp engine on Android, Darwin engine on iOS, `ktor-client-mock` in `commonTest`), kotlinx-coroutines, kotlinx-serialization-json, kotlinx-datetime and Compose Multiplatform with `compose.uiTest`.
3. `shared/http/Client.kt` moved unchanged to `shared/src/commonMain/kotlin/app/http/Client.kt`. It is still the only factory of the API `HttpClient` and installs no `Logging` plugin.
4. `app.config.AppConfig` with `apiBaseUrl` (an `https` URL).
5. `app.orders.OrderRepository(client: HttpClient)`, which loads `GET {apiBaseUrl}/orders`, and `app.ui.App()`, the shared root composable that today shows `OrderListScreen`. `:androidApp` hosts it in `MainActivity`; `iosApp/iosApp.xcodeproj` hosts it through `MainViewController()`.
6. The Android `applicationId` and the iOS bundle identifier are the same reverse-DNS id, called `APP_ID` below. The `iosApp` scheme has a hosted XCTest target `iosAppTests`, and `:androidApp` has `connectedDebugAndroidTest`.

### D3. Keycloak endpoints and client

- `OidcConfig(issuer, clientId, redirectUri)` is built by `OidcConfig.create`. It refuses an issuer that is not `https`, except `http` on the hosts `localhost` and `127.0.0.1` (needed by the test Keycloak in task 6.1). It refuses a redirect URI other than `APP_ID:/oauth2redirect` ([RFC 8252 §7.1](https://www.rfc-editor.org/rfc/rfc8252#section-7.1)). Values come from Android `BuildConfig` fields and the iOS `Info.plist` keys `OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_REDIRECT_URI`.
- The endpoints are derived from the issuer, `{issuer}/protocol/openid-connect/auth` and `{issuer}/protocol/openid-connect/token`, with no discovery fetch. That leaves one trust input, the configured issuer.
- Keycloak client `orders-app` settings: public; Standard Flow only (no implicit flow, no direct access grants); PKCE method `S256` required; exactly the one redirect URI; realm "Revoke Refresh Token" on with "Refresh Token Max Reuse" 0. The test realm in task 6.1 encodes the same settings. Configuring the staging and production clients is ops work outside this repo; it must be done before F1 (task 7.2).
- The authorization request sends `response_type=code`, `client_id`, `redirect_uri`, `scope=openid`, `state`, `code_challenge` and `code_challenge_method=S256`. The token response's `id_token` is discarded: not parsed, not stored, not logged.

### D4. Sign-in attempt and authorization-response predicate

- `AuthSession.startSignIn()` creates one `SignInAttempt`, holding `state` and `codeVerifier` (each 32 bytes from the platform CSPRNG, base64url without padding, 43 characters) and `createdAt`. It is kept in memory only and replaces any earlier pending attempt. The challenge is `BASE64URL(SHA-256(verifier))`. The CSPRNG and SHA-256 are expect/actual: Android `SecureRandom` and `MessageDigest`, iOS `SecRandomCopyBytes` and `CC_SHA256`.
- `AuthSession.completeSignIn(redirect: String)` checks the following, in this order, and stops at the first failure with a `SignInFailure` kind:
  1. Take and clear the pending attempt atomically, under the session mutex (D8). None pending → `NoPendingAttempt`. Clearing it first makes a replayed redirect fail at this step.
  2. The attempt is older than 10 minutes → `Expired`.
  3. The redirect's scheme, host and path differ from the configured redirect URI → `RedirectMismatch`.
  4. `state` is missing or differs from the attempt's state (constant-time comparison) → `StateMismatch`.
  5. An `error` parameter is present → `AuthorizationError(code)`. The code is kept only if it matches `[a-z_]{1,64}`; `error_description` is ignored.
  6. `iss` is missing or differs from the issuer ([RFC 9207](https://www.rfc-editor.org/rfc/rfc9207)) → `IssuerMismatch`.
  7. `code` is missing or empty → `MissingCode`.
- Steps 1 to 7 send no network request. Only after all of them pass does D5 run.
- `AuthSession.cancelSignIn()` (the iOS session reports cancel) clears the pending attempt.

### D5. Token exchange and commit order

- `OidcClient` owns a dedicated Keycloak `HttpClient`: `followRedirects = false`, `HttpTimeout` request timeout 10 s, `expectSuccess = false`, no `Logging`. It is never used for API requests.
- Exchange: POST form `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier` to the token endpoint.
- The token response is accepted only when all of these hold: HTTP 200; JSON with `token_type` equal to `Bearer` (case-insensitive); non-empty `access_token` and `refresh_token`; integer `expires_in > 0`.
- On acceptance, `AuthTokens(accessToken, refreshToken, accessTokenExpiresAt = now + expires_in)` is first written to the `TokenStore`. Only after the write succeeds does the session become `SignedIn` in memory. If the write fails, the result is `StorageFailed` and the session stays `SignedOut`.
- Failure kinds: HTTP 400 with `error=invalid_grant` (wrong PKCE verifier, reused or expired code) → `Rejected`; any other status, malformed body or incomplete response → `TokenEndpointError`; I/O or timeout → `Network`. No failure stores anything.

### D6. Holders and sinks of protected values

Protected values are the access token, refresh token, authorization code and code verifier. `state` is not secret, but it is never logged either.

| Value | Holders | Allowed sinks | Everything else |
|---|---|---|---|
| access token | `AuthSession` memory; `TokenStore` | `Authorization` header to the API origin only (D7) | forbidden |
| refresh token | `AuthSession` memory; `TokenStore` | token endpoint request body | forbidden |
| authorization code | redirect URI (from the browser); local during `completeSignIn` | token endpoint request body | forbidden |
| code verifier | `SignInAttempt` memory only | token endpoint request body | forbidden |

- **Chokepoints.** API sending goes only through the `ApiAuth` plugin in `Client.kt` (D7). Keycloak sending goes only through the `OidcClient` client (D5). Persistence goes only through `TokenStore` (D10).
- **Redaction.** `AuthTokens.toString()`, `SignInAttempt.toString()` and every `SignInFailure`, `AuthState` and exception `toString()`/`message` print no value from the table. Failures carry only kinds, HTTP status codes and the validated `error` code. No `Logging` plugin is installed on either client, and no crash or analytics reporter exists or is added.
- **UI.** The sign-in screen shows a fixed string per failure kind, with no parameters.
- **Proof.** `TokenLeakTest` (task 2.4) runs every flow with sentinel values and scans every sink. Storage tests (tasks 4.1, 4.2) check the at-rest form. F1 scans the device logs (task 7.2).

### D7. Request pipeline (`Client.kt`)

- `httpClient(session: AuthSession, config: AppConfig): HttpClient` replaces `httpClient()`. Every caller is updated; in the D2 contract that is the one `OrderRepository` construction, which moves into `AppController` (D12).
- The client sets `followRedirects = false`. A 3xx surfaces to the caller as `ApiRedirectRejected`, and no request follows.
- Plugin `ApiAuth`, built with `createClientPlugin`:
  - `onRequest`, when the request origin (scheme, host, port) equals `config.apiBaseUrl`'s origin: `token = session.validAccessToken()` (D8), then set `Authorization: Bearer <token>`, replacing any existing value. For any other origin, remove any `Authorization` header.
  - `onResponse`: a 401 from the API origin calls `session.markAccessTokenExpired(tokenUsed)`, and the response is returned unchanged.
- Signed-out (`NotSignedIn`), rejected (`SignedOut`) and unavailable (`AuthUnavailable`) outcomes are thrown from `validAccessToken()` before the request leaves the client.

### D8. Refresh: threshold, single-flight, failure classes

- `AuthSession` has one `Mutex`. `validAccessToken()`, `completeSignIn`, `markAccessTokenExpired` and the D9 sign-out all run under it, so state transitions are serialised.
- Inside the lock, `validAccessToken()` does:
  1. State `SignedOut` → throw `NotSignedIn`.
  2. `accessTokenExpiresAt - now >= 60 s` → return the current access token.
  3. Otherwise call `OidcClient.refresh(refreshToken)`:
     - **Success** (same acceptance rule as D5; Keycloak rotates the refresh token): write the new tokens to the store, set them in memory, return the new access token. If the store write fails, the new tokens stay in memory. The next refresh writes again (Risks).
     - **Rejected** (HTTP 400 `error=invalid_grant`): D9, then throw `SignedOut`.
     - **Transient** (I/O, 10 s timeout, 5xx, 429, any other 4xx or error code, malformed or incomplete body): keep the tokens. If `accessTokenExpiresAt > now`, return the current access token; otherwise throw `AuthUnavailable`. Nothing is retried inside the call; the next request tries again.
- Callers that wait on the mutex re-check step 2 after acquiring it. They find the refreshed token and do not refresh again, so with rotation (D3) two concurrent requests never send the same refresh token twice.
- `markAccessTokenExpired(tokenUsed)` sets `accessTokenExpiresAt = 0` only if `tokenUsed` is still the current access token, so a 401 that arrives after a refresh does not discard the new token.
- `now` comes from an injected `kotlinx.datetime.Clock`; tests use a fake clock.

### D9. Sign-out on rejected refresh: order of effects

Under the mutex:
1. `TokenStore.clear()`. Android deletes the Keystore key, which makes any remaining ciphertext undecryptable, and then the file. iOS calls `SecItemDelete`.
2. Clear the in-memory tokens and any pending attempt.
3. Publish `AuthState.SignedOut` on `state: StateFlow<AuthState>`.
4. Throw `SignedOut` to the waiting request, which is never sent.

`AppController` (D12) observes step 3 and shows the sign-in screen. If step 1 throws, steps 2 to 4 still run. The next cold start then reads the leftover entry, and its first refresh is rejected again, which signs out again (Risks).

### D10. Platform token storage

- **Android `KeystoreTokenStore`:** AES-256-GCM key `orders_auth_tokens` in `AndroidKeyStore` (non-exportable). The ciphertext of the JSON-serialised `AuthTokens` (12-byte IV prefix) is written to `noBackupFilesDir/auth/tokens.bin` via a temp file and rename. Files under `noBackupFilesDir` are excluded from Auto Backup and device transfer. `load()` returns `null` and deletes the file and key when decryption fails (key invalidated, corrupt file).
- **iOS `KeychainTokenStore`:** `kSecClassGenericPassword`, service `APP_ID.auth`, account `tokens`, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, which keeps the item out of iCloud Keychain and out of restores to other devices. Keychain items survive app deletion. So on first use, when the `NSUserDefaults` flag `auth.installed` is absent, the store deletes the item before setting the flag.
- **Cold start:** `AuthSession.restore()` reads the store once. Tokens present → `SignedIn` (no network call). Absent or unreadable → `SignedOut`.

### D11. Entry paths and the checks each runs

| Entry path | Platform code | Shared checks | Platform-specific control |
|---|---|---|---|
| Android redirect | `OidcRedirectActivity` in `:androidApp`, exported, `VIEW`/`DEFAULT`/`BROWSABLE` filter on scheme `APP_ID` (Android ignores `path` without a host, so the path is checked in D4 step 3); forwards `intent.data` to `completeSignIn` and finishes | D4, D5 | `RedirectEntryTest` (task 5.2); F1 `android-forged-redirect` |
| iOS redirect | `ASWebAuthenticationSession` with `callbackURLScheme = APP_ID` in `iosMain`; the completion handler calls `completeSignIn` or `cancelSignIn`. The scheme is not registered in `CFBundleURLTypes`, so `openURL` cannot deliver a redirect | D4, D5 | `RedirectEntryTests` (task 5.3); F1 `ios-forged-redirect` |
| Refresh | shared `AuthSession` | D8, D9 | `AuthSessionTest` on both targets (task 2.3); F1 refresh and rejected-refresh per platform |
| Rejected-refresh sign-out | shared `AuthSession` + platform `TokenStore.clear()` | D9 | store tests (tasks 4.1, 4.2); F1 rejected-refresh per platform |
| Cold start with stored tokens | shared `restore()` + platform `TokenStore.load()` | D10 | store tests (tasks 4.1, 4.2); F1 relaunch steps per platform |

The PKCE mismatch is decided by Keycloak and handled by the shared D5 code. Its real-surface run (F1 `android-pkce-mismatch`) needs Chrome remote debugging to change the challenge in the browser. On iOS, the only part of this path that differs is the Darwin HTTP engine, which `ios-first-sign-in` exercises against the same token endpoint.

### D12. Order access gate

`app.AppController` (commonMain) is one instance per process. `AppController.get(platform)` creates it on first call and returns the same instance afterwards. It is called by `App()`, by Android `OidcRedirectActivity` (with `applicationContext`) and by the iOS launcher, so the redirect reaches the session that started the attempt. Tests build their own instance through the constructor. It owns `AuthSession` (with `restore()` started on creation), `OidcClient`, the platform `TokenStore`, the API client from D7 and `OrderRepository`, and exposes `screen: StateFlow<Screen>`:
- `Restoring` → `Screen.Loading`
- `SignedOut` → `Screen.SignIn(failure)`
- `SignedIn` → `Screen.Orders`, which loads orders on entry

`App()` renders `screen`. `OrderRepository` is called only on entering `Screen.Orders`. The `ApiAuth` plugin additionally refuses any API request while signed out (D7). The platform browser launch (Custom Tab on Android via `androidx.browser`, D11 on iOS) is the expect/actual `BrowserLauncher.open(url)`.

### D13. One change, not a cut

The change touches the shared auth core, the HTTP client, the two platform entry layers and the UI gate. These cannot ship separately because they share one contract, `AuthSession`, and one cutover: sign-in is the moment `Client.kt` starts sending tokens.
- The HTTP plugin without sign-in has no token to send.
- Sign-in without the plugin delivers no access to orders.
- Neither platform receiver has anything to deliver to without the shared core.
- The gate is the switch that makes the order list depend on all of the above.

The prerequisite D2, which can ship on its own, is cut out as its own change.

## Risks / Trade-offs

- [Store write fails after a rotated refresh] The new refresh token lives only in memory. After a restart the old one is rejected and the user signs in again. → Rare, and safe: no token leaks.
- [`TokenStore.clear()` fails in D9] A rejected token stays at rest until the next cold start signs out again. On Android, deleting the key first makes the leftover file undecryptable. → Store tests cover `clear()`.
- [Response lost after Keycloak rotated the refresh token] The next refresh is rejected and the user signs in again. → Accepted by design (D8 transient handling cannot know).
- [Device wall clock moves backwards] The token looks valid but the API returns 401. → D7 `markAccessTokenExpired` makes the next request refresh.
- [Process death while the browser is open (Android)] The in-memory attempt is lost, and the redirect fails with `NoPendingAttempt`. The user taps Sign in again. → The verifier is never at rest.
- [Chrome may not hand a gesture-less redirect to the app when Keycloak's SSO session auto-completes] → F1 `android-first-sign-in` includes a second sign-in with an existing Keycloak SSO session.
- [Production Keycloak without RFC 9207 `iss`] Sign-in fails closed with `IssuerMismatch`. → F1 against the staging Keycloak exposes it before merge.
