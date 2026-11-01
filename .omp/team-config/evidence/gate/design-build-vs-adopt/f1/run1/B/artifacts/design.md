# Design

## Context

See proposal.md - Why. `SignInService.signIn` (`shared/src/commonMain/kotlin/auth/SignInService.kt`) resolves the account, checks the password and returns `SignedIn`; it never reads `Account.plan` or `Account.trialEndsAtMillis` and has no notion of the current time. The code lives in Kotlin Multiplatform `commonMain` (Android, iosArm64, iosSimulatorArm64; Kotlin 2.2.20), so `java.time` and `System.currentTimeMillis()` are not available. `Account.kt` documents `trialEndsAtMillis` as set for trial accounts only, but the type is nullable for every plan.

## Goals / Non-Goals

**Goals:**
- A testable "now" in `commonMain`, so the expiry check can be unit-tested at and around the trial end without waiting on the wall clock.
- Settle the boundary instant, the check order and the `TRIAL` account without a trial end before coding.

**Non-Goals:**
- Server-side enforcement or a trusted (server-provided) time; the check runs on the device clock.
- Grace periods, upgrade prompts, or any change to `PAID` accounts.

## Decisions

### Inject `kotlin.time.Clock` into `SignInService`

`SignInService` gains a constructor parameter `clock: Clock = Clock.System` (`kotlin.time.Clock`). The expiry check compares `clock.now().toEpochMilliseconds()` with `trialEndsAtMillis`. Tests pass a fixed `Clock`. The class carries `@OptIn(ExperimentalTime::class)`, because `Clock` is still experimental in 2.2.20.

Alternatives: a `() -> Long` lambda would work but invents a project-local seam for something the standard library already defines; ktor's `getTimeMillis()` and kotlinx-datetime are rejected in the subsection below.

### Build vs. adopt: current-time source (clock)

- Repository: no clock abstraction or time call in `shared/src` (searched `auth/`, `account/`, `http/`). The installed dependency `io.ktor:ktor-client-core:3.3.1` exposes `ktor-utils` transitively (ktor-client-core `api(projects.ktorHttp)`, ktor-http `api(projects.ktorUtils)`), which offers `io.ktor.util.date.getTimeMillis()` at `ktor-utils/common/src/io/ktor/util/date/Date.kt:186` (tag 3.3.1). Rejected: it is a plain global function with no injectable seam, so tests cannot control time, and it would tie the auth check to the HTTP client library through a transitive dependency.
- Platform: `kotlin.time.Clock` / `Clock.System` in the Kotlin standard library since 2.1.20, experimental, opt-in via `@OptIn(ExperimentalTime::class)` (https://kotlinlang.org/docs/whatsnew2120.html). It is an interface, so a fixed test clock is possible.
- Candidates: not searched, covered above.
- Decision: adopt `kotlin.time.Clock` from the standard library, injected with `Clock.System` as the default.

### Expiry rule and boundary

A trial has ended when `plan == TRIAL`, `trialEndsAtMillis != null` and `now >= trialEndsAtMillis`. The end instant itself is outside the trial, because `trialEndsAt` names the moment the trial stops. Alternative `now > trialEndsAtMillis` grants one extra millisecond and reads as "ends after", which contradicts the field name.

### `TRIAL` account without a trial end signs in

A `TRIAL` account whose `trialEndsAtMillis` is `null` signs in as today. The proposal refuses only trials that have ended, and a missing end date does not show that. Refusing would lock users out over an API data gap that `Account.kt` says should not occur. Alternative (refuse, fail closed) is safer commercially but turns an API data fault into a lockout that users cannot fix.

### Check after the password check

The expiry check runs after `passwords.matches` succeeds. Returning `TrialEnded` before the password check would tell anyone holding an email address that the account exists and is an ended trial; after the check, only the account holder learns it. Alternative (check first, skip the password round-trip) saves one call but leaks account state.

### New result variant

`SignInResult` gains `data object TrialEnded`. It carries no payload; the proposal asks for refusal only, and the caller already knows which account it asked about.

## Risks / Trade-offs

- [Device clock is user-controlled; setting it back bypasses the check] → Accepted for this change (Non-Goals); real enforcement belongs on the server, which this repository does not contain.
- [`kotlin.time.Clock` is experimental and may change] → The opt-in is confined to `SignInService` and its test; one call site to adjust if the API changes.
- [Adding a variant to the sealed `SignInResult` breaks exhaustive `when` expressions in consumers] → No consumer exists in this repository; app modules outside it fail at compile time rather than silently, which is the desired signal. [INFERENCE: external consumers not visible here]
- [`TRIAL` with `null` end signs in] → Deliberate (see Decisions); revisit if the API is found to send `TRIAL` accounts without an end date.
