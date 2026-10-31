# Review

- **Verdict**: REJECT
- **Reviewed digest**: 6002dfa3c1812d38bda3a5dd27379c4a2aaa456b6e96834edb09a4b7663177e3
- **Reviewer**: plan-reviewer, CorrectnessLens, VerificationLens, ChecksLens
- **Round**: 1
- **Override**: none

## Blockers

### Correctness (CorrectnessLens)

- **Area**: Correctness — sign-in and API integration
  - **Defect**: The implementation tasks never connect sign-in to either mobile app, protect the order-list entry point, or attach tokens to API requests. Completing both implementation tasks can leave the required user-facing flow and authenticated requests unchanged.
  - **Evidence**: openspec/changes/oidc-sign-in/specs/oidc-sign-in/spec.md:5-10 requires an access token on every API request and the order list after sign-in; proposal.md:21 names shared/http/Client.kt, but tasks.md:5-6 only implements auth files. shared/http/Client.kt:5 currently returns an unconfigured HttpClient; the repository’s shared/ tree contains no app or order-list integration.
  - **Change**: Plan the Android and iOS sign-in entry and redirect handling, signed-out/order-list state transition, and HTTP client integration that obtains and attaches the access token to API requests.
- **Area**: Correctness — refresh lifecycle
  - **Defect**: A standalone refresher does not establish the required ordering before requests or the sign-out transition on rejection. A normal request with a nearly expired token can proceed without waiting for refresh; a rejected refresh can leave the UI signed in or stored tokens intact.
  - **Evidence**: openspec/changes/oidc-sign-in/specs/oidc-sign-in/spec.md:19-28 requires refresh before the next request and deletion plus sign-out when refresh is rejected. tasks.md:6 only says to store tokens and refresh before expiry; shared/http/Client.kt:5 has no auth or refresh integration.
  - **Change**: Specify and task the request-time refresh coordination, including waiting for the refresh result and propagating rejection to a single signed-out state while deleting persisted tokens.
- **Area**: Architecture — whole-diff review
  - **Defect**: The plan explicitly skips whole-diff review for an authentication change, contradicting the repository’s mandatory full-review policy.
  - **Evidence**: openspec/changes/oidc-sign-in/gate.md:3-6 classifies the change as auth-secrets-pii but says whole-diff review is not needed; openspec/config.yaml:8 requires full review for auth/secrets/PII changes.
  - **Change**: Require the full whole-diff review in the gate and include it in the final verification sequence.

### Verification (VerificationLens)

- **Area**: Scenario and task verification
  - **Defect**: Neither implementation task names tests or assertions that prove its scenarios or the HTTP integration. A passing name-filtered test run could leave a requirement broken.
  - **Evidence**: specs/oidc-sign-in/spec.md:3-14: first sign-in and the missing-verifier negative control have only task 1.1's unspecified '*OidcClient*' tests (tasks.md:5); those tests are not required to prove token storage, order-list display, rejection without storage, or the Authorization header on every API request. spec.md:16-27: refresh-before-request and rejected-refresh sign-out/deletion have only task 1.2's unspecified '*Token*' tests (tasks.md:6), with no named assertions for timing, request ordering, rejection, sign-out or deletion. No test is named for either requirement or any scenario. Under ordinary sign-in or expiry, an implementation can pass unrelated selected tests while users cannot see orders or remain signed in after rejection; the resulting failure is reversible, but defeats the stated goal.
  - **Change**: Name and implement discriminating tests for each scenario and for authenticated HTTP requests, including cross-component assertions; ensure each task's Verify command actually runs its named tests.
- **Area**: F1 manual QA evidence
  - **Defect**: The final verification command checks only that one file exists, not that the four scenario observations were exercised and retained. The plan does not specify the real-surface setup, actions, or observable evidence for any scenario.
  - **Evidence**: tasks.md:10 requires one evidence path per scenario but verifies only 'test -f .../sign-in.md'; spec.md:5-14 and :18-27 specify four materially distinct scenarios. An empty or stale sign-in.md passes even if refresh, rejected refresh, PKCE rejection, token deletion, or order display was never exercised. In ordinary release verification this can approve a broken authentication flow; the missed failure is reversible but defeats the value proof.
  - **Change**: Specify a disposable Keycloak/app setup, concrete actions and expected observations for all four scenarios and the authenticated API request, retain each scenario's actual output, and verify all required artifacts correspond to the final code and contain the relevant observations.
- **Area**: Executable verification commands
  - **Defect**: Both implementation Verify commands depend on a Gradle wrapper and shared build that are absent from the supplied repository, and no task creates or identifies them.
  - **Evidence**: tasks.md:5-6 invokes './gradlew :shared:allTests'; the repository root contains only shared/, openspec/ and .omp/, and a repository-wide search found no gradlew or build.gradle files. Following either task as written therefore cannot execute its claimed verification on this checkout.
  - **Change**: Provide the actual build/test entry point and configuration, or explicitly add the prerequisite that supplies them and a runnable verification command for the resulting project.
- **Area**: Final verification wave
  - **Defect**: The plan omits the F3 task and dismisses whole-diff review on an unsupported one-module/one-line characterization, despite the feature spanning independently testable authentication, token storage/refresh and HTTP integration mechanisms.
  - **Evidence**: gate.md:6 says 'not needed (one module, shared/auth/, and one line in shared/http/Client.kt)'; tasks.md:5-6 names the separate OIDC client, token store and refresher, while proposal.md:23 names HTTP integration and spec.md:9 additionally requires the order list. tasks.md:8-15 has F1 and F2 but no F3. The final wave rule requires F3 and makes whole-diff review needed for changes spanning three or more modules/layers. Without cross-component review, a locally passing token refresher can remain disconnected from the HTTP client in ordinary use, defeating refresh-before-request; this is reversible but breaks the requirement.
  - **Change**: Add F3 before F1, run integration-review over the final whole diff and its auth/store/refresh/HTTP seams, and retain its report for F2.

