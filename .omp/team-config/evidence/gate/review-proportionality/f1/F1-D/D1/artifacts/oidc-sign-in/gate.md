# Gate

- **Mandatory class**: auth-secrets-pii
- **Risk tier**: product
- **Author's risk assessment**: A wrong sign-in or refresh locks users out, leaks tokens, or binds the app to an attacker's session (login CSRF). Tokens grant access to customer orders, so the change reaches a real credential and customer data: product tier, class auth-secrets-pii.
- **Whole-diff review**: needed
- **Accepted residual risks**: none (F1 fixture change)
- **Out of scope for blocking**: none (F1 fixture change)
