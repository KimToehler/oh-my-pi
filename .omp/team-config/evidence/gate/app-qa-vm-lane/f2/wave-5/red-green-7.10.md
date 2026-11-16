# RED and GREEN for row 7.10

Head `b3f59008cc035269be9a9af2c1347763041cda07` plus the uncommitted 7.10 change. GREEN runs the changed qa.test.mjs against the changed driver. RED runs the same tests with `QA_UNDER_TEST` naming the head's driver (`git archive` of `b3f59008cc` to `/tmp/aqvl/pre7`; its qa.mjs compared byte-equal to `HEAD:team-config/agent/skills/app-qa-drivers/scripts/qa.mjs`; `vm/` unchanged by 7.10).

```
$ node --test --test-name-pattern='route: turn|route: flowlock' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs
✔ route: flowlock - two routed flows started together in one lease run one after the other: the second waits for the first by name, and the guest's one flow lock refuses neither (7369.654917ms)
✔ route: turn - a routed flow waits while another routed flow holds the host's flow turn, runs once that holder is gone, and releases the turn; a routed preflight does not wait (6565.449125ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
[exit 0]

$ QA_UNDER_TEST=/tmp/aqvl/pre7/team-config/agent/skills/app-qa-drivers/scripts/qa.mjs node --test --test-name-pattern='route: turn|route: flowlock' team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs
✖ route: flowlock - two routed flows started together in one lease run one after the other: the second waits for the first by name, and the guest's one flow lock refuses neither (4647.154417ms)
✖ route: turn - a routed flow waits while another routed flow holds the host's flow turn, runs once that holder is gone, and releases the turn; a routed preflight does not wait (4285.729292ms)
ℹ tests 2
ℹ pass 0
ℹ fail 2
  AssertionError [ERR_ASSERTION]: lane: flow ios runs in app-qa-slot-1 (slot 1)
  AssertionError [ERR_ASSERTION]: the flow ran while another routed flow held the turn
[exit 1]
```

Full file after 7.10: `node --test team-config/agent/skills/app-qa-drivers/scripts/qa.test.mjs`

```
ℹ tests 225
ℹ pass 225
ℹ fail 0
exit 0
```
