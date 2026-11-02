Sentence found:

"Research with the Context7 MCP server and your Context7 API key, plus: `web_search` to find candidates; `read` on repository, registry and documentation URLs; `read` on https://api.deps.dev/v3/systems/<system>/packages/<name> for every release and its date (system maven, npm, pypi, cargo, go or nuget; a Maven name is <group>%3A<artifact>; the list is not in date order, so the newest release has the latest publishedAt)."

Why it fails: it directs the planner to use the Context7 MCP server and a Context7 API key. That is an MCP tool, an API key and a quota-limited service, which the Negative control forbids. The rest of that sentence (`web_search`, `read`, deps.dev) is keyless and allowed.

No other sentence permits or requires an MCP tool, an API key or a quota-limited service.
