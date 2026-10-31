# Review

- **Verdict**: REJECT
- **Reviewed digest**: 4b59444424ec53c098e0492521df90753c26f6ca02e9b97d5ce380b516651e1a
- **Reviewer**: plan-reviewer, OidcCorrectnessR4, OidcVerificationR4, OidcChecksR4
- **Round**: 4
- **Override**: none

## Blockers

### Correctness (OidcCorrectnessR4)

[
  {
    "area": "Session ownership and concurrency",
    "defect": "The process-wide store is shared, but the session state, cache and mutex are owned by individual SessionManager instances. Repeated createAuth calls can therefore operate concurrently on the same persisted session without coordination.",
    "evidence": "design.md:45,56,58-59,88-91 and tasks.md:25 explicitly permit and test two createAuth calls while memoizing only the Android store. If both managers restore the same session, they can refresh the same token concurrently; one may reject and delete the session while the other remains SignedIn or rewrites it. This violates specs/oidc-sign-in/spec.md:78,87-88,98-99. The incorrect session state persists until corrected or the process restarts; it is reversible.",
    "change": "Give each persisted session a single shared owner, including its state and lock, or explicitly enforce and document a singleton AuthComponents/session per storage namespace on both platforms; cover concurrent refresh and rejection through two entry-point instances."
  },
  {
    "area": "Concurrent refresh",
    "defect": "The mutex alone does not ensure that requests queued together reuse one refresh when the newly issued access token also has less than one minute of lifetime.",
    "evidence": "design.md:69-71 accepts any positive expires_in and refreshes whenever the remaining lifetime is below 60 seconds. With a 30-second token, ten queued requests each find the new token below the threshold and refresh again, contradicting specs/oidc-sign-in/spec.md:87-88. This causes avoidable token rotations and possible rate limiting or sign-out; the effects are reversible.",
    "change": "Define how a request that waited for an already-completed refresh reuses its result even for short-lived tokens, or explicitly constrain and handle short-lived responses; test the ten-request case with expires_in below 60 seconds."
  },
  {
    "area": "Token response contract",
    "defect": "The specification requires every accepted token response to include a refresh token and ID token with the original nonce, while the refresh design expressly accepts responses without either and does not validate refresh nonce.",
    "evidence": "specs/oidc-sign-in/spec.md:35 requires those fields for a token response; design.md:71 accepts a missing refresh token and an absent ID token and skips nonce checking on refresh. A normal successful refresh without a new refresh token is accepted by the design but violates the stated requirement; the contract failure is reversible.",
    "change": "Distinguish initial authorization-code responses from refresh responses in the requirement, specifying the appropriate validation and token-retention rules for each, and align implementation tasks with that contract."
  },
  {
    "area": "Refresh expiry lifecycle",
    "defect": "The design records refresh-token expiry at sign-in but does not update or clear it when refresh returns a replacement token or a new refresh lifetime.",
    "evidence": "design.md:64 computes refreshExpiresAt on sign-in; design.md:70-71 checks it before refresh but describes no update on success. After a successful rotation with an extended refresh lifetime, the old expiry can cause a later request to delete an otherwise valid session without contacting Keycloak. This involuntary sign-out is reversible by signing in again.",
    "change": "Specify how each refresh response updates the stored refresh expiry, including returned replacement tokens, new lifetime values and absent lifetime values; exercise rotation across the old expiry."
  }
]

### Verification (OidcVerificationR4)

