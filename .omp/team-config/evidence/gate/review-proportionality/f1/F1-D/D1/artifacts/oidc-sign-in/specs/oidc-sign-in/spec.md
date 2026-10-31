## ADDED Requirements

### Requirement: Sign-in with Keycloak

The app SHALL sign the user in with the OIDC authorization code flow with PKCE (`S256`) against the configured Keycloak issuer. It SHALL store tokens only after a token response with HTTP 200, `token_type` `Bearer`, a non-empty access token and refresh token, and a positive integer `expires_in`.

#### Scenario: First sign-in

- **WHEN** a signed-out user opens the app, taps Sign in and authenticates at Keycloak
- **THEN** the app exchanges the code with the attempt's code verifier, stores an access token and a refresh token, and shows the order list

#### Scenario: Incomplete token response

- **WHEN** the token endpoint answers HTTP 200 without a refresh token, with a `token_type` other than `Bearer`, or without a positive `expires_in`
- **THEN** sign-in fails, nothing is stored, and the app stays on the sign-in screen

#### Scenario: Negative control

- **WHEN** the redirect carries a code that Keycloak issued for a different code challenge than the one derived from the attempt's code verifier
- **THEN** sign-in MUST fail: Keycloak answers `invalid_grant`, no token is stored, and the app stays on the sign-in screen

### Requirement: Authorization response validation

The app SHALL accept a redirect as an authorization response only when all of these hold:
- a sign-in attempt started by the running app is pending and is at most 10 minutes old;
- the redirect's scheme, host and path equal the configured redirect URI;
- `state` equals the attempt's state;
- the redirect carries no `error` parameter;
- `iss` equals the configured issuer;
- `code` is present and non-empty.

The first redirect SHALL consume the pending attempt, whatever its outcome. A rejected redirect SHALL cause no token request and SHALL leave the current authentication state unchanged.

#### Scenario: Missing state

- **WHEN** a sign-in attempt is pending and the redirect carries a code but no `state`
- **THEN** sign-in fails with no token request

#### Scenario: Replayed redirect

- **WHEN** the redirect that completed a sign-in attempt is delivered a second time
- **THEN** it is rejected because no attempt is pending, and no token request is sent

#### Scenario: Error response

- **WHEN** the redirect carries the attempt's `state` and `error=access_denied`
- **THEN** sign-in fails with no token request, and the sign-in screen shows the fixed message for a refused sign-in

#### Scenario: Issuer mismatch

- **WHEN** the redirect carries the attempt's `state` and a code, but `iss` is missing or names another issuer
- **THEN** sign-in fails with no token request

#### Scenario: Expired attempt

- **WHEN** the redirect arrives more than 10 minutes after the attempt started
- **THEN** sign-in fails with no token request

#### Scenario: Negative control

- **WHEN** a redirect with a forged `state` and a code is delivered through the platform's redirect path (Android redirect activity, iOS `ASWebAuthenticationSession` callback or an `openURL` to the app)
- **THEN** accepting it MUST fail: no token request is sent, nothing is stored, and the app's authentication state is unchanged

### Requirement: Access token on API requests

The app SHALL attach `Authorization: Bearer <access token>` to every request whose origin (scheme, host, port) equals the configured API base URL's origin. It SHALL send no `Authorization` header to any other origin and SHALL NOT follow HTTP redirects on the API client. While signed out, the app SHALL send no API request.

#### Scenario: Order request carries the token

- **WHEN** a signed-in user's order list loads
- **THEN** the `GET /orders` request carries the current access token as a bearer token

#### Scenario: Other origin

- **WHEN** the API client sends a request to an origin other than the API base URL, even with a caller-set `Authorization` header
- **THEN** the request carries no `Authorization` header

#### Scenario: Negative control

- **WHEN** the API answers an order request with a 302 redirect to another host
- **THEN** forwarding the token MUST fail: no request reaches the other host, and the redirect surfaces as an error

### Requirement: Token refresh before expiry

