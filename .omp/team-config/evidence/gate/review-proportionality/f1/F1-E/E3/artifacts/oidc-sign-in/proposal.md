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

## Not in this change

- The 10-second request timeout and single idempotent-GET retry in `httpClient()` (`shared/http/Client.kt`), which fixes the order-screen hang when the orders API stalls, is split out as the separate change `http-request-timeout`. It is independent of sign-in and is proposed and reviewed on its own before it is implemented; this change does not fix that hang.
