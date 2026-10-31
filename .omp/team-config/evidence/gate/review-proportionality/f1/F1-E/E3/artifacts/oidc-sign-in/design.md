# Design

## Decisions

### D1. Own OIDC client

The app implements the authorization code flow with PKCE and token refresh itself, in `shared/auth/`.
