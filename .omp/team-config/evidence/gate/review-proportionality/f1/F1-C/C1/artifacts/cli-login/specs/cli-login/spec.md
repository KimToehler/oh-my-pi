## ADDED Requirements

### Requirement: Device-flow sign-in

`acme login` SHALL sign the customer in with the OAuth device flow and SHALL keep the refresh token so later commands run without signing in again.

#### Scenario: Sign-in

- **WHEN** a customer runs `acme login` and approves the device code in the browser
- **THEN** later `acme invoices` calls succeed without another sign-in

#### Scenario: Negative control

- **WHEN** the customer denies the device code
- **THEN** sign-in MUST fail and no token is kept

### Requirement: Silent refresh

The CLI SHALL refresh an expired access token with the kept refresh token before calling the API.

#### Scenario: Expired access token

- **WHEN** the access token has expired and the refresh token is valid
- **THEN** the CLI refreshes it and the API call succeeds

#### Scenario: Negative control

- **WHEN** the identity provider rejects the refresh token
- **THEN** the API call MUST fail with a "run acme login" message
