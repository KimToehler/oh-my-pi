# Spec Delta

## Purpose

Defines when an `omp-gated` design must look for an existing implementation before designing a mechanism, what its `Build vs. adopt` decision records, and how plan review checks it, so a plan does not build from scratch what the repository, the platform or a maintained library already provides.

## ADDED Requirements

### Requirement: Covered mechanisms are researched before they are designed

The design instruction SHALL require a search before a mechanism is designed when it implements a published protocol, format or algorithm, or general-purpose infrastructure not specific to the project's domain: first this repository and its installed dependencies, then the platform or standard library, then maintained open-source libraries. Project-specific logic and glue between existing components SHALL need no search.

#### Scenario: Protocol client is covered

- **WHEN** a design adds sign-in through OIDC authorization code with PKCE, token storage and token refresh
- **THEN** the planner searches for existing implementations before writing the design of those mechanisms, and `design.md` records the result

#### Scenario: Project logic is not covered

- **WHEN** a design adds a domain-specific validation rule built from components the repository already has
- **THEN** the instruction requires no search and no `Build vs. adopt` decision for it

#### Scenario: Negative control

- **WHEN** an instruction lets a design specify a protocol client without a prior search, or lets the search start with open-source libraries before the repository and platform
- **THEN** review of that instruction MUST fail

### Requirement: A covered mechanism brings design.md

The design instruction SHALL list building a covered mechanism as a reason to create `design.md`, even when the change stays inside one module and meets no other reason.

#### Scenario: Single-module format parser

- **WHEN** a change inside one module parses a published file format and meets no other reason for `design.md`
- **THEN** the planner creates `design.md` with a `Build vs. adopt` decision for the parser

#### Scenario: Negative control

- **WHEN** the reasons for `design.md` omit covered mechanisms, so a single-module parser change skips `design.md`
- **THEN** review of that instruction MUST fail

### Requirement: Decision content

Each covered mechanism SHALL get one `### Build vs. adopt: <mechanism>` subsection under Decisions recording what the repository and its dependencies offer with `PATH:LINE`, what the platform offers with a documentation URL, `none` with the searches where nothing was found, per library candidate its URL, newest release and date, licence, maintenance state and verdict, and a decision. A build or reject verdict SHALL name its gap.

#### Scenario: Partial coverage

- **WHEN** the only maintained candidate covers Android and iOS and the change also targets desktop
- **THEN** the decision names the desktop gap and states which part is adopted and which is built

#### Scenario: Nothing found

- **WHEN** no repository code, platform API or library covers the mechanism
- **THEN** the decision records what was searched where, and the decision is build with the gap

#### Scenario: Negative control

- **WHEN** a decision rejects a candidate without a gap, or lists a candidate without its newest release and date
- **THEN** the correctness lens review of that design MUST fail with REJECT

### Requirement: Auth, crypto and protocol mechanisms adopt by default

The design instruction SHALL require a covered auth, crypto or protocol mechanism to adopt a maintained library unless its decision names a gap that no candidate covers.

#### Scenario: Maintained library exists

- **WHEN** a design needs an OIDC authorization-code client and a maintained library covers the change's targets
- **THEN** the decision adopts that library

#### Scenario: Negative control

- **WHEN** a design builds its own OIDC client while a maintained candidate covers the targets and the decision names no gap
- **THEN** review of that design MUST fail

### Requirement: Research uses keyless session tools

The design instruction SHALL name research tools an omp session already has: `web_search` for discovery, `read` on repository, registry and documentation URLs, and `read` on the deps.dev package endpoint for release history. It SHALL require no API key, MCP server or quota-limited service.

#### Scenario: Keyless release history

- **WHEN** a planner reads the deps.dev package endpoint the instruction names, for a found Maven library, in a session without any API key or MCP server
- **THEN** the response lists every version of the library with its publish date

#### Scenario: Negative control

- **WHEN** the instruction requires an MCP tool, an API key or a quota-limited service such as Context7
- **THEN** review of that instruction MUST fail

### Requirement: Plan review checks the decision

The plan review's correctness lens SHALL read the `Build vs. adopt` rule from the project's `omp-gated` schema and SHALL return a blocker when the plan builds a covered mechanism without its decision in `design.md`, when a decision lacks a line or candidate fact the form asks for, or when a build or reject verdict names no gap. A complete decision SHALL produce no such blocker.

#### Scenario: Complete decision passes

- **WHEN** the design adopts a maintained OIDC library through a complete `Build vs. adopt` decision
- **THEN** the correctness lens returns no blocker about that decision

#### Scenario: Negative control

- **WHEN** a plan hand-builds OIDC with PKCE without a `Build vs. adopt` decision, or rejects every candidate without naming a gap
- **THEN** the correctness lens review MUST fail with REJECT and a blocker naming the missing decision or the missing gap
