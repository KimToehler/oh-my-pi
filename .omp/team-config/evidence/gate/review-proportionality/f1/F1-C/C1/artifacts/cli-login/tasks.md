# Tasks

## 1. Login

- [ ] 1.1 Implement the device flow in `src/login.ts` and the session file in `src/session.ts`, with tests against a mocked identity provider. Verify: `bun test test/login.test.ts test/session.test.ts`
- [ ] 1.2 Take the access token from the session in `src/api.ts` and refresh it when expired. Verify: `bun test test/api.test.ts`

## 2. Final verification

- [ ] 2.1 F1. Manual QA on the real surface: sign in against the staging identity provider, list invoices, expire the token and list again; evidence in `.omp/team-config/evidence/gate/cli-login/f1/login.md`. Verify: `test -f .omp/team-config/evidence/gate/cli-login/f1/login.md`

## Workflow follow-up

- F2 merge gate (`review-work`), after 2.1 and never a checkbox.
- Merge only after the F2 record validates.