### Checks (ChecksLens)

- **Area**: CHECK 1 (holders and sinks)
  - **Defect**: The plan creates, stores, sends and deletes real credentials (access token, refresh token, authorization code, PKCE verifier). It has no holder/sink inventory, no named chokepoint, and no sentinel control. The sinks that new code would reach are all unspecified. They are: on-device token storage (Keystore/Keychain versus plain prefs), the redirect URL/deep link and its code, logs and error messages from OidcClient, TokenRefresher and the Ktor client, crash reports and backups, and the F1 evidence file.
  - **Evidence**: proposal.md:10 ('Token storage on the device') and tasks.md:6 (TokenStore.kt) name no storage mechanism and no encryption requirement. spec.md:15,29 require only 'no token is stored' and 'deletes the stored tokens', and say nothing about where tokens may appear. design.md:7 (D1, own OIDC client) gives no logging or redaction rule. tasks.md:9 (2.1) makes F1 QA capture a real Keycloak sign-in into the tracked path `.omp/team-config/evidence/gate/f1/f1/sign-in.md`, with no synthetic-account or redaction step. The review-work skill requires evidence to be redacted because it becomes repository history. gate.md:5-8 records 'Accepted residual risks: none', so none of this is excluded by a reason.
  - **Change**: Add to design.md a table of Holder × Sink: in-memory objects, TokenStore backend per platform, redirect/intent handling, Ktor client logging, error and log strings, backups, and the F1 artifact. Name one chokepoint that new paths inherit: a single secure TokenStore (Keystore/Keychain, excluded from backup) plus a redacting logger. Add a requirement with a negative control that plants sentinel token/code/verifier values in every input and scans logs, storage dumps and evidence for zero hits. Make task 2.1 use a synthetic account, redact before storing, and cite the redaction.
- **Area**: CHECK 8 / CHECK 1 (narrow defaults, sink scope)
  - **Defect**: The requirement 'SHALL send the access token with every API request' has no scope. `httpClient()` is a generic HttpClient, and the plan says Client.kt gets 'one line' that adds the token. As planned, the bearer token goes to any URL requested through this client: redirects to other hosts, non-API hosts, the Keycloak token endpoint, and third-party URLs. That leaks a credential that grants access to customer orders.
  - **Evidence**: spec.md:5 ('every API request'). proposal.md:24 and gate.md:6 ('one line in shared/http/Client.kt'). shared/http/Client.kt:5 (`HttpClient()` with no origin restriction). No task in tasks.md modifies Client.kt, so this requirement has no owner and no scoping decision.
  - **Change**: Restrict token attachment to an explicit allow-list of API origins (HTTPS only), never to Keycloak endpoints or cross-origin redirects. Add a requirement and negative control: a request to a non-API host or an HTTP/redirected URL MUST NOT carry the Authorization header. Add a task that implements this in Client.kt, with a Verify command.
- **Area**: Security: untrusted input on the redirect (CHECK 4, validation predicate)
  - **Defect**: The sign-in negative control covers only a missing PKCE verifier. The plan hand-rolls the client (D1) but never requires validating the redirect and token response. Missing are the `state` check (login CSRF and session fixation via a crafted redirect from another app or page), the redirect_uri/issuer match, and ID-token or response checks (iss, aud, nonce, expiry). It also does not require the system browser rather than an embedded WebView. A hostile app or link can deliver a crafted redirect into the app, and the plan has no predicate for rejecting it.
  - **Evidence**: spec.md:5,14-15 (only 'code without the matching PKCE verifier'). tasks.md:5 ('receive the redirect, exchange the code for tokens', with no validation step). design.md:5-7 (no security decisions for a custom client).
  - **Change**: Add requirements, each with a negative control, for: state mismatch or missing state is rejected; wrong issuer/audience/nonce is rejected; the redirect must match the registered redirect_uri; the authorization request uses the system browser. Record in design.md why a custom client is used instead of an audited library (AppAuth), or switch to the library.
- **Area**: CHECK 4 (decision predicate: 'rejected refresh token')
  - **Defect**: The requirement 'sign the user out when the refresh token is rejected' defines no predicate for the input states. Missing or corrupt stored refresh token, network failure, 5xx or timeout, and a refresh already running concurrently are all unspecified. If the app signs out on any failure, users are locked out by transient errors; Keycloak rotation plus two parallel API requests each refreshing would invalidate the token and sign the user out. If the app treats an unreadable or missing token as still valid, it stays signed in with a bad state. The default direction is not stated.
  - **Evidence**: spec.md:19,28-29 (the only control is 'Keycloak rejects the refresh token'). spec.md:23-24 ('expires in less than a minute' has no handling for a missing expiry or clock skew). gate.md:5 itself names lock-out as a risk.
  - **Change**: Define 'rejected' in one sentence (for example an OAuth `invalid_grant` or 400/401 from the token endpoint). Specify the outcome for missing or corrupt tokens (sign out, fail closed), for transient errors (retry, keep tokens, surface a visible error, do not sign out), and for concurrent refresh (a single-flight refresh). Add negative controls for the missing-token and in-flight states.
