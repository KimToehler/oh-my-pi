# Tasks

## 1. Sign-in

- [ ] 1.1 Implement the OIDC authorization code flow with PKCE in `shared/auth/OidcClient.kt`: build the authorization URL, receive the redirect, exchange the code for tokens. Verify: `./gradlew :shared:allTests --tests '*OidcClient*'`
- [ ] 1.2 Store the tokens in `shared/auth/TokenStore.kt` and refresh them before expiry in `shared/auth/TokenRefresher.kt`. Verify: `./gradlew :shared:allTests --tests '*Token*'`

## 2. Final verification

- [ ] 2.1 F1. Manual QA on the real surface, one evidence path per scenario in `.omp/team-config/evidence/gate/f1/f1/`, on the head after the last code commit. Verify: `test -f .omp/team-config/evidence/gate/f1/f1/sign-in.md`

## Workflow follow-up

- F2 merge gate (`review-work`), after 2.1 and never a checkbox.
- Merge only after the F2 record validates.