[
  {
    "area": "Quality and verification - Verify commands (tasks 2.1-6.1, 8.2)",
    "defect": "The Verify commands cannot fail when a named test is missing, was not run, or was served from cache. Per-task Verify filters at class level (`--tests 'app.auth.X'`), so omitting `nonceMismatchFails` or `stateMismatchFailsWithoutTokenRequest` still passes. The 8.2 Verify checks only `BUILD SUCCESSFUL` for `unit-suite.txt`, and no class name at all. For `ios-keychain.txt` it checks only `itemIsThisDeviceOnly`, although the task text claims 'every commonTest class passed on iOS' and 'every class of tasks 2-6 passed'. A Gradle run that is UP-TO-DATE or FROM-CACHE prints `BUILD SUCCESSFUL` without executing any test, and the plan does not require `--rerun-tasks` or `cleanTest`. In the 8.2 Verify, the `git diff --quiet <recorded head> HEAD` comparison ignores uncommitted working-tree edits, so the transcript's `head:` line does not prove which code ran.",
    "evidence": "tasks.md:11,12,16,17,21,30 (class-level `--tests`); tasks.md:39 (the Verify loop greps `BUILD SUCCESSFUL` and the keycloak test names, and checks `storedFileHasNoPlaintextToken` and `itemIsThisDeviceOnly`; nothing for unit-suite classes, SecretLeakTest, StdStreamLeakTest or the iOS commonTest classes)",
    "change": "Add a check that reads the JUnit XML under `build/test-results/` (and the Kotlin/Native iOS results) and asserts every method named in tasks 2.1-6.1 ran with no skip or failure. Run the F1 commands with `--rerun-tasks` or `cleanTest`. Require a clean working tree, or bind the transcripts to a tree hash, instead of only comparing against HEAD."
  },
  {
    "area": "Quality and verification - task 3.2 / spec 'Refresh before expiry' Concurrent requests",
    "defect": "`tenConcurrentRequestsRefreshOnce` and `refreshQueuedBehindRejectionCannotRestoreSession` are specified without any suspension control. Under `runTest` on a single-threaded test dispatcher, and with a `MockEngine` handler that returns immediately, the ten calls run one after another. A mutex-free implementation that rechecks expiry after the first refresh still shows token-endpoint count 1, so the test cannot fail when the mutex is removed. The 'queued behind rejection' race cannot be reproduced without a controlled interleaving, and the plan names none.",
    "evidence": "tasks.md:17 gives only '(token-endpoint count 1, all ten see the new token)'. design.md D4 states the serialization is the mechanism that prevents the stale-completion race and double refresh.",
    "change": "Specify a gated token-endpoint handler (for example a `CompletableDeferred` that holds the first refresh until all ten callers are waiting). Run the test on a multi-threaded dispatcher or with explicit interleaving. For the race test, hold a refresh in flight, fire a rejection or sign-out, then release it and assert that the session stays `SignedOut`. Add a mutation check that the test fails with the mutex removed."
  },
  {
    "area": "Quality and verification - task 6.1 / spec 'Credentials stay confidential' Negative control",
    "defect": "The leak tests can pass vacuously. (a) The injected failures are not said to carry sentinels. The throwing store fake, the 5xx/`invalid_grant` response bodies and the library exceptions need sentinel text in their messages or bodies. Otherwise a leaked cause chain or response body contains nothing to find. (b) There is no planted-leak control that proves the detector fails when a sentinel is leaked. (c) `StdStreamLeakTest` is `androidUnitTest` only, so iOS stdout and stderr are never checked. The F1 `leak-scan.txt` only greps Gradle transcripts, which show test stdout only if `showStandardStreams` is enabled, and 1.1 does not require it. (d) 'ID token never persisted' is tested only as `idTokenIsNeverWritten` at `SessionStore`, whose `StoredSession` has no ID-token field, so the test is tautological. The sentinel ID token and email claim are never scanned in the raw value that `SessionManager.signIn` writes to the store.",
    "evidence": "tasks.md:12 (`idTokenIsNeverWritten`), tasks.md:30 (paths listed; no sentinel injection into failures; no control), tasks.md:39 (leak-scan over transcripts); spec.md 'Credentials stay confidential' Negative control",
    "change": "In 6.1, embed sentinels in the injected exception messages, error bodies and the ID-token `email` claim. Add a control that deliberately leaks a sentinel through a test-only path and asserts the detector fails. Scan the raw store contents after a `signIn` with `SENTINEL-ID`. Cover iOS output, or state the iOS gap explicitly as unexercised."
  },
  {
    "area": "Quality and verification - spec 'Session restore fails closed' Negative control (tasks 3.1, 5.1, 5.2)",
    "defect": "The negative control (decrypt failure after a backup restore to another device) is exercised only with a throwing in-memory fake (`unreadableSessionIsDeletedAndSignedOut`). The design's load-bearing claim is that the real `AndroidDataStoreSettingsStore` throws on decryption failure instead of returning null or empty. If it swallowed the failure, restore would sign the user out without ever calling delete, or would behave differently. The instrumented and Keychain tests cover only plaintext-at-rest, round-trip and accessibility. Restore with a failing `delete()` is also untested: the `pendingDelete` flag is tested only after a refresh rejection.",
    "evidence": "tasks.md:16 (restore tests all use fakes), tasks.md:25 and tasks.md:26 (no corrupt-ciphertext or wrong-key test), design.md Context ('throws when decryption fails'), design.md D4 (restore: `SessionUnreadable` → `store.delete()`)",
    "change": "Add to 5.1 an instrumented test that corrupts the DataStore file or deletes the Keystore key, then runs a real `SessionManager` restore. It must assert that `SessionUnreadable` is raised, the entry is deleted, and the state is `SignedOut`. Add an iOS equivalent (an unreadable item). Add a restore test with a failing `delete()` that asserts `SignedOut` and that no token is returned."
  },
  {
    "area": "Quality and verification - tasks 3.1, 3.2, 4.1 coverage gaps",
    "defect": "Scenarios and implemented paths have no test. (a) The 'Temporary failure' scenario lists a timeout, but no `timeoutKeepsSession` test exists. The design's mitigation for holding the mutex through the refresh ('bounded by the 15 s timeout') has no task that implements or verifies the OIDC HttpClient timeout. Task 4.1 mentions only `followRedirects = false` for that client. (b) `continueSignIn`, a second commit path, is implemented in 3.1 but has no test, so a path that skips validation or the state check would go unnoticed. (c) The scenario says the API request is not sent after a temporary refresh failure, but `ApiHttpClientTest` covers only `rejectedRefreshRequestNotSent` and `signedOutRequestNotSent`. (d) `followRedirects = false` on the OIDC client is asserted in 4.1 but not tested.",
    "evidence": "spec.md 'Temporary failure' ('a network error, a timeout, ...'); tasks.md:16-17 (test lists; no timeout and no continueSignIn test); tasks.md:21 (4.1 test list); design.md D4 (15 s bound), D5, Risks",
    "change": "Add `timeoutKeepsSession` using a virtual-time `MockEngine` delay, and a configuration assertion that the OIDC client has a 15 s request timeout and `followRedirects = false`. Assign the timeout to a task. Add `continueSignIn` tests for success, state mismatch and validation failure. Add `temporaryRefreshFailureRequestNotSent` to `ApiHttpClientTest`."
  }
]

