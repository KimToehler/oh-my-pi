# Review

- **Verdict**: REJECT
- **Reviewed digest**: 4f0ef79194646016612c03e23b1ed24c3cd3cae966498930ec67cfefb822d6b6
- **Reviewer**: plan-reviewer, CorrectnessR4, VerificationR4, ChecksR4
- **Round**: 4
- **Override**: none

## Blockers

### Correctness (CorrectnessR4)

[
  {
    "area": "Refresh concurrency",
    "defect": "The mutex and expiry recheck do not guarantee that concurrent callers use the same refresh result.",
    "evidence": "design.md:60 accepts every positive expires_in; design.md:93-99 makes each waiter refresh again whenever the resulting token has less than 60 seconds remaining. Thus a valid 30-second token causes two concurrent requests to make two sequential refreshes and use different tokens. Likewise, after a transient failure the unchanged near-expiry token makes each waiter perform another refresh. Both violate specs/oidc-sign-in/spec.md:85,94-97. The effects are reversible but break the promised single-flight behavior during normal short-token configurations or outages.",
    "change": "Share the completed in-flight refresh result with callers already waiting, including transient outcomes, independently of the new token's remaining lifetime; cover short-lived successful tokens and concurrent transient failures."
  },
  {
    "area": "Rejected-refresh sign-out and restore",
    "defect": "A failed storage clear permits a signed-out session to be restored as signed in and potentially make an order request.",
    "evidence": "design.md:103-111 explicitly continues sign-out when TokenStore.clear() throws and assumes the leftover entry will immediately be refreshed; design.md:117 instead restores any readable entry as SignedIn, and design.md:93-94 returns an access token with at least 60 seconds remaining without refreshing it. A revoked refresh token can be encountered while its access token still has remaining lifetime, for example after a 401-triggered refresh; if clear fails, a relaunch can show orders and send that still-valid token. This contradicts specs/oidc-sign-in/spec.md:115-131. The residual stored credential and unintended access persist until cleanup or expiry.",
    "change": "Make rejection durably invalidate the restorable session even if token deletion fails, or keep the app in a fail-closed recovery state until invalidation is durable; define and test relaunch after clear failure with an unexpired access token."
  },
  {
    "area": "Cold-start order request",
    "defect": "The cold-start requirement forbids a network call before the order request, while the refresh design requires one for an expired or near-expiry stored token.",
    "evidence": "specs/oidc-sign-in/spec.md:141-144 applies to stored tokens without limiting their age; design.md:117 restores them without a network call, but design.md:90-98 refreshes before every API request when less than 60 seconds remain. Relaunching after the app has been closed beyond the access-token lifetime therefore necessarily sends a token request before the order request. This is an ordinary, reversible lifecycle state but violates the requirement.",
    "change": "Reconcile the requirement with refresh: distinguish valid tokens from expired or near-expiry tokens and explicitly specify the permitted refresh-before-order behavior."
  },
  {
    "area": "Token-storage requirements",
    "defect": "The specification forbids transmissions that its own sign-in and API requirements require.",
    "evidence": "specs/oidc-sign-in/spec.md:139 says state exists only in memory and that the token endpoint body is the only other place the access token may be sent. Yet design.md:40 sends state in the authorization request, and specs/oidc-sign-in/spec.md:61-68 requires sending the access token in the API Authorization header. Both occur on every normal sign-in/order load, so the criteria cannot all be true; the consequence is a blocked or contradictory implementation, not irreversible damage.",
    "change": "Allow state in the authorization request and response while prohibiting its persistence and logging, and explicitly allow the access token in the API-origin Authorization header."
  },
  {
    "area": "Refresh persistence",
    "defect": "The defined successful-refresh path can send a new token without storing the new token pair, contrary to the refresh scenario.",
    "evidence": "design.md:95-96 explicitly keeps rotated tokens only in memory and returns the new access token when storage fails; specs/oidc-sign-in/spec.md:89-92 requires storing both new tokens before sending the request. After a subsequent restart, design.md:152 acknowledges the stale refresh token is rejected and the user must sign in again. The failure is reversible but violates the specified refresh outcome.",
    "change": "Define and implement a storage-failure outcome consistent with the required durable refresh, or explicitly revise the requirement to permit the stated degraded behavior and its restart consequence."
  }
]

### Verification (VerificationR4)

