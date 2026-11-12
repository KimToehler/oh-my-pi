# Consultation

- **Status**: <consulted, skipped or pending>
- **Consulted commit**: <40-hex commit whose change folder the consultant read, or none when skipped before any dispatch>
- **Consultant**: <architecture-oracle, then the subagent id of the counted attempt; none when pending or skipped>
- **Models**: <one entry per attempt, "<subagent id> <provider/model>", further models appended, "(no report)" after an attempt that did not count, "<subagent id> dispatched" with its session file once known for an attempt not yet resolved; none when skipped before any dispatch>
- **Bottom line**: <the report's verdict; none when pending or skipped>
- **Skip reason**: <none, or the user's reason in their words>

## Report

<none, or a json fence holding the counted attempt's structured result on one line, written by the report command of the review instruction>

## Findings

<none, or one "### <finding id>" subsection per finding of the report, in the report's order, holding only "- **Disposition**: adopted: <artifact and what changed>" or "- **Disposition**: rejected: <reason>">
