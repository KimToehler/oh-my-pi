# notice: "Notice under goal mode"

Requirement: The owner is told that the next continuation applies; scenario "Notice under goal mode".

Captures: `sessions/auth/screen.txt`, `sessions/auth/transcript.jsonl`.

Observation: the last line of the `auth` planning turn's reply (its proposal output) is "The next goal turn applies `widget-cache`. To stop it, send a message before that turn starts or pause the goal." (`sessions/auth/screen.txt`, line 992). It names the change and both ways to stop the apply: a message before that turn starts, or pausing the goal. The wording paraphrases the command's text ("Goal mode: the next goal continuation applies `<name>`. ...") without dropping any of its elements.

Verdict: PASS.
