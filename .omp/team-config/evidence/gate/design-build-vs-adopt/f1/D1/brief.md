Requirement (quoted verbatim from a change's delta spec):

### Requirement: Covered mechanisms are researched before they are designed

The design instruction SHALL require a search before a mechanism the change introduces (one the changed code does not use today) is designed, when it implements a published protocol, format or algorithm, or general-purpose infrastructure not specific to the project's domain: the repository and its installed dependencies, then the platform or standard library, then maintained libraries, stopping at the first stage that covers it. Project-specific logic and glue SHALL need none.

#### Scenario: Protocol client is covered

- **WHEN** a design adds sign-in through OIDC authorization code with PKCE, token storage and token refresh
- **THEN** the planner searches for existing implementations before writing the design of those mechanisms, and `design.md` records the result

#### Scenario: Repository covers it

- **WHEN** a change needs token storage and the repository already has an encrypted key-value store that other code uses
- **THEN** the decision adopts that store with its `PATH:LINE` and records that no platform or library search was needed

#### Scenario: Platform covers it

- **WHEN** a JVM change needs a SHA-256 digest and the JDK provides one
- **THEN** the decision adopts the platform API and records that no library search was needed

#### Scenario: Project logic is not covered

- **WHEN** a design adds a domain-specific validation rule built from components the repository already has
- **THEN** the instruction requires no search and no `Build vs. adopt` decision for it

#### Scenario: Negative control

- **WHEN** an instruction lets a design specify a protocol client without a prior search, or lets the search start with open-source libraries before the repository and platform
- **THEN** review of that instruction MUST fail

Instruction text:

~~~~text
<input-a.md or input-b.md>
~~~~

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
