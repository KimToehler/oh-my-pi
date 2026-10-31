# Design

## Decisions

### D1. Session file

`src/session.ts` writes `{ accessToken, refreshToken, expiresAt }` as JSON to `~/.acme/session.json` with `Bun.write`, and reads it at the start of every command.

### D2. Refresh errors

When a refresh fails, `src/session.ts` appends the identity provider's full response and the request body to `~/.acme/acme.log` for support, then prints "run acme login".
