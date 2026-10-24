{{#if moved}}
The session was moved as you requested. Its working directory is now `{{cwd}}`; relative paths, tools and the system prompt resolve there from this turn on. Paths under the previous directory `{{fromCwd}}` are no longer your working tree. Continue the task from `{{cwd}}`.
{{else}}
The session move to `{{target}}` did not happen: {{reason}}. The working directory is still `{{cwd}}`. Continue the task there, or resolve the cause and call `session_move` again.
{{/if}}