### Checks (OidcChecksR4)

[
  {
    "area": "CHECK 1 — Credential confidentiality",
    "defect": "The plan omits a complete holder and sink inventory and does not scan all artifacts for every secret-bearing input. A normal token or claim leak to an uncovered sink can expose customer orders or personal data irreversibly.",
    "evidence": "design.md:45-50,62-76,80-81; tasks.md:30,39 cover exception text, states and JVM streams, but not all platform and library output or all credential-bearing fields.",
    "change": "Inventory all holders and sinks, establish a common safe output boundary or justify exclusions, and plant sentinels in every input and scan every artifact on both platforms."
  },
  {
    "area": "CHECK 6 — Multiple session entry paths",
    "defect": "Repeated createAuth calls can create independently locked managers sharing one persisted session. Concurrent refreshes can overlap, and one manager can continue using cached credentials after the other signs out.",
    "evidence": "design.md:56-59,67-74,90-95 memoizes only the Android store; tasks.md:17,25 tests concurrency through one manager and only checks store reuse.",
    "change": "Enforce one coordinated session authority per store on both platforms and test concurrent requests and rejection across separate entry-point calls."
  },
  {
    "area": "CHECK 6 — Continued sign-in",
    "defect": "The Android process-death continuation path has no path-specific negative control proving state, nonce and token validation before session commit. A broken resumed flow could accept a forged response and expose customer orders irreversibly.",
    "evidence": "design.md:62-66,109-112; tasks.md:16 lists sign-in tests but no continueSignIn or process-death control.",
    "change": "Exercise continuation independently after process recreation, including mismatched state and nonce and incomplete responses, asserting no session is committed."
  },
  {
    "area": "Boundary rule — Criterion boundaries",
    "defect": "The criterion boundaries name new symbols that cannot be found in the repository, so the required real code locations cannot be verified.",
    "evidence": "design.md:101-108 names SessionManager, SessionAuth, SessionStore and SessionException; shared/http/Client.kt:5 contains only httpClient(), and the planned auth files do not yet exist.",
    "change": "Identify locatable real boundaries or revise the gate so the required boundaries can be verified against the implementation before acceptance."
  }
]
