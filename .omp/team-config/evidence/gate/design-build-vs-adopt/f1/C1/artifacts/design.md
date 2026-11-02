# Design

## Context

See proposal.md - Why. `:shared` has a Ktor client (`shared/src/commonMain/kotlin/http/Client.kt`) and no auth code.

## Goals / Non-Goals

Goals: Keycloak sign-in with PKCE on Android and iOS, a session that survives restarts, refresh before expiry. Non-Goals: other identity providers, account management screens.

## Decisions

### D1. OIDC client written in `:shared`

The authorization code flow with PKCE is implemented in commonMain: generate a 64-byte code verifier, derive the S256 challenge, build the authorization URL with a random `state`, open it through `expect fun openBrowser(url: String)`, receive the redirect through an Android intent filter and an iOS `ASWebAuthenticationSession`, compare `state`, and exchange the code at the token endpoint with Ktor.

### D2. Token storage

Tokens are stored through `expect class TokenStore`, with an Android actual on EncryptedSharedPreferences and an iOS actual on the Keychain (`SecItemAdd`, `SecItemCopyMatching`).

### D3. Token refresh

A Ktor client plugin reads the access token's `exp` before each request and refreshes with the refresh token 60 seconds before expiry; a failed refresh clears the store and emits `SignedOut`.

## Risks / Trade-offs

- [The redirect is intercepted by another app] → PKCE binds the code to the app's verifier; the `state` check rejects foreign redirects.

## Migration Plan

Ship in the next app release; the password sign-in screen is removed in the same release. Rollback: the previous release.
