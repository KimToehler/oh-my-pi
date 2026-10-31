# Design

## Context

See proposal.md for motivation and the scope decision. The repository currently contains only `shared/http/Client.kt` (package `app.http`, `fun httpClient(): HttpClient = HttpClient()`, no callers). It has no Gradle build, no app modules and no source-set layout. Everything below is new, apart from the move and replacement of that function.

Library facts this design relies on (kotlin-multiplatform-oidc 0.18.4, read from its source at tag 0.18.4):

- `PreferencesCodeAuthFlow.continueLogin` rejects a mismatched `state` before redeeming the code. After redeeming, it rejects a `nonce` that differs from the request's; a missing ID token yields an empty nonce and is rejected too, unless `disableNonce` is set, which this design never sets. (`oidc-core/.../flows/CodeAuthFlow.kt`, `types/AuthCodeRequest.kt`.)
- The library does not verify signatures and does not check `iss`, `aud`, `azp` or `exp`. `Jwt.parse` only decodes (README "JWT Parsing").
- `DefaultOpenIdConnectClient(httpClient, config)` accepts our own Ktor `HttpClient`.
- `SettingsTokenStore` swallows every read, write and delete failure (`runOrNull`, which also `println`s the exception message). `IosKeychainSettingsStore` uses `kSecAttrAccessibleAfterFirstUnlock`, which allows backup and device migration. `AndroidDataStoreSettingsStore` encrypts each value with AES-256-GCM under a non-exportable Android Keystore key and throws when decryption fails.
- `oidcBearer` (Ktor `bearer`) sends the token to every host by default and refreshes only after a 401. `TokenRefreshHandler` keeps its lock private, so it cannot be ordered with sign-out.

## Goals / Non-Goals

**Goals:** the requirements in `specs/oidc-sign-in/spec.md`, delivered by `shared/` with tests that run on Android (host JVM and emulator) and the iOS simulator.

**Non-Goals:**

- Platform wiring and the order list (follow-up change `oidc-app-integration`, see "Platform contract").
- User-initiated sign-out, token revocation and Keycloak end-session. The only sign-out in this change is the forced one on refresh rejection or an unreadable session.
- Retrying an API request after a 401: an API 401 is returned to the caller. A session revoked on the server is detected at its next refresh.
- Discovery (`.well-known/openid-configuration`): endpoints are derived from the configured issuer.

## Decisions

### D1. Use kotlin-multiplatform-oidc for the protocol, own the session

We use the library for the authorization request (PKCE S256, `state`, `nonce`), browser hand-off (`AndroidCodeAuthFlowFactory`, `IosCodeAuthFlowFactory`), the `state`/`nonce` checks and the token-endpoint calls. We do not use its `SettingsTokenStore`, `TokenRefreshHandler` or `oidcBearer`, for the reasons listed under Context: silent storage failures, logging, a non-device-only Keychain class, a refresh lock we cannot share, and a bearer policy that is neither origin-bound nor proactive. Alternatives considered: a hand-written client (rejected by user decision; the whole protocol surface would become ours), and AppAuth-Android/AppAuth-iOS behind expect/actual (two native integrations, more glue).

### D2. Configuration (`app.auth.AuthConfig`)

`AuthConfig(issuer, clientId, redirectUri, apiOrigin)` comes from the app's build config (platform contract).

Construction fails with `IllegalArgumentException` in any of these cases:
- `issuer` or `apiOrigin` is not `https`;
- `apiOrigin` has a path, query or fragment;
- `clientId` or `redirectUri` is blank.

Endpoints are derived from the issuer in Keycloak's fixed layout: `<issuer>/protocol/openid-connect/auth` and `/token`. The OIDC client config uses scope `openid` and `codeChallengeMethod = S256`, and leaves `disableNonce` false.

### D3. Session storage (`app.auth.SessionStore`)

`SessionStore` sits on the library's `SettingsStore` interface (get/put/remove; implementations throw on failure). It writes one key, `session.v1`, holding JSON `StoredSession(accessToken, refreshToken, accessExpiresAtEpochSec, refreshExpiresAtEpochSec?)`. The ID token is validated at sign-in and then discarded, never stored.
- `read()` returns the session, or `null` when the key is absent.
- `read()` throws `SessionUnreadable` on any failure: decrypt or Keychain error, malformed JSON, a missing field, or an empty token.
- `write`/`delete` propagate failures; nothing is swallowed.

