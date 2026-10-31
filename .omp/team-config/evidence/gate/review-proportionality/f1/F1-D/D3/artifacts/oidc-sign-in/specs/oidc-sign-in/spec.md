## ADDED Requirements

### Requirement: Sign-in with Keycloak

The app SHALL sign the user in with the OIDC authorization code flow with PKCE against Keycloak and SHALL send the access token with every API request.

#### Scenario: First sign-in

- **WHEN** a signed-out user opens the app and signs in at Keycloak
- **THEN** the app holds an access and a refresh token and shows the order list

#### Scenario: Negative control

- **WHEN** the redirect carries a code without the matching PKCE verifier
- **THEN** sign-in MUST fail and no token is stored

### Requirement: Token refresh

The app SHALL refresh the access token before it expires and SHALL sign the user out when the refresh token is rejected.

#### Scenario: Refresh before expiry

- **WHEN** the access token expires in less than a minute
- **THEN** the app refreshes it before the next API request

#### Scenario: Negative control

- **WHEN** Keycloak rejects the refresh token
- **THEN** keeping the user signed in MUST fail: the app signs the user out and deletes the stored tokens
