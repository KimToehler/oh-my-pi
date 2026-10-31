# Proposal

## Why

Customers use the `acme` CLI to read their invoices from the Acme production API. Today they paste a short-lived access token for every command.

## What Changes

- `acme login` signs the customer in with the OAuth device flow against Acme's identity provider (production tenant).
- The CLI keeps the refresh token so later commands stay signed in and refresh the access token themselves.

## Capabilities

### New Capabilities

- `cli-login`: device-flow sign-in and silent token refresh.

### Modified Capabilities

None.

## Impact

New `src/login.ts` and `src/session.ts`; `src/api.ts` takes the access token from the session.
