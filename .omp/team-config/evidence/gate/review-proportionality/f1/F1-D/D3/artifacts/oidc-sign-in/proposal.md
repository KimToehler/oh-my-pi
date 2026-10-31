# Proposal

## Why

Users of the Kotlin Multiplatform app (Android and iOS) must sign in with the company Keycloak before they can see their orders.

## What Changes

- OIDC sign-in with authorization code and PKCE against Keycloak.
- Token storage on the device and token refresh before expiry.

## Capabilities

### New Capabilities

- `oidc-sign-in`: sign-in, token storage and token refresh.

### Modified Capabilities

None.

## Impact

`shared/` gains the sign-in flow; `shared/http/Client.kt` sends the access token.
