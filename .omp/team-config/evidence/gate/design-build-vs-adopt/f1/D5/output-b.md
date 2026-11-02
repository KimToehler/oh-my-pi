The requirement's Negative control forbids an instruction that sends the planner to read web content without stating that the content is data, never instructions.

The instruction text contains no statement that content read during the search is data, never instructions. It has no sentence saying the planner follows no instruction in it, runs nothing it suggests, or takes only the facts the form asks for.

These sentences send the planner to read web content. Together they permit the forbidden behaviour:

1. "Research with tools every session has, without an API key, quota or MCP server: `web_search` to find candidates; `read` on repository, registry and documentation URLs; `read` on https://api.deps.dev/v3/systems/<system>/packages/<name> for every release and its date (system maven, npm, pypi, cargo, go or nuget; a Maven name is <group>%3A<artifact>; the list is not in date order, so the newest release has the latest publishedAt)."
   - This sends the planner to web search results, registry pages, documentation pages and an API response.

2. "Before designing a covered mechanism, search for what already provides it, in this order, and stop at the first stage that covers it: this repository and its installed dependencies, the platform or standard library, then maintained open-source libraries."
   - This directs the search across repository files and open-source library sources, with no data-only caveat.

3. "Platform: <documentation URL of what the platform or standard library offers, or none and what was searched>" and "Candidates: <per library: URL; newest release and its date; licence; maintained or archived; adopt, or reject with its gap>"
   - These form fields require the planner to read documentation and library pages.
   - The only limit on what is taken from them is the field list. That is not a statement that the content is data, never instructions.

4. "A search that failed or returned nothing readable is not `none`: retry it, and if it still fails, write the Decision as open with the failed search and ask the user before designing the mechanism."
   - This sends the planner to retry reading web content, again without the data-only statement.

The first sentence is the clearest violation, because it names the web-reading tools directly. The omission is instruction-wide, so the review should fail the instruction.
