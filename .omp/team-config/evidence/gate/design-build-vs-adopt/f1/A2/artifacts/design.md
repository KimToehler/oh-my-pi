# Design

## Context

See proposal.md - Why and What Changes.

Current state of the repository:

- `settings.gradle.kts:2` includes only `:shared`. The Android, iOS and desktop app shells named in the proposal's Impact are not in this repository. This design fixes the contract the shells must meet; it does not change shell code here.
- `shared/build.gradle.kts:6-23` defines the targets `androidTarget`, `iosArm64`, `iosSimulatorArm64` and `jvm("desktop")` on Kotlin 2.2.20, with `ktor-client-core:3.3.1` and the OkHttp and Darwin engines. `desktopMain` declares no engine, and the module has no auth, storage, serialization or coroutines dependency of its own.
- `shared/src/commonMain/kotlin/http/Client.kt:9-12`: each `ApiClient.get` caller passes an optional `token`, and `ApiClient` sets it as `Authorization: Bearer`. Nothing obtains, stores or refreshes a token.

Constraints that shape the approach:

- Proposal: on every release target, use only components whose maintainers mark them stable for that target. The usual KMP OIDC library is stable on Android and iOS but experimental on desktop JVM (see Build vs. adopt below), so desktop needs a separate adapter.
- Proposal: refresh happens *before* expiry. A 401 from the API is not the refresh trigger.
- Keycloak accepts `http://127.0.0.1` as a redirect URI on any port, for native apps that open a loopback server on a random port ([Keycloak: Redirect URIs](https://www.keycloak.org/securing-apps/oidc-layers)).

## Goals / Non-Goals

**Goals:**

- One shared session core in `commonMain` holds token state, expiry, single-flight refresh and sign-out on refresh failure. Platform code covers only the browser authorization step, the token-endpoint calls and secure storage.
- Every component on a target is marked stable for that target by its maintainers.
- On every target the system browser handles sign-in. No embedded WebView, per RFC 8252 §8.12.
- `ApiClient` gets its token from the session. Callers no longer pass one in.

**Non-Goals:**

- User-initiated sign-out, RP-initiated logout (end session) and token revocation. The proposal does not include them.
- A 401-triggered refresh-and-retry in `ApiClient`.
- Client-side JWT parsing or signature validation. The app treats the access token as opaque; the API validates it.
- Upgrading Kotlin to 2.3 or Ktor past 3.3.x. See D3 for the pinned library line this forces.
- HTTPS claimed redirects (Android App Links, iOS associated domains).
- Removing the legacy username/password sign-in. It lives in the shells, not in this repository.

## Decisions

### D1. One change despite three subsystems

The change touches three independently testable parts: the platform authorization adapters, secure token storage, and the session core together with `ApiClient`. They ship together because they form one cutover around one shared contract, `StoredTokens` plus `SessionManager.accessToken()`. The API accepts only Keycloak access tokens. Sign-in alone still leaves `ApiClient` without a token. `ApiClient` changes alone have no token to send. Storage alone has nothing to store. Shipping any part on its own leaves the app unable to call the API.

### D2. Shared session core, platform adapters behind two interfaces

`commonMain`, package `com.example.fieldnotes.auth`:

- `AuthConfig`: issuer `https://sso.fieldnotes.example/realms/fieldnotes`, client ID, redirect URI, and scopes `openid offline_access`.
- `StoredTokens`: access token, refresh token, `expiresAtEpochSeconds`, and optional ID token. This is the only persisted record.
- `AuthorizationGateway` (one implementation per platform):
  - `suspend fun signIn(): StoredTokens` runs the browser flow and the code exchange.
  - `suspend fun refresh(refreshToken): RefreshOutcome`, where `RefreshOutcome` is one of `Refreshed(StoredTokens)`, `Rejected` (the token endpoint returned an OAuth error) or `Unavailable(cause)` (transport failure or 5xx).
- `TokenStore` (one implementation per platform): `load(): StoredTokens?`, `save(StoredTokens)`, `clear()`.
- `SessionManager`:
  - `state: StateFlow<SessionState>` emits `SignedOut` or `SignedIn`.
  - `signIn()` runs the browser flow.
  - `accessToken(): String?` refreshes the token when it is near expiry.
  - On construction it loads the token record from `TokenStore`, so a signed-in user stays signed in across app restarts.
  - Time comes from an injected `now: () -> Long` (epoch seconds), so tests control the clock.

Alternatives rejected:

- Implementing refresh and expiry separately on each platform: the same policy would exist three times and the copies would drift.
- Adopting one library for every target: the only KMP candidate is experimental on JVM (D3).

### D3. Source sets: `mobile` group for kmp-oidc, `desktopMain` for Nimbus

`kotlin { applyDefaultHierarchyTemplate { common { group("mobile") { withAndroidTarget(); withIos() } } } }` gives Android and iOS a shared `mobileMain` source set:

- `mobileMain` depends on `io.github.kalinjul.kotlin.multiplatform:oidc-appsupport:0.16.5` and implements `AuthorizationGateway` with `OpenIdConnectClient` and the platform `CodeAuthFlowFactory`.
- kmp-oidc must not go into `commonMain`. There it would put its experimental JVM target on the desktop classpath.
- 0.16.x is the line the library's compatibility table maps to Kotlin 2.2.20 and Ktor 3.3.+. 0.17.0 and later require Kotlin 2.3.0.
- `desktopMain` depends on `com.nimbusds:oauth2-oidc-sdk:11.38.2` (D7).

Only kmp-oidc's core client and app-support flow are used. Its `oidc-tokenstore` and `oidc-ktor` modules are marked experimental and stay out.

### D4. Redirect URIs per target

- Android and iOS use `com.example.fieldnotes:/oauth2redirect`, a reverse-domain private-use scheme (RFC 8252 §7.1).
  - The Android shell sets the manifest placeholder `oidcRedirectScheme = "com.example.fieldnotes"` and calls `AndroidCodeAuthFlowFactory.registerActivity` in `onCreate`.
  - The iOS shell creates `IosCodeAuthFlowFactory`. With `ASWebAuthenticationSession`, iOS needs no URL-scheme declaration (kmp-oidc `docs/setup-ios.md`).
- Desktop uses `http://127.0.0.1:<ephemeral>/oauth2redirect`, a loopback redirect (RFC 8252 §7.3).

The desktop choice departs from the proposal, which names the custom scheme for every target. A JVM desktop app can receive a custom scheme only with per-OS registration from its installer (macOS `CFBundleURLTypes`, Windows registry, Linux `.desktop`) plus forwarding into the already-running instance. RFC 8252 recommends loopback for desktop, Keycloak supports it on any port, and the proposal's Impact lists only the Android and iOS shells for the redirect. The `keycloak-sign-in` spec should state the desktop redirect as loopback.

### D5. Public client with PKCE S256 and `offline_access`

The client is a Keycloak public client: no client secret ships in the apps, and PKCE uses `S256`.

The app requests the `offline_access` scope. Without it, the refresh token lives only as long as the Keycloak SSO session (SSO Session Idle / SSO Session Max), so a user who reopens the app later would be signed out. An offline token stays valid while the app refreshes at least once per Offline Session Idle (thirty days per the Keycloak docs), which is what "stays signed in across app restarts" requires. Keycloak requires users to hold the realm role `offline_access` and the client to carry the `offline_access` client scope as optional, which Keycloak sets by default ([Keycloak Server Admin: Offline access](https://www.keycloak.org/docs/latest/server_admin/index.html#_offline-access)).

Alternative rejected: raising the realm's SSO Session Idle. That would lengthen browser SSO sessions for every client in the realm.

### D6. Expiry and refresh policy

- `expiresAtEpochSeconds` is the local receipt time plus `expires_in` from the token response (kmp-oidc `AccessTokenResponse.received_at + expires_in`; Nimbus `AccessToken.getLifetime()`). The token's `exp` claim is not used. A device clock that is off from the server's clock therefore does not change when the app refreshes. This also needs no JWT parsing.
- `accessToken()` returns the stored token while `now() < expiresAt - 60 s`. Otherwise it refreshes. Refresh runs on demand and is single-flight under a `kotlinx.coroutines.sync.Mutex`: concurrent callers wait for one refresh and reuse its result. A background timer was rejected: a timer cannot keep running on iOS or Android while the app is suspended.
- On `Refreshed`, the new record is written to `TokenStore` before the access token is returned. If the response has no refresh token, the previous one is kept, which covers Keycloak's optional refresh-token rotation.
- On `Rejected`, or when there is no refresh token, the session is cleared: `TokenStore.clear()`, then `state = SignedOut`, then `accessToken()` returns `null`. This is the proposal's "a failed refresh signs the user out".
  - `Rejected` means the token endpoint answered with an OAuth error (4xx with `error`, typically `invalid_grant`). This is kmp-oidc `OpenIdConnectException.UnsuccessfulTokenRequest` with a 4xx status, or Nimbus `TokenErrorResponse`.
- On `Unavailable` (kmp-oidc `TechnicalFailure`, `IOException`, 5xx), the session is kept and `accessToken()` throws a retriable error. A field app that goes offline must not sign the user out. The spec should state this split between refused and failed-to-reach.

### D7. Desktop authorization adapter

The flow:

1. Nimbus resolves `OIDCProviderMetadata` from the issuer.
2. The adapter builds the `AuthorizationRequest` with a `State`, a `CodeVerifier` and `CodeChallengeMethod.S256`.
3. It binds `com.sun.net.httpserver.HttpServer` to `127.0.0.1:0` and puts the bound port into the redirect URI.
4. It opens the authorization URL with `java.awt.Desktop.browse`.
5. It accepts exactly one request on `/oauth2redirect` and verifies `state`.
6. It answers the browser with a static "you can close this window" page and stops the server.
7. It exchanges the code with an `AuthorizationCodeGrant`.

Refresh uses a `RefreshTokenGrant`. Nimbus performs blocking I/O over its own HTTP client, so all calls run on `Dispatchers.IO`, and desktop needs no Ktor engine for auth. The receiver gives up after 5 minutes, and `signIn()` then fails with a timeout. If `Desktop.isSupported(Action.BROWSE)` is false, `signIn()` fails with an explicit error.

### D8. Android: no WebView fallback, survive process death

kmp-oidc's Android factory falls back to a WebView when no Custom Tabs provider exists, even with `useWebView = false` (`AndroidCodeAuthFlowFactory.kt:116` at 0.16.5). The Android gateway prevents this:

- It checks `CustomTabsClient.getPackageName(context, null)` before `startLogin()`. When that returns no provider, it fails with a "no supported browser" error and never reaches the WebView path.
- If Android kills the app process while the browser is open, the shell calls `SessionManager.completePendingSignIn()` at startup. That method wraps `canContinueLogin()`/`continueLogin()`, following kmp-oidc's split between `startLogin()` and `continueLogin()`.

### D9. Persisted record and per-platform storage

`StoredTokens` is stored as one JSON item using kotlinx-serialization (`kotlinx-serialization-json:1.9.0`, the release for Kotlin 2.2). One item means each write replaces all four fields at once. A record that fails to decode is cleared and treated as signed out.

| Target | Storage |
|---|---|
| Android | AES-256-GCM key in `AndroidKeyStore`, non-exportable. The `Cipher` ciphertext with its IV goes into app-private `SharedPreferences`, and that file is excluded from Auto Backup by the shell. |
| iOS | One Keychain generic-password item (`kSecClassGenericPassword`, service `com.example.fieldnotes.auth`) with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. Kotlin/Native `platform.Security` provides the Keychain calls. |
| Desktop | `com.github.javakeyring:java-keyring:1.0.4`. The OS store is macOS Keychain, Windows Credential Manager, or Secret Service/KWallet on Linux. |

### D10. `ApiClient` takes a token provider

`ApiClient(http, baseUrl, tokens: AccessTokenProvider)`. `AccessTokenProvider` is a `fun interface` that `SessionManager` implements. `get(path)` loses its `token` parameter and sets `Authorization: Bearer` from `tokens.accessToken()`, keeping the header code at `Client.kt:11`. When the provider returns `null`, `get` throws `NotSignedInException` and sends no request. This is a clean cutover with no overload for the old signature.

### Build vs. adopt: OIDC authorization code flow with PKCE, discovery, code exchange and refresh grant

- Repository: none. `ApiClient` (`shared/src/commonMain/kotlin/http/Client.kt:9-12`) only attaches a given token. `shared/build.gradle.kts:13-21` has only Ktor client core and engines, with no OAuth/OIDC module.
- Platform:
  - Android has no OIDC client; Custom Tabs (`androidx.browser`) only opens the browser.
  - iOS `ASWebAuthenticationSession` (https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession) handles the browser and the callback, but not PKCE, discovery or token requests.
  - The JDK has no OAuth client.
  - None of these covers the flow.
- Candidates:
  - kmp-oidc (https://github.com/kalinjul/kotlin-multiplatform-oidc). Newest 0.18.4, 2026-09-29; the Kotlin 2.2.20 line ends at 0.16.5, 2026-02-12. Apache-2.0. Maintained: last push 2026-10-10. Its README marks Android and iOS Stable and Desktop (JVM) Experimental.
    - Android and iOS: adopt `oidc-appsupport` 0.16.5.
    - Desktop: reject. Gap: the maintainer marks JVM experimental, which the proposal forbids.
  - Nimbus OAuth 2.0 SDK with OpenID Connect extensions (https://bitbucket.org/connect2id/oauth-2.0-sdk-with-openid-connect-extensions). Newest 11.38.2, 2026-07-21. Apache-2.0. Maintained. It covers discovery, PKCE, the code grant and the refresh grant on the JVM. Adopt for desktop.
  - AppAuth-Android `net.openid:appauth` (https://github.com/openid/AppAuth-Android). Newest 0.11.1, 2021-12-22. Apache-2.0. No release in almost five years. Reject. Gap: Android-only and pre-1.0; kmp-oidc already covers Android and shares the gateway code with iOS.
- Decision: adopt kmp-oidc `oidc-appsupport` 0.16.5 on Android and iOS, and Nimbus `oauth2-oidc-sdk` 11.38.2 on desktop.

### Build vs. adopt: desktop loopback redirect receiver and system-browser launch

- Repository: none. `desktopMain` has no dependencies (`shared/build.gradle.kts:12-22`).
- Platform:
  - JDK `com.sun.net.httpserver.HttpServer`, a supported, exported module `jdk.httpserver` (https://docs.oracle.com/en/java/javase/21/docs/api/jdk.httpserver/com/sun/net/httpserver/HttpServer.html).
  - `java.awt.Desktop.browse` (https://docs.oracle.com/en/java/javase/21/docs/api/java.desktop/java/awt/Desktop.html).
  - Together they cover binding to `127.0.0.1:0`, receiving one redirect and opening the browser.
- Candidates: not searched, covered above.
- Decision: adopt `HttpServer` and `Desktop.browse` from the JDK.

### Build vs. adopt: secure on-device token storage

- Repository: none. Nothing in `:shared` persists data.
- Platform:
  - Android: Android Keystore system plus `javax.crypto.Cipher` AES/GCM (https://developer.android.com/privacy-and-security/keystore). Covers Android.
  - iOS: Keychain Services (https://developer.apple.com/documentation/security/keychain-services). Covers iOS.
  - JVM: none. `java.security.KeyStore` (PKCS12) is a password-protected file, and the app would have to store that password somewhere itself. The JDK has no API for the OS credential store.
- Candidates:
  - Android and iOS: not searched, covered above.
  - Desktop:
    - kmp-oidc `oidc-tokenstore` (https://github.com/kalinjul/kotlin-multiplatform-oidc). 0.18.4, 2026-09-29. Apache-2.0. Maintained. Reject. Gap: the README marks the Token Store experimental, and it has no desktop implementation.
    - java-keyring (https://github.com/javakeyring/java-keyring). Newest 1.0.4, 2023-08-30. BSD-3-Clause. Not archived, but the last push was 2023-09-30. It covers macOS Keychain, Windows Credential Manager and Linux Secret Service/KWallet. Adopt.
    - Microsoft credential-secure-storage-for-java (https://github.com/microsoft/credential-secure-storage-for-java). MIT. Archived. Reject. Gap: archived.
    - Microsoft msal4j-persistence-extension (https://github.com/AzureAD/microsoft-authentication-extensions-for-java). 1.3.0, 2024-04-05. MIT. Archived. Reject. Gap: archived.
- Decision: adopt Android Keystore with AES-GCM `Cipher` on Android, Keychain Services on iOS, and java-keyring 1.0.4 on desktop.

### Build vs. adopt: JSON encoding of the persisted token record

- Repository: none. `:shared` declares no serialization dependency or plugin (`shared/build.gradle.kts:1-4,13-21`).
- Platform: the Kotlin common stdlib has no JSON codec. Android `org.json`, iOS `NSJSONSerialization` and the JDK (none) do not share an API, so the format would have to be written once per platform.
- Candidates: kotlinx.serialization (https://github.com/Kotlin/kotlinx.serialization). Newest 1.12.0, 2026-10-20, built on Kotlin 2.4.10. 1.9.0, 2025-06-27, is the release for Kotlin 2.2 (its CHANGELOG: "Kotlin 2.2 is required"); 1.10.0 and later are based on Kotlin 2.3. Apache-2.0. Maintained by JetBrains. Adopt 1.9.0 with the `plugin.serialization` 2.2.20 Gradle plugin.
- Decision: adopt `kotlinx-serialization-json` 1.9.0.

### Build vs. adopt: bearer-token attachment and pre-expiry refresh coordination

- Repository:
  - `shared/src/commonMain/kotlin/http/Client.kt:11` already sets `Authorization: Bearer`.
  - Ktor's `ktor-client-auth` belongs to the installed Ktor 3.3.1 release train but is not declared. In 3.3.1, `BearerAuthProvider` has no `cacheTokens` switch (source at tag 3.3.1). It caches `loadTokens` until `clearToken()` and calls `refreshTokens` only after a 401 (https://ktor.io/docs/client-bearer-auth.html). `cacheTokens` appears in 3.4.0.
- Platform: none. Refresh is an OAuth grant and is covered by the adapters above.
- Candidates:
  - kmp-oidc `oidc-ktor` with `TokenRefreshHandler`, 0.18.4. Reject. Gap: the README marks Ktor support and the Token Store experimental, and neither works on desktop.
  - Ktor `ktor-client-auth` 3.3.1. Reject. Gap: it refreshes only after a 401 and caches tokens. Pre-expiry refresh would need a Ktor upgrade to 3.4 or later (non-goal), and even then it adds only the 401 retry the proposal does not ask for.
- Decision: partial.
  - Adopted: the existing header code (`Client.kt:11`), and the refresh grant from kmp-oidc and Nimbus.
  - Built: the expiry check and single-flight `Mutex` in `SessionManager`. This is about 30 lines of project glue.
  - Gap: no stable component on these Ktor and Kotlin versions refreshes before expiry.

## Risks / Trade-offs

- [kmp-oidc 0.16.x is an older line; fixes land on 0.18.x] → Pin 0.16.5 exactly. Move to 0.18.x together with the Kotlin 2.3 upgrade, which is a non-goal here. Only `mobileMain` depends on it.
- [java-keyring has had no release since 2023-08] → It is used only by the desktop `TokenStore` actual, so replacing it touches one file. Contract tests on `TokenStore` run against every actual.
- [Desktop OS stores protect tokens only when the app is packaged as a signed bundle or MSIX. On Linux an unlocked keyring adds nothing over user-file permissions (java-keyring README).] → The app takes the protection the OS gives. Desktop packaging is out of scope; the gap is recorded for the release owner.
- [Offline tokens live long on the device, and this change does not revoke them (non-goal)] → They are stored only in OS secure stores (D9). Keycloak admins can revoke offline sessions per user or client.
- [Android Auto Backup restores ciphertext whose Keystore key did not move] → The shell excludes the preferences file from backup. Decrypt failure clears the record and counts as signed out (D9).
- [iOS Keychain items survive app uninstall] → A first-launch marker in `NSUserDefaults` clears the Keychain item when the marker is missing.
- [Several desktop instances share one keyring item. If the realm enables refresh-token rotation, a concurrent refresh in another instance gets `invalid_grant` and signs this instance out.] → The Keycloak client keeps "Revoke Refresh Token" off (the default). Single-flight covers one process only.
- [A local process races to the loopback port, or a forged redirect arrives] → The server binds only to `127.0.0.1`, uses an OS-assigned ephemeral port, accepts one request, and checks `state`. PKCE makes an intercepted code useless without the verifier.
- [No Custom Tabs provider on an Android device] → Sign-in fails with an explicit error instead of opening a WebView (D8).
- [A 60 s refresh margin with a short realm access-token lifespan causes frequent refreshes] → This is acceptable. The margin is a `SessionManager` constant if tuning is ever needed.

## Migration Plan

1. Keycloak, realm `fieldnotes`, one public client:
   - Standard flow on, direct access grants off.
   - PKCE code challenge method `S256` required.
   - Valid redirect URIs `com.example.fieldnotes:/oauth2redirect` and Keycloak's port-agnostic `http://127.0.0.1` loopback entry.
   - `offline_access` kept as an optional client scope.
2. Ship `:shared` and the shells together. The Android and iOS shells wire up the redirect (D4, D8) and drop password sign-in. The desktop shell needs no redirect registration.
3. Existing users: no token migration. The API already rejects the old credentials, so on first launch after the update the user sees Keycloak sign-in.
4. Rollback: going back to the password-based build is not viable because the API accepts only Keycloak tokens. Roll back to the previous build of this change, or fix forward. The Keycloak client can stay as it is.

## Open Questions

- The Keycloak client ID. It is a configuration value in `AuthConfig`.
- The exact redirect-URI string that makes Keycloak's loopback rule match `http://127.0.0.1:<port>/oauth2redirect` (`http://127.0.0.1` vs `http://127.0.0.1/*`). Check it against the realm when registering the client.
- Whether the realm is served under `/realms/fieldnotes` (Keycloak 17+ default) or the legacy `/auth/realms/fieldnotes`. Discovery reads the endpoints from whichever issuer is configured.
