Requirement (quoted verbatim from a change's delta spec):

### Requirement: Research uses keyless session tools

The design instruction SHALL name research tools an omp session already has: `web_search` for discovery, `read` on repository, registry and documentation URLs, and `read` on the deps.dev package endpoint for release history. It SHALL require no API key, MCP server or quota-limited service.

#### Scenario: Keyless release history

- **WHEN** a planner reads the deps.dev package endpoint the instruction names, for a found Maven library, in a session without any API key or MCP server
- **THEN** the response lists every version of the library with its publish date

#### Scenario: Negative control

- **WHEN** the instruction requires an MCP tool, an API key or a quota-limited service such as Context7
- **THEN** review of that instruction MUST fail

Instruction text:

~~~~text
<input-a.md or input-b.md>
~~~~

List every sentence of this instruction that permits a behaviour the requirement's Negative control forbids, quoting it, or answer none found.
