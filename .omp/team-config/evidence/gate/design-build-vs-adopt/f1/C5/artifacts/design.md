# Design

## Context

See proposal.md - Why. `SignInService.signIn` (`shared/src/commonMain/kotlin/auth/SignInService.kt:17`) checks the password and returns `SignedIn`; `SignInService` already takes the app's `AppClock` (`SignInService.kt:15`, `shared/src/commonMain/kotlin/time/AppClock.kt`); `Account` carries `plan` and `trialEndsAtMillis` (`shared/src/commonMain/kotlin/account/Account.kt:6`).

## Goals / Non-Goals

Goals: refuse ended trials at sign-in. Non-Goals: ending sessions of users already signed in, billing.

## Decisions

### D1. Check after the password

The trial check runs after the password matched, so an ended trial is only revealed to someone who knows the password. It compares `trialEndsAtMillis` with the injected `clock.nowMillis()`, so tests set the time through the existing `AppClock` parameter.

### D2. Result type

A new `SignInResult.TrialEnded` case; the UI maps it to the existing upgrade screen.

## Risks / Trade-offs

- [Device clock is wrong] → The API repeats the check on every request; the client check only spares a round trip.

## Migration Plan

Ship in the next release. Rollback: the previous release.