Before sending an API request, the app SHALL refresh the access token when it expires in less than 60 seconds. At most one refresh SHALL be in flight; concurrent requests SHALL wait for it and use its result. After the API answers 401, the next request SHALL refresh first.

A refresh fails transiently on a network error, a timeout after 10 seconds, HTTP 5xx or 429, an error other than `invalid_grant`, or a malformed response. Then the app SHALL keep the stored tokens and send the request with the current access token only if that token has not expired.

#### Scenario: Refresh before expiry

- **WHEN** the access token expires in less than a minute
- **THEN** the app refreshes it before the next API request, stores the new access token and refresh token, and sends the request with the new access token

#### Scenario: Concurrent requests

- **WHEN** two API requests start while the access token expires in less than a minute
- **THEN** exactly one refresh request reaches Keycloak, and both API requests carry the new access token

#### Scenario: API rejects the access token

- **WHEN** the API answers 401 to a request carrying the current access token
- **THEN** the next API request refreshes the token first

#### Scenario: Transient failure with a valid token

- **WHEN** the access token expires in less than a minute, has not expired, and the refresh times out
- **THEN** the request is sent with the current access token, and the stored tokens are unchanged

#### Scenario: Negative control

- **WHEN** the access token has expired and the refresh fails with HTTP 503
- **THEN** sending the request MUST fail: no API request is sent, the stored tokens are unchanged, and the user stays signed in

### Requirement: Sign-out on rejected refresh

When Keycloak rejects the refresh token (HTTP 400 with `error=invalid_grant`), the app SHALL:
- delete the stored tokens;
- clear the in-memory session;
- switch to the signed-out state;
- not send the pending API request;
- show the sign-in screen.

#### Scenario: Relaunch after rejection

- **WHEN** the app is relaunched after a rejected refresh signed the user out
- **THEN** it shows the sign-in screen and sends no API request

#### Scenario: Negative control

- **WHEN** Keycloak rejects the refresh token
- **THEN** keeping the user signed in MUST fail: the stored tokens are deleted, the state is signed out, the pending order request is not sent, and the sign-in screen is shown

### Requirement: Token storage and leak protection

The app SHALL store tokens only in platform secure storage:
- Android: AES-256-GCM ciphertext under a non-exportable Android Keystore key, in `noBackupFilesDir`.
- iOS: a Keychain item with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

The code verifier and `state` SHALL exist only in memory. The access token, refresh token, authorization code and code verifier SHALL NOT appear in logs, exception messages, `toString` output or UI text. They also SHALL NOT appear in any URL other than the redirect URI that carries the code; the only other place they may be sent is a token endpoint request body.

#### Scenario: Cold start with stored tokens

- **WHEN** the app starts with stored tokens
- **THEN** it shows the order list without a sign-in and without a network call before the order request

#### Scenario: Unreadable store

- **WHEN** the stored entry cannot be decrypted or parsed
- **THEN** the entry is deleted and the app shows the sign-in screen

#### Scenario: iOS reinstall

- **WHEN** the app is installed again on iOS while a Keychain item from the earlier install exists
- **THEN** the first launch deletes that item and shows the sign-in screen

#### Scenario: Negative control

- **WHEN** sign-in, refresh, rejection and every failure path run with sentinel access token, refresh token, code and verifier values
- **THEN** any sentinel found in a log line, exception message, `toString` output, UI string, URL of a request other than to the token endpoint, or the stored bytes MUST fail the check

### Requirement: Order access requires sign-in

The app SHALL show the order list only in the signed-in state. It SHALL show:
- the sign-in screen while signed out;
- a loading screen while the stored tokens are read at start.

A switch to the signed-out state SHALL replace the order list with the sign-in screen.

#### Scenario: Signed-in start

- **WHEN** the app starts with valid stored tokens
- **THEN** it shows the order list loaded with the stored access token

#### Scenario: Negative control

- **WHEN** the app starts with no stored tokens
- **THEN** showing the order list or sending an order request MUST fail: the sign-in screen is shown and no API request is sent
