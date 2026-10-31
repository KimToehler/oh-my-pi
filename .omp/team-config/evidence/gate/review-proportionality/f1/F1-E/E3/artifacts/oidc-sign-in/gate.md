# Gate

- **Mandatory class**: auth-secrets-pii
- **Risk tier**: product
- **Author's risk assessment**: A wrong sign-in or refresh locks users out or leaks tokens; tokens grant access to customer orders.
- **Whole-diff review**: not needed (one module, `shared/auth/`, and one line in `shared/http/Client.kt`)
- **Accepted residual risks**: none (F1 fixture change)
- **Out of scope for blocking**: none (F1 fixture change)
