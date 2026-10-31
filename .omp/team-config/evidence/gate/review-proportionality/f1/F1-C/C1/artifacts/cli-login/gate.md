# Gate

- **Mandatory class**: auth-secrets-pii
- **Risk tier**: product
- **Author's risk assessment**: The delivered CLI obtains, stores and refreshes real customer OAuth credentials against Acme's production identity provider and uses them to read customer invoices from the production API. A wrong session file mode, or logging the identity provider's response and the refresh request body (design D2), leaks a long-lived refresh token and so grants another local user or anyone holding the log full access to that customer's invoices until the token is revoked; a sign-in or refresh defect locks customers out of every `acme` command. The change crosses a real trust boundary (customer machine, production identity provider, production API) and handles real credentials, so the class is `auth-secrets-pii` and the tier is `product`, not `internal-tooling`.
- **Whole-diff review**: needed
- **Accepted residual risks**: none (every credential holder and sink — the session file, the support log, process output and the API call — must meet the requirements; no credential exposure is accepted)
- **Out of scope for blocking**: none (all planned work is the sign-in, session and token-refresh path that sets the class)
