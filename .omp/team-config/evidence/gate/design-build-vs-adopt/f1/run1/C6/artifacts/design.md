# Design

## Context

See proposal.md - Why. `:shared` has a Ktor client (`shared/src/commonMain/kotlin/http/Client.kt`) and no auth code.

## Goals / Non-Goals

Goals: Keycloak sign-in with PKCE on Android and iOS, a session that survives restarts, refresh before expiry. Non-Goals: other identity providers, account management screens.

## Decisions

### Build vs. adopt: sign-in flow (OIDC authorization code with PKCE)

- Repository: none; searched `shared/src` for `oidc`, `oauth`, `pkce` and `token` (only `shared/src/commonMain/kotlin/http/Client.kt:9`, an unauthenticated Ktor client)
- Platform: none; Android has no OIDC client in the SDK (https://developer.android.com/identity/sign-in), and iOS `ASWebAuthenticationSession` (https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession) opens the browser but implements no OIDC flow
- Candidates: https://github.com/kalinjul/kotlin-multiplatform-oidc; newest release 0.18.4, 2026-09-29; Apache-2.0; maintained; adopt
- Decision: adopt `kotlin-multiplatform-oidc` (`oidc-appsupport`) for the authorization code flow with PKCE on Android and iOS

### Build vs. adopt: token storage

- Repository: none; searched `shared/src` for `store`, `keychain` and `preferences`
- Platform: Android Keystore (https://developer.android.com/privacy-and-security/keystore) and iOS Keychain (https://developer.apple.com/documentation/security/keychain-services) offer the primitives but no shared token API
- Candidates: https://github.com/kalinjul/kotlin-multiplatform-oidc (`oidc-tokenstore`); newest release 0.18.4, 2026-09-29; Apache-2.0; maintained; adopt
- Decision: adopt `oidc-tokenstore` from `kotlin-multiplatform-oidc`, which stores tokens on the Android Keystore and the iOS Keychain

### Build vs. adopt: token refresh

- Repository: none; searched `shared/src` for `refresh`, `expires`, `mutex` and `appgroup`
- Platform: none; neither platform coordinates a token refresh between an app and its iOS widget extension (https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps, https://developer.android.com/identity/sign-in)
- Candidates: none; searches run: `web_search` for "kotlin multiplatform token refresh across app extension", "keychain access group refresh token lock kotlin" and "oidc refresh single flight multiple processes ios"; `read` on the `kotlin-multiplatform-oidc` README, which refreshes inside one process only
- Decision: build, gap: refresh coordinated between the app and its iOS widget extension over one Keychain access group, so that only one refresh request runs at a time; no repository code, platform API or library found does this

## Risks / Trade-offs

- [The redirect is intercepted by another app] → PKCE binds the code to the app's verifier; the `state` check rejects foreign redirects.

## Migration Plan

Ship in the next app release; the password sign-in screen is removed in the same release. Rollback: the previous release.