Platform stores:
- Android: the library's `AndroidDataStoreSettingsStore(context)`.
- iOS: our own `app.auth.DeviceKeychainSettingsStore`, built on multiplatform-settings `KeychainSettings` with service `<bundle id>.auth` and `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

### D4. Session state machine (`app.auth.SessionManager`)

`SessionManager(oidcClient, store, config, clock: kotlin.time.Clock)` exposes `state: StateFlow<SessionState>` (`SignedOut`, `SignedIn`). Each operation below runs under one `Mutex`. The mutex holds through the refresh network call, which the OIDC HTTP client bounds with a 15 s request timeout. Serializing these operations means a refresh cannot finish after a sign-out and restore tokens, and two refreshes cannot overlap.

- **restore** (on first use):
  - `store.read()` returns a session: `SignedIn`, cached in memory.
  - `null`: `SignedOut`.
  - `SessionUnreadable`: `store.delete()`, then `SignedOut`.
- **signIn(factory)** / **continueSignIn(factory)**: the second exists for Android process death; the platform calls it when `canContinueLogin()` is true. The browser step runs outside the mutex. The commit step runs under it:
  - validate the response (spec "Token response validation"; `exp` against `clock`);
  - compute `accessExpiresAt = now + expires_in` and `refreshExpiresAt` from `refresh_expires_in` when present;
  - `store.write()`, then `SignedIn`.
  - Any library exception, validation failure or write failure yields `SignInFailed(reason)`; no session is stored and the state stays `SignedOut`.
- **accessTokenForRequest()**, called by the API client for every request:
  - `SignedOut`: throw `NotSignedIn`.
  - `accessExpiresAt - now >= 60 s`: return the cached access token.
  - Otherwise refresh, under the same mutex: `refreshExpiresAt` passed → reject. Otherwise call `oidcClient.refreshToken(refreshToken)`.
    - Success: requires a non-empty access token and a positive `expires_in`. A returned ID token must pass the `iss`/`aud`/`azp`/`exp` checks; the nonce is not checked on refresh, per OIDC Core 12.2. A missing refresh token keeps the old one. Then `store.write()`. A write failure keeps the new tokens in memory for this process: the persisted older session is refreshed or rejected at next start, which fails toward sign-out.
    - A success response that fails these checks, an `UnsuccessfulTokenRequest` whose `errorResponse.error` is `invalid_grant`, `invalid_client` or `unauthorized_client`, or local refresh expiry: **reject**. State becomes `SignedOut`, then `store.delete()`; throw `SignedOutByServer`.
    - Anything else: throw `SessionUnavailable`; state and storage are unchanged.
- **Delete failure**: the state stays `SignedOut` and a `pendingDelete` flag is set. Every later operation retries the delete before doing anything else and never returns a token while the flag is set. See Risks.

Error types (`app.auth.SessionException`: `NotSignedIn`, `SignedOutByServer`, `SessionUnavailable`, `SignInFailed(reason: SignInFailure enum)`, `UntrustedOrigin(origin)`) carry a fixed message, an enum reason and at most an HTTP status code or OAuth error code. They never take a library exception as `cause`, never carry response bodies and never carry token or claim values.

### D5. API client (`app.http.apiHttpClient`)

`apiHttpClient(session, config, engine): HttpClient` replaces `httpClient()`. It sets `followRedirects = false`, installs no `Logging` plugin, and installs a client plugin `SessionAuth` that runs before sending. If the request's scheme, host and effective port differ from `config.apiOrigin`, it throws `UntrustedOrigin` and nothing is sent. Otherwise it sets `Authorization: Bearer <session.accessTokenForRequest()>`, so `NotSignedIn`, `SignedOutByServer` and `SessionUnavailable` all propagate before sending. The OIDC client's own `HttpClient` (token endpoint only) also sets `followRedirects = false`, installs no `Logging`, and uses the same engine type.

### D6. ID-token signature

The ID token is received directly from the configured HTTPS token endpoint, with platform TLS validation. OIDC Core 3.1.3.7 step 6 lets the client use that TLS validation in place of checking the token signature. The app makes no authorization decision from ID-token claims beyond D4's checks, and authorization happens at the API with the access token. Adding JWKS verification would mean a key-fetch and rotation subsystem; we don't add it.

### D7. Platform entry points

- androidMain `createAuth(context, config): AuthComponents`: OkHttp engine, `AndroidDataStoreSettingsStore`, `AndroidCodeAuthFlowFactory(useWebView = false)`. The store is created once per process and memoized on the application context: the library opens a DataStore delegate per instance, and two DataStores on one file in one process throw.
- iosMain `createAuth(config): AuthComponents`: Darwin engine, `DeviceKeychainSettingsStore`, `IosCodeAuthFlowFactory()`.

`AuthComponents(session, apiClient, authFlowFactory)` is the contract surface for `oidc-app-integration`.

### D8. Why this is one change

The changed mechanisms are the build, configuration, session storage, the session state machine, the API client and the platform entry points. They cannot ship separately with useful behaviour. The API client's only input is the session's `accessTokenForRequest()`, and a session that nothing sends is inert. The stores are the session's persistence and have no other consumer. The build exists only to compile and test them. The platform wiring that can ship separately has been split off as `oidc-app-integration`. gate.md declares whole-diff review needed because the change spans more than three layers.

### Criterion boundaries

| Requirement | Boundary (where the invariant is checked) |
|---|---|
| Sign-in establishes a session | `SessionManager.signIn`/`continueSignIn` commit step; library `PreferencesCodeAuthFlow.continueLogin` (`state`) |
| Token response validation | `SessionManager` response validation, before `SessionStore.write` |
| Bearer token only to the API origin | `SessionAuth` plugin in `app.http.apiHttpClient`; `followRedirects = false` on both clients |
| Refresh before expiry | `SessionManager.accessTokenForRequest` under its mutex |
| Session restore fails closed | `SessionStore.read` → `SessionManager` restore |
| Credentials stay confidential | `SessionStore` + platform `SettingsStore`; `SessionException` construction |

## Platform contract (for `oidc-app-integration`)

The follow-up change must:
- supply `AuthConfig` from per-flavor build config;
- on Android: call `AndroidCodeAuthFlowFactory.registerActivity` in the launcher Activity's `onCreate`; call `continueSignIn` when `canContinueLogin()`; register the redirect scheme;
- on iOS: register the redirect URL scheme;
- exclude `datastore/org.publicvalue.multiplatform.oidc.tokenstore.preferences_pb` from Android Auto Backup and device transfer. A restored copy is only ciphertext, and D4 deletes it, but excluding it avoids a wasted restore;
- show the order list only in `SignedIn`, return to sign-in on `SignedOut`, and show a retry for `SessionUnavailable`;
- add no HTTP `Logging` plugin to `apiClient`.

## Risks / Trade-offs

- [Delete fails after a rejected refresh, then the process dies] → The stored tokens survive a restart. The access token stays valid at the API for at most its remaining lifetime (Keycloak access-token lifespan, default 5 min). The next refresh is rejected again, which signs the user out and retries the delete. Inside the running process the session is signed out at once (D4 `pendingDelete`). Declared in gate.md.
- [Holding the mutex through a refresh delays concurrent requests] → Bounded by the 15 s timeout. The alternative, a lock-free refresh, reopens the stale-completion race.
- [kotlin-multiplatform-oidc marks parts `@ExperimentalOpenIdConnect`] → We pin 0.18.4 and use only the flow, client and `SettingsStore` APIs read above. The negative-control tests exercise the library's `state`/`nonce` behaviour, so an upgrade that changes it fails the tests.
- [Clock changes on the device] → Expiry is computed from the app clock at receipt. A clock set forward triggers an early refresh; a clock set back leads to a 401 from the API, which is returned to the caller until the token is refreshed.

## Migration Plan

New capability; no data to migrate. Rollback is a revert of the change: nothing calls the new API until `oidc-app-integration` lands.