[
  {
    "area": "Leak-protection verification",
    "defect": "The sentinel negative control does not inspect logs, and the real-device scan cannot detect a standalone authorization code or verifier.",
    "evidence": "specs/oidc-sign-in/spec.md:156-159 requires all four sentinels to be absent from log lines. tasks.md:14 captures string representations, URLs, headers and UI strings but not logs; tasks.md:56-60 searches device logs only for `eyJ` and `oauth2redirect?`. A log line containing only the verifier or code passes both checks.",
    "change": "Capture and scan actual log sinks for each planted sentinel across the specified flows on both platforms, with a deliberately leaking control that makes the check fail. Avoid retaining real credentials in evidence."
  },
  {
    "area": "Token-response acceptance verification",
    "defect": "The listed incomplete-response tests do not exercise missing or empty access tokens, or establish the specified session and UI effects for incomplete responses.",
    "evidence": "specs/oidc-sign-in/spec.md:5,12-15 requires a non-empty access token and that an incomplete response leaves nothing stored and the sign-in screen visible. tasks.md:12 tests missing refresh token, token type and expiry only, at OidcClient level; tasks.md:13 and 27 do not specify an incomplete-response session/UI test. An implementation accepting an empty access token, or storing/displaying orders after an incomplete response, can pass the listed checks.",
    "change": "Add missing and empty access-token cases plus end-to-end session/controller assertions for each incomplete-response class: no persisted tokens and sign-in remains displayed."
  },
  {
    "area": "Refresh-before-expiry real-surface proof",
    "defect": "The F1 scenario named refresh-before-expiry first makes its request after expiry, so it cannot demonstrate the required pre-expiry behavior on either platform.",
    "evidence": "specs/oidc-sign-in/spec.md:89-92 requires refresh before a request with less than 60 seconds remaining. tasks.md:54 waits until `t0 + L + 10 s` and accepts any refresh event up to that reload; an implementation refreshing only expired tokens passes. tasks.md:13 and 33 cover the shared session in tests, not the platform-to-order-request workflow.",
    "change": "On each platform issue an order request within the final 60 seconds while the token remains valid, retain timing and refresh/order observations establishing the refresh preceded that request, and keep the post-expiry case separately."
  }
]

### Checks (ChecksR4)

[
  {
    "area": "CHECK 1 holders and sinks: F1 evidence files are an unscanned sink",
    "defect": "The F1 procedure has the QA lane write the evidence files that review-work Phase 5 then stages and commits. Those files can contain real staging tokens or a live authorization code, and nothing scans them for secrets before staging. The log-scan scenario counts lines containing `eyJ` and `oauth2redirect?`. If a leak is found, the natural record is the matching lines, which are real staging access tokens, refresh tokens or a redirect URI with its code. The pkce-mismatch scenario has the tester read and navigate Network-panel request URLs, and the evidence also includes screenshots and recordings. Only the sentence 'No password is written into evidence' guards this. The 7.2 Verify checks only `test -s`.",
    "evidence": "tasks.md:42-45 ('Each file records the steps, the observation, the screenshots or recording paths, and the Keycloak user events'; 'No password is written into evidence'); tasks.md:49-50 (log-scan lines); tasks.md:38 (Verify only `test -s \"$f.md\"`). design.md:78 lists only 'F1 scans the device logs' as proof and D6 (design.md:64-73) lists no evidence-file sink. The plan's own Phase 5 stages these artifacts into git (review-work SKILL.md Phase 5: 'QA artifacts ... must be tracked by git'). A staging refresh token committed to history is real-credential exposure, and it is irreversible once pushed.",
    "change": "Add the F1 evidence directory as a named sink in D6. Add a scan to the 7.2 Verify command (and to the F1 procedure) that fails on `eyJ`, `refresh_token`, `access_token`, `code=` and `oauth2redirect?` hits, and on any `code=` or `state=` query value, in every file in `f1/`. Require that log-scan files record counts and never matched lines. Add a negative control: plant a sentinel in an evidence file and show the scan fails."
  },
  {
    "area": "CHECK 1 holders and sinks: TokenLeakTest does not scan every forbidden sink in the D6 matrix",
    "defect": "D6 gives each value exactly one allowed sink and calls everything else forbidden. The 2.4 negative control scans only these artifacts: exception/AuthState/SignInFailure strings, URLs sent to the API and to non-token hosts, headers sent to non-API origins, and sign-in screen strings. It never checks (a) request bodies and non-Authorization headers sent to the API origin, (b) the bearer value sent to the API origin (only ApiAuthTest asserts it is the access token), or (c) the token-endpoint request body and headers for values not allowed there (for example the access token or verifier in a refresh request, or the refresh token in an authorization_code request). It also plants no sentinel in inputs the code parses: token-endpoint error bodies (`error`, `error_description`), the discarded `id_token`, and unknown or duplicate redirect parameters. It captures no stdout/stderr or platform log output, so a `println`/`Log.d` of a token in common or platform code is caught only by the manual F1 scan. A malformed-JSON body containing the sentinel is not named.",
    "evidence": "design.md:68-73 (per-value allowed sinks) vs tasks.md:14 (captures 'every request URL sent to the mock API and to hosts other than the token endpoint; every header sent to non-API origins'). design.md:51 and the D3 line 'id_token is discarded: not parsed, not stored, not logged' have no sentinel in 2.4. design.md:76 says failures carry only kinds, status codes and the validated `error` code, but 2.4 plants no sentinel in token-endpoint error bodies, so that claim is not exercised.",
    "change": "Extend 2.4 so the capture is the full per-sink matrix. Record every request (URL, all headers, body) per origin class: API origin, token endpoint, other. Assert that API-origin requests carry only the access token (in Authorization) and no other protected value anywhere. Assert that token-endpoint bodies contain only their allowed values, per grant type. Add sentinels to `id_token`, the token-endpoint `error`/`error_description`, malformed-JSON bodies and extra redirect parameters. Capture process stdout/stderr or a test log sink. Keep the existing control (deliberately unredacted `toString` must fail) and add one control per newly covered sink."
  }
]
