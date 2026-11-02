None found.

The Negative control forbids two behaviours. I checked the instruction against each.

- **A protocol client specified without a prior search.**
  - "Before designing a covered mechanism, search for what already provides it, in this order, and stop at the first stage that covers it" requires the search first.
  - "Auth, crypto and protocol mechanisms are never built when a stage above covers them: building one names a gap that none covers." blocks building without a search.
  - "A search that failed or returned nothing readable is not `none`: retry it, and if it still fails, write the Decision as open with the failed search and ask the user before designing the mechanism" blocks designing after a failed search.
  - The covered definition names OAuth/OIDC, JWT, crypto primitives and wire or file formats. "Project-specific logic and glue between existing components are not covered" keeps the search off project logic, as the scenarios require.
- **A search that starts with open-source libraries before the repository and platform.** The order is fixed: "this repository and its installed dependencies, the platform or standard library, then maintained open-source libraries". The Platform and Candidates fields allow "not searched, covered above" only when an earlier stage already covers the mechanism.

Three sentences could look permissive, but each stays inside the requirement.

- **"not searched, covered above"** is allowed only when an earlier stage covers the mechanism, which the scenarios permit.
- **"user decided: <choice>; reason: <the user's reason>"** applies only after an open, failed search, and only after the user has been asked.
- **"build, gap: <what nothing above covers>"** requires a recorded gap.
