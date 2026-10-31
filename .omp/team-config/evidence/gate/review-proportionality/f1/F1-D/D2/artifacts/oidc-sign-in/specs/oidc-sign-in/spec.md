# Spec Delta

## Purpose

Lets app users sign in with the company Keycloak, keeps their session on the device safely, and authenticates the app's API requests with that session.

## ADDED Requirements

### Requirement: Sign-in establishes a session

The app SHALL sign the user in with the OIDC authorization code flow against Keycloak, sending a PKCE S256 challenge, a fresh `state` and a fresh `nonce` with every authorization request. It SHALL accept the authorization response only when its `state` equals the one it sent. A session exists only after the token response has been validated and stored.

#### Scenario: First sign-in

- **WHEN** a signed-out user completes the Keycloak login and the redirect carries the code and the `state` the app sent
- **THEN** the app holds a signed-in session whose access and refresh tokens are in platform-protected storage, and an API request with that session succeeds

#### Scenario: Authorization request parameters

- **WHEN** the app starts a sign-in
- **THEN** the authorization URL carries `response_type=code`, `code_challenge_method=S256`, a `code_challenge`, a `state` and a `nonce`

#### Scenario: Wrong PKCE verifier

- **WHEN** the code is redeemed with a verifier that does not match the challenge and Keycloak answers `invalid_grant`
- **THEN** sign-in fails, the app stays signed out and nothing is stored

#### Scenario: Negative control

- **WHEN** the redirect carries a code with a `state` that differs from the one the app sent
- **THEN** sign-in MUST fail without redeeming the code: the token endpoint is not called, the app stays signed out and nothing is stored

### Requirement: Token response validation

The app SHALL accept a token response only when it has a non-empty access token, a refresh token, a positive `expires_in` and an ID token. The ID token's `iss` must equal the configured issuer, its `aud` must contain the client ID, its `azp` (when present) must equal the client ID, its `exp` must lie in the future, and its `nonce` must equal the one sent.

#### Scenario: Wrong issuer or audience

- **WHEN** the ID token's `iss` is another realm, or its `aud` does not contain the client ID, or its `azp` names another client
- **THEN** sign-in fails, the app stays signed out and nothing is stored

#### Scenario: Incomplete response

- **WHEN** the token response lacks the refresh token, `expires_in` or the ID token, or the ID token's `exp` has passed
- **THEN** sign-in fails, the app stays signed out and nothing is stored

#### Scenario: Negative control

- **WHEN** the ID token's `nonce` differs from the one the app sent
- **THEN** sign-in MUST fail, the app stays signed out and nothing is stored

### Requirement: Bearer token only to the API origin

The app SHALL attach the access token as `Authorization: Bearer` only to requests whose scheme, host and port equal the configured HTTPS API origin. It SHALL refuse every other request on the authenticated client before sending it, and SHALL NOT follow redirects on the authenticated client.

#### Scenario: API request

- **WHEN** a signed-in user's app sends a request to the API origin
- **THEN** the request carries `Authorization: Bearer` with the current access token

#### Scenario: Redirect not followed

- **WHEN** the API origin answers a request with a redirect to another origin
- **THEN** the redirect is returned to the caller and no request reaches the other origin

#### Scenario: Signed out

- **WHEN** a request is sent on the authenticated client while no session exists
- **THEN** the request fails with a not-signed-in error and nothing is sent

#### Scenario: Negative control

- **WHEN** the authenticated client is asked to send a request to another host, scheme or port
- **THEN** sending MUST fail before any byte leaves the device: no request reaches the network and no token is attached anywhere

### Requirement: Refresh before expiry

The app SHALL refresh the access token before an API request when it expires in less than one minute, with at most one refresh in flight per session; concurrent requests use the refreshed token. When Keycloak rejects the refresh token, the app SHALL sign the user out and delete the stored tokens. A temporary failure SHALL keep the session.

#### Scenario: Refresh before the next request

- **WHEN** the access token expires in less than a minute and the app sends an API request
- **THEN** the app refreshes the token first and sends the request with the new access token

#### Scenario: Concurrent requests

- **WHEN** ten API requests start at once while the access token expires in less than a minute
- **THEN** Keycloak receives exactly one refresh request and all ten requests carry the new access token

#### Scenario: Temporary failure

- **WHEN** the refresh fails with a network error, a timeout, HTTP 5xx or 429, or an error response without `invalid_grant`, `invalid_client` or `unauthorized_client`
- **THEN** the request fails with a retryable error, the session and the stored tokens are kept and the API request is not sent

#### Scenario: Negative control

- **WHEN** Keycloak rejects the refresh token with `invalid_grant` (or `invalid_client`/`unauthorized_client`), or the refresh token's known expiry has passed
- **THEN** keeping the user signed in MUST fail: the app signs the user out, deletes the stored tokens, the API request is not sent and fails with a signed-out error

### Requirement: Session restore fails closed

At start, the app SHALL treat a stored session as signed in only when it can be read, decrypted and decoded in full: access token, refresh token and expiry. Any other stored state SHALL be deleted and the app SHALL be signed out.

#### Scenario: Valid stored session

- **WHEN** the app starts with a complete stored session
- **THEN** it is signed in without user interaction

#### Scenario: Negative control

- **WHEN** the stored session cannot be decrypted (for example after a backup restore to another device), is malformed JSON, or lacks the refresh token or expiry
- **THEN** treating the user as signed in MUST fail: the stored entry is deleted, the app is signed out and no token from it is sent

### Requirement: Credentials stay confidential

The app SHALL store access and refresh tokens only in platform-protected storage: Keystore-encrypted on Android, a Keychain item with this-device-only accessibility on iOS. It SHALL NOT persist the ID token, and SHALL NOT write any token or ID-token claim to logs, standard output or error messages.

#### Scenario: Storage at rest

- **WHEN** a session is stored on Android or iOS
- **THEN** the Android storage file does not contain the token bytes in plain text, and the iOS Keychain item's accessibility is "after first unlock, this device only"

#### Scenario: Negative control

- **WHEN** sentinel token values pass through sign-in, validation failure, refresh, refresh rejection, temporary failure, storage failure and untrusted-origin paths
- **THEN** a sentinel appearing in any exception message, cause chain, session state, standard output or standard error MUST fail the check
