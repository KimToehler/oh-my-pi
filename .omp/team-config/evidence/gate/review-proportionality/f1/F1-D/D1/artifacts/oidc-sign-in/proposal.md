# Proposal

## Why

Users of the Kotlin Multiplatform app (Android and iOS) must sign in with the company Keycloak before they can see their orders.

## What Changes

- OIDC sign-in with authorization code and PKCE against Keycloak, with full validation of the authorization response.
- Token storage in platform secure storage (Android Keystore, iOS Keychain) and token refresh before expiry, with sign-out when Keycloak rejects the refresh token.
- The API client attaches the access token to requests to the API origin only.
- Platform sign-in entry paths: an Android Custom Tab with a redirect activity, and an iOS `ASWebAuthenticationSession`.
- The order list is shown only to a signed-in user.

## Capabilities

### New Capabilities

- `oidc-sign-in`: sign-in, authorization-response validation, token storage, request authentication, refresh, sign-out on rejected refresh, and the order access gate.

### Modified Capabilities

None.

## Impact

- **Depends on the prerequisite change `kmp-app-shell`**, which must be proposed, reviewed and merged before this change is applied. It supplies the Gradle build, the Android and iOS app shells, the order list and the test harness listed in design.md D2. This repository has none of these today; its only source is `shared/http/Client.kt`.
- `shared/` gains `app.auth` (common, Android and iOS) and `app.AppController`. `app/http/Client.kt` changes signature and gains the `ApiAuth` plugin; every caller is updated.
- `:androidApp` gains `OidcRedirectActivity`. `iosApp` gains the `Info.plist` OIDC keys and Keychain/redirect tests.
- Keycloak client `orders-app` must be configured on staging and production as in design.md D3. That is ops work outside this repository, needed before F1.
